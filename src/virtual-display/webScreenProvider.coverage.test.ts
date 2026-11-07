import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { VirtualDisplayWebContext } from '../../electron/virtualDisplayProtocol';
import { connectWebScreen } from './webScreenProvider';

// The app provider a screen page gets in a browser: the corners the main
// suite leaves -- the interaction mark on the page, and what each desktop-only
// service answers there instead.
class FakeWebSocket {
    static readonly instances: FakeWebSocket[] = [];
    static readonly OPEN = 1;
    readonly readyState = FakeWebSocket.OPEN;
    private readonly listeners = new Map<string, Array<(event: any) => void>>();

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    addEventListener(type: string, listener: (event: any) => void) {
        this.listeners.set(type, [
            ...(this.listeners.get(type) ?? []),
            listener,
        ]);
    }

    readonly sent: unknown[] = [];

    send(text: string) {
        this.sent.push(JSON.parse(text));
    }

    receive(packet: unknown) {
        for (const listener of this.listeners.get('message') ?? []) {
            listener({ data: JSON.stringify(packet) });
        }
    }
}

const context: VirtualDisplayWebContext = {
    screenId: 0,
    stage: 0,
    settings: {},
    resources: {},
    fontCss: '',
    isWindows: false,
    remote: true,
    isSoundOwner: true,
    display: { id: -500001, label: 'X', width: 1280, height: 720 },
    hostId: '00000000-0000-4000-8000-000000000001',
};

let reload: ReturnType<typeof vi.fn>;

async function connect() {
    reload = vi.fn();
    vi.stubGlobal('location', {
        search: '?vd=1&screenId=0&viewer=abcdefgh',
        protocol: 'http:',
        host: '127.0.0.1:39241',
        pathname: '/vd-screen.html',
        reload,
    });
    const promise = connectWebScreen();
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.receive({ type: 'context', context });
    const { provider } = await promise;
    return { socket, provider: provider as any };
}

beforeEach(() => {
    FakeWebSocket.instances.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('a screen page in a browser', () => {
    test('is marked on the page while the viewer may interact', async () => {
        const root = { dataset: {} as Record<string, string> };
        vi.stubGlobal('document', { documentElement: root });
        const { socket } = await connect();
        expect(root.dataset.vdInteractive).toBeUndefined();
        socket.receive({ type: 'interactive', isInteractive: true });
        expect(root.dataset.vdInteractive).toBe('1');
        // Anything but a plain true is no.
        socket.receive({ type: 'interactive', isInteractive: 'yes' });
        expect(root.dataset.vdInteractive).toBe('0');
    });

    test('with no page to mark, being let interact still lets its ✕ hide the screen', async () => {
        vi.stubGlobal('document', undefined);
        const { socket, provider } = await connect();
        provider.messageUtils.sendData('app:hide-screen', { screenId: 0 });
        expect(socket.sent).toEqual([]);
        expect(() =>
            socket.receive({ type: 'interactive', isInteractive: true }),
        ).not.toThrow();
        provider.messageUtils.sendData('app:hide-screen', { screenId: 0 });
        expect(socket.sent).toEqual([{ type: 'hide' }]);
    });

    test('answers the desktop-only questions as a dark, unzoomed page with no data folder', async () => {
        const { provider } = await connect();
        const { sendDataSync } = provider.messageUtils;
        expect(sendDataSync('main:app:get-theme')).toBe('dark');
        expect(sendDataSync('all:app:get-zoom-factor')).toBe(1);
        expect(sendDataSync('main:app:get-data-path')).toBe('');
    });

    test('opens an outside link in a new tab, cut off from this page', async () => {
        const open = vi.fn();
        vi.stubGlobal('open', open);
        const { provider } = await connect();
        provider.browserUtils.openExternalURL('https://example.org/song');
        expect(open).toHaveBeenCalledExactlyOnceWith(
            'https://example.org/song',
            '_blank',
            'noopener',
        );
    });

    test('has no files, fonts, database or YouTube helper to give', async () => {
        const { provider } = await connect();
        await expect(
            provider.systemUtils.generateFileMD5('/a.mp4'),
        ).resolves.toBe('');
        await expect(provider.ytUtils.getYTHelper()).rejects.toThrow('No yt');
        await expect(provider.fontUtils.getFonts()).resolves.toEqual({});
        await expect(
            provider.databaseUtils.getSQLiteDatabaseInstance(),
        ).rejects.toThrow('No database');
        await expect(provider.init()).resolves.toBeUndefined();
    });

    test('logs an error it is handed, and reloads the page when asked', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { provider } = await connect();
        const cause = new Error('Screen failed to draw');
        provider.appUtils.handleError(cause);
        expect(error).toHaveBeenCalledExactlyOnceWith(cause);
        expect(reload).not.toHaveBeenCalled();
        provider.reload();
        expect(reload).toHaveBeenCalledOnce();
    });
});
