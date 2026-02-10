import './BibleViewComp.scss';

import { use } from 'react';

import { tran } from '../lang/langHelpers';
import type BibleItemsViewController from './BibleItemsViewController';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import {
    applyDropped,
    genDraggingClass,
    removeDraggingClass,
} from './readBibleHelpers';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import RenderBibleEditingHeader from '../bible-lookup/RenderBibleEditingHeader';
import RenderBibleLookupBodyComp from '../bible-lookup/RenderBibleLookupBodyComp';
import type LookupBibleItemController from './LookupBibleItemController';
import { EditingResultContext } from './LookupBibleItemController';
import { useBibleViewFontSizeContext } from '../helper/bibleViewHelpers';
import {
    bringDomToNearestView,
    checkIsVerticalPartialVisible,
    HIGHLIGHT_SELECTED_CLASSNAME,
} from '../helper/helpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import { getSelectedText } from '../helper/textSelectionHelpers';
import { setBibleFindRecentSearch } from '../bible-find/BibleFindHeaderComp';
import type { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import BibleViewTextComp from './view-extra/BibleViewTextComp';
import BibleViewRenderHeaderComp from './view-extra/BibleViewRenderHeaderComp';

function handMovedChecking(
    viewController: BibleItemsViewController,
    bibleItem: ReadIdOnlyBibleItem,
    container: HTMLElement,
    threshold: number,
) {
    let kjvVerseKey: string | null = null;
    const currentElements = Array.from(
        viewController.getVerseElements<HTMLElement>(bibleItem.id),
    ).reverse();
    for (const currentElement of currentElements) {
        if (
            checkIsVerticalPartialVisible(container, currentElement, threshold)
        ) {
            kjvVerseKey = currentElement.dataset.kjvVerseKey ?? null;
            break;
        }
    }
    if (kjvVerseKey === null) {
        return;
    }
    const colorNote = viewController.getColorNote(bibleItem);
    const bibleItems = viewController
        .getBibleItemsByColorNote(colorNote)
        .filter((targetBibleItem) => {
            return bibleItem.id !== targetBibleItem.id;
        });
    for (const targetBibleItem of bibleItems) {
        const elements = viewController.getVerseElements<HTMLElement>(
            targetBibleItem.id,
            kjvVerseKey,
        );
        for (const element of elements) {
            bringDomToNearestView(element);
        }
    }
}

async function openContextMenu(
    event: any,
    {
        viewController,
        foundBibleItem,
        uuid,
    }: {
        viewController: BibleItemsViewController | LookupBibleItemController;
        foundBibleItem: ReadIdOnlyBibleItem;
        uuid: string;
    },
) {
    const extraSelectedTextContextMenuItems: ContextMenuItemType[] = [];
    if (viewController.isLookup) {
        extraSelectedTextContextMenuItems.push({
            childBefore: genContextMenuItemIcon('search'),
            menuElement: tran('Search in Bible Search'),
            onSelect: () => {
                const selectedText = getSelectedText();
                if (!selectedText) {
                    return;
                }
                setBibleFindRecentSearch(selectedText);
                const lookupController =
                    viewController as LookupBibleItemController;
                lookupController.openBibleSearch('s');
                lookupController.setIsBibleSearching(true);
            },
        });
    }
    showAppContextMenu(
        event,
        [
            ...genBibleItemCopyingContextMenu(foundBibleItem),
            ...(await viewController.genContextMenu(
                event,
                foundBibleItem,
                uuid,
            )),
        ],
        {
            shouldHandleSelectedText: true,
            extraSelectedTextContextMenuItems,
        },
    );
}

export default function BibleViewComp({
    bibleItem,
    isEditing = false,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    isEditing?: boolean;
}>) {
    const uuid = crypto.randomUUID();
    const id = `uuid-${uuid}`;
    const viewController = useBibleItemsViewControllerContext();
    const editingResult = use(EditingResultContext);
    const textViewFontSize = useBibleViewFontSizeContext();
    const foundBibleItem = isEditing
        ? (editingResult?.result.bibleItem ?? null)
        : bibleItem;
    return (
        <div
            id={id}
            className={
                'bible-view card flex-fill w-100 h-100 app-top-hover-motion-0' +
                (isEditing ? ` ${HIGHLIGHT_SELECTED_CLASSNAME} ` : '')
            }
            style={{ minWidth: '30%' }}
            onDragOver={(event) => {
                event.preventDefault();
                removeDraggingClass(event);
                const className = genDraggingClass(event);
                event.currentTarget.classList.add(className);
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                removeDraggingClass(event);
            }}
            onDrop={async (event) => {
                applyDropped(event, viewController, bibleItem);
            }}
            onContextMenu={(event) => {
                if (foundBibleItem === null) {
                    return;
                }
                openContextMenu(event, {
                    viewController,
                    foundBibleItem,
                    uuid,
                });
            }}
        >
            {isEditing ? (
                <RenderBibleEditingHeader />
            ) : (
                <BibleViewRenderHeaderComp bibleItem={bibleItem} />
            )}
            <div
                className="card-body app-top-hover-motion-1"
                data-scroll-on-next-chapter={isEditing ? '1' : '0'}
                data-scroll-verses-container={id}
                style={{
                    paddingBottom:
                        isEditing && editingResult?.result.bibleItem === null
                            ? '0'
                            : '60px',
                }}
            >
                {isEditing ? (
                    <RenderBibleLookupBodyComp />
                ) : (
                    <BibleViewTextComp bibleItem={bibleItem} />
                )}
                <ScrollingHandlerComp
                    style={{ bottom: '60px' }}
                    shouldShowPlayToBottom
                    movedCheck={{
                        check: (container: HTMLElement) => {
                            handMovedChecking(
                                viewController,
                                bibleItem,
                                container,
                                textViewFontSize,
                            );
                        },
                        threshold: textViewFontSize,
                    }}
                />
            </div>
        </div>
    );
}
