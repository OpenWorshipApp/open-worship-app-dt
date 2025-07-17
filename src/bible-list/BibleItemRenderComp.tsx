import Bible from './Bible';
import BibleItem from './BibleItem';
import ItemReadErrorComp from '../others/ItemReadErrorComp';
import { useFileSourceRefreshEvents } from '../helper/dirSourceHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    handleDragStart,
    handleAttachBackgroundDrop,
    extractDropData,
} from '../helper/dragHelpers';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { BibleSelectionMiniComp } from '../bible-lookup/BibleSelectionComp';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { useToggleBibleLookupPopupContext } from '../others/commonButtons';
import appProvider from '../server/appProvider';
import { DragTypeEnum } from '../helper/DragInf';
import { changeDragEventStyle, stopDraggingState } from '../helper/helpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import BibleItemsViewController, {
    useBibleItemsViewControllerContext,
} from '../bible-reader/BibleItemsViewController';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import AttachBackgroundIconComponent from '../others/AttachBackgroundIconComponent';
import { openBibleItemContextMenu } from './bibleHelpers';

async function getBible(bibleItem: BibleItem) {
    return bibleItem.filePath
        ? await Bible.fromFilePath(bibleItem.filePath)
        : null;
}

function handleOpening(
    event: any,
    viewController: BibleItemsViewController | LookupBibleItemController,
    bibleItem: BibleItem,
) {
    if (appProvider.isPagePresenter) {
        ScreenBibleManager.handleBibleItemSelecting(event, bibleItem);
    } else if (appProvider.isPageReader) {
        if (viewController instanceof LookupBibleItemController === false) {
            const lastBibleItem = viewController.straightBibleItems.pop();
            if (lastBibleItem !== undefined) {
                viewController.addBibleItemRight(lastBibleItem, bibleItem);
            } else {
                viewController.addBibleItem(
                    null,
                    bibleItem,
                    false,
                    false,
                    false,
                );
            }
            return;
        }
        if (event.shiftKey) {
            viewController.addBibleItemRight(
                viewController.selectedBibleItem,
                bibleItem,
            );
        } else {
            viewController.setLookupContentFromBibleItem(bibleItem);
        }
    }
}

export default function BibleItemRenderComp({
    index,
    bibleItem,
    warningMessage,
    filePath,
}: Readonly<{
    index: number;
    bibleItem: BibleItem;
    warningMessage?: string;
    filePath: string;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
    useFileSourceRefreshEvents(['select'], filePath);
    const changeBible = async (newBibleKey: string) => {
        const bible = await getBible(bibleItem);
        if (bible === null) {
            return;
        }
        bibleItem.bibleKey = newBibleKey;
        bibleItem.save(bible);
    };

    const handleContextMenuOpening = async (event: React.MouseEvent<any>) => {
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: '`Open',
                onSelect: (event) => {
                    handleOpening(event, viewController, bibleItem);
                },
            },
        ];
        const attachedBackgroundData =
            await attachBackgroundManager.getAttachedBackground(
                filePath,
                bibleItem.id,
            );
        if (attachedBackgroundData) {
            menuItems.push(
                ...genRemovingAttachedBackgroundMenu(filePath, bibleItem.id),
            );
        }
        openBibleItemContextMenu(
            event,
            bibleItem,
            index,
            showBibleLookupPopup,
            menuItems,
        );
    };

    if (bibleItem.isError) {
        return <ItemReadErrorComp onContextMenu={handleContextMenuOpening} />;
    }
    const handleDataDropping = async (event: any) => {
        changeDragEventStyle(event, 'opacity', '1');
        const droppedData = extractDropData(event);
        if (droppedData?.type === DragTypeEnum.BIBLE_ITEM) {
            const bible = await Bible.fromFilePath(filePath);
            if (bible === null) {
                return;
            }
            const droppedBibleItem = droppedData.item as BibleItem;
            if (droppedBibleItem.filePath !== undefined) {
                if (droppedBibleItem.filePath === bibleItem.filePath) {
                    const toIndex = bible.getItemIndex(bibleItem);
                    bible.moveItemToIndex(droppedBibleItem, toIndex);
                    stopDraggingState(event);
                    bible.save();
                }
            }
        } else {
            handleAttachBackgroundDrop(event, {
                filePath,
                id: bibleItem.id,
            });
        }
    };
    return (
        <li
            className="list-group-item item app-caught-hover-pointer px-3"
            title="Double click to view"
            data-index={index + 1}
            draggable
            onDragStart={(event) => {
                handleDragStart(event, bibleItem);
            }}
            onDragOver={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '0.5');
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '1');
            }}
            onDrop={handleDataDropping}
            onDoubleClick={(event) => {
                handleOpening(event, viewController, bibleItem);
            }}
            onContextMenu={handleContextMenuOpening}
        >
            <div className="d-flex ps-1">
                <ItemColorNoteComp item={bibleItem} />
                <div className="d-flex flex-fill">
                    <div className="px-1">
                        <BibleSelectionMiniComp
                            bibleKey={bibleItem.bibleKey}
                            onBibleKeyChange={(_, newValue) => {
                                changeBible(newValue);
                            }}
                            isMinimal
                        />
                    </div>
                    <span
                        className="app-ellipsis"
                        data-bible-key={bibleItem.bibleKey}
                    >
                        <BibleViewTitleEditorComp
                            bibleItem={bibleItem}
                            withCtrl
                            onTargetChange={async (newBibleTarget) => {
                                const bible = await getBible(bibleItem);
                                if (bible === null) {
                                    return;
                                }
                                bibleItem.target = newBibleTarget;
                                bibleItem.save(bible);
                            }}
                        />
                    </span>
                    {warningMessage && (
                        <span className="float-end" title={warningMessage}>
                            ⚠️
                        </span>
                    )}
                </div>
                <div className="float-end">
                    <AttachBackgroundIconComponent
                        filePath={filePath}
                        id={bibleItem.id}
                    />
                </div>
            </div>
        </li>
    );
}
