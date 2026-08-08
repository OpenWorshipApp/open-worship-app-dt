import { useCallback, useState } from 'react';

import { showDroppedDataOnScreens } from '../_screen/managers/screenDroppedHelpers';
import { checkIsVarySlideOnScreen } from '../app-document-list/appDocumentHelpers';
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { useAppCurrentRef, useAppStateAsync } from '../helper/appHooks';
import { handleDragStart } from '../helper/dragHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import type PresentingFlow from './PresentingFlow';
import type PresentingFlowItem from './PresentingFlowItem';
import PresentingFlowCcRowsComp from './PresentingFlowCcRowsComp';
import type { PresentingFlowCcHostType } from './PresentingFlowCcRowsComp';
import { loadVaryAppDocumentSlides } from './presentingFlowDocumentHelpers';
import { armPresentingFlowCcPropagation } from './presentingFlowCcApplyHelpers';
import {
    extractDropPayload,
    presentingFlowDraggingStore,
    toDragTypeIconName,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import { genPresentingFlowVarySlideContextMenuItems } from './presentingFlowItemMenuHelpers';
import {
    refreshOnScreenAfterPresenting,
    useIsOnScreenChecking,
} from './presentingFlowOnScreenHelpers';
import PresentingFlowRowComp from './PresentingFlowRowComp';
import PresentingFlowScreenPinComp from './PresentingFlowScreenPinComp';

/**
 * What a document entry's slide rows need in order to hold CCs of their own:
 * which presenting flow, which entry in it, and the entry itself (for the CCs it
 * already holds). Absent when these rows are not drawn under a presenting flow entry,
 * in which case there is nowhere to store one — the same gate the pin and the
 * park props make.
 */
export type PresentingFlowSlideCcHostType = {
    presentingFlow: PresentingFlow;
    index: number;
    presentingFlowItem: PresentingFlowItem;
};

export function PresentingFlowVarySlideRowComp({
    varySlide,
    index,
    depth,
    presetScreenIds = [],
    ownScreenIds = [],
    setSlideScreenIds,
    isDisabled = false,
    isOwnDisabled = false,
    isPresentingFlowDisabled = false,
    setSlideDisabled,
    ccHost,
    ccItems = [],
    propagatingCcItems = [],
}: Readonly<{
    varySlide: VarySlideType;
    index: number;
    depth: number;
    // Where this slide actually goes: its own pin if it has one, else the
    // owning document entry's — these rows ARE that entry being played.
    presetScreenIds?: number[];
    // Its OWN pin only, which is what the menu edits: clearing it hands the
    // slide back to the document rather than pinning it to nothing.
    ownScreenIds?: number[];
    // Absent when these rows are not drawn under a presenting flow entry, in which
    // case there is nowhere to store a pin and the entry is not offered.
    setSlideScreenIds?: (slideId: number, screenIds: number[]) => void;
    // Whether this slide is parked at all — its own flag OR the whole document
    // being parked. What the row's look and its dead click answer to.
    isDisabled?: boolean;
    // Its OWN flag, the same split the two pin props make: the menu toggles
    // this one, so a slide under a parked document can still be parked (or
    // released) in its own right.
    isOwnDisabled?: boolean;
    // Parked by the RUN SHEET — its own flag or the document element above it
    // being parked — as opposed to the document hiding the slide. A third
    // reading rather than a rename of the one above: what the row draws is not
    // what the menu edits, since a slide inherits its element's park but cannot
    // be released from it here.
    isPresentingFlowDisabled?: boolean;
    setSlideDisabled?: (slideId: number, isDisabled: boolean) => void;
    // Where a CC attached to THIS slide is stored. Absent when these rows are
    // not drawn under a presenting flow entry.
    ccHost?: PresentingFlowCcHostType;
    ccItems?: PresentingFlowItem[];
    // What actually rides along when this slide is shown: the DOCUMENT entry's
    // own CCs as well as this slide's. Kept apart from `ccItems`, which is what
    // is DRAWN here — the document's CCs are drawn once, on its own row, rather
    // than repeated under every slide.
    propagatingCcItems?: PresentingFlowItem[];
}>) {
    const varySlideRef = useAppCurrentRef(varySlide);
    const ccHostRef = useAppCurrentRef(ccHost);
    const propagatingCcItemsRef = useAppCurrentRef(propagatingCcItems);
    const [isDraggingOverCc, setIsDraggingOverCc] = useState(false);
    const presetScreenIdsRef = useAppCurrentRef(presetScreenIds);
    const ownScreenIdsRef = useAppCurrentRef(ownScreenIds);
    const setSlideScreenIdsRef = useAppCurrentRef(setSlideScreenIds);
    const isDisabledRef = useAppCurrentRef(isDisabled);
    const isOwnDisabledRef = useAppCurrentRef(isOwnDisabled);
    const setSlideDisabledRef = useAppCurrentRef(setSlideDisabled);
    const handleClicking = useCallback(async (event: any) => {
        // See PresentingFlowItemComp.handleClicking — keeps the click out of the
        // enclosing FileItemHandlerComp's unscoped `select` broadcast.
        event.stopPropagation();
        if (isDisabledRef.current) {
            return;
        }
        const currentVarySlide = varySlideRef.current;
        // Armed BEFORE the present, applied after it: this row does not go
        // through `sendPresentingFlowItemToScreens`, so it arms its own followers, and
        // they land on whatever the resolution below decides — this slide's pin,
        // the document's, the selected screens, or the one menu it may raise.
        armPresentingFlowCcPropagation(event, propagatingCcItemsRef.current);
        // The screen comes first and nothing may be interleaved before it: the
        // slide is already resolved here, so the click reaches the screen
        // manager without a single further read.
        await showDroppedDataOnScreens(
            event,
            {
                type: currentVarySlide.dragType,
                item: currentVarySlide,
            },
            false,
            presetScreenIdsRef.current,
        );
        refreshOnScreenAfterPresenting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A slide held here is already resolved, so it rides the normal synchronous
    // drag path — dropping it on a screen, or back into a presenting flow, just works.
    const handleDraggingStart = useCallback((event: any) => {
        // Unlike an element row, a slide row is not a presenting flow entry and so has
        // nothing to reorder — dragging it only ever aims it at a screen, which
        // is exactly what a parked slide must not do.
        if (isDisabledRef.current) {
            event.preventDefault();
            return;
        }
        handleDragStart(event, varySlideRef.current);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A slide row is not a presenting flow entry, so nothing dropped on it can be a
    // reorder — every drop here is a CC being attached to this one slide.
    // Stopped on the way up so it does not also become the DOCUMENT's CC on the
    // element row above, nor a new element on the presenting flow card above that.
    const handleDraggingOver = useCallback((event: any) => {
        if (ccHostRef.current === undefined) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOverCc(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDraggingLeave = useCallback(() => {
        setIsDraggingOverCc(false);
    }, []);
    const handleDropping = useCallback(async (event: any) => {
        setIsDraggingOverCc(false);
        const currentCcHost = ccHostRef.current;
        if (currentCcHost === undefined) {
            return;
        }
        // A row dragged out of a presenting flow — this one or another. It carries no
        // payload of its own for several kinds (an action, a slide and a
        // document all refuse `dragSerialize`), so it is read back out of the
        // presenting flow it came from instead. That is what lets EVERY kind be
        // attached by dragging, an action included.
        const dragging = presentingFlowDraggingStore.current;
        if (dragging !== null) {
            event.preventDefault();
            event.stopPropagation();
            await currentCcHost.presentingFlow.addItemCcFromItemIndex(
                currentCcHost.index,
                currentCcHost.slideId,
                dragging.filePath,
                dragging.index,
            );
            return;
        }
        const payload = extractDropPayload(event);
        // Both empties bubble: nothing readable is not ours to answer, and an
        // unsupported app payload is refused ONCE, by the enclosing card.
        if (payload === null || payload === UNSUPPORTED_DROP_PAYLOAD) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        await currentCcHost.presentingFlow.addItemCcFromDroppedData(
            currentCcHost.index,
            currentCcHost.slideId,
            payload.droppedData,
            payload.dragData,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genPresentingFlowVarySlideContextMenuItems({
                varySlide: varySlideRef.current,
                isDisabled: isDisabledRef.current,
                isOwnDisabled: isOwnDisabledRef.current,
                ownScreenIds: ownScreenIdsRef.current,
                setSlideScreenIds: setSlideScreenIdsRef.current,
                setSlideDisabled: setSlideDisabledRef.current,
                ccHost: ccHostRef.current,
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsVarySlideOnScreen(varySlideRef.current);
    }, `${varySlide.filePath}-${varySlide.id}`);
    return (
        // The slide and its CCs reach a screen together, so they light together
        // — the same grouping an element row and its CCs make.
        <div className="app-presenting-flow-row-group">
            <PresentingFlowRowComp
                depth={depth}
                idLabel={`#${varySlide.id}`}
                iconName={toDragTypeIconName(varySlide.dragType)}
                label={varySlide.name || `${tran('Slide')} ${index + 1}`}
                onClick={handleClicking}
                onDragStart={handleDraggingStart}
                onDragOver={handleDraggingOver}
                onDragLeave={handleDraggingLeave}
                onDrop={handleDropping}
                onContextMenu={handleContextMenuOpening}
                extraClassName={
                    isDraggingOverCc
                        ? 'app-presenting-flow-row-dragging-over-cc'
                        : ''
                }
                isOnScreen={isOnScreen}
                isDisabled={isDisabled}
                isPresentingFlowDisabled={isPresentingFlowDisabled}
                // Only its OWN pin is badged here: a slide merely following the
                // document would otherwise repeat the badge the document row right
                // above it already carries, on every one of its rows.
                // Guarded here rather than left to the component's own empty
                // check: a pin is rare, and a 500-row run sheet would otherwise
                // build an element and a fiber per row to render nothing.
                extraChild={
                    ownScreenIds.length > 0 ? (
                        <PresentingFlowScreenPinComp screenIds={ownScreenIds} />
                    ) : null
                }
            />
            {ccHost !== undefined && ccItems.length > 0 ? (
                <PresentingFlowCcRowsComp
                    host={ccHost}
                    ccItems={ccItems}
                    depth={depth + 1}
                />
            ) : null}
        </div>
    );
}

export default function PresentingFlowDocumentSlidesComp({
    filePath,
    depth,
    resolveScreenIds,
    resolveOwnScreenIds,
    setSlideScreenIds,
    resolveIsSlideDisabled,
    resolveIsOwnSlideDisabled,
    resolveIsPresentingFlowSlideDisabled,
    setSlideDisabled,
    slideCcHost,
}: Readonly<{
    filePath: string;
    depth: number;
    resolveScreenIds?: (slideId: number) => number[];
    resolveOwnScreenIds?: (slideId: number) => number[];
    setSlideScreenIds?: (slideId: number, screenIds: number[]) => void;
    // Takes the slide, not its id: whether a slide is parked depends on the
    // DOCUMENT's own flag as well as the run sheet's, and letting each row
    // re-OR the two halves is how the rule drifts between the places that ask.
    resolveIsSlideDisabled?: (varySlide: VarySlideType) => boolean;
    resolveIsOwnSlideDisabled?: (slideId: number) => boolean;
    // The run sheet's half of the answer above, on its own: what the row marks
    // as parked-by-this-presenting-flow rather than hidden-by-the-document.
    resolveIsPresentingFlowSlideDisabled?: (slideId: number) => boolean;
    setSlideDisabled?: (slideId: number, isDisabled: boolean) => void;
    slideCcHost?: PresentingFlowSlideCcHostType;
}>) {
    // Loaded on expand and dropped again on collapse (this component unmounts),
    // so a long presenting flow never holds every document's slides at once.
    const [varySlides] = useAppStateAsync(() => {
        return loadVaryAppDocumentSlides(filePath);
    }, [filePath]);
    // Asked ONCE for the whole document rather than once per row: a document of
    // ~90 slides is what this list is measured against, and the answer for the
    // overwhelmingly common case — no CC anywhere in it — is one key count.
    const hasAnySlideCc =
        slideCcHost?.presentingFlowItem.hasSlideCcItems ?? false;
    // A document entry's OWN CCs ride with every slide of it, so they count
    // towards what a slide propagates even when no slide holds one itself.
    const hasAnyCc =
        hasAnySlideCc || (slideCcHost?.presentingFlowItem.hasCcItems ?? false);
    if (varySlides === undefined) {
        return <LoadingComp />;
    }
    if (varySlides === null) {
        return (
            <PresentingFlowRowComp
                depth={depth}
                iconName="exclamation-triangle"
                label={tran('Fail to read file data')}
                extraClassName="app-presenting-flow-row-error"
            />
        );
    }
    if (varySlides.length === 0) {
        return (
            <PresentingFlowRowComp
                depth={depth}
                iconName="dash"
                label={tran('No slides')}
            />
        );
    }
    return (
        <>
            {varySlides.map((varySlide, i) => {
                return (
                    <PresentingFlowVarySlideRowComp
                        key={`${varySlide.filePath}-${varySlide.id}`}
                        varySlide={varySlide}
                        index={i}
                        depth={depth}
                        presetScreenIds={resolveScreenIds?.(varySlide.id)}
                        ownScreenIds={resolveOwnScreenIds?.(varySlide.id)}
                        setSlideScreenIds={setSlideScreenIds}
                        // A slide the DOCUMENT disables reads as parked here
                        // too, so a run sheet says the same thing in both
                        // places — but only the presenting flow's own flag is
                        // editable from a run sheet.
                        isDisabled={
                            resolveIsSlideDisabled?.(varySlide) ??
                            varySlide.isDisabled
                        }
                        isOwnDisabled={resolveIsOwnSlideDisabled?.(
                            varySlide.id,
                        )}
                        isPresentingFlowDisabled={resolveIsPresentingFlowSlideDisabled?.(
                            varySlide.id,
                        )}
                        setSlideDisabled={setSlideDisabled}
                        ccHost={
                            slideCcHost === undefined
                                ? undefined
                                : {
                                      presentingFlow:
                                          slideCcHost.presentingFlow,
                                      index: slideCcHost.index,
                                      slideId: varySlide.id,
                                  }
                        }
                        ccItems={
                            hasAnySlideCc
                                ? slideCcHost?.presentingFlowItem.getSlideCcItems(
                                      varySlide.id,
                                  )
                                : undefined
                        }
                        propagatingCcItems={
                            hasAnyCc
                                ? slideCcHost?.presentingFlowItem.getEffectiveSlideCcItems(
                                      varySlide.id,
                                  )
                                : undefined
                        }
                    />
                );
            })}
        </>
    );
}
