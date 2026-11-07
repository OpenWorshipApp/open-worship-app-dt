import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';

// A Google Cast TV on a stand-in TLS socket, as in `castTargets.test.ts`:
// what the session writes is read back as frames, and the test answers as
// the TV -- or a broken one -- would.
const tlsState = vi.hoisted(() => ({ sockets: [] as any[] }));
vi.mock('node:tls', async () => {
    const { EventEmitter: Emitter } = await import('node:events');
    class FakeTlsSocket extends Emitter {
        written: Buffer[] = [];
        destroyed = false;
        isEnded = false;
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
    const connect = () => {
        const socket = new FakeTlsSocket();
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

const TARGET: CastTarget = {
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
const URL_FOR = (localAddress: string) =>
    `http://${localAddress}:39240/vd/1/video`;

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

function genHooks(getLiveTime?: () => number | null) {
    return { onCasting: vi.fn(), onEnded: vi.fn(), getLiveTime };
}

async function connect(hooks = genHooks()) {
    const session = await startCastSession(TARGET, URL_FOR, 'Lobby', hooks);
    const socket = tlsState.sockets.at(-1);
    socket.emit('secureConnect');
    return { session, socket, hooks };
}

function typesSent(socket: any) {
    return sent(socket).map(({ payload }: any) => payload.type);
}

afterEach(() => {
    tlsState.sockets.length = 0;
    vi.useRealTimers();
});

describe('a Google Cast session, beyond the happy path', () => {
    test('keeps the connection alive with a PING every five seconds', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const { session, socket } = await connect();
        const pings = () => {
            return sent(socket).filter(({ namespace, payload }: any) => {
                return (
                    namespace === CAST_NAMESPACE.heartbeat &&
                    payload.type === 'PING'
                );
            });
        };

        expect(pings()).toHaveLength(0);
        vi.advanceTimersByTime(5000);
        expect(pings()).toHaveLength(1);
        expect(pings()[0].destinationId).toBe('receiver-0');
        vi.advanceTimersByTime(10_000);
        expect(pings()).toHaveLength(3);
        // Stopped: no more pings.
        session.stop();
        vi.advanceTimersByTime(10_000);
        expect(pings()).toHaveLength(3);
    });

    test('a frame too large to be one ends the cast as refused', async () => {
        const { socket, hooks } = await connect();
        const huge = Buffer.alloc(4);
        huge.writeUInt32BE(1 << 20);

        socket.emit('data', huge);

        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        expect(socket.destroyed).toBe(true);
    });

    test('a payload that is not JSON is ignored, and the session goes on', async () => {
        const { socket, hooks } = await connect();
        const before = socket.written.length;

        replyText(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, 'PING!');

        expect(socket.written).toHaveLength(before);
        expect(hooks.onEnded).not.toHaveBeenCalled();
        // Still answering what is well formed.
        reply(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, { type: 'PING' });
        expect(typesSent(socket).at(-1)).toBe('PONG');
    });

    test('a TV that cannot open the player has refused', async () => {
        const { socket, hooks } = await connect();

        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'LAUNCH_ERROR',
            reason: 'NOT_ALLOWED',
        });

        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        expect(hooks.onCasting).not.toHaveBeenCalled();
    });

    test('a status that names no transport yet is waited past', async () => {
        const { socket } = await connect();

        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'RECEIVER_STATUS',
            status: {
                applications: [{ appId: 'CC1AD845', sessionId: 's-1' }],
            },
        });
        // No transport: nothing is connected to, nothing loaded.
        expect(typesSent(socket)).toEqual(['CONNECT', 'LAUNCH']);

        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        expect(typesSent(socket)).toEqual([
            'CONNECT',
            'LAUNCH',
            'CONNECT',
            'LOAD',
        ]);
    });

    test('the player closing its connection before playing has refused', async () => {
        const { socket, hooks } = await connect();
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);

        // A CLOSE from anything but our transport is not ours to act on.
        reply(socket, 'receiver-0', CAST_NAMESPACE.connection, {
            type: 'CLOSE',
        });
        expect(hooks.onEnded).not.toHaveBeenCalled();
        reply(socket, 't-1', CAST_NAMESPACE.connection, { type: 'CLOSE' });

        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
    });

    test('the player closing its connection while playing is simply over', async () => {
        const { socket, hooks } = await connect();
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        reply(socket, 't-1', CAST_NAMESPACE.media, {
            type: 'MEDIA_STATUS',
            status: [{ mediaSessionId: 4, playerState: 'PLAYING' }],
        });
        expect(hooks.onCasting).toHaveBeenCalledTimes(1);

        reply(socket, 't-1', CAST_NAMESPACE.connection, { type: 'CLOSE' });

        expect(hooks.onEnded).toHaveBeenCalledWith(null);
    });

    test('a paused TV is not hurried, however far behind live', async () => {
        const { socket } = await connect(genHooks(() => 100));
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        const status = (playerState: string) => {
            reply(socket, 't-1', CAST_NAMESPACE.media, {
                type: 'MEDIA_STATUS',
                status: [{ mediaSessionId: 4, playerState, currentTime: 90 }],
            });
        };

        status('PAUSED');
        expect(typesSent(socket)).not.toContain('SET_PLAYBACK_RATE');
        // The same distance while PLAYING is hurried.
        status('PLAYING');
        expect(typesSent(socket)).toContain('SET_PLAYBACK_RATE');
    });

    test('stop after the cast is over sends nothing', async () => {
        const { session, socket, hooks } = await connect();
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, {
            type: 'LAUNCH_ERROR',
        });
        expect(hooks.onEnded).toHaveBeenCalledTimes(1);
        const before = socket.written.length;

        session.stop();

        expect(socket.written).toHaveLength(before);
        expect(socket.isEnded).toBe(false);
        expect(hooks.onEnded).toHaveBeenCalledTimes(1);
    });

    test('what the TV says after Stop is not answered', async () => {
        const { session, socket } = await connect();
        reply(socket, 'receiver-0', CAST_NAMESPACE.receiver, PLAYER);
        session.stop();
        expect(typesSent(socket).at(-1)).toBe('STOP');
        expect(socket.isEnded).toBe(true);
        const before = socket.written.length;

        reply(socket, 'receiver-0', CAST_NAMESPACE.heartbeat, { type: 'PING' });

        expect(socket.written).toHaveLength(before);
    });
});

describe('finding the address that faces a TV', () => {
    function fakeUdp(isAnswering: boolean) {
        const socket = new EventEmitter() as any;
        socket.close = vi.fn(() => {
            throw new Error('ERR_SOCKET_DGRAM_NOT_RUNNING');
        });
        socket.connect = vi.fn(
            (_port: number, _host: string, callback: () => void) => {
                setImmediate(() => {
                    if (isAnswering) {
                        callback();
                    } else {
                        socket.emit('error', new Error('ENETUNREACH'));
                    }
                });
            },
        );
        socket.address = () => {
            throw new Error('ERR_SOCKET_DGRAM_NOT_CONNECTED');
        };
        return socket;
    }

    test('no route to the TV is no address', async () => {
        const socket = fakeUdp(false);
        vi.spyOn(dgram, 'createSocket').mockReturnValue(socket);

        expect(await findLocalAddressFor('192.168.1.40')).toBe('');
        expect(socket.connect).toHaveBeenCalledWith(
            9,
            '192.168.1.40',
            expect.any(Function),
        );
        // Closed even though closing it failed.
        expect(socket.close).toHaveBeenCalledOnce();
    });

    test('a route the system will not name is no address', async () => {
        vi.spyOn(dgram, 'createSocket').mockReturnValue(fakeUdp(true));

        expect(await findLocalAddressFor('192.168.1.40')).toBe('');
    });

    test('with no address facing it, a TV is unreachable and nothing is dialed', async () => {
        vi.spyOn(dgram, 'createSocket').mockReturnValue(fakeUdp(false));
        const hooks = genHooks();
        const toUrl = vi.fn(URL_FOR);

        const session = await startCastSession(TARGET, toUrl, 'Lobby', hooks);

        expect(hooks.onEnded).toHaveBeenCalledWith('unreachable');
        expect(toUrl).not.toHaveBeenCalled();
        expect(tlsState.sockets).toHaveLength(0);
        expect(() => session.stop()).not.toThrow();
    });
});

describe('DLNA and Roku, beyond the happy path', () => {
    test('a renderer with no control address has refused, and stop sends nothing', async () => {
        const hooks = genHooks();

        const session = await startCastSession(
            {
                id: 'dlna:1',
                kind: 'dlna',
                name: 'Samsung',
                host: '127.0.0.1',
                port: 7676,
            },
            URL_FOR,
            'Lobby',
            hooks,
        );

        expect(hooks.onEnded).toHaveBeenCalledWith('refused');
        expect(() => session.stop()).not.toThrow();
        expect(hooks.onCasting).not.toHaveBeenCalled();
    });

    async function genClosedPort() {
        const probe = net.createServer();
        await new Promise<void>((resolve) => {
            probe.listen(0, '127.0.0.1', resolve);
        });
        const { port } = probe.address() as net.AddressInfo;
        await new Promise<void>((resolve) => probe.close(() => resolve()));
        return port;
    }

    async function until(check: () => boolean) {
        for (let index = 0; index < 100 && !check(); index++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }

    test('a Roku that is not there is unreachable', async () => {
        const port = await genClosedPort();
        const hooks = genHooks();

        await startCastSession(
            {
                id: 'roku:1',
                kind: 'roku',
                name: 'Den Roku',
                host: '127.0.0.1',
                port,
            },
            URL_FOR,
            'Lobby',
            hooks,
        );
        await until(() => hooks.onEnded.mock.calls.length > 0);

        expect(hooks.onEnded).toHaveBeenCalledWith('unreachable');
    });

    test('a Roku stopped before it answers says nothing at all', async () => {
        const port = await genClosedPort();
        const hooks = genHooks();

        const session = await startCastSession(
            {
                id: 'roku:1',
                kind: 'roku',
                name: 'Den Roku',
                host: '127.0.0.1',
                port,
            },
            URL_FOR,
            'Lobby',
            hooks,
        );
        session.stop();
        // Long enough for both refused connections to come back.
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hooks.onEnded).not.toHaveBeenCalled();
        expect(hooks.onCasting).not.toHaveBeenCalled();
    });
});
