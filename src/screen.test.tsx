// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    provider: {
        screenUtils: undefined as
            undefined | { getContext: () => { fontCss?: string } | null },
        sessionData: {} as Record<string, unknown>,
        messageUtils: { sendData: vi.fn() },
        reload: vi.fn(),
    },
    render: vi.fn(),
    domChangeListeners: [] as (() => void)[],
    removeDomTitle: vi.fn(),
    initAllLangCss: vi.fn(),
}));

vi.mock('./_screen/screen.scss', () => ({}));
vi.mock('./_screen/ScreenAppComp', () => ({
    default: () => <i>ScreenApp</i>,
}));
vi.mock('./server/appProvider', () => ({ default: state.provider }));
vi.mock('./helper/domHelpers', () => ({
    addDomChangeEventListener: (listener: () => void) => {
        state.domChangeListeners.push(listener);
    },
    getParamKeyValue: (search: string, key: string) =>
        new URLSearchParams(search).get(key),
    removeDomTitle: state.removeDomTitle,
}));
vi.mock('./others/rootHelpers', () => ({
    getReactRoot: () => ({ render: state.render }),
}));
vi.mock('./lang/langHelpers', () => ({
    initAllLangCss: state.initAllLangCss,
}));
vi.mock('./setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data/owa' },
}));

let listened: [EventTarget, string, EventListener][] = [];
const originalAddList: [EventTarget, EventTarget['addEventListener']][] = [];

// Remember the listeners the entry adds so each test can take them off: a
// plain wrapper on each target (the window's own method does not go through
// EventTarget.prototype in this environment, and the config's mockReset would
// empty a spy's body).
function recordListeners(target: EventTarget) {
    const original = target.addEventListener;
    originalAddList.push([target, original]);
    target.addEventListener = (type: string, listener: any, options?: any) => {
        listened.push([target, type, listener]);
        return original.call(target, type, listener, options);
    };
}

beforeEach(() => {
    vi.resetModules();
    state.provider.screenUtils = undefined;
    state.provider.sessionData = {};
    state.domChangeListeners = [];
    document.head.innerHTML = '';
    document.body.style.backgroundColor = '';
    listened = [];
    recordListeners(globalThis.window);
    recordListeners(document);
});

afterEach(() => {
    for (const [target, original] of originalAddList.splice(0)) {
        target.addEventListener = original;
    }
    for (const [target, type, listener] of listened) {
        target.removeEventListener(type, listener);
    }
});

async function loadScreen(search: string) {
    globalThis.history.replaceState({}, '', `/screen.html${search}`);
    await import('./screen');
}

function pressKey(init: KeyboardEventInit) {
    document.dispatchEvent(new KeyboardEvent('keyup', init));
}

describe('screen window entry', () => {
    test('draws the screen app transparent over the desktop with the storage path set first', async () => {
        await loadScreen('?screenId=2');

        expect(state.provider.sessionData.defaultStorageDirPath).toBe(
            '/data/owa',
        );
        expect(renderToStaticMarkup(state.render.mock.calls[0][0])).toBe(
            '<i>ScreenApp</i>',
        );
        expect(document.body.style.backgroundColor).toBe('transparent');
        expect(state.domChangeListeners).toEqual([state.removeDomTitle]);
        expect(state.initAllLangCss).toHaveBeenCalledOnce();
        // No screen context: no font sheet is added.
        expect(document.head.querySelector('style')).toBeNull();
    });

    test('adds the fonts the main window handed over', async () => {
        state.provider.screenUtils = {
            getContext: () => ({ fontCss: '@font-face { font-family: X; }' }),
        };

        await loadScreen('?screenId=2');

        expect(document.head.querySelector('style')?.textContent).toBe(
            '@font-face { font-family: X; }',
        );
    });

    test('asks the main window to step the Bible with Ctrl or Alt and the side arrows only', async () => {
        await loadScreen('?screenId=3');
        const { sendData } = state.provider.messageUtils;

        pressKey({ key: 'ArrowRight', ctrlKey: true });
        pressKey({ key: 'ArrowLeft', altKey: true });
        pressKey({ key: 'ArrowRight' });
        pressKey({ key: 'ArrowUp', ctrlKey: true });

        expect(sendData.mock.calls).toEqual([
            ['screen:app:change-bible', { screenId: 3, isNext: true }],
            ['screen:app:change-bible', { screenId: 3, isNext: false }],
        ]);
    });

    test('sends nothing when the window does not know which screen it is', async () => {
        await loadScreen('');

        pressKey({ key: 'ArrowRight', ctrlKey: true });

        expect(state.provider.messageUtils.sendData).not.toHaveBeenCalled();
    });

    test('reloads itself when the display it sits on is resized', async () => {
        await loadScreen('?screenId=1');

        globalThis.dispatchEvent(new Event('resize'));

        expect(state.provider.reload).toHaveBeenCalledOnce();
    });
});
