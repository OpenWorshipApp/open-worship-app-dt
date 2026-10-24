import dgram from 'node:dgram';
import tls from 'node:tls';

import { isMirrorLanAddress } from './screenMirrorProtocol';
import {
    CAST_NAMESPACE,
    CAST_RECEIVER_ID,
    CAST_SENDER_ID,
    CastFrameReader,
    DEFAULT_MEDIA_RECEIVER,
    DLNA_RENDERER_TARGET,
    GOOGLE_CAST_SERVICE,
    MAX_CAST_TARGETS,
    ROKU_PORT,
    ROKU_TARGET,
    buildDlnaMetadata,
    buildMdnsQuery,
    encodeCastMessage,
    readDlnaRenderer,
    readGoogleCastAnswer,
    readRokuDevice,
    readSsdpAnswer,
    toCastLoadPayload,
    toRokuPlayUrl,
    toRokuStopUrl,
    type CastTarget,
} from './castProtocol';
import {
    UpnpSoapError,
    checkIsDeviceUrl,
    listLocalIpv4s,
    sendSsdpSearch,
    upnpRequest,
    upnpSoap,
} from './upnpHelpers';

// Finding TVs on this network (asked for only while the operator looks for
// one) and casting a virtual display's MP4 to one. See `castProtocol.ts`.

const MDNS_ADDRESS = '224.0.0.251';
const MDNS_PORT = 5353;
const MAX_PACKET = 9000;
const MAX_DESCRIPTIONS = 16;
// How long a Google Cast TV gets to open its player and start the stream.
const CAST_START_TIMEOUT_MILLISECOND = 20_000;
const CAST_HEARTBEAT_MILLISECOND = 5_000;
// How far behind live a Google Cast TV is let play. It buffers ~3 s before it
// plays and never catches up on its own (7 s on a TV before the stream had
// no holes); played a little faster it does -- but one let down to ~1 s runs
// dry and stalls. Measured on a TV with Chromecast built in, 2026-10-08.
const CATCH_UP_TARGET_SECOND = 1.4;
const CATCH_UP_START_MARGIN_SECOND = 0.6;
const CATCH_UP_MAX_TARGET_SECOND = 3;
const CATCH_UP_RATE = 1.2;
// How often the TV is asked where it is.
const MEDIA_STATUS_MILLISECOND = 2_000;
// A stream that ended on the TV (its player went idle: the compositor
// restarted, the network blinked) is loaded again, at most this many times.
const MAX_RELOADS = 3;
const RELOAD_DELAY_MILLISECOND = 1_000;

export type CastFailureType = 'unreachable' | 'refused' | 'timeout' | 'ended';
export type CastSessionHooksType = {
    // The TV took the stream.
    onCasting: () => void;
    // The TV stopped (its remote, another app taking it) or never started.
    onEnded: (failure: CastFailureType | null) => void;
    // Where the stream is now, in seconds of its own timeline: a TV that
    // falls behind it is played faster until it is close again.
    getLiveTime?: () => number | null;
    // How far behind live the TV plays, and how fast, as it reports.
    onBehind?: (seconds: number, playbackRate: number) => void;
};
export type CastSessionType = { stop: () => void };

// Every TV that answered within `timeout`: Google Cast over mDNS, DLNA
// renderers and Rokus over SSDP. Searched out of every network card.
export function discoverCastTargets(timeout = 3000) {
    return new Promise<CastTarget[]>((resolve) => {
        const found = new Map<string, CastTarget>();
        const add = (target: CastTarget) => {
            if (found.size < MAX_CAST_TARGETS && !found.has(target.id)) {
                found.set(target.id, target);
            }
        };
        const pending: Promise<void>[] = [];
        const seenLocations = new Set<string>();
        const mdns = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const ssdp = dgram.createSocket('udp4');
        mdns.on('error', () => {});
        ssdp.on('error', () => {});
        mdns.on('message', (packet, info) => {
            if (
                packet.length > MAX_PACKET ||
                !isMirrorLanAddress(info.address)
            ) {
                return;
            }
            for (const target of readGoogleCastAnswer(packet, info.address)) {
                add(target);
            }
        });
        ssdp.on('message', (packet, info) => {
            if (
                packet.length > MAX_PACKET ||
                !isMirrorLanAddress(info.address)
            ) {
                return;
            }
            const answer = readSsdpAnswer(packet.toString());
            if (
                answer === null ||
                seenLocations.has(answer.location) ||
                seenLocations.size >= MAX_DESCRIPTIONS ||
                !checkIsDeviceUrl(answer.location, info.address)
            ) {
                return;
            }
            seenLocations.add(answer.location);
            const isRoku =
                answer.target === ROKU_TARGET || /roku/i.test(answer.server);
            pending.push(
                upnpRequest(answer.location, { timeout: 2500 })
                    .then((response) => {
                        if (response.status !== 200) {
                            return;
                        }
                        if (isRoku) {
                            const device = readRokuDevice(
                                response.body,
                                info.address,
                            );
                            add({
                                ...device,
                                kind: 'roku',
                                host: info.address,
                                port:
                                    Number(new URL(answer.location).port) ||
                                    ROKU_PORT,
                            });
                            return;
                        }
                        const renderer = readDlnaRenderer(
                            response.body,
                            answer.location,
                        );
                        if (renderer !== null) {
                            add({
                                ...renderer,
                                kind: 'dlna',
                                host: info.address,
                                port:
                                    Number(new URL(answer.location).port) || 80,
                            });
                        }
                    })
                    .catch(() => {}),
            );
        });
        const addresses = listLocalIpv4s();
        const sendAll = async () => {
            for (const address of addresses.length ? addresses : [undefined]) {
                try {
                    if (address) mdns.setMulticastInterface(address);
                    mdns.send(
                        buildMdnsQuery(GOOGLE_CAST_SERVICE),
                        MDNS_PORT,
                        MDNS_ADDRESS,
                    );
                } catch {}
                await sendSsdpSearch(
                    ssdp,
                    [DLNA_RENDERER_TARGET, ROKU_TARGET],
                    address,
                );
            }
        };
        let bound = 0;
        const onBound = () => {
            if (++bound < 2) return;
            void sendAll();
            // Asked twice: a packet on a busy network can go missing.
            setTimeout(() => void sendAll(), 1000);
        };
        mdns.bind(0, onBound);
        ssdp.bind(0, onBound);
        setTimeout(() => {
            for (const socket of [mdns, ssdp]) {
                try {
                    socket.close();
                } catch {}
            }
            void Promise.all(pending).then(() => {
                resolve(
                    [...found.values()].sort((a, b) => {
                        return a.name.localeCompare(b.name);
                    }),
                );
            });
        }, timeout);
    });
}

// This computer's address facing `host`: what the OS would send from. A UDP
// "connection" sends nothing; it only picks the route.
export function findLocalAddressFor(host: string) {
    return new Promise<string>((resolve) => {
        const socket = dgram.createSocket('udp4');
        const done = (address: string) => {
            try {
                socket.close();
            } catch {}
            resolve(address);
        };
        socket.on('error', () => done(''));
        socket.connect(9, host, () => {
            try {
                done(socket.address().address);
            } catch {
                done('');
            }
        });
    });
}

// -- Google Cast ---------------------------------------------------------------

class GoogleCastSession implements CastSessionType {
    private socket: tls.TLSSocket | null = null;
    private reader = new CastFrameReader();
    private requestId = 0;
    private heartbeat: ReturnType<typeof setInterval> | undefined;
    private startTimer: ReturnType<typeof setTimeout> | undefined;
    private transportId = '';
    private sessionId = '';
    private isCasting = false;
    private isOver = false;
    // The TV's media session our LOAD made: told apart from one that was
    // playing there before (it goes idle, INTERRUPTED, as ours replaces it).
    private mediaSessionId: number | null = null;
    private loadRequestId = 0;
    private statusTimer: ReturnType<typeof setInterval> | undefined;
    private playbackRate = 1;
    private behindTarget = CATCH_UP_TARGET_SECOND;
    private reloads = 0;

    constructor(
        target: CastTarget,
        private readonly url: string,
        private readonly title: string,
        private readonly hooks: CastSessionHooksType,
    ) {
        // A Cast device signs its own certificate: there is no authority to
        // check it against. Only an address on this network is ever dialed,
        // and all it is handed is the stream's address.
        const socket = tls.connect({
            host: target.host,
            port: target.port,
            rejectUnauthorized: false,
        });
        this.socket = socket;
        socket.setTimeout(CAST_START_TIMEOUT_MILLISECOND);
        socket.on('timeout', () => this.end('timeout'));
        socket.on('error', () => {
            this.end(this.isCasting ? 'ended' : 'unreachable');
        });
        socket.on('close', () =>
            this.end(this.isCasting ? null : 'unreachable'),
        );
        socket.on('secureConnect', () => {
            socket.setTimeout(0);
            this.send(CAST_RECEIVER_ID, CAST_NAMESPACE.connection, {
                type: 'CONNECT',
            });
            this.heartbeat = setInterval(() => {
                this.send(CAST_RECEIVER_ID, CAST_NAMESPACE.heartbeat, {
                    type: 'PING',
                });
            }, CAST_HEARTBEAT_MILLISECOND);
            this.send(CAST_RECEIVER_ID, CAST_NAMESPACE.receiver, {
                type: 'LAUNCH',
                appId: DEFAULT_MEDIA_RECEIVER,
                requestId: ++this.requestId,
            });
        });
        socket.on('data', (chunk: Buffer) => {
            try {
                for (const message of this.reader.push(chunk)) {
                    this.receive(
                        message.sourceId,
                        message.namespace,
                        message.payload,
                    );
                }
            } catch {
                this.end('refused');
            }
        });
        this.startTimer = setTimeout(() => {
            if (!this.isCasting) this.end('timeout');
        }, CAST_START_TIMEOUT_MILLISECOND);
    }

    private send(destinationId: string, namespace: string, payload: object) {
        if (this.socket === null || this.socket.destroyed) {
            return;
        }
        this.socket.write(
            encodeCastMessage({
                sourceId: CAST_SENDER_ID,
                destinationId,
                namespace,
                payload: JSON.stringify(payload),
            }),
        );
    }

    private receive(sourceId: string, namespace: string, text: string) {
        let payload: any;
        try {
            payload = JSON.parse(text);
        } catch {
            return;
        }
        const type = payload?.type;
        if (namespace === CAST_NAMESPACE.heartbeat && type === 'PING') {
            this.send(sourceId, CAST_NAMESPACE.heartbeat, { type: 'PONG' });
        } else if (namespace === CAST_NAMESPACE.receiver) {
            if (type === 'LAUNCH_ERROR') {
                this.end('refused');
            } else if (type === 'RECEIVER_STATUS') {
                this.receiveStatus(payload.status);
            }
        } else if (namespace === CAST_NAMESPACE.media) {
            if (
                type === 'LOAD_FAILED' ||
                type === 'LOAD_CANCELLED' ||
                type === 'INVALID_REQUEST'
            ) {
                this.end('refused');
            } else if (type === 'MEDIA_STATUS') {
                this.receiveMediaStatus(
                    Array.isArray(payload.status) ? payload.status : [],
                    payload.requestId === this.loadRequestId,
                );
            }
        } else if (
            namespace === CAST_NAMESPACE.connection &&
            type === 'CLOSE' &&
            sourceId === this.transportId
        ) {
            this.end(this.isCasting ? null : 'refused');
        }
    }

    // Only our own media session counts: the answer to our LOAD names it,
    // else the first one that is not idle after it.
    private receiveMediaStatus(statuses: any[], isLoadAnswer: boolean) {
        if (this.mediaSessionId === null) {
            const ours = statuses.find((status) => {
                return (
                    typeof status?.mediaSessionId === 'number' &&
                    (isLoadAnswer || status.playerState !== 'IDLE')
                );
            });
            if (ours === undefined) {
                return;
            }
            this.mediaSessionId = ours.mediaSessionId;
        }
        const status = statuses.find((item) => {
            return item?.mediaSessionId === this.mediaSessionId;
        });
        if (status === undefined) {
            return;
        }
        if (status.playerState === 'IDLE' && status.idleReason) {
            this.receiveIdle(status.idleReason);
            return;
        }
        if (!this.isCasting) {
            this.isCasting = true;
            clearTimeout(this.startTimer);
            this.statusTimer = setInterval(() => {
                this.send(this.transportId, CAST_NAMESPACE.media, {
                    type: 'GET_STATUS',
                    requestId: ++this.requestId,
                });
            }, MEDIA_STATUS_MILLISECOND);
            this.hooks.onCasting();
        }
        this.steer(status);
    }

    private toLoad() {
        this.loadRequestId = ++this.requestId;
        return toCastLoadPayload(this.loadRequestId, this.url, this.title);
    }

    // The player went idle. Stopped on the TV, or something else played: the
    // cast is over. The stream ended or broke: it is live, so it is loaded
    // again -- a few times, then it is given up on.
    private receiveIdle(reason: string) {
        if (reason === 'CANCELLED' || reason === 'INTERRUPTED') {
            this.end(null);
            return;
        }
        if (!this.isCasting || this.reloads >= MAX_RELOADS) {
            this.end(this.isCasting ? 'ended' : 'refused');
            return;
        }
        this.reloads++;
        this.mediaSessionId = null;
        this.playbackRate = 1;
        setTimeout(() => {
            if (!this.isOver) {
                this.send(
                    this.transportId,
                    CAST_NAMESPACE.media,
                    this.toLoad(),
                );
            }
        }, RELOAD_DELAY_MILLISECOND);
    }

    // Faster while too far behind live, back to normal once close; a TV
    // that runs dry on the way is slowed at once and kept further behind.
    private steer(status: any) {
        const live = this.hooks.getLiveTime?.() ?? null;
        if (
            live === null ||
            this.mediaSessionId === null ||
            typeof status.currentTime !== 'number'
        ) {
            return;
        }
        const behind = live - status.currentTime;
        // Not this stream's timeline (it restarted): nothing to go by.
        if (!(behind >= 0 && behind <= 30)) {
            return;
        }
        if (status.playerState === 'BUFFERING') {
            if (this.playbackRate !== 1) {
                this.setPlaybackRate(1);
                this.behindTarget = Math.min(
                    this.behindTarget + 0.3,
                    CATCH_UP_MAX_TARGET_SECOND,
                );
            }
            this.hooks.onBehind?.(behind, this.playbackRate);
            return;
        }
        if (status.playerState !== 'PLAYING') {
            return;
        }
        if (
            this.playbackRate === 1 &&
            behind > this.behindTarget + CATCH_UP_START_MARGIN_SECOND
        ) {
            this.setPlaybackRate(CATCH_UP_RATE);
        } else if (this.playbackRate !== 1 && behind <= this.behindTarget) {
            this.setPlaybackRate(1);
        }
        this.hooks.onBehind?.(behind, this.playbackRate);
    }

    private setPlaybackRate(playbackRate: number) {
        this.playbackRate = playbackRate;
        this.send(this.transportId, CAST_NAMESPACE.media, {
            type: 'SET_PLAYBACK_RATE',
            mediaSessionId: this.mediaSessionId,
            playbackRate,
            requestId: ++this.requestId,
        });
    }

    private receiveStatus(status: any) {
        const applications: any[] = Array.isArray(status?.applications)
            ? status.applications
            : [];
        const player = applications.find((application) => {
            return application?.appId === DEFAULT_MEDIA_RECEIVER;
        });
        if (this.transportId === '') {
            if (
                typeof player?.transportId !== 'string' ||
                typeof player?.sessionId !== 'string'
            ) {
                return;
            }
            this.transportId = player.transportId;
            this.sessionId = player.sessionId;
            this.send(this.transportId, CAST_NAMESPACE.connection, {
                type: 'CONNECT',
            });
            this.send(this.transportId, CAST_NAMESPACE.media, this.toLoad());
        } else if (player?.sessionId !== this.sessionId) {
            // Stopped on the TV, or another phone cast over it.
            this.end(this.isCasting ? null : 'refused');
        }
    }

    private end(failure: CastFailureType | null) {
        if (this.isOver) {
            return;
        }
        this.isOver = true;
        clearInterval(this.heartbeat);
        clearInterval(this.statusTimer);
        clearTimeout(this.startTimer);
        this.socket?.destroy();
        this.socket = null;
        this.hooks.onEnded(failure);
    }

    stop() {
        if (this.isOver) {
            return;
        }
        if (this.sessionId) {
            this.send(CAST_RECEIVER_ID, CAST_NAMESPACE.receiver, {
                type: 'STOP',
                sessionId: this.sessionId,
                requestId: ++this.requestId,
            });
        }
        const socket = this.socket;
        this.isOver = true;
        clearInterval(this.heartbeat);
        clearInterval(this.statusTimer);
        clearTimeout(this.startTimer);
        this.socket = null;
        // The STOP goes out before the socket closes.
        socket?.end();
    }
}

// -- DLNA and Roku -------------------------------------------------------------

function startDlnaCast(
    target: CastTarget,
    url: string,
    title: string,
    hooks: CastSessionHooksType,
): CastSessionType {
    const { controlUrl, serviceType } = target;
    let isStopped = false;
    void (async () => {
        if (!controlUrl || !serviceType) {
            hooks.onEnded('refused');
            return;
        }
        // Whatever it is playing first stops; some renderers refuse a new
        // address while busy. Its "no" here is not a failure.
        await upnpSoap(controlUrl, serviceType, 'Stop', [
            ['InstanceID', 0],
        ]).catch(() => {});
        await upnpSoap(controlUrl, serviceType, 'SetAVTransportURI', [
            ['InstanceID', 0],
            ['CurrentURI', url],
            ['CurrentURIMetaData', buildDlnaMetadata(title, url)],
        ]);
        await upnpSoap(controlUrl, serviceType, 'Play', [
            ['InstanceID', 0],
            ['Speed', 1],
        ]);
        if (!isStopped) hooks.onCasting();
    })().catch((error) => {
        if (!isStopped) {
            // The TV answered no, or could not be reached at all.
            hooks.onEnded(
                error instanceof UpnpSoapError ? 'refused' : 'unreachable',
            );
        }
    });
    return {
        stop: () => {
            isStopped = true;
            if (controlUrl && serviceType) {
                void upnpSoap(controlUrl, serviceType, 'Stop', [
                    ['InstanceID', 0],
                ]).catch(() => {});
            }
        },
    };
}

function startRokuCast(
    target: CastTarget,
    url: string,
    title: string,
    hooks: CastSessionHooksType,
): CastSessionType {
    let isStopped = false;
    upnpRequest(toRokuPlayUrl(target, url, title), {
        method: 'POST',
        body: '',
    }).then(
        (response) => {
            if (isStopped) return;
            if (response.status === 200) {
                hooks.onCasting();
            } else {
                hooks.onEnded('refused');
            }
        },
        () => {
            if (!isStopped) hooks.onEnded('unreachable');
        },
    );
    return {
        stop: () => {
            isStopped = true;
            void upnpRequest(toRokuStopUrl(target), {
                method: 'POST',
                body: '',
            }).catch(() => {});
        },
    };
}

// Cast to `target`: the stream's address is made from this computer's
// address facing that TV (`toUrl`), so a computer on a VPN as well still
// hands it one the TV can reach.
export async function startCastSession(
    target: CastTarget,
    toUrl: (localAddress: string) => string,
    title: string,
    hooks: CastSessionHooksType,
): Promise<CastSessionType> {
    const localAddress = await findLocalAddressFor(target.host);
    if (!localAddress) {
        hooks.onEnded('unreachable');
        return { stop: () => {} };
    }
    const url = toUrl(localAddress);
    if (target.kind === 'google-cast') {
        return new GoogleCastSession(target, url, title, hooks);
    }
    if (target.kind === 'dlna') {
        return startDlnaCast(target, url, title, hooks);
    }
    return startRokuCast(target, url, title, hooks);
}
