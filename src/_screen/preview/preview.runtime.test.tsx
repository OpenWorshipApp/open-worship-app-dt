// @vitest-environment jsdom

import {
    act,
    createContext,
    Suspense,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const showAppContextMenuMock = vi.fn(
    (
        _event?: Event,
        _items?: Array<{
            menuElement: string;
            onSelect?: (...args: any[]) => void;
        }>,
    ) => ({
        promiseDone: Promise.resolve(),
    }),
);
const useKeyboardRegisteringMock = vi.fn();
const showSimpleToastMock = vi.fn();
const handleCtrlWheelMock = vi.fn();
const handleAutoHideMock = vi.fn();
const genNewScreenManagerBaseMock = vi.fn();
const getAllScreenManagersMock = vi.fn();
const getScreenManagersFromSettingMock = vi.fn();
const getSelectedScreenManagerBasesMock = vi.fn();
const getSettingMock = vi.fn(
    (_key?: string) => undefined as string | undefined,
);
const handleErrorMock = vi.fn();
const extractDropDataMock = vi.fn(
    (_event?: Event) => null as { type: string; item: string } | null,
);
const dragOnDroppedMock = vi.fn();
const useScreenManagerEventsMock = vi.fn();
const useScreenUpdateEventsMock = vi.fn();
const slideValidateMock = vi.fn();
const pdfTryValidateMock = vi.fn((item: any) => item?.kind === 'pdf');
const pptxTryValidateMock = vi.fn((item: any) => item?.kind === 'pptx');
const docxTryValidateMock = vi.fn((item: any) => item?.kind === 'docx');

let videoSources: [string, string][] = [];
let screenManagerBase: any;
let screenManager: any;
let otherScreenManager: any;
let allScreenManagers: any[] = [];
let bibleViewController: any;

const ScreenManagerBaseContextMock = createContext<any>(null);

function getValidOnScreen(items: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(items).filter(([key]) => Number.parseInt(key) <= 2),
    );
}

function createScreenManager(
    screenId: number,
    overrides: Record<string, unknown> = {},
) {
    const displayListeners: Array<() => void> = [];
    const manager: any = {
        screenId,
        key: `screen-${screenId}`,
        width: 1280,
        height: 720,
        isSelected: false,
        isShowing: true,
        isLocked: false,
        displayId: screenId === 1 ? 2 : 1,
        stageNumber: screenId,
        colorNote: screenId === 1 ? 'blue' : null,
        clear: vi.fn(),
        delete: vi.fn(),
        fireRefreshEvent: vi.fn(),
        receiveScreenDropped: vi.fn(),
        registerEventListener: vi.fn(
            (events: string[], callback: () => void) => {
                if (events.includes('display-id')) {
                    displayListeners.push(callback);
                }
                return [`listener-${screenId}-${displayListeners.length}`];
            },
        ),
        unregisterEventListener: vi.fn(),
        emitDisplayId() {
            for (const callback of displayListeners) {
                callback();
            }
        },
        screenBackgroundManager: {
            isShowing: true,
            clear: vi.fn(),
        },
        screenVaryAppDocumentManager: {
            isShowing: true,
            clear: vi.fn(),
        },
        screenBibleManager: {
            isShowing: false,
            screenViewData: null,
            isLineSync: false,
            clear: vi.fn(),
            handleScreenVersesHighlighting: vi.fn(),
            applyBibleViewData: undefined,
            handleBibleViewVersesHighlighting: undefined,
        },
        screenForegroundManager: {
            isShowing: false,
            clear: vi.fn(),
        },
    };
    return Object.assign(manager, overrides);
}

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: ({ key }: { key: string }) => key,
    useKeyboardRegistering: useKeyboardRegisteringMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../../others/AppRangeComp', () => ({
    default: ({ value, title, setValue }: any) => {
        return (
            <button
                data-range-title={title}
                onClick={() => setValue(value + 1)}
            >
                {title}:{value}
            </button>
        );
    },
    handleCtrlWheel: handleCtrlWheelMock,
}));

vi.mock('../../helper/domHelpers', () => ({
    handleAutoHide: handleAutoHideMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => {
        return (
            <Suspense fallback={<div data-suspense="true" />}>
                {children}
            </Suspense>
        );
    },
}));

vi.mock('./MiniScreenAudioHandlersComp', () => ({
    default: ({ src, videoId }: { src: string; videoId: string }) => {
        return <div data-audio-handler={videoId}>{src}</div>;
    },
}));

vi.mock('./ScreenEffectControlComp', () => ({
    default: () => <button type="button">Effect</button>,
}));

vi.mock('../../others/ItemColorNoteComp', () => ({
    default: ({ item }: any) => (
        <div data-color-note={item.screenId}>ColorNote</div>
    ),
}));

vi.mock('./ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => {
        return <span data-showing-screen={screenId}>Screen:{screenId}</span>;
    },
}));

vi.mock('../../helper/debuggerHelpers', () => ({
    useAppEffect: useEffect,
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    useStateSettingNumber: (_key: string, initialValue: number) => {
        return useState(initialValue);
    },
}));

vi.mock('../managers/screenManagerHelpers', () => ({
    genNewScreenManagerBase: genNewScreenManagerBaseMock,
    getAllScreenManagers: getAllScreenManagersMock,
    getScreenManagersFromSetting: getScreenManagersFromSettingMock,
}));

vi.mock('../managers/screenManagerBaseHelpers', () => ({
    getSelectedScreenManagerBases: getSelectedScreenManagerBasesMock,
    getValidOnScreen,
}));

vi.mock('../screenHelpers', () => ({
    getAllDisplays: () => ({
        primaryDisplay: {
            id: 1,
            bounds: { width: 1920, height: 1080 },
        },
        displays: [
            {
                id: 1,
                label: 'Main',
                bounds: { width: 1920, height: 1080 },
            },
            {
                id: 2,
                label: 'Projector',
                bounds: { width: 1280, height: 720 },
            },
        ],
    }),
}));

vi.mock('../managers/screenManagerHooks', () => ({
    ScreenManagerBaseContext: ({ value, children }: any) => {
        return (
            <ScreenManagerBaseContextMock.Provider value={value}>
                {children}
            </ScreenManagerBaseContextMock.Provider>
        );
    },
    useScreenManagerBaseContext: () => {
        return useContext(ScreenManagerBaseContextMock) ?? screenManagerBase;
    },
    useScreenManagerContext: () => {
        return useContext(ScreenManagerBaseContextMock) ?? screenManager;
    },
    useScreenManagerEvents: useScreenManagerEventsMock,
    useScreenUpdateEvents: useScreenUpdateEventsMock,
    useScreenVideoSources: () => videoSources,
}));

vi.mock('../../helper/helpers', () => ({
    HIGHLIGHT_SELECTED_CLASSNAME: 'app-highlight-selected',
    RECEIVING_DROP_CLASSNAME: 'app-receiving-drop',
    isValidJson: (value: string) => {
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    },
}));

vi.mock('../../helper/colorNoteHelpers', () => ({
    genColorBar: (color: string) => (
        <div data-color-bar={color}>bar-{color}</div>
    ),
    genColorMap: (screenManagers: any[]) => {
        return screenManagers.reduce(
            (acc, current) => {
                const key = current.colorNote ?? 'none';
                acc[key] ??= [];
                acc[key].push(current);
                return acc;
            },
            {} as Record<string, any[]>,
        );
    },
    genColorNoteDataList: (colorMap: Record<string, any[]>) => {
        return Object.keys(colorMap);
    },
}));

vi.mock('../../helper/dragHelpers', () => ({
    dragStore: { onDropped: dragOnDroppedMock },
    extractDropData: extractDropDataMock,
}));

vi.mock('../../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => bibleViewController,
}));

vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static fromJson(json: any) {
            return json;
        }
    },
}));

vi.mock('../../app-document-list/Slide', () => ({
    default: class Slide {
        static readonly validate = slideValidateMock;
    },
}));

vi.mock('../../app-document-list/PdfSlide', () => ({
    default: class PdfSlide {
        static readonly tryValidate = pdfTryValidateMock;
    },
}));

vi.mock('../../app-document-list/PptxSlide', () => ({
    default: class PptxSlide {
        static readonly tryValidate = pptxTryValidateMock;
    },
}));

vi.mock('../../app-document-list/DocxSlide', () => ({
    default: class DocxSlide {
        static readonly tryValidate = docxTryValidateMock;
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./CustomHTMLScreenPreviewer', () => ({}));

vi.mock('../managers/ScreenManager', () => ({
    default: class ScreenManager {
        static readonly initReceiveScreenMessage = vi.fn();
    },
}));

describe('preview runtime interactions', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.clearAllMocks();
        videoSources = [];

        screenManager = createScreenManager(1, {
            isSelected: false,
            displayId: 2,
            isLocked: true,
            stageNumber: 2,
        });
        screenManager.screenBibleManager.isShowing = true;
        screenManager.screenBibleManager.screenViewData = {
            type: 'bible-item',
        };
        otherScreenManager = createScreenManager(2, {
            isSelected: true,
            colorNote: null,
        });
        screenManagerBase = screenManager;
        allScreenManagers = [screenManager, otherScreenManager];
        getAllScreenManagersMock.mockImplementation(() => allScreenManagers);
        getScreenManagersFromSettingMock.mockImplementation(
            () => allScreenManagers,
        );
        getSelectedScreenManagerBasesMock.mockImplementation(() => {
            return allScreenManagers.filter((manager) => manager.isSelected);
        });
        bibleViewController = {
            nestedBibleItems: ['stale'],
            appendBibleItem: vi.fn(),
            handleVersesHighlighting: vi.fn(),
            handleScreenBibleVersesHighlighting: vi.fn(),
        };
        handleCtrlWheelMock.mockImplementation(
            ({
                value,
                setValue,
            }: {
                value: number;
                setValue: (value: number) => void;
            }) => {
                setValue(value + 1);
            },
        );
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('updates display, visibility, and lock state from preview controls', async () => {
        const { default: DisplayControl } = await import('./DisplayControl');
        const { default: ShowHideScreen } = await import('./ShowHideScreen');
        const { default: ScreenPreviewerHeaderComp } =
            await import('./ScreenPreviewerHeaderComp');

        await act(async () => {
            root.render(
                <div>
                    <DisplayControl />
                    <ShowHideScreen />
                    <ScreenPreviewerHeaderComp />
                </div>,
            );
        });

        const displayButton = container.querySelector(
            'button[title*="Display:Projector"]',
        ) as HTMLButtonElement | null;
        expect(displayButton?.textContent).toContain('Projector(1):2');

        showAppContextMenuMock.mockClear();
        await act(async () => {
            displayButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        const displayItems = (showAppContextMenuMock.mock.calls[0]?.[1] ??
            []) as Array<{
            menuElement: string;
            onSelect: () => void;
        }>;
        expect(displayItems[1]?.menuElement).toContain(
            '*Projector(2): 1280x720',
        );
        await act(async () => {
            displayItems[0]?.onSelect();
        });
        expect(screenManager.displayId).toBe(1);

        const showHide = container.querySelector(
            '.show-hide',
        ) as HTMLDivElement | null;
        expect(showHide?.title).toContain('[F5]');
        expect(showHide?.className).toContain('showing');
        await act(async () => {
            showHide?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        expect(screenManager.isShowing).toBe(false);

        const lockIcon = container.querySelector(
            '.bi-lock-fill',
        ) as HTMLElement | null;
        await act(async () => {
            lockIcon?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        expect(screenManager.isLocked).toBe(false);
        expect(container.querySelector('.bi-unlock')).not.toBeNull();
    });

    test('changes stage number and toggles background audio handlers in the footer', async () => {
        const { default: ScreenPreviewerFooterComp } =
            await import('./ScreenPreviewerFooterComp');

        videoSources = [['/media/background.mp3', 'video-1']];

        await act(async () => {
            root.render(<ScreenPreviewerFooterComp />);
        });

        const audioToggle = container.querySelector(
            'button[title="Enable Background Audio Handlers"]',
        ) as HTMLButtonElement | null;
        const stageControl = container.querySelector(
            '[title="Stage: Click to change Stage Number"]',
        ) as HTMLDivElement | null;

        showAppContextMenuMock.mockClear();
        await act(async () => {
            stageControl?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        const stageItems = (showAppContextMenuMock.mock.calls[0]?.[1] ??
            []) as Array<{
            menuElement: string;
            onSelect: () => void;
        }>;
        await act(async () => {
            stageItems.at(-1)?.onSelect();
        });
        expect(screenManager.stageNumber).toBe(3);
        expect(container.textContent).toContain('St:3');

        await act(async () => {
            audioToggle?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(
            container.querySelector('[data-audio-handler="video-1"]'),
        ).not.toBeNull();

        const audio = document.createElement('audio');
        audio.dataset.videoId = 'video-1';
        Object.defineProperty(audio, 'paused', {
            configurable: true,
            get: () => false,
        });
        document.body.appendChild(audio);

        await act(async () => {
            audioToggle?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Audio is Playing',
            'Please pause all background audios before disabling audio handlers',
        );
        expect(
            container.querySelector('[data-audio-handler="video-1"]'),
        ).not.toBeNull();

        Object.defineProperty(audio, 'paused', {
            configurable: true,
            get: () => true,
        });
        await act(async () => {
            audioToggle?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        expect(
            container.querySelector('[data-audio-handler="video-1"]'),
        ).toBeNull();

        audio.remove();
    });

    test('runs clear controls and refreshes preview scale changes', async () => {
        const { default: MiniScreenClearControlComp } =
            await import('./MiniScreenClearControlComp');
        const { default: MiniScreenComp } = await import('./MiniScreenComp');

        screenManager.screenBibleManager.isShowing = false;
        screenManager.screenForegroundManager.isShowing = false;

        await act(async () => {
            root.render(
                <div>
                    <MiniScreenClearControlComp />
                    <MiniScreenComp />
                </div>,
            );
        });

        const clearAllButton = container.querySelector(
            'button[title="Clear All [F6]"]',
        ) as HTMLButtonElement | null;
        const clearBackgroundButton = container.querySelector(
            'button[title="Clear Background [F7]"]',
        ) as HTMLButtonElement | null;
        const clearBibleButton = container.querySelector(
            'button[title="Clear Bible [F9]"]',
        ) as HTMLButtonElement | null;
        await act(async () => {
            clearAllButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
            clearBackgroundButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
            clearBibleButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });

        expect(screenManager.clear).toHaveBeenCalledOnce();
        expect(
            screenManager.screenBackgroundManager.clear,
        ).toHaveBeenCalledOnce();
        expect(screenManager.screenBibleManager.clear).not.toHaveBeenCalled();
        expect(useKeyboardRegisteringMock).toHaveBeenCalled();

        const miniScreenCard = container.querySelector(
            '.card.app-zero-border-radius',
        ) as HTMLDivElement | null;
        await act(async () => {
            miniScreenCard?.dispatchEvent(
                new WheelEvent('wheel', { bubbles: true, cancelable: true }),
            );
        });
        expect(handleCtrlWheelMock).toHaveBeenCalledOnce();

        const rangeButton = container.querySelector(
            '[data-range-title="Preview Size Scale"]',
        ) as HTMLButtonElement | null;
        await act(async () => {
            rangeButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });

        expect(screenManager.fireRefreshEvent).toHaveBeenCalled();
        expect(otherScreenManager.fireRefreshEvent).toHaveBeenCalled();
        expect(handleAutoHideMock).toHaveBeenCalled();
    });

    test('handles preview item resize, menus, drag and wheel interactions', async () => {
        const { default: ScreenPreviewerItemComp } =
            await import('./ScreenPreviewerItemComp');

        screenManager.isSelected = false;
        otherScreenManager.isSelected = true;
        screenManager.screenBibleManager.isShowing = true;
        screenManager.screenBibleManager.screenViewData = {
            type: 'bible-item',
        };

        await act(async () => {
            root.render(
                <ScreenManagerBaseContextMock.Provider value={screenManager}>
                    <ScreenPreviewerItemComp width={200} />
                </ScreenManagerBaseContextMock.Provider>,
            );
        });

        const card = container.querySelector(
            '.mini-screen',
        ) as HTMLDivElement | null;
        const previewBody = container.querySelector(
            '.w-100.app-overflow-hidden',
        ) as HTMLDivElement | null;
        expect(card?.className).not.toContain('app-highlight-selected');
        expect(previewBody?.style.height).toBe('113px');

        screenManager.width = 1000;
        screenManager.height = 1000;
        await act(async () => {
            screenManager.emitDisplayId();
        });
        expect(previewBody?.style.height).toBe('200px');

        showAppContextMenuMock.mockClear();
        await act(async () => {
            card?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        const menuItems = (showAppContextMenuMock.mock.calls[0]?.[1] ??
            []) as Array<{
            menuElement: string;
            onSelect: () => void;
        }>;
        expect(menuItems.map(({ menuElement }) => menuElement)).toContain(
            'Solo',
        );
        expect(menuItems.map(({ menuElement }) => menuElement)).toContain(
            'Select',
        );
        expect(menuItems.map(({ menuElement }) => menuElement)).toContain(
            'Delete',
        );
        expect(menuItems.map(({ menuElement }) => menuElement)).toContain(
            'Set Line Sync',
        );
        expect(menuItems.map(({ menuElement }) => menuElement)).toContain(
            'Refresh Preview',
        );

        await act(async () => {
            menuItems[0]?.onSelect();
            menuItems[1]?.onSelect();
            menuItems[2]?.onSelect();
            menuItems[3]?.onSelect();
            menuItems[4]?.onSelect();
        });

        expect(otherScreenManager.isSelected).toBe(false);
        expect(screenManager.delete).toHaveBeenCalledOnce();
        expect(screenManager.screenBibleManager.isLineSync).toBe(true);
        expect(screenManager.fireRefreshEvent).toHaveBeenCalled();
        expect(otherScreenManager.fireRefreshEvent).toHaveBeenCalled();

        const dragOverEvent = new Event('dragover', {
            bubbles: true,
            cancelable: true,
        });
        const dragLeaveEvent = new Event('dragleave', {
            bubbles: true,
            cancelable: true,
        });
        const dragPreventDefault = vi.fn();
        Object.defineProperty(dragOverEvent, 'preventDefault', {
            configurable: true,
            value: dragPreventDefault,
        });
        Object.defineProperty(dragLeaveEvent, 'preventDefault', {
            configurable: true,
            value: dragPreventDefault,
        });

        await act(async () => {
            card?.dispatchEvent(dragOverEvent);
        });
        expect(card?.className).toContain('app-receiving-drop');

        await act(async () => {
            card?.dispatchEvent(dragLeaveEvent);
        });
        expect(card?.className).not.toContain('app-receiving-drop');

        const emptyDropEvent = new Event('drop', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            card?.dispatchEvent(emptyDropEvent);
        });
        expect(dragOnDroppedMock).toHaveBeenCalled();

        extractDropDataMock.mockReturnValueOnce({
            type: 'bg-color',
            item: '#fff',
        });
        const filledDropEvent = new Event('drop', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            card?.dispatchEvent(filledDropEvent);
        });
        expect(screenManager.receiveScreenDropped).toHaveBeenCalledWith({
            type: 'bg-color',
            item: '#fff',
        });

        const wheelEvent = new Event('wheel', {
            bubbles: true,
            cancelable: true,
        });
        const stopPropagation = vi.fn();
        Object.defineProperty(wheelEvent, 'ctrlKey', {
            configurable: true,
            value: true,
        });
        Object.defineProperty(wheelEvent, 'stopPropagation', {
            configurable: true,
            value: stopPropagation,
        });
        await act(async () => {
            card?.dispatchEvent(wheelEvent);
        });
        expect(stopPropagation).toHaveBeenCalledOnce();

        if (previewBody !== null) {
            previewBody.scrollTop = 90;
            await act(async () => {
                previewBody.dispatchEvent(
                    new Event('scroll', { bubbles: true, cancelable: true }),
                );
            });
            expect(previewBody.scrollTop).toBe(0);
        }

        await act(async () => {
            root.unmount();
        });
        expect(screenManager.unregisterEventListener).toHaveBeenCalled();
        root = createRoot(container);
    });

    test('wires body context menus, Bible controller syncing, and stored app-document parsing', async () => {
        vi.useFakeTimers();
        const { default: MiniScreenBodyComp } =
            await import('./MiniScreenBodyComp');
        const previewHelpers = await import('./screenPreviewerHelpers');

        await act(async () => {
            root.render(<MiniScreenBodyComp previewScale={2} />);
        });

        expect(
            container.querySelector('[data-color-bar="blue"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-color-bar="none"]'),
        ).not.toBeNull();

        const body = container.querySelector(
            '.card-body',
        ) as HTMLDivElement | null;
        showAppContextMenuMock.mockClear();
        await act(async () => {
            body?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        const bodyMenuItems = (showAppContextMenuMock.mock.calls[0]?.[1] ??
            []) as Array<{
            menuElement: string;
            onSelect: () => void;
        }>;
        await act(async () => {
            bodyMenuItems[0]?.onSelect();
            bodyMenuItems[1]?.onSelect();
        });
        expect(genNewScreenManagerBaseMock).toHaveBeenCalledOnce();
        expect(screenManager.fireRefreshEvent).toHaveBeenCalled();
        expect(otherScreenManager.fireRefreshEvent).toHaveBeenCalled();

        bibleViewController.handleScreenBibleVersesHighlighting(
            'GEN-1-1',
            true,
        );
        expect(
            screenManager.screenBibleManager.handleScreenVersesHighlighting,
        ).toHaveBeenCalledWith('GEN-1-1', true);
        expect(
            otherScreenManager.screenBibleManager
                .handleScreenVersesHighlighting,
        ).toHaveBeenCalledWith('GEN-1-1', true);

        screenManager.screenBibleManager.applyBibleViewData?.({
            bibleItemData: {
                bibleItem: {
                    target: {
                        bookKey: 'GEN',
                        chapter: 1,
                        verseStart: 1,
                        verseEnd: 2,
                    },
                },
                renderedList: [{ bibleKey: 'KJV' }, { bibleKey: 'NIV' }],
            },
        });
        expect(bibleViewController.nestedBibleItems).toEqual([]);
        expect(bibleViewController.appendBibleItem).toHaveBeenCalledTimes(2);

        screenManager.screenBibleManager.handleBibleViewVersesHighlighting?.(
            'GEN-1-2',
            false,
        );
        await vi.runAllTimersAsync();
        expect(
            bibleViewController.handleVersesHighlighting,
        ).toHaveBeenCalledWith('GEN-1-2', false);

        getSettingMock.mockReturnValueOnce(
            JSON.stringify({
                1: {
                    filePath: '/slides/sample.pdf',
                    itemJson: { kind: 'pdf', id: 1 },
                },
                3: {
                    filePath: '/slides/ignore.pptx',
                    itemJson: { kind: 'pptx', id: 2 },
                },
            }),
        );
        expect(previewHelpers.getAppDocumentListOnScreenSetting()).toEqual({
            1: {
                filePath: '/slides/sample.pdf',
                itemJson: { kind: 'pdf', id: 1 },
            },
        });

        getSettingMock.mockReturnValueOnce('{');
        expect(previewHelpers.getAppDocumentListOnScreenSetting()).toEqual({});

        getSettingMock.mockReturnValueOnce(
            JSON.stringify({
                1: {
                    filePath: 123,
                    itemJson: { kind: 'slide', id: 7 },
                },
            }),
        );
        expect(previewHelpers.getAppDocumentListOnScreenSetting()).toEqual({});
        expect(handleErrorMock).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });
});
