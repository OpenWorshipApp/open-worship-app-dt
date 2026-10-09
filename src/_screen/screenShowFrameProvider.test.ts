// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { connectScreenShowFrame } from './screenShowFrameProvider';

const SCREEN_MESSAGE_CHANNEL = 'app:screen:message';

function genHost(overrides: Record<string, unknown> = {}) {
    let frameListener: ((messages: any[]) => void) | null = null;
    const host = {
        sourceScreenId: 1,
        baseProvider: {
            isPagePresenter: true,
            isPageScreen: false,
            isMainPage: true,
            presenterHomePage: '/presenter.html',
            screenHomePage: '/screen.html',
            systemUtils: { isWindows: true },
            messageUtils: {
                messageChannels: { screenMessage: SCREEN_MESSAGE_CHANNEL },
                sendDataSync: vi.fn((channel: string) => `parent:${channel}`),
                sendData: vi.fn(),
            },
            browserUtils: {
                pathToFileURL: vi.fn(),
                openExternalURL: vi.fn(),
            },
            reload: vi.fn(),
        },
        getSetting: vi.fn((key: string) => {
            return key === 'known' ? 'value' : null;
        }),
        getState: vi.fn(() => ({
            stage: 3,
            fontCss: '@font-face{}',
            isWindows: true,
            messages: [{ screenId: 1, type: 'background', data: null }],
        })),
        listen: vi.fn((listener: (messages: any[]) => void) => {
            frameListener = listener;
            return () => {
                frameListener = null;
            };
        }),
        requestSnapshot: vi.fn(),
        resolveResource: vi.fn((filePath: string) => `url:${filePath}`),
        askCameraAccess: vi.fn(async () => true),
        send(messages: any[]) {
            frameListener?.(messages);
        },
        ...overrides,
    };
    return host;
}

function mountHost(host: ReturnType<typeof genHost>, search: string) {
    (globalThis as any).__owaScreenShowFrameHosts = new Map([['k1', host]]);
    globalThis.history.replaceState(null, '', `/vd-screen.html${search}`);
}

describe('connectScreenShowFrame', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        delete (globalThis as any).__owaScreenShowFrameHosts;
    });

    test('refuses a page no window is holding', () => {
        mountHost(genHost(), '?screenId=1&screenShow=other');
        expect(() => connectScreenShowFrame()).toThrow();
        mountHost(genHost(), '?screenId=2&screenShow=k1');
        expect(() => connectScreenShowFrame()).toThrow();
    });

    test('is a muted screen page of the source, named by its own address', () => {
        const host = genHost();
        mountHost(host, '?screenId=1&screenShow=k1');
        const provider: any = connectScreenShowFrame();

        expect(provider.isPageScreen).toBe(true);
        expect(provider.screenHomePage).toBe('/vd-screen.html');
        expect(provider.currentHomePage).toBe('/vd-screen.html');
        // What names the holding window's page is not carried over.
        expect(provider.isPagePresenter).toBeUndefined();
        expect(provider.isMainPage).toBeUndefined();
        expect(provider.systemUtils).toEqual({ isWindows: true });

        const context = provider.screenUtils.getContext();
        expect(context).toMatchObject({
            screenId: 1,
            stage: 3,
            fontCss: '@font-face{}',
            isSoundOwner: false,
            isScreenShowFrame: true,
            messages: [{ screenId: 1, type: 'background', data: null }],
        });
        expect(context.settings.known).toBe('value');
        expect(context.settings.unknown).toBeUndefined();
        expect(
            provider.messageUtils.sendDataSync('mirror:screen-context'),
        ).toBe(context);
    });

    test('answers files, its screen and other reads', () => {
        const host = genHost();
        mountHost(host, '?screenId=1&screenShow=k1');
        const provider: any = connectScreenShowFrame();
        const { messageUtils, browserUtils } = provider;

        expect(browserUtils.pathToFileURL('C:/a.png')).toBe('url:C:/a.png');
        expect(
            messageUtils.sendDataSync('mirror:resource', { filePath: 'b.mp4' }),
        ).toBe('url:b.mp4');
        expect(messageUtils.sendDataSync('main:app:get-screens')).toEqual([1]);
        expect(messageUtils.sendDataSync('main:app:get-theme')).toBe(
            'parent:main:app:get-theme',
        );
    });

    test('follows the source and never drives the presenter', async () => {
        const host = genHost();
        mountHost(host, '?screenId=1&screenShow=k1');
        const provider: any = connectScreenShowFrame();
        const { messageUtils } = provider;

        // Before the page listens: held for it.
        const early = { screenId: 1, type: 'foreground', data: { a: 1 } };
        host.send([early]);
        const listener = vi.fn();
        messageUtils.listenForData(SCREEN_MESSAGE_CHANNEL, listener);
        await Promise.resolve();
        expect(listener).toHaveBeenCalledWith({}, early);

        const later = { screenId: 1, type: 'background', data: { b: 2 } };
        host.send([later]);
        expect(listener).toHaveBeenLastCalledWith({}, later);
        // A copy of its own, not the holding window's object.
        expect(listener.mock.calls.at(-1)![1]).not.toBe(later);

        messageUtils.sendData(SCREEN_MESSAGE_CHANNEL, {
            screenId: 1,
            type: 'init',
        });
        expect(host.requestSnapshot).toHaveBeenCalledOnce();
        messageUtils.sendData(SCREEN_MESSAGE_CHANNEL, {
            screenId: 1,
            type: 'sync-scroll-percentage',
        });
        messageUtils.sendData('app:hide-screen', 1);
        expect(host.baseProvider.messageUtils.sendData).not.toHaveBeenCalled();
    });

    test('asks the holding window whether a camera may open', async () => {
        const host = genHost();
        mountHost(host, '?screenId=1&screenShow=k1');
        const { messageUtils }: any = connectScreenShowFrame();
        const reply = vi.fn();
        messageUtils.listenOnceForData('reply-1', reply);
        messageUtils.sendData('main:app:ask-camera-access', {
            replyEventName: 'reply-1',
        });
        await vi.waitFor(() => {
            expect(reply).toHaveBeenCalledWith({}, true);
        });
    });
});
