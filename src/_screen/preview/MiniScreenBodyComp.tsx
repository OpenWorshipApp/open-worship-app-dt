import ScreenPreviewerItemComp from './ScreenPreviewerItemComp';
import { DEFAULT_PREVIEW_SIZE } from './MiniScreenFooterComp';
import {
    genNewScreenManagerBase,
    getAllScreenManagers,
    getScreenManagersFromSetting,
} from '../managers/screenManagerHelpers';
import type ScreenManager from '../managers/ScreenManager';
import {
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import type BibleItemsViewController from '../../bible-reader/BibleItemsViewController';
import { useBibleItemsViewControllerContext } from '../../bible-reader/BibleItemsViewController';
import BibleItem from '../../bible-list/BibleItem';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import type { LongTextDataType } from '../screenTypeHelpers';
import { getBibleItemData } from '../screenLongTextTypeHelpers';
import { checkIsSameBibleTarget } from '../../helper/bible-helpers/bibleTargetHelpers';
import { tran } from '../../lang/langHelpers';
import { Fragment, useCallback, useMemo } from 'react';
import {
    getMirrorState,
    getMirrorPanelShowing,
    setMirrorPanelShowing,
} from '../../screen-mirror/mirrorConnectionHelpers';
import {
    genColorBar,
    genColorMap,
    genColorNoteDataList,
} from '../../helper/colorNoteHelpers';
import { setIsBibleCustomStyleFloatingShowing } from '../../screen-setting/bibleCustomStyleFloatingHelpers';
import {
    getIsWallpaperBackdropEnabled,
    setIsWallpaperBackdropEnabled,
} from './displayWallpaperHelpers';

// Also opened by the floating ⋮ that `MiniScreenComp` parks at the bottom-right
// of the card, so the menu is reachable without a right-click.
export function openMiniScreenContextMenu(event: any) {
    showAppContextMenu(event, [
        ...(getMirrorState()?.guests ?? []).map((guest) => ({
            childBefore: genContextMenuItemIcon('pc-display'),
            menuElement: `${guest.prefix}: ${guest.name}`,
            onSelect() {
                setMirrorPanelShowing(true, 'mirror');
            },
        })),
        {
            childBefore: genContextMenuItemIcon(
                getMirrorPanelShowing() ? 'check-square' : 'square',
            ),
            menuElement: tran('Virtual Screens Manager'),
            onSelect() {
                setMirrorPanelShowing(!getMirrorPanelShowing());
            },
        },
        {
            childBefore: genContextMenuItemIcon('window-plus'),
            menuElement: tran('Add New Screen'),
            onSelect() {
                genNewScreenManagerBase();
            },
        },
        {
            childBefore: genContextMenuItemIcon('arrow-clockwise'),
            menuElement: tran('Refresh Preview'),
            onSelect() {
                for (const screenManager of getAllScreenManagers()) {
                    screenManager.fireRefreshEvent();
                }
            },
        },
        {
            // The card draws each monitor's own desktop background behind
            // everything. The way back to the plain checkered pattern -- for
            // somebody who reads that as "nothing is on this screen" -- lives
            // here.
            childBefore: genContextMenuItemIcon(
                getIsWallpaperBackdropEnabled() ? 'check-square' : 'square',
            ),
            menuElement: tran('Show Monitor Wallpaper'),
            onSelect() {
                setIsWallpaperBackdropEnabled(!getIsWallpaperBackdropEnabled());
                // Every card re-reads the setting on a refresh, which is also
                // what reads the wallpaper for the ones turning it back on.
                for (const screenManager of getAllScreenManagers()) {
                    screenManager.fireRefreshEvent();
                }
            },
        },
        {
            childBefore: genContextMenuItemIcon('book'),
            menuElement: tran('Bible Properties'),
            // Opens, never toggles: the footer button that owns the toggle
            // auto-hides, so reaching this menu with the panel already open must
            // not close it.
            onSelect() {
                setIsBibleCustomStyleFloatingShowing(true);
            },
        },
    ]);
}

function viewControllerAndScreenManagers(
    screenManagers: ScreenManager[],
    bibleItemViewController: BibleItemsViewController,
) {
    bibleItemViewController.handleScreenBibleVersesHighlighting = (
        kjvVerseKey: string,
        isToTop: boolean,
    ) => {
        for (const { screenLongTextManager } of screenManagers) {
            // A verse clicked in the Reader is no row of a long text:
            // writing it there would only drop that screen's own
            // selected section.
            if (screenLongTextManager.isShowingLongText) {
                continue;
            }
            screenLongTextManager.handleScreenVersesHighlighting(
                kjvVerseKey,
                isToTop,
            );
        }
    };
    for (const { screenLongTextManager } of screenManagers) {
        screenLongTextManager.applyBibleViewData = (
            viewData: LongTextDataType | null,
        ) => {
            // Only a Bible passage is the Reader's to follow.
            const bibleItemData = getBibleItemData(viewData);
            if (
                bibleItemData?.bibleItem.target &&
                bibleItemData.renderedList.length > 0
            ) {
                const { target } = bibleItemData.bibleItem;
                // The same passage in the same versions already: a screen
                // drawn one chapter deeper (`...`) or sent again must not
                // rebuild the Reader's view of it.
                const currentItems = bibleItemViewController.straightBibleItems;
                const isSameView =
                    currentItems.length === bibleItemData.renderedList.length &&
                    currentItems.every((item, i) => {
                        const json = item.toJson();
                        return (
                            json.bibleKey ===
                                bibleItemData.renderedList[i].bibleKey &&
                            checkIsSameBibleTarget(json.target, target)
                        );
                    });
                if (isSameView) {
                    return;
                }
                bibleItemViewController.nestedBibleItems = [];
                for (const { bibleKey } of bibleItemData.renderedList) {
                    const bibleItem = BibleItem.fromJson({
                        id: -1,
                        bibleKey: bibleKey,
                        target,
                        metadata: {},
                    });
                    bibleItemViewController.appendBibleItem(bibleItem);
                }
            }
        };
        screenLongTextManager.handleBibleViewVersesHighlighting = (
            kjvVerseKey: string,
            isToTop: boolean,
        ) => {
            setTimeout(() => {
                bibleItemViewController.handleVersesHighlighting(
                    kjvVerseKey,
                    isToTop,
                );
            }, 0);
        };
    }
}

function genScreenManagersRenderer(
    screenManagers: ScreenManager[],
    previewWidth: number,
) {
    return screenManagers.map((screenManager) => {
        return (
            <ScreenManagerBaseContext
                key={screenManager.key}
                value={screenManager}
            >
                <ScreenPreviewerItemComp width={previewWidth} />
            </ScreenManagerBaseContext>
        );
    });
}

function RenderWithColorNoteComp({
    screenManagers,
    previewWidth,
}: Readonly<{
    previewWidth: number;
    screenManagers: ScreenManager[];
}>) {
    const screenManagerColorMap = useMemo(() => {
        return genColorMap(screenManagers);
    }, [screenManagers]);
    const colorNotes = useMemo(() => {
        return genColorNoteDataList(screenManagerColorMap);
    }, [screenManagerColorMap]);

    // ONE flat keyed list, never a Fragment per group. Nesting each group made a
    // screen changing its color note move to a different parent, which React can
    // only do by unmounting and remounting the whole previewer card: the
    // shadow-root React root is destroyed and rebuilt, taking the draw canvas
    // (and its supersampled backing store) and any playing background video with
    // it. Flat, every card is a keyed sibling, so joining/leaving a group is just
    // a reorder of the existing nodes.
    const isSingleGroup = Object.keys(screenManagerColorMap).length === 1;
    return colorNotes.flatMap((colorNote) => {
        const subScreenManagers = screenManagerColorMap[colorNote] ?? [];
        const renderedScreenManagers = genScreenManagersRenderer(
            subScreenManagers,
            previewWidth,
        );
        if (isSingleGroup) {
            return renderedScreenManagers;
        }
        return [
            <Fragment key={`color-bar-${colorNote}`}>
                {genColorBar(colorNote)}
            </Fragment>,
            ...renderedScreenManagers,
        ];
    });
}

export default function MiniScreenBodyComp({
    previewScale,
}: Readonly<{
    previewScale: number;
}>) {
    useScreenManagerEvents(['instance']);
    useScreenManagerEvents(['color-note-update']);
    const screenManagers = getScreenManagersFromSetting();
    const bibleItemViewController = useBibleItemsViewControllerContext();
    viewControllerAndScreenManagers(screenManagers, bibleItemViewController);

    const previewWidth = DEFAULT_PREVIEW_SIZE * previewScale;

    const handleContextMenuOpening = useCallback((event: any) => {
        openMiniScreenContextMenu(event);
    }, []);

    return (
        <div
            className="card-body d-flex flex-column"
            style={{
                overflow: 'auto',
                paddingBottom: 30,
            }}
            onContextMenu={handleContextMenuOpening}
        >
            <div className="w-100 flex-fill">
                <RenderWithColorNoteComp
                    screenManagers={screenManagers}
                    previewWidth={previewWidth}
                />
            </div>
        </div>
    );
}
