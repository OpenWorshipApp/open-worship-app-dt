import { useCallback, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import { genRevealOriginal } from '../others/FileItemHandlerComp';
import type PresentingFlow from './PresentingFlow';
import PresentingFlowItem from './PresentingFlowItem';
import {
    extractDropPayload,
    presentingFlowDraggingStore,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import { askForPresentingFlowMediaControl } from './presentingFlowMediaControlDialogHelpers';
import {
    checkIsPresentingFlowItemOnScreen,
    toPresentingFlowItemOnScreenKey,
    useIsOnScreenChecking,
} from './presentingFlowOnScreenHelpers';
import { notifyPresentingFlowCcOrigin } from './presentingFlowOriginHelpers';
import PresentingFlowRowComp from './PresentingFlowRowComp';
import PresentingFlowScreenPinComp, {
    genSetSpecificScreenContextMenu,
} from './PresentingFlowScreenPinComp';

/**
 * Where a CC lives: which entry holds it, and — for a document entry — which of
 * its slides. `slideId` of null is the entry itself.
 *
 * Passed as one object rather than as two more props on every row: the tree's
 * slide component already takes seven resolvers, and this is the pair every CC
 * mutation needs together.
 */
export type PresentingFlowCcHostType = {
    presentingFlow: PresentingFlow;
    index: number;
    slideId: number | null;
};

/**
 * `Add CC Elements`, offered by every row that can host one.
 *
 * Exported from here for the same reason `genDisableContextMenu` and
 * `genSetSpecificScreenContextMenu` are exported from where they are: four menus
 * offer it — the element row, a document's slide rows, and the same two in the
 * floating preview — and they must not drift apart.
 *
 * The presenting flow is read ON SELECT, never to draw the row: this is one file read
 * on an explicit gesture, against a menu that would otherwise be built for every
 * row of every listed presenting flow.
 *
 * Lists TOP-LEVEL entries only, which is also the whole of what a CC may point
 * at — every follower names a line of the sheet. A slide of a document is
 * attached by dragging its row, which appends that slide as a line of its own
 * first.
 */
export function genAddCcElementsContextMenu(
    host: PresentingFlowCcHostType,
    hostUuid: string | null,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('paperclip'),
            menuElement: tran('Add CC Elements'),
            onSelect: (event: any) => {
                event.stopPropagation();
                // The host closes this menu around `onSelect`, so the original
                // event is gone by the time the submenu opens — the coordinates
                // are kept and a fresh event synthesized at them, exactly as the
                // screen-pin checklist reopens itself.
                const { clientX, clientY } = event;
                showAddCcElementsMenu(host, hostUuid, clientX, clientY);
            },
        },
    ];
}

/**
 * The action id of the one thing added from here rather than from `Add Action`.
 * Spelled out rather than imported as a value so this module keeps its short
 * import list; the registry is what resolves it.
 */
const MEDIA_CONTROL_ACTION_ID = 'slide-media-control';

/**
 * `Add Media Control`, offered by every row that can HOLD media — a slide of any
 * kind, and a document element (whose CCs ride every slide of it).
 *
 * Exported from here for the same reason `genAddCcElementsContextMenu` is: four
 * menus offer it, and two copies would drift.
 *
 * Unlike every other action it is added from the HOST rather than from the
 * presenting flow's own `Add Action` menu, because its settings are a sentence about
 * one particular slide — see the registry entry. The panel is asked FIRST and the
 * element written after, so cancelling adds nothing at all: that is the rule every
 * other action's question follows, and the alternative (write, then ask) leaves an
 * inert controller in the sheet when the operator changes their mind.
 */
export function genAddMediaControlContextMenu(
    host: PresentingFlowCcHostType,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('sliders', {
                color: 'var(--bs-cyan)',
            }),
            menuElement: tran('Add Media Control'),
            onSelect: (event: any) => {
                event.stopPropagation();
                const { presentingFlow, index, slideId } = host;
                askForPresentingFlowMediaControl()
                    .then((answer) => {
                        if (answer === null) {
                            return;
                        }
                        return presentingFlow.addItemCcAction(
                            index,
                            slideId,
                            MEDIA_CONTROL_ACTION_ID,
                            {
                                mediaControl: answer.mediaControl,
                                ...(answer.screenIds.length > 0
                                    ? { screenIds: answer.screenIds }
                                    : {}),
                            },
                        );
                    })
                    .catch(handleError);
            },
        },
    ];
}

/** Reopen the panel of an attached controller and write the answer back. */
function editCcItemMediaControl(
    host: PresentingFlowCcHostType,
    ccItem: PresentingFlowItem,
    ccIndex: number,
) {
    const { presentingFlow, index, slideId } = host;
    askForPresentingFlowMediaControl(ccItem.mediaControl, ccItem.screenIds)
        .then((answer) => {
            if (answer === null) {
                return;
            }
            return presentingFlow.setItemCcItemMediaControl(
                index,
                slideId,
                ccIndex,
                answer.mediaControl,
                answer.screenIds,
            );
        })
        .catch(handleError);
}

async function showAddCcElementsMenu(
    host: PresentingFlowCcHostType,
    hostUuid: string | null,
    clientX: number,
    clientY: number,
) {
    const { presentingFlow, index, slideId } = host;
    const presentingFlowItems = (await presentingFlow.getItems()) ?? [];
    // A `Jump to` is armed with a POINTER at another line rather than with a
    // follower, so what it may name is everything the sheet lists — a document
    // most of all. Read off the host itself; a slide's CCs are always followers,
    // whatever the entry above them is.
    const isTarget =
        slideId === null &&
        presentingFlowItems[index] !== undefined &&
        PresentingFlowItem.checkIsCcTargetHost(
            presentingFlowItems[index].toJson(),
        );
    const menuItems: ContextMenuItemType[] = [];
    presentingFlowItems.forEach((presentingFlowItem, itemIndex) => {
        const { uuid } = presentingFlowItem;
        if (
            presentingFlowItem.isError ||
            (uuid !== null && uuid === hostUuid)
        ) {
            return;
        }
        if (
            PresentingFlowItem.resolveCcItemJson(
                presentingFlowItem.toJson(),
                isTarget,
            ) === null
        ) {
            return;
        }
        menuItems.push({
            childBefore: genContextMenuItemIcon(presentingFlowItem.iconName, {
                color: presentingFlowItem.iconColor,
            }),
            menuElement: `${itemIndex + 1}. ${presentingFlowItem.title}`,
            onSelect: () => {
                // By POSITION, not by the uuid read above: an entry written
                // before uuids existed has none until something points at it,
                // and `PresentingFlow` is where that is minted and saved.
                presentingFlow
                    .addItemCcFromItemIndex(
                        index,
                        slideId,
                        presentingFlow.filePath,
                        itemIndex,
                    )
                    .catch(handleError);
            },
        });
    });
    if (menuItems.length === 0) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('dash'),
            menuElement: tran('No other elements'),
            disabled: true,
            onSelect: () => {},
        });
    }
    showAppContextMenu(createMouseEvent(clientX, clientY), menuItems);
}

/**
 * A CC row's own menu.
 *
 * Deliberately WITHOUT `Show on Screens`: a CC is shown by its host and by
 * nothing else, and an entry that presented it on its own would quietly turn it
 * into an ordinary element by another door. Without `Disable` either — parking
 * takes a LINE out of the run, and a CC is not a line of the run; a follower
 * that is not wanted is removed. And without `Change Seconds`: what a
 * `Next: Timeout` is armed with belongs to the ELEMENT now, so it is re-armed
 * there and every CC of it is re-armed at once — `Reveal Original` is one click
 * away, and it is the first entry here.
 *
 * `Set Specific Screen` stays, the one thing a CC says for itself, and its
 * clearing row means "follow the element, then the host" — the same reading a
 * slide's cleared pin has against the document above it.
 */
export function genCcItemContextMenuItems(
    host: PresentingFlowCcHostType,
    ccItem: PresentingFlowItem,
    ccIndex: number,
    ccCount: number,
): ContextMenuItemType[] {
    const { presentingFlow, index, slideId } = host;
    const menuItems: ContextMenuItemType[] = [
        genRevealOriginal(() => {
            notifyPresentingFlowCcOrigin(ccItem);
        }),
    ];
    // The right-click route to what the gear on the row opens: an 11px icon is a
    // poor target mid-service, and this is the only CC whose settings are its own.
    if (ccItem.action?.id === MEDIA_CONTROL_ACTION_ID) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('gear-fill', {
                color: 'var(--bs-cyan)',
            }),
            menuElement: tran('Media Control Settings'),
            onSelect: () => {
                editCcItemMediaControl(host, ccItem, ccIndex);
            },
        });
    }
    if (ccItem.isScreenPinnable) {
        menuItems.push(
            ...genSetSpecificScreenContextMenu(
                ccItem.screenIds,
                (newScreenIds) => {
                    presentingFlow
                        .setItemCcItemScreenIds(
                            index,
                            slideId,
                            ccIndex,
                            newScreenIds,
                        )
                        .catch(handleError);
                },
            ),
        );
    }
    if (ccIndex > 0) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-up-circle'),
            menuElement: tran('Move up'),
            onSelect: () => {
                presentingFlow
                    .moveItemCcItemToIndex(index, slideId, ccIndex, ccIndex - 1)
                    .catch(handleError);
            },
        });
    }
    if (ccIndex < ccCount - 1) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('arrow-down-circle'),
            menuElement: tran('Move down'),
            onSelect: () => {
                presentingFlow
                    .moveItemCcItemToIndex(index, slideId, ccIndex, ccIndex + 1)
                    .catch(handleError);
            },
        });
    }
    menuItems.push({
        childBefore: genContextMenuItemIcon('x-circle', {
            color: 'var(--bs-danger)',
        }),
        menuElement: tran('Remove CC Element'),
        onSelect: () => {
            presentingFlow
                .removeItemCcItemAtIndex(index, slideId, ccIndex)
                .catch(handleError);
        },
    });
    return menuItems;
}

/**
 * One CC row, drawn under the element or slide it rides with.
 *
 * Clicking it does NOT present it — the host does that. It reveals the element
 * this CC points at instead, which is the only thing a click on a follower can
 * usefully mean and the only way to find out which line of the sheet a repeated
 * label refers to.
 */
function PresentingFlowCcRowComp({
    host,
    ccItem,
    ccIndex,
    ccCount,
    depth,
}: Readonly<{
    host: PresentingFlowCcHostType;
    ccItem: PresentingFlowItem;
    ccIndex: number;
    ccCount: number;
    depth: number;
}>) {
    const hostRef = useAppCurrentRef(host);
    const ccItemRef = useAppCurrentRef(ccItem);
    const ccIndexRef = useAppCurrentRef(ccIndex);
    const ccCountRef = useAppCurrentRef(ccCount);
    const handleClicking = useCallback((event: any) => {
        // See `PresentingFlowItemComp.handleClicking`: without this the click reaches
        // the enclosing `FileItemHandlerComp` <li> and fires the app's one
        // UNSCOPED FileSource `select`.
        event.stopPropagation();
        notifyPresentingFlowCcOrigin(ccItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        showAppContextMenu(
            event,
            genCcItemContextMenuItems(
                hostRef.current,
                ccItemRef.current,
                ccIndexRef.current,
                ccCountRef.current,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isMediaControl = ccItem.action?.id === MEDIA_CONTROL_ACTION_ID;
    const handleMediaControlEditing = useCallback((event: any) => {
        // Mandatory: without it the click reaches the row's own handler (which
        // reveals the element) and then `FileItemHandlerComp`'s <li>, which fires
        // the app's one UNSCOPED FileSource `select` and repaints every file row.
        event.stopPropagation();
        editCcItemMediaControl(
            hostRef.current,
            ccItemRef.current,
            ccIndexRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsPresentingFlowItemOnScreen(ccItemRef.current);
    }, toPresentingFlowItemOnScreenKey(ccItem));
    // A CC row belongs to its host, so the block of them is part of the host's
    // drop target: dropping onto one attaches ANOTHER CC to the same host
    // rather than doing nothing (or, worse, falling through to the presenting flow
    // card and appending an element). Nothing here reorders, so there are no
    // edge bands — the whole row attaches.
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const handleDraggingOver = useCallback((event: any) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(true);
    }, []);
    const handleDraggingLeave = useCallback(() => {
        setIsDraggingOver(false);
    }, []);
    const handleDropping = useCallback(async (event: any) => {
        setIsDraggingOver(false);
        const { presentingFlow, index, slideId } = hostRef.current;
        const dragging = presentingFlowDraggingStore.current;
        if (dragging !== null) {
            event.preventDefault();
            event.stopPropagation();
            await presentingFlow.addItemCcFromItemIndex(
                index,
                slideId,
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
        await presentingFlow.addItemCcFromDroppedData(
            index,
            slideId,
            payload.droppedData,
            payload.dragData,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <PresentingFlowRowComp
            depth={depth}
            idLabel={ccItem.idLabel}
            iconName={ccItem.iconName}
            iconColor={ccItem.iconColor}
            label={ccItem.title}
            title={`${tran('CC element')}\n${ccItem.title}`}
            onClick={handleClicking}
            onContextMenu={handleContextMenuOpening}
            onDragOver={handleDraggingOver}
            onDragLeave={handleDraggingLeave}
            onDrop={handleDropping}
            isOnScreen={isOnScreen}
            isCcRow
            extraClassName={
                'app-presenting-flow-cc-row' +
                (isDraggingOver
                    ? ' app-presenting-flow-row-dragging-over-cc'
                    : '')
            }
            extraStyle={{ ...ccItem.extraStyle }}
            // The gear first, then its OWN pin: a CC with no pin follows its host,
            // whose row right above it already carries that badge.
            extraChild={
                <>
                    {isMediaControl ? (
                        <i
                            className={
                                'bi bi-gear-fill app-caught-hover-pointer' +
                                ' app-presenting-flow-row-media-control-gear'
                            }
                            title={tran('Media Control Settings')}
                            onClick={handleMediaControlEditing}
                        />
                    ) : null}
                    {ccItem.screenIds.length > 0 ? (
                        <PresentingFlowScreenPinComp
                            screenIds={ccItem.screenIds}
                        />
                    ) : null}
                </>
            }
        />
    );
}

/**
 * The CC rows of one host. Renders nothing — not even a fragment's worth of
 * work — when there are none, which is every row of every run sheet that uses no
 * CCs; the caller still gates on the host's own cheap `hasCcItems` first.
 */
export default function PresentingFlowCcRowsComp({
    host,
    ccItems,
    depth,
}: Readonly<{
    host: PresentingFlowCcHostType;
    ccItems: PresentingFlowItem[];
    depth: number;
}>) {
    if (ccItems.length === 0) {
        return null;
    }
    return (
        <>
            {ccItems.map((ccItem, ccIndex) => {
                return (
                    <PresentingFlowCcRowComp
                        key={`${ccItem.uuid}-${ccIndex}`}
                        host={host}
                        ccItem={ccItem}
                        ccIndex={ccIndex}
                        ccCount={ccItems.length}
                        depth={depth}
                    />
                );
            })}
        </>
    );
}
