import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { VirtualDisplayWebContext } from '../../electron/virtualDisplayProtocol';
import { connectWebScreen, ensureRandomUUID } from './webScreenProvider';

type SocketListener = (event: any) => void;

class FakeWebSocket {
    static readonly instances: FakeWebSocket[] = [];
    static readonly OPEN = 1;
    readonly readyState = FakeWebSocket.OPEN;
    readonly url: string;
    private readonly listeners = new Map<string, SocketListener[]>();

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    addEventListener(type: string, listener: SocketListener) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
    }

    emit(type: string, event: unknown = {}) {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }

    send(packet: unknown) {
        this.emit('message', { data: JSON.stringify(packet) });
    }
}

const SCREEN_MESSAGE = 'app:screen:message';
const HOST_ID = '00000000-0000-4000-8000-000000000001';

function genContext(
    overrides: Partial<VirtualDisplayWebContext> = {},
): VirtualDisplayWebContext {
    return {
        screenId: 0,
        stage: 0,
        settings: {},
        resources: { 'C:\\a.mp4': '/content/x/y/a.mp4' },
        fontCss: '',
        isWindows: true,
        remote: true,
        isSoundOwner: true,
        display: { id: -500001, label: 'X', width: 1280, height: 720 },
        hostId: HOST_ID,
        ...overrides,
    };
}

function md5(text: string) {
    return createHash('md5').update(text).digest('hex');
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

let reloadMock: ReturnType<typeof vi.fn>;

function stubLocation(search: string, protocol = 'http:') {
    reloadMock = vi.fn();
    vi.stubGlobal('location', {
        search,
        protocol,
        host: '127.0.0.1:39241',
        pathname: '/vd-screen.html',
        reload: reloadMock,
    });
}

function lastSocket() {
    const socket = FakeWebSocket.instances.at(-1);
    if (socket === undefined) {
        throw new Error('No socket was opened');
    }
    return socket;
}

async function connect(
    search = '?vd=1&screenId=0&viewer=abcdefgh',
    context = genContext(),
) {
    stubLocation(search);
    const promise = connectWebScreen();
    const socket = lastSocket();
    socket.send({ type: 'context', context });
    const connection = await promise;
    const provider = connection.provider as any;
    return { socket, connection, provider };
}

describe('connectWebScreen', () => {
    beforeEach(() => {
        FakeWebSocket.instances.length = 0;
        vi.stubGlobal('WebSocket', FakeWebSocket);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test('opens the display socket for this screen and viewer', () => {
        stubLocation('?vd=1&screenId=0&viewer=abcdefgh');
        void connectWebScreen();
        const url = new URL(lastSocket().url);
        expect(url.protocol).toBe('ws:');
        expect(url.host).toBe('127.0.0.1:39241');
        expect(url.pathname).toBe('/vd/1/ws');
        expect(url.searchParams.get('viewer')).toBe('abcdefgh');
        expect(url.searchParams.get('screenId')).toBe('0');
        expect(url.searchParams.has('preview')).toBe(false);
    });

    test('a page over https uses wss, and a preview says so', () => {
        stubLocation('?vd=3&screenId=2&viewer=v&preview=1', 'https:');
        void connectWebScreen();
        const url = new URL(lastSocket().url);
        expect(url.protocol).toBe('wss:');
        expect(url.pathname).toBe('/vd/3/ws');
        expect(url.searchParams.get('preview')).toBe('1');
    });

    test('resolves only once the context arrives, ignoring junk', async () => {
        stubLocation('?vd=1&screenId=0&viewer=abcdefgh');
        let isResolved = false;
        const promise = connectWebScreen().then((value) => {
            isResolved = true;
            return value;
        });
        const socket = lastSocket();
        socket.emit('message', { data: 'not json' });
        socket.send({ type: 'layout', layout: {} });
        socket.send({ type: 'context-update', data: { stage: 2 } });
        await flushMicrotasks();
        expect(isResolved).toBe(false);
        socket.send({ type: 'context', context: genContext() });
        const { context } = await promise;
        expect(context.display.id).toBe(-500001);
        expect(context.stage).toBe(0);
    });

    test('answers get-displays with the display it is on', async () => {
        const { provider } = await connect();
        const answer = provider.messageUtils.sendDataSync(
            'main:app:get-displays',
        );
        const expected = {
            id: -500001,
            label: 'X',
            bounds: { x: 0, y: 0, width: 1280, height: 720 },
            workArea: { x: 0, y: 0, width: 1280, height: 720 },
            size: { width: 1280, height: 720 },
            workAreaSize: { width: 1280, height: 720 },
            scaleFactor: 1,
        };
        expect(answer.primaryDisplay).toMatchObject(expected);
        expect(answer.displays).toHaveLength(1);
        expect(answer.displays[0]).toMatchObject(expected);
        expect(
            provider.messageUtils.sendDataSync('main:app:get-screens'),
        ).toEqual([0]);
        expect(provider.messageUtils.sendDataSync('unknown:channel')).toBe(
            undefined,
        );
        expect(provider.isPageScreen).toBe(true);
        expect(provider.currentHomePage).toBe('/vd-screen.html');
    });

    test('a file path maps to its address on this server', async () => {
        const { provider } = await connect();
        const { sendDataSync } = provider.messageUtils;
        expect(sendDataSync('mirror:resource', { filePath: 'C:\\a.mp4' })).toBe(
            '/content/x/y/a.mp4',
        );
        expect(sendDataSync('mirror:resource', { filePath: 'C:\\b.mp4' })).toBe(
            '',
        );
        expect(sendDataSync('mirror:resource', undefined)).toBe('');
        expect(provider.browserUtils.pathToFileURL('C:\\a.mp4')).toBe(
            '/content/x/y/a.mp4',
        );
        expect(provider.browserUtils.pathToFileURL('C:\\missing.mp4')).toBe('');
    });

    test('a context update is seen by every later answer', async () => {
        const { socket, provider } = await connect();
        socket.send({
            type: 'context-update',
            data: {
                resources: { 'C:\\b.mp4': '/content/x/z/b.mp4' },
                stage: 3,
            },
        });
        expect(provider.browserUtils.pathToFileURL('C:\\b.mp4')).toBe(
            '/content/x/z/b.mp4',
        );
        expect(provider.browserUtils.pathToFileURL('C:\\a.mp4')).toBe('');
        expect(provider.screenUtils.getContext().stage).toBe(3);
        expect(
            provider.messageUtils.sendDataSync('mirror:screen-context').stage,
        ).toBe(3);
        // A second full context is not taken over the first.
        socket.send({
            type: 'context',
            context: genContext({ stage: 9 }),
        });
        expect(provider.screenUtils.getContext().stage).toBe(3);
    });

    describe('Windows paths', () => {
        test('basename, dirname and join', async () => {
            const { pathUtils } = (await connect()).provider;
            expect(pathUtils.sep).toBe('\\');
            expect(pathUtils.basename('C:\\x\\data\\14_cv.mp4')).toBe(
                '14_cv.mp4',
            );
            expect(pathUtils.basename('C:\\x\\data\\14_cv.mp4', '.mp4')).toBe(
                '14_cv',
            );
            expect(pathUtils.basename('C:/x/data/')).toBe('data');
            expect(pathUtils.dirname('C:\\x\\data\\14_cv.mp4')).toBe(
                'C:\\x\\data',
            );
            expect(pathUtils.dirname('C:/x/data/14_cv.mp4')).toBe('C:/x/data');
            expect(pathUtils.dirname('14_cv.mp4')).toBe('.');
            expect(pathUtils.join('C:\\x', 'data', '14_cv.mp4')).toBe(
                'C:\\x\\data\\14_cv.mp4',
            );
            expect(pathUtils.join('C:/x/', '/data//', '', '14_cv.mp4')).toBe(
                'C:\\x\\data\\14_cv.mp4',
            );
            expect(pathUtils.resolve('C:\\x', 'a.mp4')).toBe('C:\\x\\a.mp4');
        });

        // `join` collapses runs of separators, but not the `\\` that starts a
        // network (UNC) path -- as Node's `path.win32.join` keeps it.
        test('join keeps a network path a network path', async () => {
            const { pathUtils } = (await connect()).provider;
            expect(pathUtils.join('\\\\server\\share', 'a.mp4')).toBe(
                '\\\\server\\share\\a.mp4',
            );
        });

        // The folder of a file at a drive's root is the root `C:\`, not `C:`
        // (the current folder on drive C), as Node's `path.win32.dirname`.
        test('dirname of a file at a drive root is the root', async () => {
            const { pathUtils } = (await connect()).provider;
            expect(pathUtils.dirname('C:\\a.mp4')).toBe('C:\\');
        });

        // A slide's `./media/a.png` must reach the key the server published.
        test('resolve takes `.` and `..` out and never climbs above a root', async () => {
            const { pathUtils } = (await connect()).provider;
            expect(pathUtils.resolve('C:\\deck', './media/a.png')).toBe(
                'C:\\deck\\media\\a.png',
            );
            expect(pathUtils.resolve('C:\\deck\\html', '../media/a.png')).toBe(
                'C:\\deck\\media\\a.png',
            );
            expect(pathUtils.resolve('C:\\', '..', 'a.png')).toBe('C:\\a.png');
            expect(pathUtils.resolve('\\\\server\\share', '..', 'a.png')).toBe(
                '\\\\server\\share\\a.png',
            );
        });
    });

    // A PowerPoint slide is HTML whose pictures sit beside it. The server
    // publishes the HTML with its folder; a picture asked for by its own path
    // must come back inside that folder's address, or the slide draws white.
    test('a file beside a published page resolves inside its folder', async () => {
        const { provider } = await connect(
            undefined,
            genContext({
                resources: {
                    'C:\\deck\\slide1.html': '/content/s/i/slide1.html',
                },
            }),
        );
        const { pathToFileURL } = provider.browserUtils;
        expect(pathToFileURL('C:\\deck\\slide1.html')).toBe(
            '/content/s/i/slide1.html',
        );
        expect(pathToFileURL('C:\\deck\\media\\image 1.png')).toBe(
            '/content/s/i/media/image%201.png',
        );
        // Windows paths ignore case, as the server's own check does.
        expect(pathToFileURL('c:\\DECK\\media\\a.png')).toBe(
            '/content/s/i/media/a.png',
        );
        expect(pathToFileURL('C:\\deck\\html\\..\\media\\a.png')).toBe(
            '/content/s/i/media/a.png',
        );
        expect(pathToFileURL('C:\\other\\a.png')).toBe('');
        expect(pathToFileURL('C:\\deck')).toBe('');
    });

    test('POSIX paths on a non-Windows host', async () => {
        const { pathUtils } = (
            await connect(undefined, genContext({ isWindows: false }))
        ).provider;
        expect(pathUtils.sep).toBe('/');
        expect(pathUtils.join('/home/u', 'videos', 'a.mp4')).toBe(
            '/home/u/videos/a.mp4',
        );
        expect(pathUtils.dirname('/home/u/a.mp4')).toBe('/home/u');
        expect(pathUtils.dirname('/a.mp4')).toBe('/');
        expect(pathUtils.basename('/home/u/a.mp4')).toBe('a.mp4');
    });

    test('screen messages sent before anyone listens are held for the first listener', async () => {
        stubLocation('?vd=1&screenId=0&viewer=abcdefgh');
        const promise = connectWebScreen();
        const socket = lastSocket();
        const early = { screenId: 0, type: 'init', data: 1 };
        socket.send({ type: 'message', message: early });
        socket.send({ type: 'context', context: genContext() });
        const provider = (await promise).provider as any;
        const late = { screenId: 0, type: 'background', data: 2 };
        socket.send({ type: 'message', message: late });

        const listener = vi.fn();
        provider.messageUtils.listenForData(SCREEN_MESSAGE, listener);
        // Handed over on a microtask, in arrival order.
        expect(listener).not.toHaveBeenCalled();
        await flushMicrotasks();
        expect(listener.mock.calls.map((call) => call[1])).toEqual([
            early,
            late,
        ]);

        // Once listening, a message is delivered at once, and nothing held is
        // handed over twice.
        const second = vi.fn();
        provider.messageUtils.listenForData(SCREEN_MESSAGE, second);
        const next = { screenId: 0, type: 'visible', data: true };
        socket.send({ type: 'message', message: next });
        await flushMicrotasks();
        expect(listener).toHaveBeenCalledTimes(3);
        expect(listener.mock.calls[2][1]).toEqual(next);
        expect(second.mock.calls.map((call) => call[1])).toEqual([next]);
    });

    test('a removed listener stops hearing, and messages are held again', async () => {
        const { socket, provider } = await connect();
        const { messageUtils } = provider;
        const listener = vi.fn();
        messageUtils.listenForData(SCREEN_MESSAGE, listener);
        messageUtils.removeListener(SCREEN_MESSAGE, listener);
        const message = { screenId: 0, type: 'init', data: null };
        socket.send({ type: 'message', message });
        expect(listener).not.toHaveBeenCalled();
        const again = vi.fn();
        messageUtils.listenForData(SCREEN_MESSAGE, again);
        await flushMicrotasks();
        expect(again.mock.calls.map((call) => call[1])).toEqual([message]);
    });

    // A browser starts nothing unmuted until the page is tapped: a viewer
    // plays the sound only once "Turn on sound" loaded it with `sound=1`,
    // and the app's own preview never does.
    test('a viewer owns its sound once tapped for it, never as the app preview', async () => {
        const untapped = await connect();
        expect(untapped.connection.context.isSoundOwner).toBe(false);

        const owner = await connect('?vd=1&screenId=0&viewer=abcdefgh&sound=1');
        expect(owner.connection.context.isSoundOwner).toBe(true);

        const preview = await connect(
            '?vd=1&screenId=0&viewer=abcdefgh&preview=1&sound=1',
        );
        expect(preview.connection.context.isSoundOwner).toBe(false);
        expect(preview.provider.screenUtils.getContext().isSoundOwner).toBe(
            false,
        );
        expect(
            preview.provider.messageUtils.sendDataSync('mirror:screen-context')
                .isSoundOwner,
        ).toBe(false);
    });

    test('createHash("md5") matches Node across updates', async () => {
        const { cryptoUtils, systemUtils } = (await connect()).provider;
        const text = 'ភ្លេង #1.mp4';
        expect(cryptoUtils.createHash('md5').update(text).digest('hex')).toBe(
            md5(text),
        );
        expect(
            cryptoUtils
                .createHash('md5')
                .update('14_')
                .update('cv.mp4')
                .digest(),
        ).toBe(md5('14_cv.mp4'));
        expect(systemUtils.generateMD5(text)).toBe(md5(text));
        expect(() => cryptoUtils.createHash('sha256')).toThrow(
            'sha256 is not available',
        );
    });

    test('file calls fail like a missing file', async () => {
        const { fileUtils } = (await connect()).provider;
        expect(fileUtils.existsSync('C:\\a.mp4')).toBe(false);
        expect(() => fileUtils.readFileSync('C:\\a.mp4')).toThrow(
            'fileUtils.readFileSync is not available in a browser',
        );
        const callback = vi.fn();
        expect(fileUtils.readFile('C:\\a.mp4', callback)).toBe(undefined);
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
        const watcher = fileUtils.watch('C:\\a.mp4');
        expect(watcher.on('change', vi.fn())).toBe(watcher);
        expect(() => watcher.close()).not.toThrow();
    });

    test('base64 round-trips Khmer text', async () => {
        const { appUtils } = (await connect()).provider;
        const text = 'ភ្លេង #1';
        const encoded = appUtils.base64Encode(text);
        expect(encoded).toBe(Buffer.from(text, 'utf8').toString('base64'));
        expect(appUtils.base64Decode(encoded)).toBe(text);
    });

    test('a closed socket reloads the page to join again', async () => {
        vi.useFakeTimers();
        const { socket } = await connect();
        socket.emit('close');
        expect(reloadMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1999);
        expect(reloadMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });
});

// A phone reaches the page over plain http, where browsers withhold
// `crypto.randomUUID`; the screen page stopped at its first cache.
describe('ensureRandomUUID', () => {
    test('gives an insecure page a version-4 UUID', () => {
        // A Crypto with no `randomUUID`, as an http page gets.
        const target = {
            getRandomValues: globalThis.crypto.getRandomValues.bind(
                globalThis.crypto,
            ),
        } as unknown as Crypto;
        ensureRandomUUID(target);
        const first = target.randomUUID();
        expect(first).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(target.randomUUID()).not.toBe(first);
    });
    test('leaves a secure page its own', () => {
        const own = () =>
            'own' as `${string}-${string}-${string}-${string}-${string}`;
        const target = { randomUUID: own } as unknown as Crypto;
        ensureRandomUUID(target);
        expect(target.randomUUID).toBe(own);
    });
});

// A tap on a verse goes to the app only while the operator lets this browser
// interact -- told by the server -- and only a verse or a scroll ever does.
describe('a viewer interacting', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    test('reports a verse to the app only while it may interact', async () => {
        vi.stubGlobal('WebSocket', FakeWebSocket);
        const { socket, provider } = await connect();
        const sent: string[] = [];
        const push = socket.send.bind(socket);
        socket.send = (packet: unknown) => {
            if (typeof packet === 'string') {
                sent.push(packet);
            } else {
                push(packet);
            }
        };
        const report = (type: string, channel = SCREEN_MESSAGE) => {
            provider.messageUtils.sendData(channel, {
                screenId: 0,
                type,
                data: { selectedKJVVerseKey: 'EXO 14:18' },
                isScreen: true,
            });
        };
        report('bible-screen-view-selected-index');
        expect(sent).toEqual([]);

        socket.send({ type: 'interactive', isInteractive: true });
        report('bible-screen-view-selected-index');
        report('visible');
        report('bible-screen-view-selected-index', 'some-other-channel');
        expect(sent.map((item) => JSON.parse(item))).toEqual([
            {
                type: 'feedback',
                message: {
                    type: 'bible-screen-view-selected-index',
                    data: { selectedKJVVerseKey: 'EXO 14:18' },
                },
            },
        ]);

        socket.send({ type: 'interactive', isInteractive: false });
        report('bible-screen-view-selected-index');
        expect(sent).toHaveLength(1);
    });

    // Asked for by the user: the screen's ✕ on a browser let to interact
    // hides the screen in the app, as on the projector's own window. The
    // screen is the socket's; the id the page passes is never sent.
    test('its ✕ asks to hide the screen only while it may interact', async () => {
        vi.stubGlobal('WebSocket', FakeWebSocket);
        const { socket, provider } = await connect();
        const sent: string[] = [];
        const push = socket.send.bind(socket);
        socket.send = (packet: unknown) => {
            if (typeof packet === 'string') {
                sent.push(packet);
            } else {
                push(packet);
            }
        };
        provider.messageUtils.sendData('app:hide-screen', 7);
        expect(sent).toEqual([]);
        socket.send({ type: 'interactive', isInteractive: true });
        provider.messageUtils.sendData('app:hide-screen', 7);
        expect(sent.map((item) => JSON.parse(item))).toEqual([
            { type: 'hide' },
        ]);
    });
});

// A browser has none of this computer's cameras: a camera on the screen is
// renamed to Screen Mirror's remote form so the page asks for a stream, the
// app's "may I use the camera?" is answered no at once (it used to wait for
// ever), and the stream's setup rides the screen's socket.
describe('a camera on the screen', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    test('is named, listed, asked for and answered through the socket', async () => {
        vi.stubGlobal('WebSocket', FakeWebSocket);
        const { socket, provider } = await connect(
            undefined,
            genContext({
                messages: [
                    {
                        screenId: 0,
                        type: 'foreground',
                        data: {
                            cameraDataList: [{ id: 'cam-1', label: 'Front' }],
                        },
                    },
                ],
            }),
        );
        const remote = `mirror-camera:${HOST_ID}:cam-1`;
        const [message] = provider.screenUtils.getContext().messages;
        expect(message.data.cameraDataList[0].id).toBe(remote);
        expect(provider.messageUtils.sendDataSync('mirror:cameras')).toEqual([
            {
                deviceId: remote,
                label: 'Front',
                groupId: '',
                kind: 'videoinput',
            },
        ]);
        expect(provider.messageUtils.sendDataSync('mirror:state')).toBeNull();

        // A live camera background is renamed too, and listed with it.
        const received: any[] = [];
        provider.messageUtils.listenForData(
            SCREEN_MESSAGE,
            (_e: unknown, m: any) => {
                received.push(m);
            },
        );
        socket.send({
            type: 'message',
            message: {
                screenId: 0,
                type: 'background',
                data: { type: 'camera', src: 'cam-2' },
            },
        });
        expect(received.at(-1).data.src).toBe(`mirror-camera:${HOST_ID}:cam-2`);
        expect(
            provider.messageUtils.sendDataSync('mirror:cameras'),
        ).toHaveLength(2);

        // "May I use a camera here?" -- no, at once.
        const answers: unknown[] = [];
        provider.messageUtils.listenOnceForData(
            'reply-1',
            (_e: unknown, value: unknown) => {
                answers.push(value);
            },
        );
        provider.messageUtils.sendData('main:app:ask-camera-access', {
            replyEventName: 'reply-1',
        });
        await flushMicrotasks();
        expect(answers).toEqual([false]);

        // The stream's setup, both ways.
        const sent: string[] = [];
        const push = socket.send.bind(socket);
        socket.send = (packet: unknown) => {
            if (typeof packet === 'string') {
                sent.push(packet);
            } else {
                push(packet);
            }
        };
        const request = {
            type: 'camera-request',
            requestId: '11111111-1111-4111-8111-111111111111',
            deviceId: remote,
            label: 'Front',
        };
        provider.messageUtils.sendData('mirror:camera-send', request);
        expect(sent.map((item) => JSON.parse(item))).toEqual([
            { type: 'camera', packet: request },
        ]);
        const signals: any[] = [];
        provider.messageUtils.listenForData(
            'mirror:camera',
            (_e: unknown, p: any) => {
                signals.push(p);
            },
        );
        socket.send({
            type: 'camera',
            packet: { type: 'camera-close', requestId: request.requestId },
        });
        expect(signals).toEqual([
            { type: 'camera-close', requestId: request.requestId },
        ]);
    });

    test("a browser viewer's camera is watched over the socket, and each frame keeps its key or delta", async () => {
        vi.stubGlobal('WebSocket', FakeWebSocket);
        const { socket, provider } = await connect(
            undefined,
            genContext({
                messages: [
                    {
                        screenId: 0,
                        type: 'foreground',
                        data: {
                            cameraDataList: [
                                { id: 'vd-camera:viewer-1', label: 'Phone' },
                            ],
                        },
                    },
                ],
            }),
        );
        // Its id is not renamed: its frames come over this socket.
        const [message] = provider.screenUtils.getContext().messages;
        expect(message.data.cameraDataList[0].id).toBe('vd-camera:viewer-1');

        const sent: string[] = [];
        const push = socket.send.bind(socket);
        socket.send = (packet: unknown) => {
            if (typeof packet === 'string') {
                sent.push(packet);
            } else {
                push(packet);
            }
        };
        provider.messageUtils.sendData('vd:camera-watch', {
            cameraId: 'vd-camera:viewer-1',
            isWatching: true,
        });
        expect(sent.map((item) => JSON.parse(item))).toEqual([
            {
                type: 'camera-watch',
                cameraId: 'vd-camera:viewer-1',
                isWatching: true,
            },
        ]);

        const frames: any[] = [];
        provider.messageUtils.listenForData(
            'vd:camera-frame',
            (_e: unknown, frame: any) => {
                frames.push(frame);
            },
        );
        const ends: any[] = [];
        provider.messageUtils.listenForData(
            'vd:camera-end',
            (_e: unknown, end: any) => {
                ends.push(end);
            },
        );
        // The packet's `type` names the packet; the frame's own is
        // `frameType`. Lost, no frame was ever a key one and none decoded.
        socket.send({
            type: 'vd-camera-frame',
            cameraId: 'vd-camera:viewer-1',
            frameType: 'key',
            timestamp: 40,
            data: btoa('ÿ'),
        });
        socket.send({
            type: 'vd-camera-frame',
            cameraId: 'vd-camera:viewer-1',
            frameType: 'delta',
            timestamp: 80,
            data: btoa(''),
        });
        expect(frames).toEqual([
            {
                cameraId: 'vd-camera:viewer-1',
                type: 'key',
                timestamp: 40,
                data: new Uint8Array([1, 2, 255]),
            },
            {
                cameraId: 'vd-camera:viewer-1',
                type: 'delta',
                timestamp: 80,
                data: new Uint8Array([3]),
            },
        ]);
        socket.send({ type: 'vd-camera-end', cameraId: 'vd-camera:viewer-1' });
        expect(ends).toEqual([
            { type: 'vd-camera-end', cameraId: 'vd-camera:viewer-1' },
        ]);
    });
});
