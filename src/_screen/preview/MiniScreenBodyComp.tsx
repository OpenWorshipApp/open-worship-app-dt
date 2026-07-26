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
import type { BibleItemDataType } from '../screenTypeHelpers';
import { tran } from '../../lang/langHelpers';
import { Fragment, useCallback, useMemo } from 'react';
import {
    genColorBar,
    genColorMap,
    genColorNoteDataList,
} from '../../helper/colorNoteHelpers';

function openContextMenu(event: any) {
    showAppContextMenu(event, [
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
        for (const { screenBibleManager } of screenManagers) {
            screenBibleManager.handleScreenVersesHighlighting(
                kjvVerseKey,
                isToTop,
            );
        }
    };
    for (const { screenBibleManager } of screenManagers) {
        screenBibleManager.applyBibleViewData = (
            bibleData: BibleItemDataType | null,
        ) => {
            if (
                bibleData?.bibleItemData?.bibleItem.target &&
                bibleData.bibleItemData.renderedList.length > 0
            ) {
                bibleItemViewController.nestedBibleItems = [];
                const { target } = bibleData.bibleItemData.bibleItem;
                for (const { bibleKey } of bibleData.bibleItemData
                    .renderedList) {
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
        screenBibleManager.handleBibleViewVersesHighlighting = (
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
        openContextMenu(event);
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
