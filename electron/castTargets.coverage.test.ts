import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type * as upnpHelpersModule from './upnpHelpers';

// The paths the sibling suites cannot reach with a real UDP socket or a real
// device: a route the OS will not give, a TV that goes quiet or says no in
// every way the protocol allows, a search asked twice, and a Roku or DLNA
// renderer stopped before it answered.
const state = vi.hoisted(() => ({
    tlsSockets: [] as any[],
    udpSockets: [] as any[],
    // How the stand-in UDP socket picks a route.
    route: 'ok' as 'ok' | 'error' | 'no-address',
    localAddress: '192.168.1.3',
    cards: [] as string[],
    upnpRequest: vi.fn(),
    upnpSoap: vi.fn(),
    sendSsdpSearch: vi.fn(),
}));

vi.mock('node:tls', async () => {
    const { EventEmitter: Emitter } = await import('node:events');
    class FakeTlsSocket extends Emitter {
        written: Buffer[] = [];
        destroyed = false;
        isEnded = false;
        timeouts: number[] = [];
        constructor(readonly options: Record<string, unknown>) {
            super();
        }
        setTimeout(milliseconds: number) {
            this.timeouts.push(milliseconds);
        }
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
        state.tlsSockets.push(socket);
        return socket;
    };
    return { default: { connect }, connect };
});

vi.mock('node:dgram', async () => {
    const { EventEmitter: Emitter } = await import('node:events');
    class FakeUdpSocket extends Emitter {
        closes = 0;
        sent: { port: number; address: string }[] = [];
        interfaces: string[] = [];
        bind(_port: number, callback?: () => void) {
            queueMicrotask(() => callback?.());
        }
        connect(_port: number, _host: string, callback: () => void) {
            queueMicrotask(() => {
                if (state.route === 'error') {
                    this.emit('error', new Error('EHOSTUNREACH'));
                } else {
                    callback();
                }
            });
        }
        address() {
            if (state.route === 'no-address') {
                throw new Error('ENOTCONN');
            }
            return { address: state.localAddress, family: 'IPv4', port: 5 };
        }
        send(_message: Buffer, port: number, address: string) {
            this.sent.push({ port, address });
        }
        setMulticastInterface(address: string) {
            this.interfaces.push(address);
        }
        close() {
            this.closes += 1;
        }
    }
    const createSocket = () => {
        const socket = new FakeUdpSocket();
        state.udpSockets.push(socket);
        return socket;
    };
    return { default: { createSocket }, createSocket };
});

vi.mock('./upnpHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof upnpHelpersModule>();
    return {
        ...actual,
        listLocalIpv4s: () => state.cards,
        sendSsdpSearch: (...args: unknown[]) => state.sendSsdpSearch(...args),
        upnpRequest: (...args: unknown[]) => state.upnpRequest(...args),
        upnpSoap: (...args: unknown[]) => state.upnpSoap(...args),
    };
});

import {
    CAST_NAMESPACE,
    CastFrameReader,
    encodeCastMessage,
    type CastTarget,
} from './castProtocol';
import {
    discoverCastTargets,
    findLocalAddressFor,
    startCastSession,
} from './castTargets';

const URL_FOR = (localAddress: string) =>
    `http://${localAddress}:39240/vd/1/video`;
const TV: CastTarget = {
    id: 'google-cast:abc',
    kind: 'google-cast',
    name: 'Living Room TV',
    host: '192.168.1.40',
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

function sent(socket: any) {
    const reader = new CastFrameReader();
    return socket.written
        .flatMap((chunk: Buffer) => reader.push(chunk))
        .map((message: any) => ({
            ...message,
            payload: JSON.parse(message.payload),
        }));
}

function replyText(
    socket: any,
    sourceId: string,
    namespace: string,
    payload: string,
) {
    socket.emit(
        'data',
        encodeCastMessage({
            sourceId,
            destinationId: 'sender-0',
            namespace,
            payload,
        }),
    );
}

function reply(
    socket: any,
    sourceId: string,
    namespace: string,
    payload: object,
) {
    replyText(socket, sourceId, namespace, JSON.stringify(payload));
}

function genHooks() {
    return {
        onCasting: vi.fn(),
        onEnded: vi.fn(),
        onBehind: vi.fn(),
        getLiveTime: vi.fn(() => 13.4 as number | null),
    };
}

// Every session a test opened, stopped after it so no heartbeat runs on.
const sessions: { stop: () => void }[] = [];

// A TV that opened its player and was handed the stream.
async function castToTv(hooks = genHooks()) {
    const session = await startCastSession(TV, URL_FOR, 'Lobby', hooks);
    sessions.push(session);
    const socket = state.tlsSockets.at(-1);
    socket.emit('secureConnect');
    reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
    return { session, socket, hooks };
}

beforeEach(() => {
    state.tlsSockets.length = 0;
    state.udpSockets.length = 0;
    state.route = 'ok';
    state.localAddress = '192.168.1.3';
    state.cards = [];
    state.sendSsdpSearch.mockResolvedValue(undefined);
});

afterEach(() => {
    for (const session of sessions.splice(0)) session.stop();
    vi.useRealTimers();
});

describe('the address facing a TV', () => {
    test('is the one the route was picked from, and the socket is closed', async () => {
        expect(await findLocalAddressFor('192.168.1.40')).toBe('192.168.1.3');
        expect(state.udpSockets[0].closes).toBe(1);
    });

    test('is empty when there is no route, or the OS will not say', async () => {
        state.route = 'error';
        expect(await findLocalAddressFor('10.9.9.9')).toBe('');
        state.route = 'no-address';
        expect(await findLocalAddressFor('10.9.9.9')).toBe('');
        expect(state.udpSockets.map((socket) => socket.closes)).toEqual([1, 1]);
    });

    test('a TV with no route to it is unreachable, and nothing is dialed', async () => {
        state.route = 'error';
        const hooks = genHooks();
        const session = await startCastSession(TV, URL_FOR, 'Lobby', hooks);
        expect(hooks.onEnded).toHaveBeenCalledWith('unreachable');
        expect(state.tlsSockets).toHaveLength(0);
        // Its stop has nothing to stop.
        expect(() => session.stop()).not.toThrow();
        expect(hooks.onEnded).toHaveBeenCalledTimes(1);
        expect(state.upnpRequest).not.toHaveBeenCalled();
    });
});

describe('searching for TVs', () => {
    test('asks twice, a second apart, out of the default card when none is listed', async () => {
        vi.useFakeTimers();
        const found = discoverCastTargets(3000);
        await vi.advanceTimersByTimeAsync(0);
        const [mdns, ssdp] = state.udpSockets;
        expect(mdns.sent).toEqual([{ port: 5353, address: '224.0.0.251' }]);
        expect(mdns.interfaces).toEqual([]);
        expect(state.sendSsdpSearch).toHaveBeenCalledTimes(1);
        expect(state.sendSsdpSearch).toHaveBeenLastCalledWith(
            ssdp,
            ['urn:schemas-upnp-org:device:MediaRenderer:1', 'roku:ecp'],
            undefined,
        );
        await vi.advanceTimersByTimeAsync(999);
        expect(mdns.sent).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(mdns.sent).toHaveLength(2);
        expect(state.sendSsdpSearch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(2000);
        expect(await found).toEqual([]);
        expect(mdns.closes).toBe(1);
        expect(ssdp.closes).toBe(1);
    });
});

describe('Google Cast', () => {
    test('a TV that goes silent before it plays has timed out', async () => {
        const hooks = genHooks();
        await startCastSession(TV, URL_FOR, 'Lobby', hooks);
        const [socket] = state.tlsSockets;
        expect(socket.timeouts).toEqual([20_000]);
        socket.emit('timeout');
        expect(hooks.onEnded).toHaveBeenCalledWith('timeout');
        expect(socket.destroyed).toBe(true);
        // Ended once, whatever the socket says after.
        socket.emit('close');
        expect(hooks.onEnded).toHaveBeenCalledTimes(1);
    });

    test('pings the TV every five seconds once connected, and stops on stop', async () => {
        vi.useFakeTimers();
        const { session, socket } = await castToTv();
        const pings = () => {
            return sent(socket).filter(({ namespace, payload }: any) => {
                return (
                    namespace === CAST_NAMESPACE.heartbeat &&
                    payload.type === 'PING'
                );
            });
        };
        // The start timeout is lifted once the TLS handshake is done.
        expect(socket.timeouts).toEqual([20_000, 0]);
        expect(pings()).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(5000);
        expect(pings()).toHaveLength(1);
        expect(pings()[0].destinationId).toBe('receiver-0');
        await vi.advanceTimersByTimeAsync(5000);
        expect(pings()).toHaveLength(2);
        session.stop();
        await vi.advanceTimersByTimeAsync(15000);
        expect(pings()).toHaveLength(2);
    });

    test('a stream of bytes that is no Cast frame is refused', async () => {
        const hooks = genHooks();
        await startCastSession(TV, URL_FOR, 'Lobby', hooks);
        const [socket] = state.tlsSockets;
        socket.emit('secureConnect');
        const huge = Buffer.alloc(4);
        huge.writeUInt32BE(1 << 20);
        socket.emit('data', huge);
        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        expect(socket.destroyed).toBe(true);
    });

    test('a payload that is not JSON is ignored', async () => {
        const { socket, hooks } = await castToTv();
        const before = socket.written.length;
        replyText(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, '{PING');
        replyText(socket, 't-1', CAST_NAMESPACE.media, 'MEDIA_STATUS');
        expect(socket.written).toHaveLength(before);
        expect(hooks.onEnded).not.toHaveBeenCalled();
        expect(hooks.onCasting).not.toHaveBeenCalled();
    });

    test('a TV that cannot open the player has refused', async () => {
        const hooks = genHooks();
        await startCastSession(TV, URL_FOR, 'Lobby', hooks);
        const [socket] = state.tlsSockets;
        socket.emit('secureConnect');
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'LAUNCH_ERROR',
            reason: 'NOT_FOUND',
        });
        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
    });

    test('waits for the media player to be listed before loading anything', async () => {
        const hooks = genHooks();
        sessions.push(await startCastSession(TV, URL_FOR, 'Lobby', hooks));
        const [socket] = state.tlsSockets;
        socket.emit('secureConnect');
        const launched = socket.written.length;
        // Another app, then ours still without its transport.
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'RECEIVER_STATUS',
            status: { applications: [{ appId: 'YouTube', sessionId: 'y' }] },
        });
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'RECEIVER_STATUS',
            status: { applications: [{ appId: 'CC1AD845', sessionId: 's' }] },
        });
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'RECEIVER_STATUS',
        });
        expect(socket.written).toHaveLength(launched);
        expect(hooks.onEnded).not.toHaveBeenCalled();
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        expect(
            sent(socket)
                .slice(-2)
                .map(({ destinationId, payload }: any) => [
                    destinationId,
                    payload.type,
                ]),
        ).toEqual([
            ['t-1', 'CONNECT'],
            ['t-1', 'LOAD'],
        ]);
    });

    test("the player's transport closing ends the cast: refused before it played, over after", async () => {
        const refused = await castToTv();
        // A CLOSE from anyone else is not the player's.
        reply(refused.socket, 'receiver-0', CAST_NAMESPACE.connection, {
            type: 'CLOSE',
        });
        expect(refused.hooks.onEnded).not.toHaveBeenCalled();
        reply(refused.socket, 't-1', CAST_NAMESPACE.connection, {
            type: 'CLOSE',
        });
        expect(refused.hooks.onEnded).toHaveBeenCalledWith('refused');

        const played = await castToTv();
        reply(played.socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [{ mediaSessionId: 1, playerState: 'PLAYING' }],
        });
        expect(played.hooks.onCasting).toHaveBeenCalledTimes(1);
        reply(played.socket, 't-1', CAST_NAMESPACE.connection, {
            type: 'CLOSE',
        });
        expect(played.hooks.onEnded).toHaveBeenCalledWith(null);
    });

    test('a paused TV is not steered, nor said to be behind', async () => {
        const { socket, hooks } = await castToTv();
        reply(socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [
                { mediaSessionId: 4, playerState: 'PAUSED', currentTime: 10 },
            ],
        });
        expect(hooks.onCasting).toHaveBeenCalledTimes(1);
        expect(hooks.onBehind).not.toHaveBeenCalled();
        reply(socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [
                { mediaSessionId: 4, playerState: 'PLAYING', currentTime: 10 },
            ],
        });
        expect(hooks.onBehind).toHaveBeenCalledWith(expect.any(Number), 1.2);
        expect(hooks.onBehind.mock.calls[0][0]).toBeCloseTo(3.4);
    });

    test('nothing more is sent once stopped, and stopping twice sends one STOP', async () => {
        const { session, socket, hooks } = await castToTv();
        session.stop();
        const stops = () => {
            return sent(socket).filter(({ payload }: any) => {
                return payload.type === 'STOP';
            });
        };
        expect(stops()).toHaveLength(1);
        expect(socket.isEnded).toBe(true);
        const after = socket.written.length;
        // The TV pings while the socket closes: not answered.
        reply(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, {
            type: 'PING',
        });
        session.stop();
        expect(socket.written).toHaveLength(after);
        expect(stops()).toHaveLength(1);
        expect(hooks.onEnded).not.toHaveBeenCalled();
    });

    test('a session that already ended has nothing to stop', async () => {
        const hooks = genHooks();
        const session = await startCastSession(TV, URL_FOR, 'Lobby', hooks);
        const [socket] = state.tlsSockets;
        socket.emit('error', new Error('ECONNRESET'));
        expect(hooks.onEnded).toHaveBeenCalledWith('unreachable');
        session.stop();
        expect(socket.isEnded).toBe(false);
        expect(socket.written).toHaveLength(0);
    });
});

describe('DLNA and Roku', () => {
    test('a DLNA renderer with no AVTransport address has refused, and stop asks nothing', async () => {
        const hooks = genHooks();
        const session = await startCastSession(
            {
                id: 'dlna:1',
                kind: 'dlna',
                name: 'TV',
                host: '192.168.1.50',
                port: 7676,
            },
            URL_FOR,
            'Lobby',
            hooks,
        );
        await vi.waitFor(() => {
            expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        });
        session.stop();
        expect(state.upnpSoap).not.toHaveBeenCalled();
        expect(hooks.onCasting).not.toHaveBeenCalled();
    });

    const ROKU: CastTarget = {
        id: 'roku:1',
        kind: 'roku',
        name: 'Den Roku',
        host: '192.168.1.60',
        port: 8060,
    };

    test('a Roku that cannot be reached is unreachable', async () => {
        state.upnpRequest.mockRejectedValue(new Error('ECONNREFUSED'));
        const hooks = genHooks();
        await startCastSession(ROKU, URL_FOR, 'Lobby', hooks);
        await vi.waitFor(() => {
            expect(hooks.onEnded).toHaveBeenCalledWith('unreachable');
        });
        expect(state.upnpRequest).toHaveBeenCalledWith(
            expect.stringContaining('http://192.168.1.60:8060/launch/15985?'),
            { method: 'POST', body: '' },
        );
    });

    test('a Roku stopped before it answered is told to go home, and its answer is ignored', async () => {
        let answerPlay: (response: unknown) => void = () => {};
        let failPlay: (error: Error) => void = () => {};
        state.upnpRequest.mockImplementation((url: string) => {
            if (url.includes('/launch/')) {
                return new Promise((resolve, reject) => {
                    answerPlay = resolve;
                    failPlay = reject;
                });
            }
            return Promise.resolve({ status: 200, body: '', localAddress: '' });
        });
        const hooks = genHooks();
        const session = await startCastSession(ROKU, URL_FOR, 'Lobby', hooks);
        session.stop();
        expect(state.upnpRequest).toHaveBeenLastCalledWith(
            'http://192.168.1.60:8060/keypress/Home',
            { method: 'POST', body: '' },
        );
        answerPlay({ status: 200, body: '', localAddress: '' });
        await Promise.resolve();
        await Promise.resolve();
        expect(hooks.onCasting).not.toHaveBeenCalled();
        expect(hooks.onEnded).not.toHaveBeenCalled();

        // The same for one whose launch fails after the stop.
        const second = genHooks();
        const other = await startCastSession(ROKU, URL_FOR, 'Lobby', second);
        other.stop();
        failPlay(new Error('ECONNRESET'));
        await Promise.resolve();
        await Promise.resolve();
        expect(second.onEnded).not.toHaveBeenCalled();
    });
});
