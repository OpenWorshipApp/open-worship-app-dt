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
import { previewingEventListener } from '../../event/PreviewingEventListener';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
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
            menuElement: tran('Add New Screen'),
            onSelect() {
                genNewScreenManagerBase();
            },
        },
        {
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
                    previewingEventListener.showBibleItem(bibleItem);
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

    if (Object.keys(screenManagerColorMap).length === 1) {
        return genScreenManagersRenderer(screenManagers, previewWidth);
    }

    return colorNotes.map((colorNote) => {
        const subScreenManagers = screenManagerColorMap[colorNote] ?? [];
        return (
            <Fragment key={colorNote}>
                {genColorBar(colorNote)}
                {genScreenManagersRenderer(subScreenManagers, previewWidth)}
            </Fragment>
        );
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
