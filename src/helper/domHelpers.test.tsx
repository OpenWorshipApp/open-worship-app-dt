// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    genContextMenuItemIconMock,
    showAppContextMenuMock,
    keyboardRegisterMock,
    keyboardUnregisterMock,
    toEventMapperKeyMock,
    electronSendAsyncMock,
    pasteTextToInputMock,
    bringDomToNearestViewMock,
    checkIsVerticalPartialInvisibleMock,
    bringDomToCenterViewMock,
    checkIsVerticalAtBottomMock,
    getDefaultScreenDisplayMock,
    getFileMD5Mock,
    fsGetFileStampMock,
    sendDataSyncMock,
    sendDataMock,
    listenForDataMock,
    unlockingMock,
    agentFileHandlerMock,
    agentScreenDescribeMock,
    agentPresenterDescribeMock,
    agentPresenterNumberMock,
    agentBibleHandlerMock,
    agentBibleListHandlerMock,
    agentNoteHandlerMock,
    agentUndoHandlerMock,
    agentBibleXmlHandlerMock,
    agentBibleFindHandlerMock,
    agentLookupHandlerMock,
    agentResourcesHandlerMock,
    agentBibleSuggestHandlerMock,
    agentPresentingFlowHandlerMock,
    agentMediaHandlerMock,
    agentForegroundHandlerMock,
    openCalls,
    listenerRegistry,
} = vi.hoisted(() => ({
    genContextMenuItemIconMock: vi.fn((name: string) => `icon:${name}`),
    showAppContextMenuMock: vi.fn(),
    keyboardRegisterMock: vi.fn(
        (_keys?: string[], _handler?: (event: any) => void) => [
            'escape-listener',
        ],
    ),
    keyboardUnregisterMock: vi.fn(),
    toEventMapperKeyMock: vi.fn(() => 'escape-key'),
    electronSendAsyncMock: vi.fn(),
    pasteTextToInputMock: vi.fn(),
    bringDomToNearestViewMock: vi.fn(),
    checkIsVerticalPartialInvisibleMock: vi.fn(),
    bringDomToCenterViewMock: vi.fn(),
    checkIsVerticalAtBottomMock: vi.fn(),
    getDefaultScreenDisplayMock: vi.fn(() => ({
        bounds: { width: 1280, height: 720 },
    })),
    getFileMD5Mock: vi.fn(async (_filePath: string): Promise<string | null> => {
        return null;
    }),
    fsGetFileStampMock: vi.fn(async (_filePath: string) => {
        return { size: 1, modifiedAt: 1 } as {
            size: number;
            modifiedAt: number;
        } | null;
    }),
    sendDataSyncMock: vi.fn(),
    sendDataMock: vi.fn(),
    listenForDataMock: vi.fn(
        (channel: string, callback: (...args: any[]) => void) => {
            listenerRegistry[channel] = callback;
        },
    ),
    unlockingMock: vi.fn(
        async (_key: string, callback: () => Promise<unknown>) => {
            return await callback();
        },
    ),
    openCalls: [] as Array<{
        url?: string | URL | undefined;
        target?: string;
        features?: string;
    }>,
    listenerRegistry: {} as Record<string, (...args: any[]) => void>,
    agentFileHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'file',
        token: detail?.token,
    })),
    agentScreenDescribeMock: vi.fn((_options?: unknown) => ({
        isAuthoritative: false,
        screens: [] as { id: number }[],
    })),
    agentPresenterDescribeMock: vi.fn(async () => ({ kind: 'presenter' })),
    agentPresenterNumberMock: vi.fn(async (screens: unknown) => ({
        screenSummary: screens,
        numbered: true,
    })),
    agentBibleHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'bible',
        token: detail?.token,
    })),
    agentBibleListHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'bible-item',
        token: detail?.token,
    })),
    agentNoteHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'note',
        token: detail?.token,
    })),
    agentUndoHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'undo',
        token: detail?.token,
    })),
    agentBibleXmlHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'bible-xml',
        token: detail?.token,
    })),
    agentBibleFindHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'bible-find',
        token: detail?.token,
    })),
    agentLookupHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'lookup',
        token: detail?.token,
    })),
    agentResourcesHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'resources',
        token: detail?.token,
    })),
    agentBibleSuggestHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'bible-suggest',
        token: detail?.token,
    })),
    agentPresentingFlowHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'presenting-flow',
        token: detail?.token,
    })),
    agentMediaHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'media',
        token: detail?.token,
    })),
    agentForegroundHandlerMock: vi.fn(async (detail: any) => ({
        kind: 'foreground',
        token: detail?.token,
    })),
}));

vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: genContextMenuItemIconMock,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../event/KeyboardEventListener', () => ({
    default: {
        registerEventListener: keyboardRegisterMock,
        unregisterEventListener: keyboardUnregisterMock,
        toEventMapperKey: toEventMapperKeyMock,
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
    pasteTextToInput: pasteTextToInputMock,
}));

vi.mock('./helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    APP_AUTO_HIDE_CLASSNAME: 'app-auto-hide',
    bringDomToNearestView: bringDomToNearestViewMock,
    checkIsVerticalPartialInvisible: checkIsVerticalPartialInvisibleMock,
    bringDomToCenterView: bringDomToCenterViewMock,
    checkIsVerticalAtBottom: checkIsVerticalAtBottomMock,
}));

// Partial mock: only `useAppEffectAsync` is swapped for a plain `useEffect`.
// A full replacement would drop sibling exports the module under test also
// uses (`useAppEffect`), which fails as an undefined call rather than anything
// legible.
vi.mock('./appHooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./appHooks')>();
    return {
        ...actual,
        useAppEffectAsync: (
            effectMethod: (methods: Record<string, unknown>) => Promise<void>,
            deps: readonly unknown[],
            methods?: Record<string, unknown>,
        ) => {
            const methodContext = methods === undefined ? {} : { ...methods };
            /* eslint-disable react-hooks/exhaustive-deps */
            useEffect(() => {
                void effectMethod(methodContext);
            }, deps);
            /* eslint-enable react-hooks/exhaustive-deps */
        },
    };
});

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: getDefaultScreenDisplayMock,
}));

vi.mock('../others/CacheManager', () => ({
    default: class CacheManagerMock<T> {
        private readonly store = new Map<string, T>();

        async has(key: string) {
            return this.hasSync(key);
        }

        // The real one expires entries on its own timer, so the screenshot
        // budget asks it which of its ledger rows still exist. No TTL here —
        // whatever was set is still there.
        hasSync(key: string) {
            return this.store.has(key);
        }

        async get(key: string) {
            return this.getSync(key);
        }

        getSync(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.setSync(key, value);
        }

        setSync(key: string, value: T) {
            this.store.set(key, value);
        }

        async delete(key: string) {
            this.store.delete(key);
        }

        deleteSync(key: string) {
            this.store.delete(key);
        }
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        POPUP_FRAME_NAME_PREFIX: 'owa-frame',
        aboutHomePage: 'https://app.local/about',
        chatbotHomePage: 'https://app.local/chatbot',
        messageUtils: {
            sendDataSync: sendDataSyncMock,
            sendData: sendDataMock,
            listenForData: listenForDataMock,
        },
        // `appHooks` reads this at MODULE LOAD to pick between its dev-only
        // `useAppEffect` wrapper and the plain `useEffect`, so a mock without
        // it throws while importing, not while running.
        systemUtils: { isDev: false },
    },
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

// `capturingHelpers` reaches these three, on demand and only for a `file:`
// url, to key a local page's screenshot by the md5 of its own bytes. Mocked
// whole rather than partially: nothing else in this file's graph loads that
// module, and a real one wants an `appProvider` this test has no use for.
vi.mock('../server/fileHelpers', () => ({
    toFilePathFromFileUrl: (src: string) => {
        return decodeURIComponent(new URL(src).pathname);
    },
    fsGetFileStamp: fsGetFileStampMock,
    getFileMD5: getFileMD5Mock,
}));

vi.mock('./agentFileHelpers', () => ({
    handleAgentFileRequest: agentFileHandlerMock,
}));
vi.mock('./agentScreenHelpers', () => ({
    describeScreensForAgent: agentScreenDescribeMock,
}));
vi.mock('./agentPresenterHelpers', () => ({
    describePresenterForAgent: agentPresenterDescribeMock,
    numberScreenSlidesForAgent: agentPresenterNumberMock,
}));
vi.mock('./agentBibleHelpers', () => ({
    handleAgentBibleRequest: agentBibleHandlerMock,
}));
vi.mock('./agentBibleListHelpers', () => ({
    handleAgentBibleListRequest: agentBibleListHandlerMock,
}));
vi.mock('./agentNoteHelpers', () => ({
    handleAgentNoteRequest: agentNoteHandlerMock,
}));
vi.mock('./agentBackupHelpers', () => ({
    handleAgentUndoRequest: agentUndoHandlerMock,
}));
vi.mock('./agentBibleXMLHelpers', () => ({
    handleAgentBibleXMLRequest: agentBibleXmlHandlerMock,
}));
vi.mock('./agentBibleFindHelpers', () => ({
    handleAgentBibleFindRequest: agentBibleFindHandlerMock,
}));
vi.mock('./agentLookupHelpers', () => ({
    handleAgentLookupRequest: agentLookupHandlerMock,
}));
vi.mock('./agentResourcesHelpers', () => ({
    handleAgentResourcesRequest: agentResourcesHandlerMock,
}));
vi.mock('./agentBibleSuggestHelpers', () => ({
    handleAgentBibleSuggestRequest: agentBibleSuggestHandlerMock,
}));
vi.mock('./agentPresentingFlowHelpers', () => ({
    handleAgentPresentingFlowRequest: agentPresentingFlowHandlerMock,
}));
vi.mock('./agentMediaFileHelpers', () => ({
    handleAgentMediaFileRequest: agentMediaHandlerMock,
}));
vi.mock('./agentForegroundHelpers', () => ({
    handleAgentForegroundRequest: agentForegroundHandlerMock,
}));

import {
    HoverMotionHandler,
    InputContextMenuHandler,
    addDomChangeEventListener,
    checkIsDisabled,
    checkIsZoomed,
    escapeSelectorValue,
    findVerticalScrollingParent,
    getParamFileFullName,
    getParamIdNum,
    handleActiveSelectedElementScrolling,
    handleAutoHide,
    handleClassNameAction,
    handleFullWidgetView,
    notifyElementHighlight,
    openPopupWindow,
    removeDomChangeEventListener,
    removeDomTitle,
    setParamFileFullName,
    setParamIdNum,
    setParamKeyValue,
} from './domHelpers';
import {
    captureWebScreenShot,
    refreshWebCapturing,
    useWebCapturing,
} from './capturingHelpers';

describe('domHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useFakeTimers();
        openCalls.length = 0;
        container = document.createElement('div');
        document.body.appendChild(container);
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            configurable: true,
            value: {
                readText: vi.fn(async () => ' copied '),
            },
        });
        Object.defineProperty(globalThis, 'open', {
            configurable: true,
            value: vi.fn(
                (url?: string | URL, target?: string, features?: string) => {
                    openCalls.push({ url, target, features });
                    return null;
                },
            ),
        });
        class ResizeObserverMock {
            observe = vi.fn();
            constructor(public callback: () => void) {}
        }
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: ResizeObserverMock,
        });
        sendDataSyncMock.mockReturnValue(1);
        electronSendAsyncMock.mockResolvedValue('image-data');
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
        vi.useRealTimers();
    });

    test('notifies DOM change listeners for added, removed, and modified nodes', async () => {
        const listener = vi.fn();
        addDomChangeEventListener(listener);

        const node = document.createElement('div');
        document.body.appendChild(node);
        await Promise.resolve();

        node.setAttribute('data-test', '1');
        await Promise.resolve();

        node.remove();
        await Promise.resolve();

        expect(listener).toHaveBeenCalledWith(node, 'added');
        expect(listener).toHaveBeenCalledWith(node, 'attr-modified');
        expect(listener).toHaveBeenCalledWith(node, 'removed');

        removeDomChangeEventListener(listener);
    });

    test('handles full-view escape logic and class-name actions', () => {
        const element = document.createElement('div');
        element.classList.add('app-full-view', 'target-class');

        handleFullWidgetView(element, 'attr-modified');
        expect(toEventMapperKeyMock).toHaveBeenCalledWith({ key: 'Escape' });
        expect(keyboardRegisterMock).toHaveBeenCalledWith(
            ['escape-key'],
            expect.any(Function),
        );

        const keyboardHandler = keyboardRegisterMock.mock.calls[0][1];
        if (!keyboardHandler) {
            throw new TypeError('Missing keyboard handler');
        }
        const stopPropagation = vi.fn();
        const preventDefault = vi.fn();
        keyboardHandler({ stopPropagation, preventDefault });
        expect(stopPropagation).toHaveBeenCalledTimes(1);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(keyboardUnregisterMock).toHaveBeenCalledWith([
            'escape-listener',
        ]);
        expect(element.classList.contains('app-full-view')).toBe(false);

        const handle = vi.fn();
        handleClassNameAction('target-class', handle, element, 'attr-modified');
        expect(handle).toHaveBeenCalledWith(element);
    });

    test('ignores unrelated mutations and finds the actual scroll container', () => {
        const fullView = document.createElement('div');
        fullView.classList.add('app-full-view');
        handleFullWidgetView(fullView, 'attr-modified');
        handleFullWidgetView(fullView, 'attr-modified');
        expect(keyboardRegisterMock).toHaveBeenCalledTimes(1);
        fullView.classList.remove('app-full-view');
        handleFullWidgetView(fullView, 'attr-modified');
        expect(keyboardUnregisterMock).toHaveBeenCalledWith([
            'escape-listener',
        ]);
        handleFullWidgetView(
            document.createTextNode('not an element'),
            'added',
        );

        const action = vi.fn();
        const ordinary = document.createElement('div');
        ordinary.classList.add('target-class');
        handleClassNameAction('target-class', action, ordinary, 'added');
        expect(action).not.toHaveBeenCalled();
        ordinary.classList.remove('target-class');
        handleClassNameAction(
            'target-class',
            action,
            ordinary,
            'attr-modified',
        );
        expect(action).not.toHaveBeenCalled();

        const target = document.createElement('button');
        const disabledAncestor = document.createElement('div');
        disabledAncestor.classList.add('is-disabled');
        disabledAncestor.append(target);
        expect(checkIsDisabled(target)).toBe(true);
        handleActiveSelectedElementScrolling(target);
        expect(bringDomToNearestViewMock).not.toHaveBeenCalled();

        const outer = document.createElement('div');
        const inner = document.createElement('div');
        const leaf = document.createElement('span');
        outer.style.overflowY = 'auto';
        Object.defineProperties(outer, {
            scrollHeight: { configurable: true, value: 300 },
            clientHeight: { configurable: true, value: 100 },
        });
        inner.append(leaf);
        outer.append(inner);
        document.body.append(outer);
        expect(findVerticalScrollingParent(leaf)).toBe(outer);
        outer.style.overflowY = 'hidden';
        expect(getComputedStyle(outer).overflowY).toBe('hidden');
        expect(findVerticalScrollingParent(leaf)).toBeNull();
        outer.remove();

        expect(escapeSelectorValue('a b')).toBe('a b');
        history.replaceState({}, '', '/preview?keep=one');
        expect(setParamKeyValue('/preview?keep=one', 'name', 'two words')).toBe(
            '/preview?keep=one&name=two+words',
        );
        expect(setParamIdNum('https://app.local/open', 42)).toBe(
            'https://app.local/open?id=42',
        );
        expect(setParamFileFullName('/open', 'song.owa')).toBe(
            '/open?file=song.owa',
        );
        expect(getParamIdNum('/open?id=not-a-number')).toBeNull();
    });

    test('scrolls selected elements to the center or nearest view as needed', () => {
        const target = document.createElement('div');
        target.dataset.scrollContainerSelector = '#scroll-container';
        const containerElement = document.createElement('div');
        containerElement.id = 'scroll-container';
        document.body.appendChild(containerElement);

        checkIsVerticalPartialInvisibleMock.mockReturnValue(true);
        checkIsVerticalAtBottomMock.mockReturnValue(true);
        handleActiveSelectedElementScrolling(target);
        expect(bringDomToCenterViewMock).toHaveBeenCalledWith(target);

        checkIsVerticalPartialInvisibleMock.mockReturnValue(false);
        handleActiveSelectedElementScrolling(target);
        expect(bringDomToNearestViewMock).toHaveBeenCalledWith(target);
    });

    test('adds auto-hide controls and re-hides content after interaction', async () => {
        const parent = document.createElement('div');
        const panel = document.createElement('div');
        parent.appendChild(panel);
        const oldButton = document.createElement('i');
        oldButton.className = 'auto-hide-button';
        parent.appendChild(oldButton);

        handleAutoHide(panel);

        const clearButton = parent.querySelector(
            '.auto-hide-button',
        ) as HTMLElement | null;
        expect(oldButton.isConnected).toBe(false);
        expect(panel.classList.contains('app-auto-hide')).toBe(true);
        expect(clearButton?.title).toBe('Reveal Hidden Controls');

        clearButton?.click();
        expect(panel.classList.contains('auto-hide-show')).toBe(true);

        panel.dispatchEvent(new Event('mouseleave'));
        vi.advanceTimersByTime(1000);
        panel.dispatchEvent(new Event('mouseenter'));
        vi.advanceTimersByTime(1500);
        expect(panel.classList.contains('auto-hide-show')).toBe(true);
        panel.dispatchEvent(new Event('mouseleave'));
        vi.advanceTimersByTime(2000);
        expect(panel.classList.contains('auto-hide-show')).toBe(false);
        expect(clearButton?.style.display).toBe('block');

        const detached = document.createElement('div');
        handleAutoHide(detached);
        expect(detached.classList.contains('app-auto-hide')).toBe(false);
    });

    test('tracks hover-motion widths and input context menus', async () => {
        const wrapper = document.createElement('div');
        wrapper.className = HoverMotionHandler.topClassname;
        const child = document.createElement('div');
        child.className = HoverMotionHandler.lowDisplayClassname;
        child.dataset.minParentWidth = '100';
        Object.defineProperty(wrapper, 'offsetWidth', {
            configurable: true,
            value: 120,
        });
        wrapper.appendChild(child);

        const hoverHandler = new HoverMotionHandler();
        hoverHandler.listenForHoverMotion(wrapper);
        expect(child.classList.contains('force-show')).toBe(true);

        const inputHandler = new InputContextMenuHandler();
        const inputWrapper = document.createElement('div');
        inputWrapper.innerHTML = '<input type="text" value="hello" />';
        inputHandler.listenForInputContextMenu(inputWrapper);
        const input = inputWrapper.querySelector('input') as HTMLInputElement;

        await input.oncontextmenu?.({} as PointerEvent);
        expect(showAppContextMenuMock).toHaveBeenCalledTimes(1);
        const menuItems = showAppContextMenuMock.mock.calls[0][1];
        expect(
            menuItems.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['Paste', 'Clear']);
        menuItems[0].onSelect();
        menuItems[1].onSelect();
        expect(pasteTextToInputMock).toHaveBeenCalledWith(input, 'copied');
        expect(pasteTextToInputMock).toHaveBeenCalledWith(input, '');
        expect(genContextMenuItemIconMock).toHaveBeenCalledWith('clipboard');
        expect(genContextMenuItemIconMock).toHaveBeenCalledWith('x');

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { readText: vi.fn(async () => '') },
        });
        const emptyInput = document.createElement('input');
        inputHandler.init(emptyInput);
        await emptyInput.oncontextmenu?.({} as PointerEvent);
        expect(showAppContextMenuMock).toHaveBeenCalledTimes(1);
    });

    test('removes titles, checks zoom state, and opens popup windows', async () => {
        const titled = document.createElement('div');
        titled.title = 'Parent';
        titled.innerHTML = '<span title="Child"></span>';
        await removeDomTitle(titled, 'added');
        expect(titled.title).toBe('');
        expect((titled.firstElementChild as HTMLElement).title).toBe('');

        sendDataSyncMock.mockReturnValueOnce(1).mockReturnValueOnce(1.25);
        expect(checkIsZoomed()).toBe(false);
        expect(checkIsZoomed()).toBe(true);

        history.replaceState({}, '', '/preview?id=42&file=test.owa');
        expect(getParamIdNum(globalThis.location.href)).toBe(42);
        expect(getParamFileFullName(globalThis.location.href)).toBe('test.owa');

        openPopupWindow('/settings', 'frame-1', 'uuid-1', {
            width: 320,
            appTopToMain: false,
        });
        const settingsUrl = new URL('/settings', location.href);
        settingsUrl.searchParams.set('uuid', 'uuid-1');
        expect(openCalls[0]).toEqual({
            url: settingsUrl.toString(),
            target: 'owa-frame_frame-1',
            features: 'popup,width=320,appTopToMain=false',
        });

        // Blink features are `+`-joined (the features string already uses
        // `,`/`=`) and force `noopener`, without which the popup lands in the
        // opener's renderer process and the features are ignored.
        openPopupWindow('/experiment', 'frame-2', 'uuid-2', {
            appBlinkFeatures: ['CanvasDrawElement', 'SomethingElse'],
        });
        expect(openCalls[1]?.features).toBe(
            'popup,appBlinkFeatures=CanvasDrawElement+SomethingElse,noopener',
        );

        openPopupWindow('/experiment', 'frame-3', 'uuid-3', {
            appBlinkFeatures: [],
        });
        expect(openCalls[2]?.features).toBe('popup');
    });

    // The user's word: _open from taskbar no need confirmation_. Every other
    // way in asks the caution, which is asynchronous; this one opens in the
    // same turn, before any question could have been put.
    test('the taskbar task opens the help at once, with no caution', () => {
        listenerRegistry['main:app:open-chatbot-from-taskbar']?.();

        expect(openCalls).toHaveLength(1);
        expect(openCalls[0]?.url).toContain(
            'https://app.local/chatbot?uuid=chatbot',
        );
    });

    test('relays agent requests and guide events with their results and tokens', async () => {
        const request = async (eventName: string, detail: unknown) => {
            const answer = new Promise<CustomEvent>((resolve) => {
                document.addEventListener(
                    `${eventName}-answer`,
                    (event) => resolve(event as CustomEvent),
                    { once: true },
                );
            });
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
            return (await answer).detail;
        };

        expect(await request('owa-agent-file', { token: 11 })).toEqual({
            token: 11,
            result: { kind: 'file', token: 11 },
        });
        agentFileHandlerMock.mockRejectedValueOnce(new Error('bad file'));
        expect(await request('owa-agent-file', { token: 12 })).toEqual({
            token: 12,
            result: { isError: true, reason: 'bad file' },
        });
        expect(await request('owa-agent-screens', { token: 13 })).toEqual({
            token: 13,
            result: { isAuthoritative: false, screens: [] },
        });

        agentScreenDescribeMock.mockReturnValueOnce({
            isAuthoritative: true,
            screens: [{ id: 4 }],
        });
        expect(await request('owa-agent-screens', { token: 14 })).toEqual({
            token: 14,
            result: {
                screenSummary: { isAuthoritative: true, screens: [{ id: 4 }] },
                numbered: true,
            },
        });
        expect(agentPresenterNumberMock).toHaveBeenCalledTimes(1);
        expect(await request('owa-agent-presenter', { token: 15 })).toEqual({
            token: 15,
            result: { kind: 'presenter' },
        });
        expect(await request('owa-agent-bible', { token: 16 })).toEqual({
            token: 16,
            result: { kind: 'bible', token: 16 },
        });
        expect(await request('owa-agent-foreground', { token: 17 })).toEqual({
            token: 17,
            result: { kind: 'foreground', token: 17 },
        });

        const domains = [
            ['bible-item', { kind: 'bible-item', token: 20 }],
            ['note', { kind: 'note', token: 21 }],
            ['undo', { kind: 'undo', token: 22 }],
            ['bible-xml', { kind: 'bible-xml', token: 23 }],
            ['bible-find', { kind: 'bible-find', token: 24 }],
            ['lookup', { kind: 'lookup', token: 25 }],
            ['resources', { kind: 'resources', token: 26 }],
            ['bible-suggest', { kind: 'bible-suggest', token: 27 }],
            ['presenting-flow', { kind: 'presenting-flow', token: 28 }],
            ['media', { kind: 'media', token: 29 }],
        ] as const;
        for (const [domain, result] of domains) {
            expect(
                await request('owa-agent-data', {
                    domain,
                    token: result.token,
                }),
            ).toEqual({ token: result.token, result });
        }
        expect(
            await request('owa-agent-data', { domain: 'constructor' }),
        ).toEqual({
            result: {
                isError: true,
                reason: 'Unknown kind of data "constructor".',
            },
        });

        document.dispatchEvent(
            new CustomEvent('owa-guide-running', { detail: { isRunning: 1 } }),
        );
        expect(sendDataMock).toHaveBeenCalledWith('all:app:guide-running', {
            isRunning: false,
        });
        document.dispatchEvent(
            new CustomEvent('owa-guide-running', {
                detail: { isRunning: true },
            }),
        );
        expect(sendDataMock).toHaveBeenLastCalledWith('all:app:guide-running', {
            isRunning: true,
        });
        const help = { token: 31, step: 'open settings' };
        document.dispatchEvent(
            new CustomEvent('owa-guide-help', { detail: help }),
        );
        expect(sendDataMock).toHaveBeenLastCalledWith(
            'all:app:guide-help',
            help,
        );

        let helpAnswer: unknown;
        document.addEventListener(
            'owa-guide-help-answer',
            (event) => {
                helpAnswer = (event as CustomEvent).detail;
            },
            { once: true },
        );
        listenerRegistry['main:app:guide-help-answer']?.(null, {
            token: 31,
            text: 'Select Settings',
        });
        expect(helpAnswer).toEqual({ token: 31, text: 'Select Settings' });
    });

    test('registers the about page listener and highlights newly added elements', async () => {
        listenerRegistry['main:app:open-about-page']?.();
        expect(openCalls).toHaveLength(1);
        expect(openCalls[0]?.url).toContain(
            'https://app.local/about?uuid=about',
        );

        let element: HTMLDivElement | null = null;
        const moveToView = vi.fn();
        const notificationPromise = notifyElementHighlight(() => element, {
            moveToView,
        });

        element = document.createElement('div');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
            await notificationPromise;
        });

        expect(moveToView).toHaveBeenCalledWith(element);
        vi.advanceTimersByTime(100);
        expect(
            element.classList.contains('app-notify-element-highlight-success'),
        ).toBe(true);
        vi.advanceTimersByTime(2200);
        expect(
            element.classList.contains('app-notify-element-highlight-success'),
        ).toBe(false);

        const skipElement = document.createElement('div');
        await notifyElementHighlight(() => skipElement, {
            shouldSkipHighlighting: true,
        });
        expect(bringDomToNearestViewMock).toHaveBeenCalledWith(skipElement);
    });

    test('caches web screenshots and exposes useWebCapturing', async () => {
        vi.useRealTimers();
        electronSendAsyncMock
            .mockResolvedValueOnce('capture-image')
            .mockResolvedValueOnce('hook-image');
        const firstCapture = await captureWebScreenShot('https://example.com', {
            width: 640,
            height: 360,
            delay: 250,
        });
        const secondCapture = await captureWebScreenShot(
            'https://example.com',
            {
                width: 640,
                height: 360,
                delay: 250,
            },
        );
        expect(firstCapture).toBe('capture-image');
        expect(secondCapture).toBe('capture-image');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);

        const observedValues: Array<string | null | undefined> = [];
        function Probe() {
            const value = useWebCapturing('https://example.com/page');
            useEffect(() => {
                observedValues.push(value);
            }, [value]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(getDefaultScreenDisplayMock).toHaveBeenCalledTimes(1);
        expect(observedValues).toContain(undefined);
        expect(observedValues).toContain('hook-image');
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:capture-web-screen-shot',
            {
                url: 'https://example.com/page',
                width: 1280,
                height: 720,
                delay: 3000,
            },
        );
    });

    test('keys a local page by the md5 of its own bytes', async () => {
        const url = 'file:///webs/snow.html';
        const options = { width: 320, height: 180, delay: 0 };
        getFileMD5Mock.mockResolvedValue('md5-one');
        electronSendAsyncMock.mockResolvedValue('file-image');

        expect(await captureWebScreenShot(url, options)).toBe('file-image');
        expect(await captureWebScreenShot(url, options)).toBe('file-image');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
        // The md5 is memoised against what a stat can see, so a panel of tiles
        // asking about one file does not read it once per tile.
        expect(getFileMD5Mock).toHaveBeenCalledTimes(1);

        // Edited in the app's own web editor: new bytes, new key, new picture.
        getFileMD5Mock.mockResolvedValue('md5-two');
        fsGetFileStampMock.mockResolvedValue({ size: 2, modifiedAt: 2 });
        electronSendAsyncMock.mockResolvedValue('edited-image');
        expect(await captureWebScreenShot(url, options)).toBe('edited-image');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
    });

    test('a page it cannot hash is cached the way a web address is', async () => {
        const options = { width: 320, height: 180, delay: 0 };
        electronSendAsyncMock.mockResolvedValue('remote-image');

        // Nothing at that path: no md5, so no promise can be made about the
        // bytes, and the shot falls back to the url key that expires.
        fsGetFileStampMock.mockResolvedValue(null);
        expect(
            await captureWebScreenShot('file:///webs/gone.html', options),
        ).toBe('remote-image');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
        expect(getFileMD5Mock).not.toHaveBeenCalled();

        // And a web address never asks the disk anything at all.
        await captureWebScreenShot('https://example.com/unhashed', options);
        expect(fsGetFileStampMock).toHaveBeenCalledTimes(1);
    });

    test('skips the blocking display lookup when the caller knows its size', async () => {
        vi.useRealTimers();
        electronSendAsyncMock.mockResolvedValue('sized-image');

        function Probe() {
            useWebCapturing('https://example.com/sized', {
                width: 800,
                height: 600,
            });
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // `getDefaultScreenDisplay` is a BLOCKING sync IPC; a caller that
        // supplies both dimensions must never pay for it.
        expect(getDefaultScreenDisplayMock).not.toHaveBeenCalled();
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:capture-web-screen-shot',
            {
                url: 'https://example.com/sized',
                width: 800,
                height: 600,
                delay: 3000,
            },
        );
    });

    test('never captures while disabled', async () => {
        vi.useRealTimers();
        electronSendAsyncMock.mockResolvedValue('never');

        function Probe() {
            useWebCapturing('https://example.com/offscreen', {
                width: 800,
                height: 600,
                isEnabled: false,
            });
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(electronSendAsyncMock).not.toHaveBeenCalled();
    });

    test('runs at most two captures at a time', async () => {
        vi.useRealTimers();
        let inFlight = 0;
        let peakInFlight = 0;
        const releaseList: (() => void)[] = [];
        electronSendAsyncMock.mockImplementation(() => {
            inFlight++;
            peakInFlight = Math.max(peakInFlight, inFlight);
            return new Promise((resolve) => {
                releaseList.push(() => {
                    inFlight--;
                    resolve('queued-image');
                });
            });
        });

        // Six DISTINCT urls, so the per-key dedup cannot collapse them: only
        // the concurrency gate can. Each capture opens a hidden BrowserWindow,
        // so an ungated slide list would run all six at once.
        const captures = Array.from({ length: 6 }, (_unused, index) => {
            return captureWebScreenShot(`https://example.com/q${index}`, {
                width: 320,
                height: 240,
                delay: 0,
            });
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(peakInFlight).toBe(2);

        while (releaseList.length > 0) {
            releaseList.shift()?.();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        await Promise.all(captures);
        expect(peakInFlight).toBe(2);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(6);
    });

    test('refreshWebCapturing drops the cached shot and re-captures', async () => {
        vi.useRealTimers();
        electronSendAsyncMock
            .mockResolvedValueOnce('first-shot')
            .mockResolvedValueOnce('second-shot');
        const options = { width: 400, height: 300, delay: 0 };

        expect(
            await captureWebScreenShot('https://example.com/clock', options),
        ).toBe('first-shot');
        // Cached: no second trip.
        expect(
            await captureWebScreenShot('https://example.com/clock', options),
        ).toBe('first-shot');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);

        // A clock page never self-invalidates, so this is the only way out.
        refreshWebCapturing('https://example.com/clock');

        expect(
            await captureWebScreenShot('https://example.com/clock', options),
        ).toBe('second-shot');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
    });

    test('evicts old screenshots once the size budget is exceeded', async () => {
        vi.useRealTimers();
        // Two shots of ~4M chars each blow the ~6M budget, so writing the
        // second must evict the first — a count-based cap would have kept both.
        const bigImage = 'x'.repeat(4e6);
        electronSendAsyncMock.mockResolvedValue(bigImage);
        const options = { width: 128, height: 128, delay: 0 };

        await captureWebScreenShot('https://example.com/big-a', options);
        await captureWebScreenShot('https://example.com/big-b', options);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);

        // The newest survives...
        await captureWebScreenShot('https://example.com/big-b', options);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
        // ...the evicted one is re-captured.
        await captureWebScreenShot('https://example.com/big-a', options);
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });

    test('url params round-trip while keeping the caller url shape', async () => {
        const {
            getParamFileFullName,
            getParamIdNum,
            getParamKeyValue,
            setParamFileFullName,
            setParamIdNum,
            setParamKeyValue,
        } = await import('./domHelpers');

        // a relative path stays relative
        expect(setParamKeyValue('/reader.html', 'tab', 'bible')).toBe(
            '/reader.html?tab=bible',
        );
        expect(getParamKeyValue('/reader.html?tab=bible', 'tab')).toBe('bible');
        expect(getParamKeyValue('/reader.html', 'tab')).toBeNull();

        // ...and an absolute url stays absolute
        expect(
            setParamKeyValue('https://app.test/reader.html', 'tab', 'bible'),
        ).toBe('https://app.test/reader.html?tab=bible');

        expect(setParamIdNum('/editor.html', 7)).toBe('/editor.html?id=7');
        expect(getParamIdNum('/editor.html?id=7')).toBe(7);
        expect(getParamIdNum('/editor.html?id=nope')).toBeNull();
        expect(getParamIdNum('/editor.html')).toBeNull();

        expect(setParamFileFullName('/editor.html', 'song.owa')).toBe(
            '/editor.html?file=song.owa',
        );
        expect(getParamFileFullName('/editor.html?file=song.owa')).toBe(
            'song.owa',
        );
    });
});
