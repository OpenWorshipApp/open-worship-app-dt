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

    function genAnimData() {
        return {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async (_element: HTMLElement) => {}),
        };
    }

    test('of a drawing only the whole picture is kept; a stroke, or a kind it does not know, is passed on', async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
        });
        const picture = {
            screenId: 1,
            type: 'draw',
            data: { action: 'sync', strokes: [] },
        };
        const stroke = {
            screenId: 1,
            type: 'draw',
            data: { action: 'stroke', points: [1, 2] },
        };
        const focus = { screenId: 1, type: 'focus', data: { x: 0.5 } };
        const unknown = { screenId: 1, type: 'something-new', data: {} };
        receiveScreenShowPayload(
            genPayload({ messages: [picture, stroke, focus, unknown] }),
        );
        const host = Array.from(getHosts().values())[0];
        expect(host.getState().messages).toEqual([picture, focus]);
    });

    test('a fresh snapshot replaces everything kept before it', async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
        });
        receiveScreenShowPayload(genPayload());
        const foreground = { screenId: 1, type: 'foreground', data: { a: 1 } };
        receiveScreenShowPayload(
            genPayload({ stage: 4, messages: [foreground] }),
        );
        const host = Array.from(getHosts().values())[0];
        expect(host.getState()).toMatchObject({
            stage: 4,
            messages: [foreground],
        });
    });

    test('a snapshot that arrives with no copy up is kept only a little while', async () => {
        vi.useFakeTimers();
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        receiveScreenShowPayload(genPayload({ sourceScreenId: 1 }));
        receiveScreenShowPayload(genPayload({ sourceScreenId: 2 }));
        await vi.advanceTimersByTimeAsync(2999);
        // Still there for a copy put up in time...
        const first = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: first,
        });
        expect(first.querySelector('iframe')).not.toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        // ...but gone for one that comes after it was let go.
        const second = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 2,
            ownScreenId: 0,
            ...readers,
            parentContainer: second,
        });
        expect(second.children).toHaveLength(0);
        // The one a copy draws is kept for as long as it is drawn.
        await vi.advanceTimersByTimeAsync(10_000);
        const third = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: third,
        });
        expect(third.querySelector('iframe')).not.toBeNull();
    });

    test('taking down a copy that never drew leaves no timer behind', async () => {
        vi.useFakeTimers();
        const { checkHasScreenShowFrame, mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const handle = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
        });
        expect(checkHasScreenShowFrame(1)).toBe(true);
        await expect(handle.dispose()).resolves.toBeUndefined();
        expect(checkHasScreenShowFrame(1)).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    test("with no screen context, the copy gets this window's own font faces, addressed in full", async () => {
        contextState.context = {};
        class FontFaceRuleStub {
            constructor(readonly cssText: string) {}
        }
        vi.stubGlobal('CSSFontFaceRule', FontFaceRuleStub);
        const sheets = [
            {
                href: null,
                cssRules: [
                    new FontFaceRuleStub(
                        `@font-face { font-family: "Inline"; src: url('fonts/inline.woff2') format("woff2"); }`,
                    ),
                    { cssText: '.title { color: red; }' },
                ],
            },
            {
                // A cross-origin sheet: its rules cannot be read.
                get cssRules(): never {
                    throw new DOMException('Blocked', 'SecurityError');
                },
            },
            {
                href: 'https://cdn.example.com/css/site.css',
                cssRules: [
                    new FontFaceRuleStub(
                        '@font-face { src: url( "../fonts/linked.ttf" ); }',
                    ),
                ],
            },
        ];
        Object.defineProperty(document, 'styleSheets', {
            configurable: true,
            get: () => sheets,
        });
        try {
            const { mountScreenShowFrame } =
                await import('./screenShowFrameHelpers');
            mountScreenShowFrame({
                sourceScreenId: 1,
                ownScreenId: 0,
                ...readers,
                parentContainer: document.createElement('div'),
                getSnapshot: () => genPayload(),
            });
            const host = Array.from(getHosts().values())[0];
            const inlineHref = new URL('fonts/inline.woff2', location.href)
                .href;
            expect(host.getState().fontCss).toBe(
                [
                    `@font-face { font-family: "Inline"; src: url("${inlineHref}") format("woff2"); }`,
                    '@font-face { src: url("https://cdn.example.com/fonts/linked.ttf"); }',
                ].join('\n'),
            );
        } finally {
            delete (document as any).styleSheets;
            vi.unstubAllGlobals();
        }
    });

    test('a resize that comes after the copy is taken down changes nothing', async () => {
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        const handle = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            getSnapshot: () => genPayload(),
        });
        const box = parentContainer.firstElementChild as HTMLDivElement;
        const iframe = box.querySelector('iframe')!;
        const before = iframe.style.transform;
        const [observer] = ResizeObserverMock.instances;
        await handle.dispose();
        expect(observer.disconnect).toHaveBeenCalledTimes(1);
        Object.defineProperty(box, 'clientWidth', { value: 400 });
        expect(() => observer.callback()).not.toThrow();
        expect(iframe.style.transform).toBe(before);
    });

    test('comes and goes through the transition it is handed, and is removed once that is done', async () => {
        const animData = genAnimData();
        const { mountScreenShowFrame } =
            await import('./screenShowFrameHelpers');
        const parentContainer = document.createElement('div');
        const handle = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
            animData,
            getSnapshot: () => genPayload(),
        });
        const box = parentContainer.firstElementChild as HTMLDivElement;
        expect(box.querySelector('iframe')).not.toBeNull();
        expect(animData.animIn).toHaveBeenCalledWith(box, parentContainer);

        let finishOut!: () => void;
        animData.animOut.mockImplementationOnce(() => {
            return new Promise<void>((resolve) => {
                finishOut = resolve;
            });
        });
        const disposing = handle.dispose();
        expect(animData.animOut).toHaveBeenCalledWith(box);
        // Still in place while it goes out.
        expect(box.parentElement).toBe(parentContainer);
        finishOut();
        await disposing;
        expect(box.parentElement).toBeNull();
    });

    test('a second dispose does nothing, even with a new copy of the same screen up', async () => {
        const animData = genAnimData();
        const {
            checkHasScreenShowFrame,
            mountScreenShowFrame,
            receiveScreenShowPayload,
        } = await import('./screenShowFrameHelpers');
        const old = mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
            animData,
            getSnapshot: () => genPayload(),
        });
        await old.dispose();
        const parentContainer = document.createElement('div');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer,
        });
        await old.dispose();
        expect(animData.animOut).toHaveBeenCalledTimes(1);
        // The new copy still hears the presenter.
        expect(checkHasScreenShowFrame(1)).toBe(true);
        receiveScreenShowPayload(genPayload());
        expect(parentContainer.querySelector('iframe')).not.toBeNull();
    });

    test("a page that stops listening hears nothing more, and an older page's late stop leaves the newer one alone", async () => {
        const { mountScreenShowFrame, receiveScreenShowPayload } =
            await import('./screenShowFrameHelpers');
        mountScreenShowFrame({
            sourceScreenId: 1,
            ownScreenId: 0,
            ...readers,
            parentContainer: document.createElement('div'),
        });
        receiveScreenShowPayload(genPayload());
        const host = Array.from(getHosts().values())[0];
        const older = vi.fn();
        const stopOlder = host.listen(older);
        // The page reloaded: its new document listens in the old one's place.
        const newer = vi.fn();
        const stopNewer = host.listen(newer);
        stopOlder();
        const change = {
            screenId: 1,
            type: 'background',
            data: { src: 'blue' },
        };
        receiveScreenShowPayload(
            genPayload({ isSnapshot: false, messages: [change] }),
        );
        expect(newer).toHaveBeenCalledWith([change]);
        expect(older).not.toHaveBeenCalled();

        stopNewer();
        receiveScreenShowPayload(
            genPayload({ isSnapshot: false, messages: [change] }),
        );
        host.requestSnapshot();
        expect(newer).toHaveBeenCalledTimes(1);
    });
});
