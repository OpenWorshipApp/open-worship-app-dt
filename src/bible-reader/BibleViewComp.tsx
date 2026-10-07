import './BibleViewComp.scss';

import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    type DragEvent as ReactDragEvent,
} from 'react';

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
import RenderBibleLookupBodyComp from '../bible-lookup/RenderBibleLookupBodyComp';
import LookupBibleItemController, {
    useEditingResult,
} from './LookupBibleItemController';
import { useBibleViewFontSizeContext } from '../helper/bibleViewHelpers';
import {
    bringDomToNearestView,
    checkIsVerticalPartialVisible,
    HIGHLIGHT_SELECTED_CLASSNAME,
} from '../helper/helpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getSelectedText } from '../helper/textSelectionHelpers';
import { setBibleFindRecentSearch } from '../bible-find/BibleFindHeaderComp';
import type { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import BibleViewTextComp from './view-extra/BibleViewTextComp';
import BibleViewHeaderComp from './view-extra/BibleViewHeaderComp';
import { useAppCurrentRef } from '../helper/appHooks';

function checkIsParentPlayToBottom(verseElement: HTMLElement) {
    const containerElements = Array.from(
        document.querySelectorAll('div.bible-view'),
    ).filter((element) => {
        return element.contains(verseElement);
    });
    if (containerElements.length !== 1) {
        return false;
    }
    const playToBottomElement =
        containerElements[0].querySelector('i.play-to-bottom');
    if (!(playToBottomElement instanceof HTMLElement)) {
        return false;
    }
    return !!playToBottomElement.dataset.speed;
}

function handMovedChecking(
    viewController: BibleItemsViewController,
    bibleItem: ReadIdOnlyBibleItem,
    container: HTMLElement,
    threshold: number,
) {
    if (
        viewController.getIsGroupScrollSynced(
            viewController.getColorNote(bibleItem),
        )
    ) {
        return;
    }
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
            if (checkIsParentPlayToBottom(element)) {
                continue;
            }
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
                lookupController.setIsAdvanceLookupOpened(true);
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
    // Once per view, not per render: a fresh one each render rewrote the
    // card's `id` and scroll attribute on every re-render of every pane.
    const [uuid] = useState(() => {
        return crypto.randomUUID();
    });
    const id = `uuid-${uuid}`;
    const viewController = useBibleItemsViewControllerContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const colorGroup = viewController.getColorNote(bibleItem);
    const isSyncScrolling = viewController.getIsGroupScrollSynced(colorGroup);
    // Register before the next frame so enabling from a header can align
    // every member immediately, without waiting for another scroll event.
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (container && colorGroup && isSyncScrolling) {
            return viewController.groupScrollSync.register(
                container,
                colorGroup,
            );
        }
    }, [viewController, colorGroup, isSyncScrolling]);
    const editingResult = useEditingResult();
    const textViewFontSize = useBibleViewFontSizeContext();
    const foundBibleItem = isEditing
        ? (editingResult?.result.bibleItem ?? null)
        : bibleItem;
    const handleDragOver = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            const currentTarget = event.currentTarget;
            if (currentTarget.dataset.doNotAllowDrop === '1') {
                return;
            }
            event.preventDefault();
            removeDraggingClass(event);
            const className = genDraggingClass(event);
            event.currentTarget.classList.add(className);
        },
        [],
    );
    const handleDragLeaving = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            removeDraggingClass(event);
        },
        [],
    );
    const viewControllerRef = useAppCurrentRef(viewController);
    // Auto-scroll slides its own pane by fractions of a pixel and moves no
    // whole pixel for several frames at a time, so it says when to follow.
    const handleAutoScrollFrame = useCallback(() => {
        const container = scrollContainerRef.current;
        if (container) {
            viewControllerRef.current.groupScrollSync.followFrame(container);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleDropping = useCallback(
        async (event: ReactDragEvent<HTMLDivElement>) => {
            applyDropped(
                event,
                viewControllerRef.current,
                bibleItemRef.current,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const foundBibleItemRef = useAppCurrentRef(foundBibleItem);
    const uuidRef = useAppCurrentRef(uuid);
    const isEditingRef = useAppCurrentRef(isEditing);
    const bookKeyRef = useAppCurrentRef(editingResult?.result.bookKey ?? null);
    const handleContextMenu = useCallback((event: any) => {
        if (foundBibleItemRef.current === null) {
            // The view being edited on its book or chapter grid: nothing to
            // copy or save yet, but it can still be split, shown full or
            // closed -- and its ⋮ must not be a dead button.
            const viewController = viewControllerRef.current;
            if (
                isEditingRef.current &&
                viewController instanceof LookupBibleItemController
            ) {
                showAppContextMenu(
                    event,
                    viewController.genNoPassageContextMenu(
                        bookKeyRef.current,
                        uuidRef.current,
                    ),
                );
            }
            return;
        }
        openContextMenu(event, {
            viewController: viewControllerRef.current,
            foundBibleItem: foundBibleItemRef.current,
            uuid: uuidRef.current,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            id={id}
            className={
                'bible-view card flex-fill w-100 h-100 app-top-hover-motion-0' +
                (isEditing ? ` ${HIGHLIGHT_SELECTED_CLASSNAME} ` : '')
            }
            style={{ minWidth: '30%' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeaving}
            onDrop={handleDropping}
            onContextMenu={handleContextMenu}
        >
            <BibleViewHeaderComp bibleItem={bibleItem} isEditing={isEditing} />
            <div
                ref={scrollContainerRef}
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
                {/* The lookup's own rows -- the verse picker above a found
                    passage, the book and chapter lists before one is -- in
                    a slot of their own, so the passage below keeps its
                    position whether this view is the one being edited or
                    not. It used to be drawn inside the lookup body, one
                    level down, and every switch rebuilt the verses. */}
                {isEditing ? <RenderBibleLookupBodyComp /> : null}
                {foundBibleItem === null ? null : (
                    <BibleViewTextComp
                        bibleItem={foundBibleItem}
                        extraBibleItems={
                            isEditing
                                ? editingResult?.result.extraBibleItems
                                : undefined
                        }
                    />
                )}
                <ScrollingHandlerComp
                    // Both buttons stack in the bottom-right corner, 30px
                    // apart. Kept low so the pair hugs the card's foot rather
                    // than floating up over the verse text.
                    style={{ bottom: '30px' }}
                    playToBottomStyle={{ bottom: 0 }}
                    shouldShowPlayToBottom
                    onAutoScrollFrame={handleAutoScrollFrame}
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
