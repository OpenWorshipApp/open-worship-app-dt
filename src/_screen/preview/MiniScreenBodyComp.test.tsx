// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    Context: null as any,
    eventNames: [] as string[][],
    screenManagers: [] as any[],
    allScreenManagers: [] as any[],
    viewController: null as any,
    menuCalls: [] as { event: any; items: any[] }[],
    mirrorState: null as null | { guests: { prefix: string; name: string }[] },
    isMirrorPanelShowing: false,
    setMirrorPanelShowing: vi.fn(),
    genNewScreenManagerBase: vi.fn(),
    isWallpaperEnabled: true,
    setIsWallpaperBackdropEnabled: vi.fn(),
    setIsBibleCustomStyleFloatingShowing: vi.fn(),
    fromJson: vi.fn(),
}));

vi.mock('../managers/screenManagerHooks', async () => {
    const { createContext } = await import('react');
    h.Context = createContext<any>(null);
    return {
        ScreenManagerBaseContext: h.Context,
        useScreenManagerEvents: (eventNames: string[]) => {
            h.eventNames.push(eventNames);
        },
    };
});
vi.mock('./ScreenPreviewerItemComp', async () => {
    const { use } = await import('react');
    return {
        default: ({ width }: { width: number }) => {
            const screenManager = use(h.Context) as any;
            return (
                <div
                    data-stub="item"
                    data-screen-id={screenManager.screenId}
                    data-width={width}
                />
            );
        },
    };
});
vi.mock('./MiniScreenFooterComp', () => ({ DEFAULT_PREVIEW_SIZE: 50 }));
vi.mock('../managers/screenManagerHelpers', () => ({
    genNewScreenManagerBase: h.genNewScreenManagerBase,
    getAllScreenManagers: () => h.allScreenManagers,
    getScreenManagersFromSetting: () => h.screenManagers,
}));
vi.mock('../../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../bible-list/BibleItem', () => ({
    default: { fromJson: h.fromJson },
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: any, items: any[]) => {
        h.menuCalls.push({ event, items });
    },
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../screen-mirror/mirrorConnectionHelpers', () => ({
    getMirrorState: () => h.mirrorState,
    getMirrorPanelShowing: () => h.isMirrorPanelShowing,
    setMirrorPanelShowing: h.setMirrorPanelShowing,
}));
// The color-note grouping is the real one; only the file layer it reaches
// for file paths is cut away.
vi.mock('../../helper/FileSource', () => ({ default: {} }));
vi.mock('../../screen-setting/bibleCustomStyleFloatingHelpers', () => ({
    setIsBibleCustomStyleFloatingShowing:
        h.setIsBibleCustomStyleFloatingShowing,
}));
vi.mock('./displayWallpaperHelpers', () => ({
    getIsWallpaperBackdropEnabled: () => h.isWallpaperEnabled,
    setIsWallpaperBackdropEnabled: h.setIsWallpaperBackdropEnabled,
}));

import MiniScreenBodyComp, {
    openMiniScreenContextMenu,
} from './MiniScreenBodyComp';

let container: HTMLDivElement;
let root: Root;

function createScreenManager(
    screenId: number,
    colorNote: string | null = null,
    isShowingLongText = false,
) {
    return {
        screenId,
        key: `screen-${screenId}`,
        colorNote,
        fireRefreshEvent: vi.fn(),
        screenLongTextManager: {
            isShowingLongText,
            handleScreenVersesHighlighting: vi.fn(),
            applyBibleViewData: null as any,
            handleBibleViewVersesHighlighting: null as any,
        },
    };
}

function createViewController(items: { bibleKey: string; target: any }[]) {
    return {
        handleScreenBibleVersesHighlighting: null as any,
        straightBibleItems: items.map((item) => {
            return { toJson: () => item };
        }),
        nestedBibleItems: ['old'] as any[],
        appendBibleItem: vi.fn(),
        handleVersesHighlighting: vi.fn(),
    };
}

const target = { bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 };

function genBibleViewData(bibleKeys: string[], viewTarget = target) {
    return {
        bibleItemData: {
            bibleItem: { target: viewTarget },
            renderedList: bibleKeys.map((bibleKey) => {
                return { bibleKey };
            }),
        },
    } as any;
}

async function renderBody(previewScale = 2) {
    await act(async () => {
        root.render(<MiniScreenBodyComp previewScale={previewScale} />);
    });
}

function getItems() {
    return [
        ...container.querySelectorAll<HTMLElement>('[data-stub="item"]'),
    ].map((item) => {
        return Number(item.dataset.screenId);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.eventNames.length = 0;
    h.menuCalls.length = 0;
    h.screenManagers = [];
    h.allScreenManagers = [];
    h.viewController = createViewController([]);
    h.mirrorState = null;
    h.isMirrorPanelShowing = false;
    h.isWallpaperEnabled = true;
    h.fromJson.mockImplementation((json: any) => {
        return { fromJson: json };
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('MiniScreenBodyComp', () => {
    test('one card per screen at the scaled preview width', async () => {
        h.screenManagers = [createScreenManager(1), createScreenManager(2)];
        await renderBody(3);
        expect(getItems()).toEqual([1, 2]);
        expect(
            container.querySelector<HTMLElement>('[data-stub="item"]')!.dataset
                .width,
        ).toBe('150');
        // A single group draws no color bar.
        expect(container.querySelector('hr')).toBe(null);
        expect(h.eventNames).toContainEqual(['instance']);
        expect(h.eventNames).toContainEqual(['color-note-update']);
    });

    test('screens in several color notes are grouped behind color bars', async () => {
        h.screenManagers = [
            createScreenManager(1, '#ff0000'),
            createScreenManager(2),
            createScreenManager(3, '#00ff00'),
            createScreenManager(4, '#ff0000'),
        ];
        await renderBody();
        // Sorted color notes first, the screens with none last.
        expect(getItems()).toEqual([3, 1, 4, 2]);
        const bars = [...container.querySelectorAll<HTMLElement>('hr')];
        expect(
            bars.map((bar) => {
                return bar.style.backgroundColor;
            }),
        ).toEqual(['rgb(0, 255, 0)', 'rgb(255, 0, 0)', '']);
        // Every card is a direct sibling: changing a group is a reorder,
        // never a remount under a new parent.
        const list = container.querySelector('.flex-fill')!;
        expect(
            list.querySelectorAll(':scope > [data-stub="item"]'),
        ).toHaveLength(4);
    });

    test('a Reader verse highlights every screen but one showing a long text', async () => {
        const plain = createScreenManager(1);
        const longText = createScreenManager(2, null, true);
        h.screenManagers = [plain, longText];
        await renderBody();

        h.viewController.handleScreenBibleVersesHighlighting('GEN.1.2', true);
        expect(
            plain.screenLongTextManager.handleScreenVersesHighlighting,
        ).toHaveBeenCalledWith('GEN.1.2', true);
        expect(
            longText.screenLongTextManager.handleScreenVersesHighlighting,
        ).not.toHaveBeenCalled();
    });

    test('a screen passage rebuilds the Reader with one item per version', async () => {
        const screenManager = createScreenManager(1);
        h.screenManagers = [screenManager];
        await renderBody();

        screenManager.screenLongTextManager.applyBibleViewData(
            genBibleViewData(['KJV', 'KHM']),
        );
        expect(h.viewController.nestedBibleItems).toEqual([]);
        expect(h.fromJson.mock.calls.map((call) => call[0])).toEqual([
            { id: -1, bibleKey: 'KJV', target, metadata: {} },
            { id: -1, bibleKey: 'KHM', target, metadata: {} },
        ]);
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(2);
    });

    test('the same passage in the same versions leaves the Reader alone', async () => {
        h.viewController = createViewController([
            { bibleKey: 'KJV', target },
            { bibleKey: 'KHM', target },
        ]);
        const screenManager = createScreenManager(1);
        h.screenManagers = [screenManager];
        await renderBody();

        screenManager.screenLongTextManager.applyBibleViewData(
            genBibleViewData(['KJV', 'KHM']),
        );
        expect(h.viewController.appendBibleItem).not.toHaveBeenCalled();
        expect(h.viewController.nestedBibleItems).toEqual(['old']);

        // A different version in one column is a new view.
        screenManager.screenLongTextManager.applyBibleViewData(
            genBibleViewData(['KJV', 'NIV']),
        );
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(2);

        // So is another verse range in the same versions.
        h.viewController.appendBibleItem.mockClear();
        screenManager.screenLongTextManager.applyBibleViewData(
            genBibleViewData(['KJV', 'KHM'], { ...target, verseEnd: 9 }),
        );
        expect(h.viewController.appendBibleItem).toHaveBeenCalledTimes(2);
    });

    test('only a Bible passage is the Reader’s to follow', async () => {
        const screenManager = createScreenManager(1);
        h.screenManagers = [screenManager];
        await renderBody();
        const apply = screenManager.screenLongTextManager.applyBibleViewData;

        apply(null);
        apply({ type: 'long-text' });
        apply(genBibleViewData([]));
        apply({
            bibleItemData: {
                bibleItem: { target: null },
                renderedList: [{ bibleKey: 'KJV' }],
            },
        });
        expect(h.viewController.appendBibleItem).not.toHaveBeenCalled();
        expect(h.viewController.nestedBibleItems).toEqual(['old']);
    });

    test('a screen verse highlight reaches the Reader a macrotask later', async () => {
        vi.useFakeTimers();
        const screenManager = createScreenManager(1);
        h.screenManagers = [screenManager];
        await renderBody();

        screenManager.screenLongTextManager.handleBibleViewVersesHighlighting(
            'GEN.1.3',
            false,
        );
        expect(
            h.viewController.handleVersesHighlighting,
        ).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(0);
        expect(h.viewController.handleVersesHighlighting).toHaveBeenCalledWith(
            'GEN.1.3',
            false,
        );
    });

    test('right click on the body opens the previewer menu', async () => {
        await renderBody();
        await act(async () => {
            container.querySelector('.card-body')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.menuCalls).toHaveLength(1);
        expect(
            h.menuCalls[0].items.map((item: any) => {
                return item.menuElement;
            }),
        ).toEqual([
            'Virtual Screens Manager',
            'Add New Screen',
            'Refresh Preview',
            'Show Monitor Wallpaper',
            'Bible Properties',
        ]);
    });
});

describe('openMiniScreenContextMenu', () => {
    function getItem(menuElement: string) {
        return h.menuCalls.at(-1)!.items.find((item: any) => {
            return item.menuElement === menuElement;
        });
    }

    test('lists every connected mirror guest first and opens the mirror panel', () => {
        h.mirrorState = {
            guests: [
                { prefix: 'V1', name: 'Lobby TV' },
                { prefix: 'V2', name: 'Phone' },
            ],
        };
        openMiniScreenContextMenu({});
        const items = h.menuCalls.at(-1)!.items;
        expect(items[0].menuElement).toBe('V1: Lobby TV');
        expect(items[1].menuElement).toBe('V2: Phone');
        expect(items[0].childBefore).toBe('icon:pc-display');

        items[1].onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenCalledWith(true, 'mirror');
    });

    test('the virtual screens entry toggles the panel and shows its state', () => {
        h.isMirrorPanelShowing = true;
        openMiniScreenContextMenu({});
        expect(getItem('Virtual Screens Manager').childBefore).toBe(
            'icon:check-square',
        );
        getItem('Virtual Screens Manager').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenLastCalledWith(false);

        h.isMirrorPanelShowing = false;
        openMiniScreenContextMenu({});
        expect(getItem('Virtual Screens Manager').childBefore).toBe(
            'icon:square',
        );
        getItem('Virtual Screens Manager').onSelect();
        expect(h.setMirrorPanelShowing).toHaveBeenLastCalledWith(true);
    });

    test('add and refresh act on the screens', () => {
        const first = createScreenManager(1);
        const second = createScreenManager(2);
        h.allScreenManagers = [first, second];
        openMiniScreenContextMenu({});

        getItem('Add New Screen').onSelect();
        expect(h.genNewScreenManagerBase).toHaveBeenCalledTimes(1);

        getItem('Refresh Preview').onSelect();
        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(second.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });

    test('the wallpaper entry flips the setting and refreshes every card', () => {
        const first = createScreenManager(1);
        h.allScreenManagers = [first];
        h.isWallpaperEnabled = true;
        openMiniScreenContextMenu({});
        expect(getItem('Show Monitor Wallpaper').childBefore).toBe(
            'icon:check-square',
        );
        getItem('Show Monitor Wallpaper').onSelect();
        expect(h.setIsWallpaperBackdropEnabled).toHaveBeenCalledWith(false);
        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(1);

        h.isWallpaperEnabled = false;
        openMiniScreenContextMenu({});
        expect(getItem('Show Monitor Wallpaper').childBefore).toBe(
            'icon:square',
        );
        getItem('Show Monitor Wallpaper').onSelect();
        expect(h.setIsWallpaperBackdropEnabled).toHaveBeenLastCalledWith(true);
    });

    test('Bible Properties only ever opens the floating panel', () => {
        openMiniScreenContextMenu({});
        getItem('Bible Properties').onSelect();
        getItem('Bible Properties').onSelect();
        expect(h.setIsBibleCustomStyleFloatingShowing.mock.calls).toEqual([
            [true],
            [true],
        ]);
    });
});
