// @vitest-environment jsdom

import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `screen.tsx` is the projector window's entry: it never runs `init()`, so it
// sets up what the screen managers need itself, then draws `ScreenAppComp`.
// Each test re-evaluates the entry; every listener it adds to `document` and
// `window` is recorded and removed again after the test.
const h = vi.hoisted(() => {
    const ScreenAppComp = () => null;
    const removeDomTitle = () => {};
    return {
        ScreenAppComp,
        removeDomTitle,
        events: [] as string[],
        screenUtils: undefined as { getContext: () => any } | undefined,
        sessionData: {} as Record<string, unknown>,
        defaultStorageDirPath: '/data/open-worship-data',
        screenIdParam: null as string | null,
        sendData: vi.fn(),
        reload: vi.fn(),
        addDomChangeEventListener: vi.fn(),
        getParamKeyValue: vi.fn(),
        getReactRoot: vi.fn(),
        rootRender: vi.fn(),
        initAllLangCss: vi.fn(),
    };
});

vi.mock('./_screen/screen.scss', () => ({}));
vi.mock('./_screen/ScreenAppComp', () => ({ default: h.ScreenAppComp }));
vi.mock('./server/appProvider', () => ({
    default: {
        get screenUtils() {
            return h.screenUtils;
        },
        get sessionData() {
            return h.sessionData;
        },
        messageUtils: {
            sendData: (...args: unknown[]) => {
                return h.sendData(...args);
            },
        },
        reload: () => {
            return h.reload();
        },
    },
}));
vi.mock('./helper/domHelpers', () => ({
    addDomChangeEventListener: h.addDomChangeEventListener,
    getParamKeyValue: h.getParamKeyValue,
    removeDomTitle: h.removeDomTitle,
}));
vi.mock('./others/rootHelpers', () => ({ getReactRoot: h.getReactRoot }));
vi.mock('./lang/langHelpers', () => ({ initAllLangCss: h.initAllLangCss }));
vi.mock('./setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorageDirPath() {
            return h.defaultStorageDirPath;
        },
    },
}));

type Listener = [string, EventListenerOrEventListenerObject];
let documentListeners: Listener[] = [];
let windowListeners: Listener[] = [];
let addedStyles: HTMLStyleElement[] = [];

function recordListeners(target: Document | Window, into: Listener[]) {
    const original = target.addEventListener.bind(target);
    return vi
        .spyOn(target, 'addEventListener')
        .mockImplementation((type: string, listener: any, options?: any) => {
            into.push([type, listener]);
            original(type, listener, options);
        });
}

function pressKey(init: KeyboardEventInit) {
    document.dispatchEvent(new KeyboardEvent('keyup', init));
}

async function loadScreen() {
    const stylesBefore = new Set(document.head.querySelectorAll('style'));
    await import('./screen');
    addedStyles = [...document.head.querySelectorAll('style')].filter(
        (style) => {
            return !stylesBefore.has(style);
        },
    );
}

beforeEach(() => {
    vi.resetModules();
    h.events.length = 0;
    h.screenUtils = undefined;
    h.sessionData = {};
    h.defaultStorageDirPath = '/data/open-worship-data';
    h.screenIdParam = '2';
    h.getParamKeyValue.mockImplementation(() => h.screenIdParam);
    h.getReactRoot.mockReturnValue({ render: h.rootRender });
    h.rootRender.mockImplementation(() => {
        h.events.push(`render@${h.sessionData.defaultStorageDirPath}`);
    });
    h.initAllLangCss.mockResolvedValue(undefined);
    documentListeners = [];
    windowListeners = [];
    addedStyles = [];
    recordListeners(document, documentListeners);
    recordListeners(window, windowListeners);
});

afterEach(() => {
    for (const [type, listener] of documentListeners) {
        document.removeEventListener(type, listener);
    }
    for (const [type, listener] of windowListeners) {
        window.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    for (const style of addedStyles) {
        style.remove();
    }
    document.body.style.backgroundColor = '';
});

describe('screen.tsx', () => {
    test('knows the storage folder before it draws the screen app', async () => {
        await loadScreen();

        expect(h.events).toEqual(['render@/data/open-worship-data']);
        expect(h.getReactRoot).toHaveBeenCalledExactlyOnceWith();
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(tree.props.children.type).toBe(h.ScreenAppComp);
        expect(h.addDomChangeEventListener).toHaveBeenCalledExactlyOnceWith(
            h.removeDomTitle,
        );
        expect(document.body.style.backgroundColor).toBe('transparent');
        expect(h.initAllLangCss).toHaveBeenCalledOnce();
    });

    test('adds the font CSS the screen window was opened with', async () => {
        const fontCss = '@font-face { font-family: "app-Xx-Face"; }';
        h.screenUtils = { getContext: () => ({ fontCss }) };
        await loadScreen();

        expect(addedStyles).toHaveLength(1);
        expect(addedStyles[0].textContent).toBe(fontCss);
    });

    test('adds no style without font CSS or without screen utils', async () => {
        h.screenUtils = { getContext: () => ({ fontCss: '' }) };
        await loadScreen();
        expect(addedStyles).toHaveLength(0);

        vi.resetModules();
        h.screenUtils = undefined;
        await loadScreen();
        expect(addedStyles).toHaveLength(0);
        expect(h.rootRender).toHaveBeenCalledTimes(2);
    });

    test('Ctrl/Alt + Left/Right asks the main window to step this screen', async () => {
        await loadScreen();
        expect(h.getParamKeyValue).toHaveBeenCalledExactlyOnceWith(
            globalThis.location.search,
            'screenId',
        );

        pressKey({ key: 'ArrowRight', ctrlKey: true });
        pressKey({ key: 'ArrowLeft', altKey: true });
        expect(h.sendData.mock.calls).toEqual([
            ['screen:app:change-bible', { screenId: 2, isNext: true }],
            ['screen:app:change-bible', { screenId: 2, isNext: false }],
        ]);
    });

    test('ignores arrows without a modifier and other keys with one', async () => {
        await loadScreen();
        pressKey({ key: 'ArrowRight' });
        pressKey({ key: 'ArrowUp', ctrlKey: true });
        pressKey({ key: 'a', altKey: true });
        expect(h.sendData).not.toHaveBeenCalled();
    });

    test('a screen with no id in its URL steps nothing', async () => {
        h.screenIdParam = null;
        await loadScreen();
        pressKey({ key: 'ArrowRight', ctrlKey: true });
        expect(h.sendData).not.toHaveBeenCalled();
    });

    test('reloads when the window is resized', async () => {
        await loadScreen();
        expect(h.reload).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('resize'));
        expect(h.reload).toHaveBeenCalledOnce();
    });
});
