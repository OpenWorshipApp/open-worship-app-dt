import { createContext, use } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { genColorFromScreenId } from '../preview/screenIdColorHelpers';
import { getAllScreenManagerBases } from './screenManagerBaseHelpers';

/**
 * Deliberately a leaf, the way `contextMenuIconHelpers` is: `ScreenEventHandler`
 * imports this, so whatever lands here lands in every screen manager. Nothing
 * translated belongs in it — `tran` drags the whole settings/file graph behind
 * it. A caller that needs a label owns that label itself.
 */

/**
 * The "which screen?" menu rows, in one place.
 *
 * Two pickers build them: the one that appears when nothing is selected
 * (`ScreenEventHandler.chooseScreenIds`) and the one that pins an item to a
 * screen for good (`chooseScreenIdsPreset`). They must list the same screens,
 * in the same order, under the same label — an operator reading `Screen id: 2`
 * in one has to find `Screen id: 2` in the other.
 *
 * `getAllScreenManagerBases` is already sorted by `screenId` for exactly this.
 * The label is NOT translated: it is an id, and it is what the mini screen
 * cards show.
 *
 * `checkIsChosen` turns the list into a checklist; without it every row wears
 * the plain `display` icon the rest of the app uses for a screen.
 */
export function genScreenIdMenuItems(
    onSelect: (screenId: number) => void,
    checkIsChosen?: (screenId: number) => boolean,
): ContextMenuItemType[] {
    return getAllScreenManagerBases().map(({ screenId }) => {
        const iconName =
            checkIsChosen === undefined
                ? 'display'
                : checkIsChosen(screenId)
                  ? 'check-square-fill'
                  : 'square';
        return {
            // Tinted with the screen's own identity colour — the one its mini
            // screen's id badge wears — so a row is recognizable before the
            // number is read.
            childBefore: genContextMenuItemIcon(iconName, {
                color: genColorFromScreenId(screenId),
            }),
            menuElement: `Screen id: ${screenId}`,
            onSelect: () => {
                onSelect(screenId);
            },
        };
    });
}

/**
 * Ride the answer a screen resolution is ABOUT to give, without asking a second
 * question.
 *
 * A presenting flow element that carries CC elements has to put them on the very
 * screens its host just reached — and it cannot ask for itself: the resolution
 * may end in the "which screen?" menu, and one click may only ever raise one
 * menu. So the resolution publishes its answer here and the follower reads it.
 *
 * Keyed by the ONE GESTURE, not by a global slot: several may be in flight (a
 * keyboard step synthesizes its own event while a menu from an earlier click is
 * still open), and identity is what stops one gesture consuming another's
 * answer.
 *
 * The key is the NATIVE event, never React's wrapper. A slide preview renders
 * into a shadow root with its OWN React root
 * (`ShadowingFillParentWidthComp`), so one click on a card is wrapped TWICE —
 * the outer tree arms the followers from its synthetic event, the inner tree
 * resolves the screens from its own — and two wrappers around one click are two
 * different objects. Keying on the wrapper silently dropped every follower of
 * every document slide in the floating preview. Anything with no `nativeEvent`
 * (a synthesized `createMouseEvent`, which both sides then share) is its own
 * key.
 *
 * Fired on the next MACROTASK: the thing the operator actually clicked has to
 * reach its screen manager first, with nothing interleaved before it.
 */
const chosenScreenIdsListeners = new Map<
    unknown,
    (screenIds: number[]) => void
>();

function toChosenScreenIdsKey(event: unknown) {
    return (event as { nativeEvent?: unknown })?.nativeEvent ?? event;
}

export function captureChosenScreenIds(
    event: unknown,
    onChosen: (screenIds: number[]) => void,
) {
    if (event === null || event === undefined) {
        return () => {};
    }
    const key = toChosenScreenIdsKey(event);
    chosenScreenIdsListeners.set(key, onChosen);
    return () => {
        if (chosenScreenIdsListeners.get(key) === onChosen) {
            chosenScreenIdsListeners.delete(key);
        }
    };
}

export function notifyChosenScreenIds(event: unknown, screenIds: number[]) {
    const key = toChosenScreenIdsKey(event);
    const onChosen = chosenScreenIdsListeners.get(key);
    if (onChosen === undefined) {
        return;
    }
    // Dropped as it fires: one arm answers one resolution. A gesture that
    // resolves twice (a menu reopened by the pin checklist) must not replay its
    // followers onto a screen the operator has moved on from.
    chosenScreenIdsListeners.delete(key);
    setTimeout(() => {
        onChosen(screenIds);
    }, 0);
}

/**
 * The screens a subtree must present onto instead of the selected ones.
 *
 * Deliberately generic — it says nothing about presenting flows. Slide cards are drawn
 * by the presenter's own components, shared with the documents previewer, so a
 * caller that has already decided which screens its content belongs on cannot
 * reach the click handler by props without teaching that component who its
 * caller is. Empty (the default) means "the selected screens", i.e. exactly
 * what every existing caller already does.
 */
export const PresetScreenIdsContext = createContext<number[]>([]);

export function usePresetScreenIds() {
    return use(PresetScreenIdsContext);
}
