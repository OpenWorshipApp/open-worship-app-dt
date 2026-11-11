// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One mock surface for the Mini Screen preview components (the presenter's
// cards, NOT the projected `screen.html`). Every manager is a plain object
// built per test; the event hooks register by event name in `h.listeners`, so a
// test fires an event exactly the way a manager would.

type ListenerType = (...args: any[]) => void;

const h = vi.hoisted(() => {
    return {
        listeners: new Map<string, Set<ListenerType>>(),
        keyListeners: new Map<string, (event?: any) => void>(),
        keyLayers: [] as unknown[],
        syncedStore: new Map<string, unknown>(),
        syncedListeners: new Set<() => void>(),
        settingValues: new Map<string, unknown>(),
        settingNames: [] as string[],
        provider: {
            isPageScreen: false,
            systemUtils: { isDev: false },
            envUtils: { isFEUseEffectWarning: false },
            screenUtils: { getContext: () => null as any },
            appUtils: { handleError: () => {} },
            messageUtils: { sendData: () => {} },
        },
        videoSources: [] as [string, string][],
        displayInfo: { primaryDisplay: { id: 1 }, displays: [] as any[] },
        mirrorState: null as any,
        isMirrorPanelShowing: false,
        isWallpaperEnabled: true,
        wallpaper: null as any,
        wallpaperCalls: [] as [number, boolean][],
        isDarkMode: false,
        screenManagers: [] as any[],
        viewController: null as any,
        bibleItemJsons: [] as any[],
        rangeProps: null as any,
        zoomingOptions: null as any,
        initReceiveCount: 0,
        showAppContextMenu: vi.fn(),
        showSimpleToast: vi.fn(),
        checkMediaPlaying: vi.fn(),
        handleAudioPlaying: vi.fn(),
        handleAudioPausing: vi.fn(),
        handleAudioEnding: vi.fn(),
        openContextMenu: vi.fn(),
        extractDropData: vi.fn(),
        onDropped: vi.fn(),
        setMirrorPanelShowing: vi.fn(),
        genNewScreenManagerBase: vi.fn(),
        setIsBibleCustomStyleFloatingShowing: vi.fn(),
        setIsWallpaperBackdropEnabled: vi.fn(),
        refreshDisplayWallpaper: vi.fn(),
        handleAutoHide: vi.fn(),
    };
});

vi.mock('../../server/appProvider', () => ({ default: h.provider }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: (effect: any, deps: any) => {
            React.useEffect(effect, deps);
        },
        useAppCurrentRef: (target: unknown) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
vi.mock('../managers/screenManagerHooks', async () => {
    const React = await import('react');
    const ScreenManagerBaseContext = React.createContext<any>(null);
    const useScreenManagerBaseContext = () => {
        const screenManagerBase = React.useContext(ScreenManagerBaseContext);
        if (screenManagerBase === null) {
            throw new Error('No screen manager in context');
        }
        return screenManagerBase;
    };
    const useScreenManagerEvents = (
        events: string[],
        _screenManagerBase?: unknown,
        callback?: ListenerType,
    ) => {
        const [, setCount] = React.useState(0);
        const callbackRef = React.useRef(callback);
        callbackRef.current = callback;
        React.useEffect(() => {
            const listener = () => {
                setCount((count) => count + 1);
                callbackRef.current?.();
            };
            for (const event of events) {
                const set = h.listeners.get(event) ?? new Set();
                set.add(listener);
                h.listeners.set(event, set);
            }
            return () => {
                for (const event of events) {
                    h.listeners.get(event)?.delete(listener);
                }
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [events.join(',')]);
    };
    return {
        ScreenManagerBaseContext,
        useOptionalScreenManagerBaseContext: () => {
            return React.useContext(ScreenManagerBaseContext);
        },
        useScreenManagerBaseContext,
        useScreenManagerContext: useScreenManagerBaseContext,
        useScreenManagerEvents,
        useScreenUpdateEvents: (
            screenManagerBase?: unknown,
            callback?: ListenerType,
        ) => {
            useScreenManagerEvents(['update'], screenManagerBase, callback);
        },
        useScreenVideoSources: () => h.videoSources,
    };
});
vi.mock('../managers/screenEventHelpers', async () => {
    const hooks: any = await import('../managers/screenManagerHooks');
    return {
        useScreenFocusManagerEvents: (events: string[]) => {
            hooks.useScreenManagerEvents(events.map((e) => `focus:${e}`));
        },
    };
});
vi.mock('../../event/KeyboardEventListener', async () => {
    const React = await import('react');
    const toShortcutKey = (eventMapper: { key: string }) => eventMapper.key;
    return {
        PlatformEnum: { Windows: 'Windows', MacOS: 'MacOS', Linux: 'Linux' },
        toShortcutKey,
        default: {
            filterEventMappersByPlatform: (eventMappers: any[]) => {
                return eventMappers.filter((eventMapper) => {
                    return (
                        eventMapper.platform === undefined ||
                        eventMapper.platform === 'Windows'
                    );
                });
            },
            toEnUsKey: (event: { key: string }) => event.key,
        },
        useKeyboardRegistering: (
            eventMappers: { key: string }[],
            listener: (event?: any) => void,
            _deps: unknown[],
            layer?: unknown,
        ) => {
            const listenerRef = React.useRef(listener);
            listenerRef.current = listener;
            h.keyLayers.push(layer);
            React.useEffect(() => {
                const keys = eventMappers.map(toShortcutKey);
                const wrapped = (event?: any) => listenerRef.current(event);
                for (const key of keys) {
                    h.keyListeners.set(key, wrapped);
                }
                return () => {
                    for (const key of keys) {
                        if (h.keyListeners.get(key) === wrapped) {
                            h.keyListeners.delete(key);
                        }
                    }
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
        },
    };
});
vi.mock('../managers/ScreenFocusManager', () => ({
    FOCUS_SIZE_MIN: 40,
    FOCUS_SIZE_MAX: 1200,
    FOCUS_DIM_MIN: 10,
    FOCUS_DIM_MAX: 100,
    FOCUS_BLUR_MIN: 0,
    FOCUS_BLUR_MAX: 100,
}));
vi.mock('../../helper/settingHelpers', async () => {
    const React = await import('react');
    const useRecordedState = (name: string, initial: unknown) => {
        h.settingNames.push(name);
        const [value, setValue] = React.useState(() => {
            return h.settingValues.has(name)
                ? h.settingValues.get(name)
                : initial;
        });
        const setAndRecord = React.useCallback(
            (newValue: unknown) => {
                h.settingValues.set(name, newValue);
                setValue(newValue);
            },
            [name],
        );
        return [value, setAndRecord];
    };
    return {
        useStateSettingString: useRecordedState,
        useStateSettingNumber: useRecordedState,
        useStateSettingBooleanSynced: (name: string, initial: boolean) => {
            const value = React.useSyncExternalStore(
                (onChange) => {
                    h.syncedListeners.add(onChange);
                    return () => {
                        h.syncedListeners.delete(onChange);
                    };
                },
                () => (h.syncedStore.get(name) ?? initial) as boolean,
            );
            const setValue = React.useCallback(
                (newValue: boolean | ((previous: boolean) => boolean)) => {
                    const previous = (h.syncedStore.get(name) ??
                        initial) as boolean;
                    h.syncedStore.set(
                        name,
                        typeof newValue === 'function'
                            ? newValue(previous)
                            : newValue,
                    );
                    for (const onChange of [...h.syncedListeners]) {
                        onChange();
                    }
                },
                [name, initial],
            );
            return [value, setValue];
        },
    };
});
vi.mock('../../helper/mediaControlHelpers', () => ({
    checkMediaPlaying: h.checkMediaPlaying,
    handleAudioPlaying: h.handleAudioPlaying,
    handleAudioPausing: h.handleAudioPausing,
    handleAudioEnding: h.handleAudioEnding,
}));
vi.mock('../../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: ReactNode }) => (
            <Suspense fallback={<div className="lazy-fallback" />}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('./overlayPresetComps', () => ({
    // It has its own suite; the Focusing panel only has to mount it.
    SpotlightPresetsComp: () => <div className="spotlight-presets-stub" />,
}));
vi.mock('./MiniScreenDrawHandlersComp', () => ({
    // It has its own suite; here it only has to say it was mounted.
    default: () => <div className="draw-handlers-stub" />,
}));
vi.mock('./CustomHTMLScreenPreviewer', () => ({}));
vi.mock('./screenPreviewerHelpers', () => ({
    openContextMenu: h.openContextMenu,
}));
vi.mock('./displayWallpaperHelpers', () => ({
    getIsWallpaperBackdropEnabled: () => h.isWallpaperEnabled,
    setIsWallpaperBackdropEnabled: h.setIsWallpaperBackdropEnabled,
    refreshDisplayWallpaper: h.refreshDisplayWallpaper,
    useDisplayWallpaper: (displayId: number, isEnabled: boolean) => {
        h.wallpaperCalls.push([displayId, isEnabled]);
        return h.wallpaper;
    },
}));
vi.mock('../managers/screenManagerHelpers', () => ({
    genNewScreenManagerBase: h.genNewScreenManagerBase,
    getAllScreenManagers: () => h.screenManagers,
    getScreenManagersFromSetting: () => h.screenManagers,
    getScreenManagerByScreenId: (screenId: number) => {
        return (
            h.screenManagers.find((screenManager) => {
                return screenManager.screenId === screenId;
            }) ?? null
        );
    },
}));
vi.mock('../managers/screenHelpers', () => ({
    getAllDisplays: () => h.displayInfo,
}));
vi.mock('../screenHelpers', () => ({
    STAGE_NUMBER_CHOICE_COUNT: 6,
    getStageAccentColor: (stage: number) => `rgb(${stage}, 1, 2)`,
}));
vi.mock('../managers/ScreenManager', () => ({
    default: class ScreenManager {
        static initReceiveScreenMessage() {
            h.initReceiveCount++;
        }
    },
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../../screen-mirror/mirrorConnectionHelpers', () => ({
    getMirrorState: () => h.mirrorState,
    getMirrorPanelShowing: () => h.isMirrorPanelShowing,
    setMirrorPanelShowing: h.setMirrorPanelShowing,
    useMirrorState: () => h.mirrorState,
}));
vi.mock('../../screen-mirror/ScreenMirrorFloatingComp', () => ({
    default: () => null,
}));
vi.mock('../../screen-setting/bibleCustomStyleFloatingHelpers', () => ({
    setIsBibleCustomStyleFloatingShowing:
        h.setIsBibleCustomStyleFloatingShowing,
}));
vi.mock('../../screen-setting/BibleCustomStyleFloatingToggleComp', () => ({
    default: () => <span className="bible-style-toggle-stub" />,
}));
vi.mock('../../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static fromJson(json: any) {
            h.bibleItemJsons.push(json);
            return { fromJson: json };
        }
    },
}));
vi.mock('../../helper/dragHelpers', () => ({
    dragStore: {
        onDropped: (event: unknown) => h.onDropped(event),
    },
    extractDropData: h.extractDropData,
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../others/ItemColorNoteComp', () => ({
    default: ({ item }: { item: { colorNote: string | null } }) => (
        <span className="color-note-stub">{String(item.colorNote)}</span>
    ),
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button type="button">More Options</button>,
}));
vi.mock('../../others/AppRangeComp', () => ({
    default: (props: any) => {
        h.rangeProps = props;
        return <span className="range-stub">{props.value}</span>;
    },
    useZoomingRegistering: (_ref: unknown, options: unknown) => {
        h.zoomingOptions = options;
    },
}));
vi.mock('../../helper/domHelpers', () => ({
    handleAutoHide: h.handleAutoHide,
}));
vi.mock('../../others/themeHelpers', () => ({
    checkIsDarkMode: () => h.isDarkMode,
}));
vi.mock('../../helper/FileSource', () => ({
    default: class FileSource {},
}));
vi.mock('../ScreenForegroundComp', () => ({
    default: ({ isBehind }: { isBehind?: boolean }) => (
        <div id={isBehind ? 'foreground-behind' : 'foreground'} />
    ),
}));
vi.mock('../ScreenBackgroundComp', () => ({
    default: () => <div id="background" />,
}));
vi.mock('../ScreenVaryAppDocumentComp', () => ({
    default: ({ isUnpainted }: { isUnpainted?: boolean }) => (
        <div id="slide" data-unpainted={String(!!isUnpainted)} />
    ),
}));
vi.mock('../ScreenBibleComp', () => ({
    default: () => <div id="bible-screen-view" />,
}));
vi.mock('../ScreenDrawComp', () => ({
    default: () => <div id="draw" />,
}));
vi.mock('../ScreenFocusComp', () => ({
    default: () => <div id="focus" />,
}));

import { ScreenManagerBaseContext } from '../managers/screenManagerHooks';
import MiniScreenFocusHandlersComp from './MiniScreenFocusHandlersComp';
import ScreenPreviewerFooterComp from './ScreenPreviewerFooterComp';
import ScreenPreviewerHeaderComp from './ScreenPreviewerHeaderComp';
import ScreenPreviewerItemComp from './ScreenPreviewerItemComp';
import MiniScreenBodyComp, {
    openMiniScreenContextMenu,
} from './MiniScreenBodyComp';
import MiniScreenAudioHandlersComp from './MiniScreenAudioHandlersComp';
import DisplayControlComp from './DisplayControlComp';
import MiniScreenAppComp from './MiniScreenAppComp';
import MiniScreenComp from './MiniScreenComp';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ShowHideScreenComp from './ShowHideScreen';
import ShowingScreenIconComp from './ShowingScreenIcon';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genEffectManager(effectType: string) {
    const effectManager = {
        effectType,
        styleAnimList: {
            fade: { styleText: `.fade-${effectType}{}` },
            zoom: { styleText: `.zoom-${effectType}{}` },
        },
        listeners: [] as ListenerType[],
        registerEventListener: vi.fn(
            (events: string[], listener: ListenerType) => {
                effectManager.listeners.push(listener);
                return [`effect-token-${events.join()}`];
            },
        ),
        unregisterEventListener: vi.fn(),
    };
    return effectManager;
}

function genScreenManager(screenId: number, colorNote: string | null = null) {
    let stage = 0;
    let isShowing = true;
    const manager: any = {
        screenId,
        key: `screen-${screenId}`,
        width: 1920,
        height: 1080,
        displayId: 1,
        isSelected: false,
        isLocked: false,
        colorNote,
        isOnVirtualDisplay: false,
        isShowingForeground: true,
        stageSets: [] as number[],
        showingSets: [] as boolean[],
        registered: [] as { events: string[]; listener: ListenerType }[],
        registerEventListener: vi.fn(
            (events: string[], listener: ListenerType) => {
                manager.registered.push({ events, listener });
                return [`token-${screenId}`];
            },
        ),
        unregisterEventListener: vi.fn(),
        setIsLockedWithSyncGroup: vi.fn(),
        fireScaleEvent: vi.fn(),
        fireRefreshEvent: vi.fn(),
        receiveScreenDropped: vi.fn(),
        clear: vi.fn(),
        clearForeground: vi.fn(),
        screenBackgroundManager: {
            isShowing: true,
            clear: vi.fn(),
            sendSyncVideoSound: vi.fn(),
            setBackgroundVideoCurrentTimeForce: vi.fn(),
        },
        screenVaryAppDocumentManager: { isShowing: true, clear: vi.fn() },
        screenLongTextManager: {
            isShowing: true,
            isShowingLongText: false,
            isLineSync: false,
            screenViewData: null,
            clear: vi.fn(),
            handleScreenVersesHighlighting: vi.fn(),
        },
        screenDrawManager: {
            isShowing: false,
            isDrawEnabled: false,
            enableDraw: vi.fn(),
            disableDraw: vi.fn(),
        },
        screenFocusManager: {
            isShowing: false,
            isPanelOpen: false,
            size: 300,
            dimColor: '#000000',
            dimOpacity: 70,
            edgeBlur: 35,
            isContrast: false,
            isShortcutTarget: false,
            isSpotlighting: false,
            setIsPanelOpen: vi.fn(),
            setSize: vi.fn(),
            setDimColor: vi.fn(),
            setDimOpacity: vi.fn(),
            setEdgeBlur: vi.fn(),
            setIsContrast: vi.fn(),
            setIsArmed: vi.fn(),
            resetSettings: vi.fn(() => {
                Object.assign(manager.screenFocusManager, {
                    size: 300,
                    dimColor: '#000000',
                    dimOpacity: 70,
                    edgeBlur: 35,
                    isContrast: false,
                });
            }),
        },
        varyAppDocumentEffectManager: genEffectManager('fade'),
        backgroundEffectManager: genEffectManager('move'),
        foregroundEffectManager: genEffectManager('zoom'),
    };
    Object.defineProperty(manager, 'stage', {
        configurable: true,
        get: () => stage,
        set: (value: number) => {
            stage = value;
            manager.stageSets.push(value);
        },
    });
    Object.defineProperty(manager, 'isShowing', {
        get: () => isShowing,
        set: (value: boolean) => {
            isShowing = value;
            manager.showingSets.push(value);
        },
    });
    return manager;
}

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function inScreen(manager: any, node: ReactNode) {
    return (
        <ScreenManagerBaseContext value={manager}>
            {node}
        </ScreenManagerBaseContext>
    );
}

async function fire(eventName: string) {
    await act(async () => {
        for (const listener of [...(h.listeners.get(eventName) ?? [])]) {
            listener();
        }
    });
}

async function press(key: string, event: { repeat?: boolean } = {}) {
    const listener = h.keyListeners.get(key);
    if (listener === undefined) {
        throw new Error(`No key registered: ${key}`);
    }
    await act(async () => {
        listener(event);
    });
}

function byLabel(label: string) {
    const element = container.querySelector(`[aria-label="${label}"]`);
    if (element === null) {
        throw new Error(`Missing control: ${label}`);
    }
    return element as HTMLElement;
}

async function click(element: Element) {
    await act(async () => {
        (element as HTMLElement).click();
    });
}

async function dispatch(element: Element, event: Event) {
    let result = true;
    await act(async () => {
        result = element.dispatchEvent(event);
    });
    return result;
}

function changeInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// A lazily-loaded panel resolves on a dynamic import, then React retries.
async function settleLazy() {
    for (let i = 0; i < 3; i++) {
        await act(async () => {
            await vi.dynamicImportSettled();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

function lastMenuItems() {
    const calls = h.showAppContextMenu.mock.calls;
    if (calls.length === 0) {
        throw new Error('No menu was opened');
    }
    return calls[calls.length - 1][1] as any[];
}

function menuItem(items: any[], label: string) {
    const item = items.find((menuItem) => menuItem.menuElement === label);
    if (item === undefined) {
        throw new Error(`Missing menu item: ${label}`);
    }
    return item;
}

beforeEach(() => {
    h.listeners.clear();
    h.keyListeners.clear();
    h.keyLayers.length = 0;
    h.syncedStore.clear();
    h.syncedListeners.clear();
    h.settingValues.clear();
    h.settingNames.length = 0;
    h.provider.isPageScreen = false;
    h.provider.screenUtils.getContext = () => null;
    h.videoSources = [];
    h.displayInfo = {
        primaryDisplay: { id: 1 },
        displays: [
            {
                id: 1,
                label: 'Main',
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
        ],
    };
    h.mirrorState = null;
    h.isMirrorPanelShowing = false;
    h.isWallpaperEnabled = true;
    h.wallpaper = null;
    h.wallpaperCalls.length = 0;
    h.isDarkMode = false;
    h.screenManagers = [];
    h.viewController = {
        straightBibleItems: [],
        nestedBibleItems: ['stale'],
        appendBibleItem: vi.fn(),
        handleVersesHighlighting: vi.fn(),
    };
    h.bibleItemJsons.length = 0;
    h.rangeProps = null;
    h.zoomingOptions = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('MiniScreenFocusHandlersComp (the Focusing panel)', () => {
    test('arms the overlay while open, disarms it on close, and the hint follows the spotlight', async () => {
        const manager = genScreenManager(1);
        const focus = manager.screenFocusManager;
        await render(inScreen(manager, <MiniScreenFocusHandlersComp />));
        expect(focus.setIsArmed).toHaveBeenCalledTimes(1);
        expect(focus.setIsArmed).toHaveBeenLastCalledWith(true);
        expect(container.textContent).toContain(
            'Press and hold on the screen to spotlight',
        );
        expect(
            container.querySelector('.bi-record-circle.text-muted'),
        ).not.toBeNull();

        focus.isSpotlighting = true;
        await fire('focus:update');
        expect(container.textContent).toContain('Release to stop');
        expect(
            container.querySelector('.bi-record-circle.text-primary'),
        ).not.toBeNull();

        await act(async () => {
            root.unmount();
        });
        expect(focus.setIsArmed).toHaveBeenLastCalledWith(false);
        root = createRoot(container);
    });

    test('a slider, its steppers and the swatch write both the panel and the manager', async () => {
        const manager = genScreenManager(1);
        const focus = manager.screenFocusManager;
        await render(inScreen(manager, <MiniScreenFocusHandlersComp />));

        const sizeRange = byLabel('Spotlight size') as HTMLInputElement;
        expect(sizeRange.min).toBe('40');
        expect(sizeRange.max).toBe('1200');
        await act(async () => {
            changeInput(sizeRange, '350');
        });
        expect(focus.setSize).toHaveBeenLastCalledWith(350);
        expect(sizeRange.parentElement!.textContent).toContain('350px');

        // The steppers flank the range: one step each, the label naming both
        // the small and the Shift (big) keys.
        const sizeMinus = sizeRange.previousElementSibling as HTMLButtonElement;
        const sizePlus = sizeRange.nextElementSibling as HTMLButtonElement;
        expect(sizeMinus.getAttribute('aria-label')).toBe(
            'Spotlight size -10 / -50 [[, {]',
        );
        await click(sizePlus);
        expect(focus.setSize).toHaveBeenLastCalledWith(360);
        await click(sizeMinus);
        expect(focus.setSize).toHaveBeenLastCalledWith(350);
        // A stepper never steals the overlay's keyboard focus.
        expect(
            sizePlus.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        ).toBe(false);

        const dimRange = byLabel(
            'Dim the rest of the screen',
        ) as HTMLInputElement;
        await act(async () => {
            changeInput(dimRange, '10');
        });
        expect(focus.setDimOpacity).toHaveBeenLastCalledWith(10);
        // At the floor the minus stepper is off; the plus one is not.
        expect(
            (dimRange.previousElementSibling as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(
            (dimRange.nextElementSibling as HTMLButtonElement).disabled,
        ).toBe(false);

        const blurRange = byLabel(
            'Spotlight edge blur (0 = hard edge)',
        ) as HTMLInputElement;
        await act(async () => {
            changeInput(blurRange, '100');
        });
        expect(focus.setEdgeBlur).toHaveBeenLastCalledWith(100);
        expect(
            (blurRange.nextElementSibling as HTMLButtonElement).disabled,
        ).toBe(true);

        const swatch = byLabel('Dim color') as HTMLInputElement;
        expect(swatch.type).toBe('color');
        await act(async () => {
            changeInput(swatch, '#112233');
        });
        expect(focus.setDimColor).toHaveBeenLastCalledWith('#112233');
        // The swatch previews the dim at the chosen strength (10%).
        expect(swatch.style.opacity).toBe('0.1');
    });

    test('contrast flips the mask and reset puts every value back from the manager', async () => {
        const manager = genScreenManager(1);
        const focus = manager.screenFocusManager;
        focus.size = 800;
        focus.edgeBlur = 0;
        await render(inScreen(manager, <MiniScreenFocusHandlersComp />));
        const contrast = byLabel('Contrast');
        expect(contrast.getAttribute('aria-pressed')).toBe('false');
        expect(contrast.title).toBe(
            'Spotlight: the circle reveals what the pointer is over [x]',
        );
        await click(contrast);
        expect(focus.setIsContrast).toHaveBeenLastCalledWith(true);
        expect(contrast.getAttribute('aria-pressed')).toBe('true');
        expect(contrast.className).toContain('btn-primary');
        expect(contrast.title).toBe(
            'Contrast: the circle blocks what the pointer is over [x]',
        );
        expect(contrast.querySelector('.bi-circle-fill')).not.toBeNull();

        const reset = byLabel('Reset settings');
        expect(reset.title).toBe('Reset settings [r]');
        await click(reset);
        expect(focus.resetSettings).toHaveBeenCalledTimes(1);
        expect(contrast.getAttribute('aria-pressed')).toBe('false');
        const sizeRange = byLabel('Spotlight size') as HTMLInputElement;
        expect(sizeRange.value).toBe('300');
        expect(
            (byLabel('Spotlight edge blur (0 = hard edge)') as HTMLInputElement)
                .value,
        ).toBe('35');
    });

    test('its keys act only while this overlay owns the keyboard, and only the steps repeat', async () => {
        const manager = genScreenManager(1);
        const focus = manager.screenFocusManager;
        await render(inScreen(manager, <MiniScreenFocusHandlersComp />));
        // The mini-screen panels bind on the root layer.
        expect(h.keyLayers.every((layer) => layer === undefined)).toBe(true);

        await press('[');
        await press('x');
        expect(focus.setSize).not.toHaveBeenCalled();
        expect(focus.setIsContrast).not.toHaveBeenCalled();

        focus.isShortcutTarget = true;
        await press('[');
        expect(focus.setSize).toHaveBeenLastCalledWith(290);
        // Held: the step keys keep stepping.
        await press('[', { repeat: true });
        expect(focus.setSize).toHaveBeenLastCalledWith(280);
        await press('{');
        expect(focus.setSize).toHaveBeenLastCalledWith(230);
        await press('}');
        await press(']');
        expect(focus.setSize).toHaveBeenLastCalledWith(290);
        await press('-');
        expect(focus.setDimOpacity).toHaveBeenLastCalledWith(65);
        await press('+');
        expect(focus.setDimOpacity).toHaveBeenLastCalledWith(85);
        await press('.');
        expect(focus.setEdgeBlur).toHaveBeenLastCalledWith(40);
        await press('<');
        expect(focus.setEdgeBlur).toHaveBeenLastCalledWith(20);

        // A held toggle would flap: auto-repeat is dropped.
        await press('x', { repeat: true });
        expect(focus.setIsContrast).not.toHaveBeenCalled();
        await press('x');
        expect(focus.setIsContrast).toHaveBeenLastCalledWith(true);
        await press('r');
        expect(focus.resetSettings).toHaveBeenCalledTimes(1);
        expect(byLabel('Contrast').getAttribute('aria-pressed')).toBe('false');
    });
});

describe('ScreenPreviewerFooterComp', () => {
    test('the stage chip lists the stage numbers and moves the stage it is given', async () => {
        const manager = genScreenManager(1);
        manager.stage = 2;
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        const chip = byLabel('Stage 2: Click to change Stage Number');
        expect(chip.getAttribute('role')).toBe('button');
        expect(chip.style.color).toBe('rgb(2, 1, 2)');

        await click(chip);
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            'Decrement',
            'Increment',
        ]);
        expect(
            items.map((item) => {
                return !!item.disabled;
            }),
        ).toEqual([false, false, true, false, false, false, false, false]);
        expect(items[3].childBefore.props.className).toBe('bi bi-3-circle');

        await act(async () => {
            menuItem(items, '4').onSelect();
        });
        expect(manager.stage).toBe(4);
        expect(
            byLabel('Stage 4: Click to change Stage Number').textContent,
        ).toBe('St:4');

        await click(byLabel('Stage 4: Click to change Stage Number'));
        await act(async () => {
            menuItem(lastMenuItems(), 'Decrement').onSelect();
        });
        expect(manager.stage).toBe(3);
        await click(byLabel('Stage 3: Click to change Stage Number'));
        await act(async () => {
            menuItem(lastMenuItems(), 'Increment').onSelect();
        });
        expect(manager.stageSets).toEqual([2, 4, 3, 4]);

        // From the keyboard too: Enter opens the same menu.
        const before = h.showAppContextMenu.mock.calls.length;
        await dispatch(
            byLabel('Stage 4: Click to change Stage Number'),
            new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(h.showAppContextMenu.mock.calls.length).toBe(before + 1);
    });

    test('at stage 0 the Decrement row is off and never goes below zero', async () => {
        const manager = genScreenManager(1);
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        await click(byLabel('Stage 0: Click to change Stage Number'));
        const decrement = menuItem(lastMenuItems(), 'Decrement');
        expect(decrement.disabled).toBe(true);
        expect(menuItem(lastMenuItems(), '0').disabled).toBe(true);
    });

    test('a stage above 0 that cut the slide transition to None says so, once', async () => {
        const manager = genScreenManager(1);
        const effectManager = manager.varyAppDocumentEffectManager;
        let stage = 0;
        Object.defineProperty(manager, 'stage', {
            get: () => stage,
            set: (value: number) => {
                stage = value;
                if (value > 0) {
                    effectManager.effectType = 'none';
                }
            },
        });
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        await click(byLabel('Stage 0: Click to change Stage Number'));
        await act(async () => {
            menuItem(lastMenuItems(), '1').onSelect();
        });
        expect(h.showSimpleToast).toHaveBeenCalledTimes(1);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Slide transition',
            'A stage above 0 cuts between slides, so the Slide transition was set to None.',
        );
        // Already None: nothing new to explain.
        await click(byLabel('Stage 1: Click to change Stage Number'));
        await act(async () => {
            menuItem(lastMenuItems(), '2').onSelect();
        });
        expect(h.showSimpleToast).toHaveBeenCalledTimes(1);
    });

    test('the background audio switch shows only with audio, and will not close over a playing one', async () => {
        const manager = genScreenManager(1);
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        expect(
            container.querySelector(
                '[aria-label="Enable Background Audio Handlers"]',
            ),
        ).toBeNull();

        h.videoSources = [['https%3A%2F%2Fexample.com%2Fsong.mp3', 'vid-1']];
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        const audioSwitch = byLabel('Enable Background Audio Handlers');
        expect(audioSwitch.getAttribute('aria-pressed')).toBe('false');
        await click(audioSwitch);
        await settleLazy();
        expect(audioSwitch.getAttribute('aria-pressed')).toBe('true');
        expect(container.textContent).toContain('song.mp3');
        expect(
            container.querySelector('audio[data-video-id="vid-1"]'),
        ).not.toBeNull();

        h.checkMediaPlaying.mockReturnValue(true);
        await click(audioSwitch);
        expect(h.checkMediaPlaying).toHaveBeenCalledWith({
            query: 'audio[data-video-id]',
            withMessage: false,
        });
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Audio is Playing',
            'Please pause all background audios before disabling audio handlers',
        );
        expect(audioSwitch.getAttribute('aria-pressed')).toBe('true');

        h.checkMediaPlaying.mockReturnValue(false);
        await click(audioSwitch);
        expect(audioSwitch.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelector('audio')).toBeNull();
    });

    test('the draw toggle turns the chosen control on, and off tears down both', async () => {
        const manager = genScreenManager(1);
        const draw = manager.screenDrawManager;
        const focus = manager.screenFocusManager;
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        expect(h.settingNames).toContain('screen-draw-mode-1');
        const toggle = byLabel('Enable Drawing');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.querySelector('.bi-brush')).not.toBeNull();

        await click(toggle);
        await settleLazy();
        expect(draw.enableDraw).toHaveBeenCalledTimes(1);
        expect(toggle.getAttribute('aria-label')).toBe('Disable Drawing');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('.draw-handlers-stub')).not.toBeNull();

        await click(toggle);
        expect(focus.setIsPanelOpen).toHaveBeenLastCalledWith(false);
        expect(draw.disableDraw).toHaveBeenCalledTimes(1);
        expect(toggle.getAttribute('aria-label')).toBe('Enable Drawing');
        expect(container.querySelector('.draw-handlers-stub')).toBeNull();
    });

    test('choosing Focusing re-homes the on/off state without changing it', async () => {
        const manager = genScreenManager(1);
        const draw = manager.screenDrawManager;
        const focus = manager.screenFocusManager;
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));

        await click(byLabel('Choose Drawing or Focusing'));
        const items = lastMenuItems();
        expect(items.map((item) => [item.menuElement, item.disabled])).toEqual([
            ['Drawing', true],
            ['Focusing', false],
        ]);
        expect(items[1].childBefore.props.className).toBe(
            'bi bi-record-circle',
        );
        await act(async () => {
            menuItem(items, 'Focusing').onSelect();
        });
        // Off stays off, now persisted by the focus manager.
        expect(focus.setIsPanelOpen).toHaveBeenLastCalledWith(false);
        expect(h.settingValues.get('screen-draw-mode-1')).toBe('focus');
        const toggle = byLabel('Enable Focusing');
        expect(toggle.querySelector('.bi-record-circle')).not.toBeNull();

        await click(toggle);
        await settleLazy();
        expect(focus.setIsPanelOpen).toHaveBeenLastCalledWith(true);
        expect(draw.enableDraw).not.toHaveBeenCalled();
        // The real Focusing panel, lazily loaded.
        expect(container.textContent).toContain(
            'Press and hold on the screen to spotlight',
        );
        expect(focus.setIsArmed).toHaveBeenLastCalledWith(true);

        // A right-click on the pair opens the same chooser; back to Drawing
        // while on hands the "on" to the draw manager.
        await dispatch(
            toggle,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        await act(async () => {
            menuItem(lastMenuItems(), 'Drawing').onSelect();
        });
        await settleLazy();
        expect(draw.enableDraw).toHaveBeenCalledTimes(1);
        expect(byLabel('Disable Drawing')).toBe(toggle);
        // The Focusing panel went with the switch, and disarmed its overlay.
        expect(focus.setIsArmed).toHaveBeenLastCalledWith(false);
        expect(container.querySelector('.draw-handlers-stub')).not.toBeNull();
    });

    test('back to Drawing while off disables the drawing layer', async () => {
        const manager = genScreenManager(1);
        h.settingValues.set('screen-draw-mode-1', 'focus');
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        await click(byLabel('Choose Drawing or Focusing'));
        await act(async () => {
            menuItem(lastMenuItems(), 'Drawing').onSelect();
        });
        expect(manager.screenDrawManager.disableDraw).toHaveBeenCalledTimes(1);
        expect(manager.screenDrawManager.enableDraw).not.toHaveBeenCalled();
    });

    test('reopens with the state of whichever manager owns the persisted mode', async () => {
        const manager = genScreenManager(1);
        manager.screenFocusManager.isPanelOpen = true;
        h.settingValues.set('screen-draw-mode-1', 'focus');
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        expect(byLabel('Disable Focusing').getAttribute('aria-pressed')).toBe(
            'true',
        );

        // An unknown persisted mode reads as Drawing, which is off here.
        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        h.settingValues.set('screen-draw-mode-1', 'sparkle');
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        const toggle = byLabel('Enable Drawing');
        expect(toggle.querySelector('.bi-brush')).not.toBeNull();
    });

    test('each transition button lists the four effects and marks the one in use', async () => {
        const manager = genScreenManager(1);
        const effectManager = manager.varyAppDocumentEffectManager;
        await render(inScreen(manager, <ScreenPreviewerFooterComp />));
        // Each button follows its own effect manager's updates.
        expect(effectManager.registerEventListener).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        const slideButton = container.querySelector(
            'button[title="Slide transition"]',
        ) as HTMLButtonElement;
        expect(slideButton.textContent).toBe('Slide:');
        expect(slideButton.querySelector('.bi-shadows')).not.toBeNull();

        await click(slideButton);
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'none',
            'fade',
            'move',
            'zoom',
        ]);
        expect(items[1].childBefore.props.className).toContain(
            HIGHLIGHT_SELECTED_CLASSNAME,
        );
        expect(items[3].childBefore.props.className).not.toContain(
            HIGHLIGHT_SELECTED_CLASSNAME,
        );
        menuItem(items, 'zoom').onSelect();
        expect(effectManager.effectType).toBe('zoom');
        await act(async () => {
            for (const listener of effectManager.listeners) {
                listener(null, 1);
            }
        });
        expect(
            slideButton.querySelector('.bi-arrows-fullscreen'),
        ).not.toBeNull();

        await act(async () => {
            root.unmount();
        });
        expect(effectManager.unregisterEventListener).toHaveBeenCalledWith([
            'effect-token-update',
        ]);
        root = createRoot(container);
    });
});

describe('ScreenPreviewerHeaderComp', () => {
    test('lock goes through the sync group, and a sibling locking re-syncs it', async () => {
        const manager = genScreenManager(1);
        await render(
            inScreen(
                manager,
                <ScreenPreviewerHeaderComp
                    isFullView={false}
                    setIsFullView={() => {}}
                />,
            ),
        );
        const lock = byLabel('Lock');
        expect(lock.className).toContain('bi-unlock');
        expect(lock.style.color).toBe('green');
        await click(lock);
        expect(manager.setIsLockedWithSyncGroup).toHaveBeenCalledWith(true);
        expect(lock.getAttribute('aria-label')).toBe('Unlock');
        expect(lock.getAttribute('aria-pressed')).toBe('true');
        expect(lock.className).toContain('bi-lock-fill');
        expect(lock.style.color).toBe('red');

        // A group member unlocked it from its own card.
        manager.isLocked = false;
        await fire('instance');
        expect(lock.getAttribute('aria-label')).toBe('Lock');

        // Enter works on the icon-control like a click.
        manager.isLocked = false;
        await dispatch(
            lock,
            new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(manager.setIsLockedWithSyncGroup).toHaveBeenLastCalledWith(true);
    });

    test('full view asks for the opposite of what it was given', async () => {
        const manager = genScreenManager(1);
        const setIsFullView = vi.fn();
        await render(
            inScreen(
                manager,
                <ScreenPreviewerHeaderComp
                    isFullView={false}
                    setIsFullView={setIsFullView}
                />,
            ),
        );
        await click(byLabel('Full view'));
        expect(setIsFullView).toHaveBeenLastCalledWith(true);
        await render(
            inScreen(
                manager,
                <ScreenPreviewerHeaderComp
                    isFullView
                    setIsFullView={setIsFullView}
                />,
            ),
        );
        const exit = byLabel('Exit full view');
        expect(exit.className).toContain('bi-fullscreen-exit');
        await click(exit);
        expect(setIsFullView).toHaveBeenLastCalledWith(false);
    });

    test('the eye stops and resumes drawing this card, per screen', async () => {
        const manager = genScreenManager(3);
        await render(
            inScreen(
                manager,
                <ScreenPreviewerHeaderComp
                    isFullView={false}
                    setIsFullView={() => {}}
                />,
            ),
        );
        const eye = byLabel('Stop rendering preview');
        await click(eye);
        expect(h.syncedStore.get('mini-screen-no-rendering-3')).toBe(true);
        expect(eye.getAttribute('aria-label')).toBe('Resume rendering preview');
        expect(eye.className).toContain('bi-eye-slash');
        expect(eye.style.color).toBe('var(--bs-warning)');
        await click(eye);
        expect(h.syncedStore.get('mini-screen-no-rendering-3')).toBe(false);
        expect(eye.getAttribute('aria-label')).toBe('Stop rendering preview');
    });
});

describe('ScreenPreviewerItemComp (one screen card)', () => {
    test('follows its display size and lets go of the listener on unmount', async () => {
        const manager = genScreenManager(1);
        manager.isSelected = true;
        await render(
            inScreen(manager, <ScreenPreviewerItemComp width={200} />),
        );
        const card = container.querySelector('.mini-screen') as HTMLElement;
        expect(card.className).toContain(HIGHLIGHT_SELECTED_CLASSNAME);
        expect(card.style.width).toBe('200px');
        expect(card.title).toBe('Screen: 1');
        // The manager reaches the card through a weak reference.
        expect(manager.divRef.deref()).toBe(card);
        const body = card.querySelector(
            '.mini-screen-preview-body',
        ) as HTMLElement;
        expect(body.style.aspectRatio).toBe('1920 / 1080');

        const registration = manager.registered.find((item: any) => {
            return item.events.join() === 'display-id';
        });
        manager.width = 1280;
        manager.height = 720;
        await act(async () => {
            registration.listener();
        });
        expect(body.style.aspectRatio).toBe('1280 / 720');

        await act(async () => {
            root.unmount();
        });
        expect(manager.unregisterEventListener).toHaveBeenCalledWith([
            'token-1',
        ]);
        root = createRoot(container);
    });

    test('a size change rescales, and leaving full view by Escape clears its state', async () => {
        const observers: any[] = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                callback: () => void;
                observed: Element[] = [];
                isDisconnected = false;
                constructor(callback: () => void) {
                    this.callback = callback;
                    observers.push(this);
                }
                observe(element: Element) {
                    this.observed.push(element);
                }
                disconnect() {
                    this.isDisconnected = true;
                }
            },
        );
        const manager = genScreenManager(1);
        await render(
            inScreen(manager, <ScreenPreviewerItemComp width={200} />),
        );
        expect(observers).toHaveLength(1);
        const observer = observers[0];
        const fit = observer.observed[0] as HTMLElement;
        expect(fit.className).toBe('mini-screen-preview-fit');
        const size = { width: 0, height: 0 };
        Object.defineProperty(fit, 'clientWidth', { get: () => size.width });
        Object.defineProperty(fit, 'clientHeight', { get: () => size.height });

        await act(async () => observer.callback());
        expect(manager.fireScaleEvent).not.toHaveBeenCalled();
        size.width = 400;
        size.height = 225;
        await act(async () => observer.callback());
        expect(manager.fireScaleEvent).toHaveBeenCalledTimes(1);
        // Height alone also re-runs the contain math (full view).
        size.height = 300;
        await act(async () => observer.callback());
        expect(manager.fireScaleEvent).toHaveBeenCalledTimes(2);

        const card = container.querySelector('.mini-screen') as HTMLElement;
        await click(byLabel('Full view'));
        expect(card.classList.contains('app-full-view')).toBe(true);
        await act(async () => observer.callback());
        expect(byLabel('Exit full view')).not.toBeNull();
        // Escape strips the class straight off the DOM.
        card.classList.remove('app-full-view');
        await act(async () => observer.callback());
        expect(byLabel('Full view')).not.toBeNull();
        expect(card.classList.contains('app-full-view')).toBe(false);

        await act(async () => {
            root.unmount();
        });
        expect(observer.isDisconnected).toBe(true);
        root = createRoot(container);
    });

    test('menu, drops, wheel and scroll on the card', async () => {
        const manager = genScreenManager(2);
        const onParentWheel = vi.fn();
        await render(
            <div onWheel={onParentWheel}>
                {inScreen(manager, <ScreenPreviewerItemComp width={200} />)}
            </div>,
        );
        const card = container.querySelector('.mini-screen') as HTMLElement;

        await dispatch(
            card,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(h.openContextMenu).toHaveBeenCalledWith(
            expect.anything(),
            manager,
        );

        const isNotPrevented = await dispatch(
            card,
            new Event('dragover', { bubbles: true, cancelable: true }),
        );
        expect(isNotPrevented).toBe(false);
        expect(card.classList.contains('receiving-data-drop')).toBe(true);
        await dispatch(
            card,
            new Event('dragleave', { bubbles: true, cancelable: true }),
        );
        expect(card.classList.contains('receiving-data-drop')).toBe(false);

        // Nothing this card understands: the drag's own handler takes it.
        h.extractDropData.mockReturnValue(null);
        card.classList.add('receiving-data-drop');
        await dispatch(card, new Event('drop', { bubbles: true }));
        expect(card.classList.contains('receiving-data-drop')).toBe(false);
        expect(h.onDropped).toHaveBeenCalledTimes(1);
        expect(manager.receiveScreenDropped).not.toHaveBeenCalled();
        const dropped = { type: 'bible-item', item: { id: 1 } };
        h.extractDropData.mockReturnValue(dropped);
        await dispatch(card, new Event('drop', { bubbles: true }));
        expect(manager.receiveScreenDropped).toHaveBeenCalledWith(dropped);
        expect(h.onDropped).toHaveBeenCalledTimes(1);

        // Ctrl+wheel over a long text is the text's own zoom, not the panel's.
        await dispatch(
            card,
            new WheelEvent('wheel', { bubbles: true, ctrlKey: true }),
        );
        expect(onParentWheel).not.toHaveBeenCalled();
        await dispatch(card, new WheelEvent('wheel', { bubbles: true }));
        expect(onParentWheel).toHaveBeenCalledTimes(1);
        manager.screenLongTextManager.isShowing = false;
        await dispatch(
            card,
            new WheelEvent('wheel', { bubbles: true, ctrlKey: true }),
        );
        expect(onParentWheel).toHaveBeenCalledTimes(2);

        const body = card.querySelector(
            '.mini-screen-preview-body',
        ) as HTMLElement;
        body.scrollTop = 40;
        await dispatch(body, new Event('scroll'));
        expect(body.scrollTop).toBe(0);
    });

    test('with rendering off the card shows its No rendering face', async () => {
        const manager = genScreenManager(4);
        h.syncedStore.set('mini-screen-no-rendering-4', true);
        await render(
            inScreen(manager, <ScreenPreviewerItemComp width={200} />),
        );
        const face = container.querySelector('.mini-screen-no-rendering');
        expect(face?.textContent).toBe('No rendering');
        // The previewer element stays: its slide layer plays the sound.
        expect(
            container.querySelector('mini-screen-previewer-custom-html'),
        ).not.toBeNull();
        await click(byLabel('Resume rendering preview'));
        expect(container.querySelector('.mini-screen-no-rendering')).toBeNull();
    });
});

describe('MiniScreenBodyComp (the cards)', () => {
    test('a bar between colour groups, none when every screen is in one', async () => {
        const red = genScreenManager(1, '#ff0000');
        const plain = genScreenManager(2);
        h.screenManagers = [plain, red];
        await render(<MiniScreenBodyComp previewScale={3} />);
        const list = container.querySelector(
            '.card-body > .flex-fill',
        ) as HTMLElement;
        expect(
            [...list.children].map((child) => {
                return child.tagName === 'HR'
                    ? 'bar'
                    : `card-${(child as HTMLElement).dataset.screenKey}`;
            }),
        ).toEqual(['bar', 'card-1', 'bar', 'card-2']);
        const firstBar = list.children[0] as HTMLElement;
        expect(firstBar.style.backgroundColor).toBe('rgb(255, 0, 0)');
        expect((list.children[1] as HTMLElement).style.width).toBe('150px');

        h.screenManagers = [genScreenManager(1), genScreenManager(2)];
        await fire('instance');
        expect(
            [...list.children].map((child) => {
                return child.tagName;
            }),
        ).toEqual(['DIV', 'DIV']);

        // Every screen with ONE colour note: its bar, and no second bar with
        // no screen under it. Found by UT-90b (2026-11-03): the always-seeded
        // "unknown" group drew an empty divider last, which the file lists
        // already leave out.
        h.screenManagers = [
            genScreenManager(1, '#ff0000'),
            genScreenManager(2, '#ff0000'),
        ];
        await fire('instance');
        expect(
            [...list.children].map((child) => {
                return child.tagName === 'HR'
                    ? 'bar'
                    : `card-${(child as HTMLElement).dataset.screenKey}`;
            }),
        ).toEqual(['bar', 'card-1', 'card-2']);
    });

    test('a right-click opens the Mini Screen menu, each row doing its job', async () => {
        const first = genScreenManager(1);
        const second = genScreenManager(2);
        h.screenManagers = [first, second];
        h.mirrorState = { guests: [{ prefix: 'G1', name: 'Phone' }] };
        await render(<MiniScreenBodyComp previewScale={1} />);
        await dispatch(
            container.querySelector('.card-body')!,
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'G1: Phone',
            'Virtual Screens Manager',
            'Add New Screen',
            'Refresh Preview',
            'Show Monitor Wallpaper',
            'Bible/LongText Properties',
        ]);
        expect(items[1].childBefore.props.className).toBe('bi bi-square');
        expect(items[4].childBefore.props.className).toBe('bi bi-check-square');

        menuItem(items, 'G1: Phone').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenLastCalledWith(
            true,
            'mirror',
        );
        menuItem(items, 'Virtual Screens Manager').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenLastCalledWith(true);
        menuItem(items, 'Add New Screen').onSelect();
        expect(h.genNewScreenManagerBase).toHaveBeenCalledTimes(1);
        menuItem(items, 'Refresh Preview').onSelect();
        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(second.fireRefreshEvent).toHaveBeenCalledTimes(1);
        menuItem(items, 'Show Monitor Wallpaper').onSelect();
        expect(h.setIsWallpaperBackdropEnabled).toHaveBeenCalledWith(false);
        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(2);
        menuItem(items, 'Bible/LongText Properties').onSelect();
        expect(h.setIsBibleCustomStyleFloatingShowing).toHaveBeenCalledWith(
            true,
        );

        // Panel open and backdrop off: the ticks follow, no guest rows.
        h.mirrorState = null;
        h.isMirrorPanelShowing = true;
        h.isWallpaperEnabled = false;
        openMiniScreenContextMenu(new MouseEvent('contextmenu'));
        const closedItems = lastMenuItems();
        expect(closedItems).toHaveLength(5);
        expect(closedItems[0].childBefore.props.className).toBe(
            'bi bi-check-square',
        );
        menuItem(closedItems, 'Virtual Screens Manager').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenLastCalledWith(false);
        menuItem(closedItems, 'Show Monitor Wallpaper').onSelect();
        expect(h.setIsWallpaperBackdropEnabled).toHaveBeenLastCalledWith(true);
    });

    test('a verse clicked in the Reader reaches every screen but a long text', async () => {
        const bibleScreen = genScreenManager(1);
        const longTextScreen = genScreenManager(2);
        longTextScreen.screenLongTextManager.isShowingLongText = true;
        h.screenManagers = [bibleScreen, longTextScreen];
        await render(<MiniScreenBodyComp previewScale={1} />);
        h.viewController.handleScreenBibleVersesHighlighting('KJV-1-1', true);
        expect(
            bibleScreen.screenLongTextManager.handleScreenVersesHighlighting,
        ).toHaveBeenCalledWith('KJV-1-1', true);
        expect(
            longTextScreen.screenLongTextManager.handleScreenVersesHighlighting,
        ).not.toHaveBeenCalled();
    });

    test('the Reader follows a Bible passage put on a screen, once per passage', async () => {
        const screen = genScreenManager(1);
        h.screenManagers = [screen];
        await render(<MiniScreenBodyComp previewScale={1} />);
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };
        const viewData: any = {
            bibleItemData: {
                bibleItem: { target },
                renderedList: [{ bibleKey: 'KJV' }, { bibleKey: 'ESV' }],
            },
        };
        const { screenLongTextManager } = screen;
        screenLongTextManager.applyBibleViewData(viewData);
        expect(h.viewController.nestedBibleItems).toEqual([]);
        expect(h.bibleItemJsons).toEqual([
            { id: -1, bibleKey: 'KJV', target, metadata: {} },
            { id: -1, bibleKey: 'ESV', target, metadata: {} },
        ]);
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(2);

        // The same passage in the same versions: the Reader is left alone.
        h.viewController.straightBibleItems = [
            { toJson: () => ({ bibleKey: 'KJV', target: { ...target } }) },
            { toJson: () => ({ bibleKey: 'ESV', target: { ...target } }) },
        ];
        screenLongTextManager.applyBibleViewData(viewData);
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(2);
        // Another version set rebuilds it.
        h.viewController.straightBibleItems = [
            { toJson: () => ({ bibleKey: 'KJV', target: { ...target } }) },
            { toJson: () => ({ bibleKey: 'NIV', target: { ...target } }) },
        ];
        screenLongTextManager.applyBibleViewData(viewData);
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(4);

        // Not a Bible passage, or an empty one: nothing to follow.
        screenLongTextManager.applyBibleViewData(null);
        screenLongTextManager.applyBibleViewData({
            type: 'long-text',
        } as any);
        screenLongTextManager.applyBibleViewData({
            bibleItemData: { bibleItem: { target }, renderedList: [] },
        } as any);
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(4);
    });

    test('a verse the screen highlights is handed to the Reader on the next tick', async () => {
        const screen = genScreenManager(1);
        h.screenManagers = [screen];
        await render(<MiniScreenBodyComp previewScale={1} />);
        vi.useFakeTimers();
        screen.screenLongTextManager.handleBibleViewVersesHighlighting(
            'KJV-2-4',
            false,
        );
        expect(
            h.viewController.handleVersesHighlighting,
        ).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(0);
        expect(h.viewController.handleVersesHighlighting).toHaveBeenCalledWith(
            'KJV-2-4',
            false,
        );
    });
});

describe('MiniScreenAudioHandlersComp (one background audio)', () => {
    async function renderAudio(manager: any) {
        await render(
            inScreen(
                manager,
                <MiniScreenAudioHandlersComp
                    src="https%3A%2F%2Fexample.com%2Fmusic%2Fhymn.mp3"
                    videoId="vid-7"
                />,
            ),
        );
        return container.querySelector('audio') as HTMLAudioElement;
    }

    test('on a real monitor this copy plays out loud and only reports the time', async () => {
        const manager = genScreenManager(1);
        const background = manager.screenBackgroundManager;
        const audio = await renderAudio(manager);
        expect(container.textContent).toContain('hymn.mp3');
        expect(audio.dataset.videoId).toBe('vid-7');
        expect(audio.muted).toBe(false);

        await dispatch(audio, new Event('play'));
        expect(h.handleAudioPlaying).toHaveBeenCalledTimes(1);
        await dispatch(audio, new Event('pause'));
        expect(h.handleAudioPausing).toHaveBeenCalledTimes(1);
        await dispatch(audio, new Event('timeupdate'));
        expect(
            background.setBackgroundVideoCurrentTimeForce,
        ).toHaveBeenCalledWith('vid-7', 0, false);
        // The sound is here: nothing is sent to the screen page.
        expect(background.sendSyncVideoSound).not.toHaveBeenCalled();

        const repeat = byLabel('Repeat this audio: hymn.mp3');
        expect(repeat.getAttribute('aria-pressed')).toBe('true');
        await dispatch(audio, new Event('ended'));
        expect(h.handleAudioEnding.mock.calls[0][0]).toBe(true);
        await click(repeat);
        expect(repeat.getAttribute('aria-pressed')).toBe('false');
        expect(repeat.style.opacity).toBe('0.5');
        await dispatch(audio, new Event('ended'));
        expect(h.handleAudioEnding.mock.calls[1][0]).toBe(false);
    });

    test('on a virtual display it stays muted and tells the screen page instead', async () => {
        const manager = genScreenManager(1);
        manager.isOnVirtualDisplay = true;
        const background = manager.screenBackgroundManager;
        const audio = await renderAudio(manager);
        expect(audio.muted).toBe(true);
        expect(background.sendSyncVideoSound).toHaveBeenLastCalledWith(
            'vid-7',
            false,
            1,
        );

        const sendCount = () => background.sendSyncVideoSound.mock.calls.length;
        // Something unmuted it: the next report mutes it again.
        let before = sendCount();
        await act(async () => {
            audio.muted = false;
        });
        await dispatch(audio, new Event('volumechange'));
        expect(audio.muted).toBe(true);
        expect(sendCount()).toBeGreaterThan(before);
        before = sendCount();
        await dispatch(audio, new Event('play'));
        await dispatch(audio, new Event('timeupdate'));
        expect(sendCount()).toBe(before + 2);
        expect(background.sendSyncVideoSound).toHaveBeenLastCalledWith(
            'vid-7',
            false,
            1,
        );

        // Moved back to a real monitor: the sound comes back here.
        manager.isOnVirtualDisplay = false;
        await fire('display-id');
        expect(audio.muted).toBe(false);
        before = sendCount();
        await dispatch(audio, new Event('volumechange'));
        await dispatch(audio, new Event('play'));
        expect(sendCount()).toBe(before);
    });
});

describe('DisplayControlComp (the display chooser)', () => {
    function setDisplays() {
        h.displayInfo = {
            primaryDisplay: { id: 1 },
            displays: [
                {
                    id: 1,
                    label: 'Main',
                    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                },
                {
                    id: 2,
                    label: ' ',
                    bounds: { x: 0, y: 0, width: 1280, height: 720 },
                },
                {
                    id: 3,
                    label: '',
                    isPrimary: true,
                    bounds: { x: 0, y: 0, width: 800, height: 600 },
                },
                {
                    id: -500001,
                    label: 'Stream',
                    bounds: { x: 0, y: 0, width: 1280, height: 720 },
                },
                {
                    id: -1000001,
                    label: 'Phone',
                    guestId: 'guest-1',
                    bounds: { x: 0, y: 0, width: 390, height: 844 },
                },
            ],
        };
    }

    async function renderFor(displayId: number) {
        const manager = genScreenManager(5);
        manager.displayId = displayId;
        await render(inScreen(manager, <DisplayControlComp />));
        return {
            manager,
            button: container.querySelector('button') as HTMLButtonElement,
        };
    }

    test.each([
        [1, 'Main', 'Main(5):1', 'bi bi-display'],
        [2, 'Unnamed display', '(5):2', 'bi bi-display'],
        [3, 'Primary display', '(5):3', 'bi bi-display'],
        [
            99,
            'Not connected',
            '(5):99',
            'bi bi-exclamation-triangle text-warning',
        ],
        [
            -1000005,
            'Guest display, not connected',
            '(5):-1000005',
            'bi bi-exclamation-triangle text-warning',
        ],
        [
            -500005,
            'Virtual display not found',
            '(5):-500005',
            'bi bi-exclamation-triangle text-warning',
        ],
        [-500001, 'Stream', 'Stream: 1280x720', 'bi bi-display'],
        [-1000001, 'Phone', 'Phone: 390x844', 'bi bi-display'],
    ])(
        'display %i reads as %s',
        async (displayId, label, text, iconClassName) => {
            setDisplays();
            const { button } = await renderFor(displayId);
            expect(button.title).toBe(
                `Display: ${label}, Screen id: 5, Display id: ${displayId}`,
            );
            expect(button.textContent).toBe(text);
            expect(button.querySelector('i')!.className).toBe(iconClassName);
        },
    );

    test('lists every display, marks the current one and moves the screen to the picked one', async () => {
        setDisplays();
        const { manager, button } = await renderFor(2);
        await click(button);
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Main(1): 1920x1080 (primary)',
            '*Unnamed display(2): 1280x720',
            'Unnamed display(3): 800x600 (primary)',
            'Stream (Virtual): 1280x720',
            'Phone: 390x844',
            'Manage Virtual Displays',
        ]);
        items[0].onSelect();
        expect(manager.displayId).toBe(1);
        items[4].onSelect();
        expect(manager.displayId).toBe(-1000001);
        menuItem(items, 'Manage Virtual Displays').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenCalledWith(true, 'virtual');
    });
});

describe('MiniScreenAppComp (inside the previewer shadow root)', () => {
    test('a screen id with no manager draws nothing', async () => {
        await render(<MiniScreenAppComp screenId={9} />);
        expect(container.innerHTML).toBe('');
    });

    test('draws the checkered pattern while there is no wallpaper, darker in dark mode', async () => {
        const manager = genScreenManager(1);
        manager.displayId = 7;
        h.screenManagers = [manager];
        await render(<MiniScreenAppComp screenId={1} />);
        expect(h.wallpaperCalls.at(-1)).toEqual([7, true]);
        const backdrop = container.querySelector(
            'div[style*="pointer-events"]',
        ) as HTMLElement;
        expect(backdrop.style.backgroundImage).toContain('--bs-gray-300');
        expect(backdrop.style.backgroundSize).toBe('20px 20px');
        expect(
            [...container.querySelectorAll('style')].map((style) => {
                return style.textContent;
            }),
        ).toEqual([
            '.fade-move{}',
            '.zoom-move{}',
            '.fade-fade{}',
            '.zoom-fade{}',
            '.fade-zoom{}',
            '.zoom-zoom{}',
        ]);
        expect(
            [...container.querySelectorAll('div[id]')].map((div) => div.id),
        ).toEqual([
            'background',
            'foreground-behind',
            'slide',
            'bible-screen-view',
            'foreground',
            'draw',
            'focus',
        ]);

        h.isDarkMode = true;
        h.isWallpaperEnabled = false;
        await fire('display-id');
        expect(backdrop.style.backgroundImage).toContain('--bs-gray-700');
        expect(h.wallpaperCalls.at(-1)).toEqual([7, false]);

        // Refresh Preview reads the wallpaper again.
        await fire('refresh');
        expect(h.refreshDisplayWallpaper).toHaveBeenCalledWith(7);
    });

    test.each([
        ['contain', 'contain', 'no-repeat'],
        ['fill', '100% 100%', 'no-repeat'],
        ['tile', 'auto', 'repeat'],
        ['unknown-fit', 'cover', 'no-repeat'],
    ])(
        'a %s wallpaper is laid out the way the desktop lays it out',
        async (fit, backgroundSize, backgroundRepeat) => {
            const manager = genScreenManager(1);
            h.screenManagers = [manager];
            h.wallpaper = {
                imageDataUrl: 'data:image/jpeg;base64,AAA',
                color: '#123456',
                fit,
            };
            await render(<MiniScreenAppComp screenId={1} />);
            const backdrop = container.querySelector(
                'div[style*="pointer-events"]',
            ) as HTMLElement;
            expect(backdrop.style.backgroundImage).toBe(
                'url("data:image/jpeg;base64,AAA")',
            );
            expect(backdrop.style.backgroundSize).toBe(backgroundSize);
            expect(backdrop.style.backgroundRepeat).toBe(backgroundRepeat);
            expect(backdrop.style.backgroundColor).toBe('rgb(18, 52, 86)');
        },
    );

    test('a desktop with no picture is its plain colour', async () => {
        const manager = genScreenManager(1);
        h.screenManagers = [manager];
        h.wallpaper = { imageDataUrl: null, color: '#123456', fit: 'cover' };
        await render(<MiniScreenAppComp screenId={1} />);
        const backdrop = container.querySelector(
            'div[style*="pointer-events"]',
        ) as HTMLElement;
        expect(backdrop.style.backgroundImage).toBe('');
        expect(backdrop.style.backgroundColor).toBe('rgb(18, 52, 86)');
    });
});

describe('MiniScreenComp (the Mini Screen panel)', () => {
    test('initialises the screen message channel once, at load', () => {
        expect(h.initReceiveCount).toBe(1);
    });

    test('connected guests are listed, the internet ones in the warning colour', async () => {
        h.mirrorState = {
            guests: [
                { id: 'a', network: 'internet', prefix: 'G1', name: 'Phone' },
                { id: 'b', network: 'lan', prefix: 'G2', name: 'Tablet' },
            ],
        };
        await render(<MiniScreenComp />);
        const header = byLabel('Connected guests');
        const buttons = [...header.querySelectorAll('button')];
        expect(buttons.map((button) => button.textContent)).toEqual([
            'G1: Phone',
            'G2: Tablet',
        ]);
        expect(buttons[0].className).toContain('btn-outline-warning');
        expect(buttons[0].title).toBe('Connected from the internet');
        expect(buttons[0].querySelector('.bi-globe2')).not.toBeNull();
        expect(buttons[1].className).toContain('btn-outline-info');
        expect(buttons[1].title).toBe('Connected from this network');
        expect(buttons[1].querySelector('.bi-pc-display')).not.toBeNull();
        await click(buttons[1]);
        expect(h.setMirrorPanelShowing).toHaveBeenCalledWith(true);
    });

    test('no guests, no guest row', async () => {
        h.mirrorState = { guests: [] };
        await render(<MiniScreenComp />);
        expect(
            container.querySelector('[aria-label="Connected guests"]'),
        ).toBeNull();
    });

    test('the size scale rescales every card, from the slider or the zoom keys', async () => {
        const first = genScreenManager(1);
        const second = genScreenManager(2);
        h.screenManagers = [first, second];
        await render(<MiniScreenComp />);
        expect(h.settingNames).toContain('mini-screen-previewer');
        expect(h.rangeProps.value).toBe(9);
        expect(h.rangeProps.title).toBe('Preview Size Scale');
        const card = container.querySelector('.mini-screen') as HTMLElement;
        expect(card.style.width).toBe('450px');

        await act(async () => {
            h.rangeProps.setValue(12);
        });
        expect(first.fireScaleEvent).toHaveBeenCalledTimes(1);
        expect(second.fireScaleEvent).toHaveBeenCalledTimes(1);
        expect(card.style.width).toBe('600px');
        expect(h.settingValues.get('mini-screen-previewer')).toBe(12);

        expect(h.zoomingOptions.value).toBe(12);
        await act(async () => {
            h.zoomingOptions.setValue(4);
        });
        expect(first.fireScaleEvent).toHaveBeenCalledTimes(2);
        expect(card.style.width).toBe('200px');

        // The footer hides itself until hovered.
        const footer = container.querySelector('.app-auto-hide-bottom');
        expect(h.handleAutoHide).toHaveBeenCalledWith(footer);
    });

    test('the options icon opens the Mini Screen menu, and F5 is bound once for the panel', async () => {
        const screen = genScreenManager(1);
        screen.isShowing = false;
        h.screenManagers = [screen];
        await render(<MiniScreenComp />);
        await click(byLabel('Mini Screen Options'));
        expect(
            lastMenuItems().map((item) => {
                return item.menuElement;
            }),
        ).toContain('Add New Screen');
        await press('F5');
        expect(screen.isShowing).toBe(true);
    });
});

describe('MiniScreenClearControlComp (the clear buttons)', () => {
    test('each enabled button clears its own layer, by click or by its key', async () => {
        const manager = genScreenManager(1);
        await render(inScreen(manager, <MiniScreenClearControlComp />));
        const clearAll = byLabel('Clear All');
        expect(clearAll.className).toBe('btn btn-danger');
        expect(clearAll.title).toBe('Clear All [F6]');
        await click(clearAll);
        expect(manager.clear).toHaveBeenCalledTimes(1);
        await click(byLabel('Clear Background'));
        expect(manager.screenBackgroundManager.clear).toHaveBeenCalledTimes(1);
        await click(byLabel('Clear Slide'));
        expect(
            manager.screenVaryAppDocumentManager.clear,
        ).toHaveBeenCalledTimes(1);
        await click(byLabel('Clear Long Text'));
        expect(manager.screenLongTextManager.clear).toHaveBeenCalledTimes(1);
        await click(byLabel('Clear Foreground'));
        expect(manager.clearForeground).toHaveBeenCalledTimes(1);
        await press('F6');
        await press('F10');
        expect(manager.clear).toHaveBeenCalledTimes(2);
        expect(manager.clearForeground).toHaveBeenCalledTimes(2);
    });

    test('a layer with nothing up has an outlined button that does nothing', async () => {
        const manager = genScreenManager(1);
        manager.screenBackgroundManager.isShowing = false;
        manager.screenVaryAppDocumentManager.isShowing = false;
        manager.screenLongTextManager.isShowing = false;
        manager.isShowingForeground = false;
        // A drawing alone still enables Clear All.
        manager.screenDrawManager.isShowing = true;
        await render(inScreen(manager, <MiniScreenClearControlComp />));
        expect(byLabel('Clear All').className).toBe('btn btn-danger');
        const background = byLabel('Clear Background');
        expect(background.className).toBe('btn btn-outline-secondary');
        await click(background);
        await press('F7');
        expect(manager.screenBackgroundManager.clear).not.toHaveBeenCalled();

        manager.screenDrawManager.isShowing = false;
        manager.screenFocusManager.isShowing = true;
        await fire('update');
        expect(byLabel('Clear All').className).toBe('btn btn-danger');
        manager.screenFocusManager.isShowing = false;
        await fire('update');
        expect(byLabel('Clear All').className).toBe('btn btn-outline-danger');
        await click(byLabel('Clear All'));
        expect(manager.clear).not.toHaveBeenCalled();
    });
});

describe('ShowHideScreen (one card toggle)', () => {
    test('a click or Enter/Space flips the live state, a held or other key does not', async () => {
        const manager = genScreenManager(1);
        await render(inScreen(manager, <ShowHideScreenComp />));
        const toggle = byLabel('Toggle showing screen [F5]');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.className).toContain('showing');

        await click(toggle);
        expect(manager.showingSets).toEqual([false]);
        await fire('visible');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.style.opacity).toBe('0.4');

        const isEnterNotPrevented = await dispatch(
            toggle,
            new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(isEnterNotPrevented).toBe(false);
        await dispatch(
            toggle,
            new KeyboardEvent('keydown', {
                key: ' ',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(manager.showingSets).toEqual([false, true, false]);
        await dispatch(
            toggle,
            new KeyboardEvent('keydown', {
                key: 'Enter',
                repeat: true,
                bubbles: true,
                cancelable: true,
            }),
        );
        const isOtherNotPrevented = await dispatch(
            toggle,
            new KeyboardEvent('keydown', {
                key: 'a',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(isOtherNotPrevented).toBe(true);
        expect(manager.showingSets).toEqual([false, true, false]);
    });
});

describe('ShowingScreenIcon', () => {
    test('is a plain badge, or a pressable one that reports its screen id', async () => {
        const onClick = vi.fn();
        await render(
            <>
                <ShowingScreenIconComp screenId={3} />
                <ShowingScreenIconComp
                    screenId={4}
                    title="Go to screen 4"
                    onClick={onClick}
                />
            </>,
        );
        const [plain, pressable] = [
            ...container.querySelectorAll('[data-screen-id]'),
        ] as HTMLElement[];
        expect(plain.title).toBe('Screen: 3');
        expect(plain.className).not.toContain('app-caught-hover-pointer');
        expect(pressable.title).toBe('Go to screen 4');
        expect(pressable.className).toContain('app-caught-hover-pointer');
        await click(pressable);
        expect(onClick).toHaveBeenCalledWith(expect.anything(), 4);
        await click(plain);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
