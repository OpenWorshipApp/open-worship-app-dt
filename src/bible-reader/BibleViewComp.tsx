import './BibleViewComp.scss';

import BibleItemsViewController, {
    ReadIdOnlyBibleItem,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import {
    applyDropped,
    genDraggingClass,
    removeDraggingClass,
} from './readBibleHelpers';
import { BibleViewTextComp, RenderHeaderComp } from './BibleViewExtra';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import RenderBibleEditingHeader from '../bible-lookup/RenderBibleEditingHeader';
import RenderBibleLookupBodyComp from '../bible-lookup/RenderBibleLookupBodyComp';
import { use } from 'react';
import LookupBibleItemController, {
    EditingResultContext,
} from './LookupBibleItemController';
import { useBibleViewFontSizeContext } from '../helper/bibleViewHelpers';
import {
    bringDomToNearestView,
    checkIsVerticalPartialVisible,
} from '../helper/helpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import { getSelectedText } from '../helper/textSelectionHelpers';
import { setBibleFindRecentSearch } from '../bible-find/BibleFindHeaderComp';

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

export default function BibleViewComp({
    bibleItem,
    isEditing = false,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    isEditing?: boolean;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const uuid = crypto.randomUUID();
    const editingResult = use(EditingResultContext);
    const textViewFontSize = useBibleViewFontSizeContext();
    const foundBibleItem = isEditing
        ? (editingResult?.result.bibleItem ?? null)
        : bibleItem;
    const handleContextMenuOpening =
        foundBibleItem === null
            ? undefined
            : async (event: any) => {
                  const isLookup =
                      viewController instanceof LookupBibleItemController;
                  const extraSelectedTextContextMenuItems: ContextMenuItemType[] =
                      [];
                  if (isLookup) {
                      extraSelectedTextContextMenuItems.push({
                          childBefore: genContextMenuItemIcon('search'),
                          menuElement: '`Search in Bible Search',
                          onSelect: () => {
                              const selectedText = getSelectedText();
                              if (!selectedText) {
                                  return;
                              }
                              setBibleFindRecentSearch(selectedText);
                              viewController.openBibleSearch('s');
                              viewController.setIsBibleSearching(true);
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
              };
    return (
        <div
            id={`uuid-${uuid}`}
            className={
                'bible-view card flex-fill w-100 h-100 app-top-hover-motion-0' +
                (isEditing ? ' app-highlight-selected ' : '')
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
            onContextMenu={handleContextMenuOpening}
        >
            {isEditing ? (
                <RenderBibleEditingHeader />
            ) : (
                <RenderHeaderComp bibleItem={bibleItem} />
            )}
            <div
                className="card-body app-top-hover-motion-1"
                data-scroll-on-next-chapter={isEditing ? '1' : '0'}
                style={{
                    paddingBottom: '60px',
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
