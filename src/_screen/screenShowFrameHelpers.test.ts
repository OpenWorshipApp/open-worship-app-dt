// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const contextState: { context: any } = { context: null };
const appProviderMock = {
    isPageScreen: true,
    systemUtils: { isWindows: true },
    screenUtils: {
        getContext: () => contextState.context,
    },
    browserUtils: {
        pathToFileURL: vi.fn((filePath: string) => `published:${filePath}`),
    },
};

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));
// What the foreground manager hands in.
const readers = {
    getSetting: vi.fn((key: string) => `setting:${key}`),
    askCameraAccess: vi.fn(async () => true),
};

class ResizeObserverMock {
    callback: () => void;
    static instances: ResizeObserverMock[] = [];
    constructor(callback: () => void) {
        this.callback = callback;
        ResizeObserverMock.instances.push(this);
    }
    observe() {}
    disconnect = vi.fn();
}

function genPayload(overrides: Record<string, unknown> = {}): any {
    return {
        sourceScreenId: 1,
        width: 1600,
        height: 1000,
        stage: 2,
        isSnapshot: true,
        messages: [
            { screenId: 1, type: 'background', data: { src: 'red' } },
            { screenId: 1, type: 'background-video-time', data: { t: 1 } },
            {
                screenId: 1,
                type: 'effect',
                data: { target: 'background', effect: 'fade' },
            },
        ],
        ...overrides,
    };
}

function getHosts() {
    return (globalThis as any).__owaScreenShowFrameHosts as Map<string, any>;
}

describe('screenShowFrameHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        contextState.context = { fontCss: '@font-face{}' };
        (globalThis as any).ResizeObserver = ResizeObserverMock;
        ResizeObserverMock.instances = [];
        delete (globalThis as any).__owaScreenShowFrameHosts;
        document.body.innerHTML = '';
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('draws nothing of itself, and nothing inside a copy', async () => {
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 1,
            ...readers,
            parentContainer,
            getSnapshot: () => genPayload(),
        });
        contextState.context = { isScreenShowFrame: true };
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            getSnapshot: () => genPayload(),
        });
        expect(parentContainer.children).toHaveLength(0);
    });

    test("draws the source's page at its own size, scaled into the box", async () => {
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            extraStyle: { width: '40%' },
            getSnapshot: () => genPayload(),
        });

        const box = parentContainer.firstElementChild as HTMLDivElement;
        expect(box.style.width).toBe('40%');
        expect(box.style.aspectRatio).toBe('1600 / 1000');
        expect(box.style.overflow).toBe('hidden');
        const iframe = box.querySelector('iframe')!;
        expect(iframe.style.width).toBe('1600px');
        expect(iframe.style.height).toBe('1000px');
        const url = new URL(iframe.src);
        expect(url.pathname).toBe('/vd-screen.html');
        expect(url.searchParams.get('screenId')).toBe('1');
        const key = url.searchParams.get('screenShow')!;
        expect(getHosts().get(key)?.sourceScreenId).toBe(1);

        Object.defineProperty(box, 'clientWidth', { value: 400 });
        ResizeObserverMock.instances[0].callback();
        expect(iframe.style.transform).toBe('scale(0.25)');
    });

    test('is see-through, whatever backing the datum carries', async () => {
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            // What the text overlays' common style put on one placed before
            // the panel stopped giving it.
            extraStyle: {
                width: '40%',
                backgroundColor: '#000080AA',
                backgroundImage: 'linear-gradient(red, blue)',
                backdropFilter: 'blur(5px)',
            },
            getSnapshot: () => genPayload(),
        });

        const box = parentContainer.firstElementChild as HTMLDivElement;
        expect(box.style.width).toBe('40%');
        expect(box.style.backgroundColor).toBe('transparent');
        expect(box.style.backgroundImage).toBe('none');
        expect((box.style as any).backdropFilter).toBe('none');
        const iframe = box.querySelector('iframe')!;
        expect(iframe.style.colorScheme).toBe('normal');
    });

    test('hands the page what it asks for', async () => {
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            getSnapshot: () => genPayload(),
        });
        const host = Array.from(getHosts().values())[0];

        expect(host.getState()).toEqual({
            stage: 2,
            fontCss: '@font-face{}',
            isWindows: true,
            messages: genPayload().messages,
        });
        expect(host.getSetting('screen-x')).toBe('setting:screen-x');
        expect(host.resolveResource('C:/a.png')).toBe('published:C:/a.png');
        await expect(host.askCameraAccess()).resolves.toBe(true);

        const listener = vi.fn();
        host.listen(listener);
        host.requestSnapshot();
        expect(listener).toHaveBeenCalledWith(genPayload().messages);
    });

    test('keeps the state the presenter sent, and passes every change on', async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        // Nothing to draw before the size is known.
        expect(parentContainer.children).toHaveLength(0);

        receiveScreenShowPayload(genPayload());
        expect(parentContainer.querySelector('iframe')).not.toBeNull();
        const host = Array.from(getHosts().values())[0];
        // Only state is kept: a video's time is passed on, never stored.
        expect(host.getState().messages.map(({ type }: any) => type)).toEqual([
            'background',
            'effect',
        ]);

        const listener = vi.fn();
        host.listen(listener);
        const change = {
            screenId: 1,
            type: 'background',
            data: { src: 'blue' },
        };
        receiveScreenShowPayload(
            genPayload({ isSnapshot: false, messages: [change] }),
        );
        expect(listener).toHaveBeenLastCalledWith([change]);
        expect(host.getState().messages[0]).toEqual(change);
    });

    test('a change before any snapshot never stands in for the whole state', async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
        });
        receiveScreenShowPayload(genPayload({ isSnapshot: false }));
        const host = Array.from(getHosts().values())[0];
        expect(host.getState().messages).toEqual([]);
    });

    test('ignores what is not a payload', async () => {
        const { checkHasScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        expect(() => {
            receiveScreenShowPayload(null);
            receiveScreenShowPayload({ sourceScreenId: -1, messages: [] });
            receiveScreenShowPayload(genPayload({ width: 0 }));
        }).not.toThrow();
        expect(checkHasScreenShowFrame(1)).toBe(false);
    });

    test('takes the box down and lets the state go a little later', async () => {
        vi.useFakeTimers();
        const {
            checkHasScreenShowFrame,
            mountScreenShowFrame,
            receiveScreenShowPayload,
        } = await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        const handle = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        receiveScreenShowPayload(genPayload());
        expect(checkHasScreenShowFrame(1)).toBe(true);

        await handle.dispose();
        expect(parentContainer.children).toHaveLength(0);
        expect(getHosts().size).toBe(0);
        expect(checkHasScreenShowFrame(1)).toBe(false);

        // Put up again in its place (Properties changed): the state is there.
        const again = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        expect(parentContainer.querySelector('iframe')).not.toBeNull();
        await again.dispose();
        await vi.advanceTimersByTimeAsync(3000);
        // Gone now: nothing holds it.
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        expect(parentContainer.children).toHaveLength(0);
    });

    test('follows the source to a new size', async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        receiveScreenShowPayload(genPayload());
        receiveScreenShowPayload(
            genPayload({ isSnapshot: false, width: 1920, height: 1080 }),
        );
        const box = parentContainer.firstElementChild as HTMLDivElement;
        expect(box.style.aspectRatio).toBe('1920 / 1080');
        expect(box.querySelector('iframe')!.style.width).toBe('1920px');
        expect(parentContainer.querySelectorAll('iframe')).toHaveLength(1);
    });
});
