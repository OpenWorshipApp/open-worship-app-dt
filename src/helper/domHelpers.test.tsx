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
    sendDataSyncMock,
    listenForDataMock,
    unlockingMock,
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
    sendDataSyncMock: vi.fn(),
    listenForDataMock: vi.fn((channel: string, callback: () => void) => {
        listenerRegistry[channel] = callback;
    }),
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
    listenerRegistry: {} as Record<string, () => void>,
}));

vi.mock('../context-menu/AppContextMenuComp', () => ({
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

vi.mock('./debuggerHelpers', () => {
    return {
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
            return this.store.has(key);
        }

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        POPUP_FRAME_NAME_PREFIX: 'owa-frame',
        aboutHomePage: 'https://app.local/about',
        finderHomePage: 'https://app.local/find',
        messageUtils: {
            sendDataSync: sendDataSyncMock,
            listenForData: listenForDataMock,
        },
    },
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

import {
    HoverMotionHandler,
    InputContextMenuHandler,
    addDomChangeEventListener,
    captureWebScreenShot,
    checkIsZoomed,
    getParamFileFullName,
    getParamIdNum,
    handleActiveSelectedElementScrolling,
    handleAutoHide,
    handleClassNameAction,
    handleFullWidgetView,
    notifyNewElementAdded,
    openPopupWindow,
    removeDomChangeEventListener,
    removeDomTitle,
    useWebCapturing,
} from './domHelpers';

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
        expect(clearButton?.title).toBe('Show');

        clearButton?.click();
        expect(panel.classList.contains('auto-hide-show')).toBe(true);

        panel.dispatchEvent(new Event('mouseleave'));
        vi.advanceTimersByTime(2000);
        expect(panel.classList.contains('auto-hide-show')).toBe(false);
        expect(clearButton?.style.display).toBe('block');
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
        expect(getParamIdNum()).toBe(42);
        expect(getParamFileFullName()).toBe('test.owa');

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
    });

    test('registers about/find page listeners and highlights newly added elements', async () => {
        listenerRegistry['main:app:open-about-page']?.();
        listenerRegistry['main:app:open-find-page']?.();
        expect(openCalls).toHaveLength(2);
        expect(openCalls[0]?.url).toContain(
            'https://app.local/about?uuid=about',
        );
        expect(openCalls[1]?.url).toContain('https://app.local/find?uuid=find');

        let element: HTMLDivElement | null = null;
        const moveToView = vi.fn();
        const notificationPromise = notifyNewElementAdded(() => element, {
            moveToView,
        });

        element = document.createElement('div');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
            await notificationPromise;
        });

        expect(moveToView).toHaveBeenCalledWith(element);
        vi.advanceTimersByTime(100);
        expect(element.classList.contains('app-new-element-highlight')).toBe(
            true,
        );
        vi.advanceTimersByTime(2200);
        expect(element.classList.contains('app-new-element-highlight')).toBe(
            false,
        );

        const skipElement = document.createElement('div');
        await notifyNewElementAdded(() => skipElement, {
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
        const fileSource = { src: 'https://example.com/page' };
        function Probe() {
            const value = useWebCapturing(fileSource as any);
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
});
