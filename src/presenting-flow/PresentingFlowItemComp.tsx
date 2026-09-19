import { useCallback, useMemo, useState } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { dragStore } from '../helper/dragHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import type PresentingFlow from './PresentingFlow';
import type PresentingFlowItem from './PresentingFlowItem';
import PresentingFlowCcRowsComp from './PresentingFlowCcRowsComp';
import type { PresentingFlowCcHostType } from './PresentingFlowCcRowsComp';
import PresentingFlowDocumentSlidesComp from './PresentingFlowDocumentSlidesComp';
import type { PresentingFlowSlideCcHostType } from './PresentingFlowDocumentSlidesComp';
import { useVaryAppDocumentOpener } from './presentingFlowDocumentHelpers';
import {
    extractDropPayload,
    handlePresentingFlowItemScreenDropping,
    presentingFlowDraggingStore,
    toPresentingFlowRowDropKind,
    sendPresentingFlowItemToScreens,
    toPresentingFlowSettingName,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import { genPresentingFlowItemContextMenuItems } from './presentingFlowItemMenuHelpers';
import {
    checkIsPresentingFlowItemOnScreen,
    refreshOnScreenAfterPresenting,
    toPresentingFlowItemOnScreenKey,
    useIsOnScreenChecking,
} from './presentingFlowOnScreenHelpers';
import { notifyPresentingFlowItemOrigin } from './presentingFlowOriginHelpers';
import {
    toPresentingFlowPreviewItemKey,
    usePresentingFlowPreviewIsItemSelected,
} from './presentingFlowPreviewFloatingHelpers';
import PresentingFlowRowComp from './PresentingFlowRowComp';
import PresentingFlowScreenPinComp from './PresentingFlowScreenPinComp';

export default function PresentingFlowItemComp({
    presentingFlow,
    presentingFlowItem,
    index,
    itemCount,
}: Readonly<{
    presentingFlow: PresentingFlow;
    presentingFlowItem: PresentingFlowItem;
    index: number;
    itemCount: number;
}>) {
    const isDocument = presentingFlowItem.isAppDocument;
    // Keyed by the referenced document, not by the row index, so reordering the
    // presenting flow does not shuffle which rows are open.
    const [isExpanded, setIsExpanded] = useStateSettingBoolean(
        toPresentingFlowSettingName(
            'presenting-flow-item-expanded',
            presentingFlow.filePath,
            presentingFlowItem.itemFilePath,
        ),
        false,
    );
    // Which of the two things a drag hovering here would do — they look
    // different because they ARE different: one moves this line, the other
    // attaches something to it.
    const [draggingOverKind, setDraggingOverKind] = useState<
        'position' | 'cc' | null
    >(null);
    const presentingFlowItemRef = useAppCurrentRef(presentingFlowItem);
    const presentingFlowRef = useAppCurrentRef(presentingFlow);
    const indexRef = useAppCurrentRef(index);
    const itemCountRef = useAppCurrentRef(itemCount);
    const openVaryAppDocument = useVaryAppDocumentOpener();
    const openVaryAppDocumentRef = useAppCurrentRef(openVaryAppDocument);

    const handleClicking = useCallback(async (event: any) => {
        // Stopped here, exactly as the presenter's slide card does
        // (`selectVarySlide`). Without it the click keeps bubbling to the
        // enclosing `FileItemHandlerComp` <li>, which fires an UNSCOPED
        // FileSource `select` — the one subscription in the app that is not
        // filtered by file path — and re-renders every file row in the window.
        // Nothing in the presenting flow consumes that event: the presenting flow file's
        // `active` state comes from its own open/closed flag.
        event.stopPropagation();
        const currentItem = presentingFlowItemRef.current;
        // Parked: the whole point is that a click on this row does nothing at
        // all — not even open a document's preview, which is what a mis-aimed
        // click on a run sheet costs an operator mid-service.
        if (currentItem.isDisabled) {
            return;
        }
        if (currentItem.isAppDocument) {
            await openVaryAppDocumentRef.current(currentItem.itemFilePath);
            return;
        }
        // Audio is never played from here: the Audios panel owns playback and
        // all of its protections (one track at a time, the already-playing
        // toast, per-file repeat). Clicking points at the track there instead.
        if (currentItem.isAudio) {
            notifyPresentingFlowItemOrigin(currentItem);
            return;
        }
        // Resolving the payload is the only thing allowed before the screen
        // manager is handed the data — a stored slide is a reference, so it has
        // to be re-read from its document to exist at all. An action skips that
        // and is run on the chosen screens instead.
        await sendPresentingFlowItemToScreens(currentItem, event);
        refreshOnScreenAfterPresenting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingStart = useCallback((event: any) => {
        const currentItem = presentingFlowItemRef.current;
        presentingFlowDraggingStore.current = {
            filePath: presentingFlowRef.current.filePath,
            index: indexRef.current,
        };
        // A slide has to be re-read from its document before it can go to a
        // screen, and `dragstart` cannot await — so the async route is used for
        // every kind here, keeping one code path.
        //
        // A parked row is still DRAGGABLE — reordering the run sheet is how it
        // is tidied away, and taking that off would be the one thing disabling
        // must not cost — it just carries no screen payload with it.
        dragStore.onDropped = currentItem.isDisabled
            ? null
            : handlePresentingFlowItemScreenDropping.bind(null, currentItem);
        event.dataTransfer.setData('text', currentItem.title);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingEnd = useCallback(() => {
        presentingFlowDraggingStore.current = null;
        dragStore.onDropped = null;
    }, []);

    // The two things a drag hovering this row can do, and the modifiers that
    // force either — the rule itself is `toPresentingFlowRowDropKind`; this only says
    // whether the row's EDGE BANDS mean anything, which they do for a line of
    // this sheet being moved and for nothing else.
    const toDropKind = useCallback((event: any): 'position' | 'cc' => {
        const dragging = presentingFlowDraggingStore.current;
        return toPresentingFlowRowDropKind(
            event,
            dragging !== null &&
                dragging.filePath === presentingFlowRef.current.filePath &&
                dragging.index !== indexRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingOver = useCallback((event: any) => {
        const dragging = presentingFlowDraggingStore.current;
        // An element row of ANOTHER presenting flow is being moved within its own list
        // — it is neither reordered here nor attached, so this row says nothing.
        if (
            dragging !== null &&
            dragging.filePath !== presentingFlowRef.current.filePath
        ) {
            return;
        }
        // Dropping a row on ITSELF has never meant anything, and attaching an
        // element to itself means less.
        if (dragging !== null && dragging.index === indexRef.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        // The payload cannot be inspected here — the browser only hands
        // `dataTransfer`'s contents over on `drop` — so a CC affordance is
        // OPTIMISTIC and the drop decides whether anything comes of it.
        setDraggingOverKind(toDropKind(event));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDraggingLeave = useCallback(() => {
        setDraggingOverKind(null);
    }, []);

    const handleDropping = useCallback(async (event: any) => {
        setDraggingOverKind(null);
        const dragging = presentingFlowDraggingStore.current;
        if (dragging !== null) {
            if (
                dragging.filePath !== presentingFlowRef.current.filePath ||
                dragging.index === indexRef.current
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (toDropKind(event) === 'position') {
                presentingFlowRef.current.moveItemToIndex(
                    dragging.index,
                    indexRef.current,
                );
                return;
            }
            // A listed element attaching to this one. Read back out of its
            // presenting flow by index rather than from the drag: an action is not a
            // drag type at all, and a slide and a document both refuse to
            // serialize themselves onto one.
            await presentingFlowRef.current.addItemCcFromItemIndex(
                indexRef.current,
                null,
                dragging.filePath,
                dragging.index,
            );
            return;
        }
        const payload = extractDropPayload(event);
        // Nothing this presenting flow understands (a file, plain text) — left to
        // bubble so the enclosing presenting flow card still gets its chance at it.
        // An app payload of an unsupported type bubbles for the same reason:
        // the card refuses it out loud, and letting it through keeps that ONE
        // refusal instead of one per nested drop target.
        if (payload === null || payload === UNSUPPORTED_DROP_PAYLOAD) {
            return;
        }
        event.preventDefault();
        // Stopped, and it must be: the same drop otherwise reaches
        // `PresentingFlowFileComp.handleDropping` through the enclosing
        // `FileItemHandlerComp` <li> and the payload lands TWICE — once as this
        // row's CC and once as a new element appended out of sight.
        event.stopPropagation();
        // Ctrl on something from ANOTHER panel means "as a line, HERE" — the
        // only way to land it anywhere but the end of the sheet, since dropping
        // on the presenting flow's name row appends. Without it, dropping on a line
        // attaches to that line, which is what it has always meant.
        if (toDropKind(event) === 'position') {
            await presentingFlowRef.current.addItem(
                payload.droppedData,
                payload.dragData,
                indexRef.current,
            );
            return;
        }
        await presentingFlowRef.current.addItemCcFromDroppedData(
            indexRef.current,
            null,
            payload.droppedData,
            payload.dragData,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genPresentingFlowItemContextMenuItems(
                presentingFlowRef.current,
                presentingFlowItemRef.current,
                indexRef.current,
                itemCountRef.current,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExpandToggling = useCallback(() => {
        setIsExpanded(!isExpanded);
    }, [isExpanded, setIsExpanded]);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsPresentingFlowItemOnScreen(presentingFlowItemRef.current);
    }, toPresentingFlowItemOnScreenKey(presentingFlowItem));
    // WHERE THE RUN IS, in the tree — until now it showed only inside the
    // floating preview, so an operator who had not opened one (or had scrolled it
    // away) had nothing on screen saying which line the next press would step
    // from. The same cursor, read from the same store, so the two panels can
    // never disagree about it.
    //
    // Cheap enough to ask per row: it is a `useSyncExternalStore` over a Map
    // lookup, and the snapshot flips for exactly the two rows the cursor left and
    // landed on — a step re-renders two rows, not the sheet. No debounce for the
    // same reason; there is no expensive work behind it to collapse.
    //
    // Answers false whenever no preview is open on this sheet: the cursor lives
    // and dies with a run, and marking a line while nothing is running would
    // claim a position the next press would not honour.
    const isRunCursor = usePresentingFlowPreviewIsItemSelected(
        presentingFlow.filePath,
        toPresentingFlowPreviewItemKey(presentingFlowItem),
        index,
    );
    const ccHost: PresentingFlowCcHostType = useMemo(() => {
        return { presentingFlow, index, slideId: null };
    }, [presentingFlow, index]);
    const slideCcHost: PresentingFlowSlideCcHostType = useMemo(() => {
        return { presentingFlow, index, presentingFlowItem };
    }, [presentingFlow, index, presentingFlowItem]);

    return (
        <div>
            {/* The element and its CCs are ONE thing to point at: they go to a
                screen together, so hovering any of them lights all of them. A
                container of their own rather than the wrapper below, which also
                holds a document's slides — those are what the element HOLDS,
                not what rides with it. */}
            <div className="app-presenting-flow-row-group">
                <PresentingFlowRowComp
                    depth={0}
                    // The line this IS of the run sheet, which the floating
                    // preview has always numbered and the tree never did — so the
                    // two could not be read against each other, and an operator
                    // had no handle to call a line by.
                    lineNumber={index + 1}
                    isCommand={presentingFlowItem.isAction}
                    isRunCursor={isRunCursor}
                    // On the ROW rather than on a wrapper: the drop kind is
                    // decided from where the pointer sits WITHIN the row, so it
                    // has to be the row the rect is measured from.
                    onDragOver={handleDraggingOver}
                    onDragLeave={handleDraggingLeave}
                    onDrop={handleDropping}
                    itemUuid={presentingFlowItem.uuid}
                    idLabel={presentingFlowItem.idLabel}
                    iconName={presentingFlowItem.iconName}
                    iconColor={presentingFlowItem.iconColor}
                    label={presentingFlowItem.title}
                    title={
                        presentingFlowItem.itemFilePath
                            ? presentingFlowItem.itemFilePath
                            : presentingFlowItem.title
                    }
                    isExpandable={isDocument}
                    isExpanded={isExpanded}
                    onToggleExpanding={handleExpandToggling}
                    onClick={handleClicking}
                    onDragStart={handleDraggingStart}
                    onDragEnd={handleDraggingEnd}
                    onContextMenu={handleContextMenuOpening}
                    colorNote={presentingFlowItem.colorNote}
                    isOnScreen={isOnScreen}
                    isDisabled={presentingFlowItem.isDisabled}
                    // An element carries no flag but this presenting flow's own — a
                    // document hides SLIDES, never the whole entry — so a parked
                    // element is always the run sheet's doing.
                    isPresentingFlowDisabled={presentingFlowItem.isDisabled}
                    extraChild={
                        presentingFlowItem.screenIds.length > 0 ? (
                            <PresentingFlowScreenPinComp
                                screenIds={presentingFlowItem.screenIds}
                            />
                        ) : null
                    }
                    extraClassName={
                        (draggingOverKind === null
                            ? ''
                            : draggingOverKind === 'cc'
                              ? 'app-presenting-flow-row-dragging-over-cc'
                              : 'app-presenting-flow-row-dragging-over') +
                        (presentingFlowItem.isError
                            ? ' app-presenting-flow-row-error'
                            : '')
                    }
                    extraStyle={{ ...presentingFlowItem.extraStyle }}
                />
                {/* Directly under the line they ride with, and BEFORE a
                    document's slides: they belong to this element, the slides
                    are what it holds. Gated on the item's own cheap check so a
                    run sheet without CCs builds no component at all. */}
                {presentingFlowItem.hasCcItems ? (
                    <PresentingFlowCcRowsComp
                        host={ccHost}
                        ccItems={presentingFlowItem.ccItems}
                        depth={1}
                    />
                ) : null}
            </div>
            {isDocument && isExpanded ? (
                <PresentingFlowDocumentSlidesComp
                    filePath={presentingFlowItem.itemFilePath}
                    depth={1}
                    // A slide row follows its own pin if it has one, else the
                    // document's — and pinning one writes an exception onto
                    // this same entry, since a slide row is not a presenting flow
                    // entry of its own.
                    resolveScreenIds={(slideId) => {
                        return presentingFlowItem.getSlideScreenIds(slideId);
                    }}
                    resolveOwnScreenIds={(slideId) => {
                        return presentingFlowItem.getOwnSlideScreenIds(slideId);
                    }}
                    setSlideScreenIds={(slideId, newScreenIds) => {
                        presentingFlow.setItemSlideScreenIds(
                            index,
                            slideId,
                            newScreenIds,
                        );
                    }}
                    // Parking the document parks every slide under it, so this
                    // answers for them; the menu still edits only the slide's
                    // OWN flag, the same split the pins make.
                    resolveIsSlideDisabled={(varySlide) => {
                        return presentingFlowItem.checkIsVarySlideDisabled(
                            varySlide,
                        );
                    }}
                    resolveIsOwnSlideDisabled={(slideId) => {
                        return presentingFlowItem.checkIsOwnSlideDisabled(
                            slideId,
                        );
                    }}
                    // Marked apart from a slide the DOCUMENT hides: this park
                    // is the operator's own and comes off from this menu, that
                    // one only ever does in the document itself. Its own flag
                    // OR the element's — an inherited park is still this run
                    // sheet's decision, just made one level up.
                    resolveIsPresentingFlowSlideDisabled={(slideId) => {
                        return presentingFlowItem.checkIsSlideDisabled(slideId);
                    }}
                    setSlideDisabled={(slideId, isDisabled) => {
                        presentingFlow.setItemSlideDisabled(
                            index,
                            slideId,
                            isDisabled,
                        );
                    }}
                    // One object rather than four more resolvers: this prop list
                    // is already long, and a slide row needs the whole triple
                    // together to write anything at all.
                    slideCcHost={slideCcHost}
                />
            ) : null}
        </div>
    );
}
