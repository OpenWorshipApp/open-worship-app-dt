import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';

// A Google Cast TV on a stand-in TLS socket: what the session writes is read
// back as frames, and the test answers as the TV would.
const tlsState = vi.hoisted(() => ({ sockets: [] as any[] }));
vi.mock('node:tls', async () => {
    const { EventEmitter: Emitter } = await import('node:events');
    class FakeTlsSocket extends Emitter {
        written: Buffer[] = [];
        destroyed = false;
        isEnded = false;
        options: Record<string, unknown>;
        constructor(options: Record<string, unknown>) {
            super();
            this.options = options;
        }
        setTimeout() {}
        write(data: Buffer) {
            this.written.push(data);
            return true;
        }
        destroy() {
            this.destroyed = true;
        }
        end() {
            this.isEnded = true;
        }
    }
    const connect = (options: Record<string, unknown>) => {
        const socket = new FakeTlsSocket(options);
        tlsState.sockets.push(socket);
        return socket;
    };
    return { default: { connect }, connect };
});

import {
    CAST_NAMESPACE,
    CastFrameReader,
    encodeCastMessage,
    type CastTarget,
} from './castProtocol';
import { findLocalAddressFor, startCastSession } from './castTargets';

function sent(socket: any) {
    const reader = new CastFrameReader();
    return socket.written
        .flatMap((chunk: Buffer) => reader.push(chunk))
        .map((message: any) => ({
            ...message,
            payload: JSON.parse(message.payload),
        }));
}

function reply(
    socket: any,
    sourceId: string,
    namespace: string,
    payload: object,
) {
    socket.emit(
        'data',
        encodeCastMessage({
            sourceId,
            destinationId: 'sender-0',
            namespace,
            payload: JSON.stringify(payload),
        }),
    );
}

const URL_FOR = (localAddress: string) =>
    `http://${localAddress}:39240/vd/1/video`;

afterEach(() => {
    tlsState.sockets.length = 0;
    vi.useRealTimers();
});

test('the address facing a TV is the one the OS would send from', async () => {
    expect(await findLocalAddressFor('127.0.0.1')).toBe('127.0.0.1');
});

describe('Google Cast', () => {
    const target: CastTarget = {
        id: 'google-cast:abc',
        kind: 'google-cast',
        name: 'Living Room TV',
        host: '127.0.0.1',
        port: 8009,
    };

    test('opens the media player, loads the stream, and says when it plays', async () => {
        const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
        const session = await startCastSession(target, URL_FOR, 'Lobby', hooks);
        const [socket] = tlsState.sockets;
        // A self-signed TV certificate: nothing to check it against.
        expect(socket.options).toMatchObject({
            host: '127.0.0.1',
            port: 8009,
            rejectUnauthorized: false,
        });
        socket.emit('secureConnect');
        expect(
            sent(socket).map(({ namespace, payload }: any) => [
                namespace,
                payload.type,
            ]),
        ).toEqual([
            [CAST_NAMESPACE.connection, 'CONNECT'],
            [CAST_NAMESPACE.receiver, 'LAUNCH'],
        ]);
        expect(sent(socket)[1].payload.appId).toBe('CC1AD845');

        // The TV pings; it is answered.
        reply(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, { type: 'PING' });
        expect(sent(socket).at(-1).payload).toEqual({ type: 'PONG' });

        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'RECEIVER_STATUS',
            status: {
                applications: [
                    {
                        appId: 'CC1AD845',
                        sessionId: 'session-1',
                        transportId: 'transport-1',
                    },
                ],
            },
        });
        const [connect, load] = sent(socket).slice(-2);
        expect(connect).toMatchObject({
            destinationId: 'transport-1',
            payload: { type: 'CONNECT' },
        });
        expect(load.destinationId).toBe('transport-1');
        expect(load.payload.media).toMatchObject({
            contentId: 'http://127.0.0.1:39240/vd/1/video',
            contentType: 'video/mp4',
            streamType: 'LIVE',
            metadata: { title: 'Lobby' },
        });
        expect(hooks.onCasting).not.toHaveBeenCalled();
        reply(socket, 'transport-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [{ mediaSessionId: 1, playerState: 'BUFFERING' }],
        });
        expect(hooks.onCasting).toHaveBeenCalledTimes(1);

        // Stopped here: the TV is told, and the socket closes after it.
        session.stop();
        expect(sent(socket).at(-1)).toMatchObject({
            destinationId: 'receiver-0',
            payload: { type: 'STOP', sessionId: 'session-1' },
        });
        expect(socket.isEnded).toBe(true);
        socket.emit('close');
        expect(hooks.onEnded).not.toHaveBeenCalled();
    });

    test('ends when the TV plays something else, and when it refuses', async () => {
        const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
        await startCastSession(target, URL_FOR, 'Lobby', hooks);
        const [socket] = tlsState.sockets;
        socket.emit('secureConnect');
        const status = (sessionId: string) => ({
            type: 'RECEIVER_STATUS',
            status: {
                applications: [
                    { appId: 'CC1AD845', sessionId, transportId: 't-1' },
                ],
            },
        });
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, status('s-1'));
        reply(socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [{ mediaSessionId: 1, playerState: 'PLAYING' }],
        });
        // Another phone cast over it: over, and not a failure.
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, status('s-2'));
        expect(hooks.onEnded).toHaveBeenCalledWith(null);
        expect(socket.destroyed).toBe(true);

        const refused = { onCasting: vi.fn(), onEnded: vi.fn() };
        await startCastSession(target, URL_FOR, 'Lobby', refused);
        const second = tlsState.sockets[1];
        second.emit('secureConnect');
        reply(second, 'receiver-0', CAST_NAMESPACE.receiver, status('s-3'));
        reply(second, 't-1', CAST_NAMESPACE.media, { type: 'LOAD_FAILED' });
        expect(refused.onEnded).toHaveBeenCalledWith('refused');
        expect(refused.onCasting).not.toHaveBeenCalled();
    });

    test('a TV that never connects is unreachable; one that never plays times out', async () => {
        const unreachable = { onCasting: vi.fn(), onEnded: vi.fn() };
        await startCastSession(target, URL_FOR, 'Lobby', unreachable);
        tlsState.sockets[0].emit('error', new Error('ECONNREFUSED'));
        expect(unreachable.onEnded).toHaveBeenCalledWith('unreachable');

        vi.useFakeTimers();
        const silent = { onCasting: vi.fn(), onEnded: vi.fn() };
        const pending = startCastSession(target, URL_FOR, 'Lobby', silent);
        await vi.runAllTimersAsync();
        await pending;
        expect(silent.onEnded).toHaveBeenCalledWith('timeout');
    });
});

describe('Google Cast keeps up with live', () => {
    const target: CastTarget = {
        id: 'google-cast:abc',
        kind: 'google-cast',
        name: 'Living Room TV',
        host: '127.0.0.1',
        port: 8009,
    };
    const PLAYER = {
        type: 'RECEIVER_STATUS',
        status: {
            applications: [
                { appId: 'CC1AD845', sessionId: 's-1', transportId: 't-1' },
            ],
        },
    };

    async function cast(getLiveTime: () => number | null) {
        const hooks = { onCasting: vi.fn(), onEnded: vi.fn(), getLiveTime };
        await startCastSession(target, URL_FOR, 'Lobby', hooks);
        const socket = tlsState.sockets.at(-1);
        socket.emit('secureConnect');
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        const status = (status: object) => {
            reply(socket, 't-1', CAST_NAMESPACE.media, {
                type: 'MEDIA_STATUS',
                status: [{ mediaSessionId: 9, ...status }],
            });
        };
        const rates = () => {
            return sent(socket)
                .filter(({ payload }: any) => {
                    return payload.type === 'SET_PLAYBACK_RATE';
                })
                .map(({ payload }: any) => payload.playbackRate);
        };
        return { hooks, socket, status, rates };
    }

    test('played faster while too far behind, normal once close, slower after running dry', async () => {
        let live = 13.4;
        const { status, rates } = await cast(() => live);
        // 3.4 s behind, as a Chromecast starts: caught up.
        status({ playerState: 'PLAYING', currentTime: 10 });
        expect(rates()).toEqual([1.2]);
        status({ playerState: 'PLAYING', currentTime: 11.5 });
        expect(rates()).toEqual([1.2]);
        status({ playerState: 'PLAYING', currentTime: 12.1 });
        expect(rates()).toEqual([1.2, 1]);
        // Within reach: left alone.
        live = 14;
        status({ playerState: 'PLAYING', currentTime: 12.4 });
        expect(rates()).toEqual([1.2, 1]);
        // Behind again, and it runs dry on the way: slowed at once, and
        // kept further behind from then on.
        live = 16;
        status({ playerState: 'PLAYING', currentTime: 13.5 });
        status({ playerState: 'BUFFERING', currentTime: 13.6 });
        expect(rates()).toEqual([1.2, 1, 1.2, 1]);
        status({ playerState: 'PLAYING', currentTime: 13.8 });
        expect(rates()).toEqual([1.2, 1, 1.2, 1]);
        status({ playerState: 'PLAYING', currentTime: 13.5 });
        expect(rates()).toEqual([1.2, 1, 1.2, 1, 1.2]);
        // A time on another timeline (the stream restarted) says nothing.
        status({ playerState: 'PLAYING', currentTime: 900 });
        expect(rates()).toHaveLength(5);
    });

    test('with no live edge known it is left alone, and is asked where it is', async () => {
        vi.useFakeTimers();
        const { socket, status, rates } = await cast(() => null);
        status({ playerState: 'PLAYING', currentTime: 1 });
        expect(rates()).toEqual([]);
        await vi.advanceTimersByTimeAsync(2000);
        expect(sent(socket).at(-1)).toMatchObject({
            destinationId: 't-1',
            payload: { type: 'GET_STATUS' },
        });
    });

    // A TV still holding an earlier cast's player: ours replaces it, and the
    // old one going idle (INTERRUPTED) used to end ours, while the TV played
    // on and was never steered.
    test('only its own media session counts, not one it replaced', async () => {
        const { hooks, socket, status, rates } = await cast(() => 13.4);
        const load = sent(socket).find(({ payload }: any) => {
            return payload.type === 'LOAD';
        }).payload;
        status({
            mediaSessionId: 3,
            playerState: 'IDLE',
            idleReason: 'INTERRUPTED',
        });
        expect(hooks.onEnded).not.toHaveBeenCalled();
        expect(hooks.onCasting).not.toHaveBeenCalled();
        // The answer to our LOAD names ours, idle while it starts.
        reply(socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            requestId: load.requestId,
            status: [{ mediaSessionId: 4, playerState: 'IDLE' }],
        });
        status({
            mediaSessionId: 3,
            playerState: 'IDLE',
            idleReason: 'INTERRUPTED',
        });
        expect(hooks.onEnded).not.toHaveBeenCalled();
        status({ mediaSessionId: 4, playerState: 'PLAYING', currentTime: 10 });
        expect(hooks.onCasting).toHaveBeenCalledTimes(1);
        expect(rates()).toEqual([1.2]);
        expect(sent(socket).at(-1).payload.mediaSessionId).toBe(4);
    });

    test('a stream that ended is loaded again; stopped on the TV, it is over', async () => {
        vi.useFakeTimers();
        const { hooks, socket, status } = await cast(() => null);
        status({ playerState: 'PLAYING', currentTime: 1 });
        const loads = () => {
            return sent(socket).filter(({ payload }: any) => {
                return payload.type === 'LOAD';
            }).length;
        };
        expect(loads()).toBe(1);
        for (let index = 0; index < 3; index++) {
            const mediaSessionId = 9 + index;
            status({
                mediaSessionId,
                playerState: 'IDLE',
                idleReason: 'FINISHED',
            });
            await vi.advanceTimersByTimeAsync(1000);
            expect(loads()).toBe(2 + index);
            // Loaded again, it is a media session of its own.
            status({
                mediaSessionId: mediaSessionId + 1,
                playerState: 'PLAYING',
            });
        }
        expect(hooks.onEnded).not.toHaveBeenCalled();
        // Given up on after that.
        status({
            mediaSessionId: 12,
            playerState: 'IDLE',
            idleReason: 'ERROR',
        });
        expect(hooks.onEnded).toHaveBeenCalledWith('ended');

        const stopped = await cast(() => null);
        stopped.status({ playerState: 'PLAYING', currentTime: 1 });
        stopped.status({ playerState: 'IDLE', idleReason: 'CANCELLED' });
        expect(stopped.hooks.onEnded).toHaveBeenCalledWith(null);
    });
});

// A device on this computer, answering on a port of its own.
async function serve(
    handle: (req: http.IncomingMessage, body: string) => [number, string],
) {
    const requests: {
        method: string;
        url: string;
        body: string;
        headers: any;
    }[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            requests.push({
                method: req.method ?? '',
                url: req.url ?? '',
                body,
                headers: req.headers,
            });
            const [status, text] = handle(req, body);
            res.writeHead(status, { 'Content-Type': 'text/xml' }).end(text);
        });
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    return {
        port: (server.address() as AddressInfo).port,
        requests,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

const until = async (check: () => boolean) => {
    for (let index = 0; index < 100 && !check(); index++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

describe('DLNA', () => {
    test('stops what plays, sets the stream, plays it; stop stops it', async () => {
        const device = await serve(() => [200, '<ok/>']);
        try {
            const target: CastTarget = {
                id: 'dlna:1',
                kind: 'dlna',
                name: 'Samsung',
                host: '127.0.0.1',
                port: device.port,
                controlUrl: `http://127.0.0.1:${device.port}/avt`,
                serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
            };
            const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
            const session = await startCastSession(
                target,
                URL_FOR,
                'Lobby',
                hooks,
            );
            await until(() => hooks.onCasting.mock.calls.length > 0);
            expect(hooks.onCasting).toHaveBeenCalledTimes(1);
            expect(
                device.requests.map((request) => request.headers.soapaction),
            ).toEqual([
                '"urn:schemas-upnp-org:service:AVTransport:1#Stop"',
                '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
                '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
            ]);
            const set = device.requests[1].body;
            expect(set).toContain(
                '<CurrentURI>http://127.0.0.1:39240/vd/1/video</CurrentURI>',
            );
            // The metadata travels escaped inside the SOAP body.
            expect(set).toContain('&lt;dc:title&gt;Lobby&lt;/dc:title&gt;');
            session.stop();
            await until(() => device.requests.length === 4);
            expect(device.requests[3].headers.soapaction).toContain('#Stop');
            expect(hooks.onEnded).not.toHaveBeenCalled();
        } finally {
            await device.close();
        }
    });

    test('a renderer that says no has refused; none there is unreachable', async () => {
        const device = await serve((req) => {
            return String(req.headers.soapaction).includes('SetAVTransportURI')
                ? [
                      500,
                      '<s:Envelope><s:Body><s:Fault><detail><UPnPError>' +
                          '<errorCode>714</errorCode><errorDescription>Illegal MIME' +
                          '</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>',
                  ]
                : [200, '<ok/>'];
        });
        const target: CastTarget = {
            id: 'dlna:1',
            kind: 'dlna',
            name: 'LG',
            host: '127.0.0.1',
            port: device.port,
            controlUrl: `http://127.0.0.1:${device.port}/avt`,
            serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
        };
        try {
            const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
            await startCastSession(target, URL_FOR, 'Lobby', hooks);
            await until(() => hooks.onEnded.mock.calls.length > 0);
            expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        } finally {
            await device.close();
        }
        const gone = { onCasting: vi.fn(), onEnded: vi.fn() };
        await startCastSession(target, URL_FOR, 'Lobby', gone);
        await until(() => gone.onEnded.mock.calls.length > 0);
        expect(gone.onEnded).toHaveBeenCalledWith('unreachable');
    });
});

describe('Roku', () => {
    test("opens Roku's player on the stream, and goes home to stop", async () => {
        const device = await serve(() => [200, '']);
        try {
            const target: CastTarget = {
                id: 'roku:1',
                kind: 'roku',
                name: 'Den Roku',
                host: '127.0.0.1',
                port: device.port,
            };
            const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
            const session = await startCastSession(
                target,
                URL_FOR,
                'Lobby',
                hooks,
            );
            await until(() => hooks.onCasting.mock.calls.length > 0);
            const play = new URL(device.requests[0].url, 'http://x');
            expect(device.requests[0].method).toBe('POST');
            expect(play.pathname).toBe('/launch/15985');
            expect(play.searchParams.get('u')).toBe(
                'http://127.0.0.1:39240/vd/1/video',
            );
            session.stop();
            await until(() => device.requests.length === 2);
            expect(device.requests[1].url).toBe('/keypress/Home');
        } finally {
            await device.close();
        }
    });

    test('a Roku that says no has refused', async () => {
        const device = await serve(() => [403, '']);
        try {
            const hooks = { onCasting: vi.fn(), onEnded: vi.fn() };
            await startCastSession(
                {
                    id: 'roku:1',
                    kind: 'roku',
                    name: 'Den Roku',
                    host: '127.0.0.1',
                    port: device.port,
                },
                URL_FOR,
                'Lobby',
                hooks,
            );
            await until(() => hooks.onEnded.mock.calls.length > 0);
            expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        } finally {
            await device.close();
        }
    });
});
