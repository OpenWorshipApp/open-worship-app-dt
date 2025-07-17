import ScreenPreviewerItemComp from './ScreenPreviewerItemComp';
import { DEFAULT_PREVIEW_SIZE } from './MiniScreenFooterComp';
import ScreenPreviewerTools from './ScreenPreviewerTools';
import {
    genNewScreenManagerBase,
    getAllScreenManagers,
    getScreenManagersFromSetting,
} from '../managers/screenManagerHelpers';
import ScreenManager from '../managers/ScreenManager';
import {
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import BibleItemsViewController, {
    useBibleItemsViewControllerContext,
} from '../../bible-reader/BibleItemsViewController';
import BibleItem from '../../bible-list/BibleItem';
import { previewingEventListener } from '../../event/PreviewingEventListener';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { BibleItemDataType } from '../screenTypeHelpers';

function openContextMenu(event: any) {
    showAppContextMenu(event, [
        {
            menuElement: 'Add New Screen',
            onSelect() {
                genNewScreenManagerBase();
            },
        },
        {
            menuElement: 'Refresh Preview',
            onSelect() {
                getAllScreenManagers().forEach((screenManager) => {
                    screenManager.fireRefreshEvent();
                });
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
        screenManagers.forEach(({ screenBibleManager }) => {
            screenBibleManager.handleScreenVersesHighlighting(
                kjvVerseKey,
                isToTop,
            );
        });
    };
    screenManagers.forEach(({ screenBibleManager }) => {
        screenBibleManager.applyBibleViewData = (
            bibleData: BibleItemDataType | null,
        ) => {
            if (
                bibleData?.bibleItemData?.bibleItem.target &&
                bibleData.bibleItemData.renderedList.length > 0
            ) {
                bibleItemViewController.nestedBibleItems = [];
                const { target } = bibleData.bibleItemData.bibleItem;
                bibleData.bibleItemData.renderedList.forEach(({ bibleKey }) => {
                    const bibleItem = BibleItem.fromJson({
                        id: -1,
                        bibleKey: bibleKey,
                        target,
                        metadata: {},
                    });
                    bibleItemViewController.appendBibleItem(bibleItem);
                    previewingEventListener.showBibleItem(bibleItem);
                });
            }
        };
        screenBibleManager.handleBibleViewVersesHighlighting = (
            kjvVerseKey: string,
            isToTop: boolean,
        ) => {
            bibleItemViewController.handleVersesHighlighting(
                kjvVerseKey,
                isToTop,
            );
        };
    });
}

export default function MiniScreenBodyComp({
    isShowingTools,
    setIsShowingTools,
    previewScale,
}: Readonly<{
    isShowingTools: boolean;
    setIsShowingTools: (isShowing: boolean) => void;
    previewScale: number;
}>) {
    useScreenManagerEvents(['instance']);
    const screenManagers = getScreenManagersFromSetting();
    const bibleItemViewController = useBibleItemsViewControllerContext();
    viewControllerAndScreenManagers(screenManagers, bibleItemViewController);

    const previewWidth = DEFAULT_PREVIEW_SIZE * previewScale;
    return (
        <div
            className={'card-body d-flex flex-column'}
            style={{
                overflow: 'auto',
                paddingBottom: '50px',
            }}
            onContextMenu={(event) => {
                openContextMenu(event);
            }}
        >
            <div className="w-100 flex-fill">
                {screenManagers.map((screenManager) => {
                    return (
                        <ScreenManagerBaseContext
                            key={screenManager.key}
                            value={screenManager}
                        >
                            <ScreenPreviewerItemComp width={previewWidth} />
                        </ScreenManagerBaseContext>
                    );
                })}
            </div>
            {isShowingTools ? (
                <div style={{ zIndex: '0' }}>
                    <hr />
                    <ScreenPreviewerTools
                        onClose={() => {
                            setIsShowingTools(false);
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
