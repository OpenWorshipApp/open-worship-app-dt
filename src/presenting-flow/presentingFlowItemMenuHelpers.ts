import { showDroppedDataOnScreens } from '../_screen/managers/screenDroppedHelpers';
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    genRevealOriginal,
    genShowOnScreensContextMenu,
} from '../others/FileItemHandlerComp';
import { chooseColorNote } from '../others/ItemColorNoteComp';
import type PresentingFlow from './PresentingFlow';
import type PresentingFlowItem from './PresentingFlowItem';
import { askForPresentingFlowActionArming } from './presentingFlowActionArmingHelpers';
import {
    genAddCcElementsContextMenu,
    genAddMediaControlContextMenu,
} from './PresentingFlowCcRowsComp';
import type { PresentingFlowCcHostType } from './PresentingFlowCcRowsComp';
import {
    genDisableContextMenu,
    sendPresentingFlowItemToScreens,
} from './presentingFlowHelpers';
import {
    notifyPresentingFlowItemOrigin,
    notifyVarySlideOrigin,
} from './presentingFlowOriginHelpers';
import { genSetSpecificScreenContextMenu } from './PresentingFlowScreenPinComp';

/**
 * The right-click menu of ONE presenting flow element, wherever it is drawn.
 *
 * Lives here rather than beside either of the two components that draw an
 * element — the tree row and the floating preview's frame — because the two are
 * the SAME line of the run sheet seen twice, and an operator who reorders,
 * duplicates or colours from the tree must be able to do the identical thing
 * from the preview. Two copies of this list drift the moment one gains an entry,
 * and the preview is exactly where the operator is during a service.
 *
 * Everything here acts on the PRESENTING_FLOW, so it is safe from either place: nothing
 * reads the row's own DOM, and `index`/`itemCount` are passed in fresh on every
 * open.
 */
export function genPresentingFlowItemContextMenuItems(
    presentingFlow: PresentingFlow,
    presentingFlowItem: PresentingFlowItem,
    index: number,
    itemCount: number,
): ContextMenuItemType[] {
    // An action has no original anywhere in the app to be pointed at — it is
    // authored in the presenting flow itself.
    const menuItems: ContextMenuItemType[] = presentingFlowItem.isAction
        ? []
        : [
              genRevealOriginal(() => {
                  notifyPresentingFlowItemOrigin(presentingFlowItem);
              }),
          ];
    // Not offered while the element is parked: it is the one entry that would
    // put it on a screen anyway, and an entry that quietly does nothing is
    // worse than one that is not there.
    if (
        presentingFlowItem.isScreenReachable &&
        !presentingFlowItem.isDisabled
    ) {
        menuItems.push(
            ...genShowOnScreensContextMenu(
                (event) => {
                    sendPresentingFlowItemToScreens(
                        presentingFlowItem,
                        event,
                        true,
                    );
                },
                presentingFlowItem.isAction ? 'Apply on Screens' : undefined,
            ),
        );
    }
    // A RUN action has no screen to be shown on or pinned to, so it takes the
    // place of that whole family with the two things it does have: firing it
    // now, and re-arming it with another number. Parked takes the first away for
    // the same reason it takes "Show on Screens" away — an entry that quietly
    // does nothing is worse than one that is not there — while re-arming stays,
    // like every other entry that edits a parked element.
    const runAction = presentingFlowItem.runAction;
    if (runAction !== null) {
        if (!presentingFlowItem.isDisabled) {
            menuItems.push({
                childBefore: genContextMenuItemIcon(runAction.iconName, {
                    color: runAction.color,
                }),
                // The clocks are STARTED; a `Keyboard Event` puts what is
                // attached to it on the screens, which is the one entry every
                // other element already has that name for; a jump just goes, and
                // its own label is already the imperative for it.
                menuElement: tran(
                    runAction.number !== null
                        ? 'Start Auto Next'
                        : presentingFlowItem.hostsCcFollowers
                          ? 'Apply on Screens'
                          : runAction.label,
                ),
                onSelect: (event) => {
                    sendPresentingFlowItemToScreens(presentingFlowItem, event);
                },
            });
        }
        // Only for the ones armed with a NUMBER or with a SHORTCUT — a `Jump to`
        // is armed with the CC element under it, which its own `Add CC Elements`
        // entry handles.
        if (runAction.number !== null || runAction.canBeKeyArmed) {
            menuItems.push({
                childBefore: genContextMenuItemIcon('pencil-square'),
                // An interval is armed with seconds and says so; the timeout
                // asks the wider question (seconds OR a time of day), so it says
                // that instead; the keyboard event asks for neither. A later run
                // action that means something else by its number needs its own
                // label here.
                menuElement: tran(
                    runAction.canBeKeyArmed
                        ? 'Change Shortcut'
                        : runAction.canBeTimeArmed
                          ? 'Change Timing'
                          : 'Change Seconds',
                ),
                onSelect: () => {
                    askForPresentingFlowActionArming(
                        runAction,
                        presentingFlowItem.actionArming,
                    )
                        .then((arming) => {
                            if (arming === null) {
                                return;
                            }
                            return presentingFlow.setItemActionArming(
                                index,
                                arming,
                            );
                        })
                        .catch(handleError);
                },
            });
        }
    }
    // Right under "Show on Screens" where there is one: that entry sends this
    // element to a screen NOW, this one says where it always goes. Its own gate
    // is WIDER — a document has no "Show on Screens" of its own, but its slides
    // do go to screens and must follow the run sheet.
    if (presentingFlowItem.isScreenPinnable) {
        menuItems.push(
            ...genSetSpecificScreenContextMenu(
                presentingFlowItem.screenIds,
                (newScreenIds) => {
                    presentingFlow.setItemScreenIds(index, newScreenIds);
                },
            ),
        );
    }
    // Kept with the screen family above rather than with the move/duplicate one
    // below: a CC does not change WHAT is in the run sheet, it changes what else
    // reaches a screen when this line fires. A run action resolves no screens, so
    // it hosts none — except a `Jump to`, whose ONE CC is not a follower at all
    // but the line it goes to, which is why the gate is "may it host another"
    // rather than the kind. Gone once it is full: the way to change where a jump
    // goes is to remove the CC it has.
    if (presentingFlowItem.canHostMoreCcItems) {
        menuItems.push(
            ...genAddCcElementsContextMenu(
                { presentingFlow, index, slideId: null },
                presentingFlowItem.uuid,
            ),
        );
        // Right after it, and gated on holding MEDIA rather than on hosting a CC:
        // it is a CC too, but the one kind the operator authors here instead of
        // picking from the lines already in the sheet. A slide of any kind can
        // hold media, and a document element's CCs ride every slide of it — nothing
        // else in a run sheet has media inside it to control.
        if (presentingFlowItem.isSlide || presentingFlowItem.isAppDocument) {
            menuItems.push(
                ...genAddMediaControlContextMenu({
                    presentingFlow,
                    index,
                    slideId: null,
                }),
            );
        }
    }
    // Each long jump sits right under its one-step sibling and behind the same
    // gate: an element already at an end has nothing to jump to.
    if (index > 0) {
        menuItems.push(
            {
                childBefore: genContextMenuItemIcon('arrow-up-circle'),
                menuElement: tran('Move up'),
                onSelect: () => {
                    presentingFlow.moveItemToIndex(index, index - 1);
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-bar-up'),
                menuElement: tran('Move to Top'),
                onSelect: () => {
                    presentingFlow.moveItemToIndex(index, 0);
                },
            },
        );
    }
    if (index < itemCount - 1) {
        menuItems.push(
            {
                childBefore: genContextMenuItemIcon('arrow-down-circle'),
                menuElement: tran('Move down'),
                onSelect: () => {
                    presentingFlow.moveItemToIndex(index, index + 1);
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-bar-down'),
                menuElement: tran('Move to Bottom'),
                onSelect: () => {
                    presentingFlow.moveItemToIndex(index, itemCount - 1);
                },
            },
        );
    }
    menuItems.push(
        // Last of the entries that change WHAT is in the list and where, before
        // the ones that only change how this element looks or behaves.
        {
            childBefore: genContextMenuItemIcon('files'),
            menuElement: tran('Duplicate'),
            onSelect: () => {
                presentingFlow.duplicateItemAtIndex(index);
            },
        },
        {
            childBefore: genContextMenuItemIcon('record-circle', {
                color: presentingFlowItem.colorNote || undefined,
            }),
            menuElement: tran('Choose Color'),
            onSelect: (event) => {
                chooseColorNote(
                    presentingFlowItem.colorNote,
                    (newColorNote) => {
                        presentingFlow.setItemColorNote(index, newColorNote);
                    },
                    event,
                );
            },
        },
        ...genDisableContextMenu(
            presentingFlowItem.isDisabled,
            (isDisabled) => {
                presentingFlow.setItemDisabled(index, isDisabled);
            },
        ),
        {
            childBefore: genContextMenuItemIcon('x-circle', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Remove from Presenting Flow'),
            onSelect: () => {
                presentingFlow.removeItemAtIndex(index);
            },
        },
    );
    return menuItems;
}

/**
 * The right-click menu of ONE slide of a document element — its tree row and its
 * card in the floating preview alike, for the same reason the element menu above
 * is shared: they are one slide of the run sheet drawn twice.
 *
 * A slide is NOT a presenting flow entry, so nothing here reorders, duplicates,
 * colours or removes: those all belong to the element that holds it. What is
 * left is where the slide goes, whether it is parked, and what rides with it.
 *
 * `setSlideScreenIds` / `setSlideDisabled` absent means these rows are not
 * drawn under a presenting flow entry at all — there is nowhere to store either flag,
 * so neither entry is offered.
 */
export function genPresentingFlowVarySlideContextMenuItems({
    varySlide,
    isDisabled,
    isOwnDisabled,
    ownScreenIds,
    setSlideScreenIds,
    setSlideDisabled,
    ccHost,
}: {
    varySlide: VarySlideType;
    // Whether the slide is parked at all — its own flag, the element's, or the
    // document's — which is what drops "Show on Screens".
    isDisabled: boolean;
    // Its OWN flag, which is the only one this menu may toggle.
    isOwnDisabled: boolean;
    ownScreenIds: number[];
    setSlideScreenIds?: (slideId: number, screenIds: number[]) => void;
    setSlideDisabled?: (slideId: number, isDisabled: boolean) => void;
    ccHost?: PresentingFlowCcHostType;
}): ContextMenuItemType[] {
    return [
        genRevealOriginal(() => {
            notifyVarySlideOrigin(varySlide);
        }),
        ...(isDisabled
            ? []
            : genShowOnScreensContextMenu((event) => {
                  showDroppedDataOnScreens(
                      event,
                      { type: varySlide.dragType, item: varySlide },
                      true,
                  );
              })),
        ...(setSlideScreenIds === undefined
            ? []
            : genSetSpecificScreenContextMenu(ownScreenIds, (newScreenIds) => {
                  setSlideScreenIds(varySlide.id, newScreenIds);
              })),
        ...(setSlideDisabled === undefined
            ? []
            : genDisableContextMenu(isOwnDisabled, (newIsDisabled) => {
                  setSlideDisabled(varySlide.id, newIsDisabled);
              })),
        ...(ccHost === undefined
            ? []
            : [
                  // A slide is not a line of the sheet, so it is never the host a
                  // CC must not point at — there is nothing to exclude.
                  ...genAddCcElementsContextMenu(ccHost, null),
                  // Ungated here, unlike the element menu: a row drawn by this
                  // builder IS a slide, whatever kind of document holds it.
                  ...genAddMediaControlContextMenu(ccHost),
              ]),
    ];
}
