/**
 * CC elements — everything about them that nothing else needs to import.
 *
 * Deliberately a LEAF: `PresentingFlowItem` imports this, and `PresentingFlowItem` is
 * already the bottom of an import graph the whole presenting flow panel sits on
 * (`presentingFlowItemsHelpers.ts` documents the cycle this file must not close).
 * Nothing translated, nothing that reads a file, no React.
 */

import type { PresentingFlowActionArmingType } from './presentingFlowActionHelpers';
import { checkIsValidPresentingFlowActionTime } from './presentingFlowActionTimeHelpers';
import type { PresentingFlowMediaControlType } from './presentingFlowMediaControlHelpers';

/**
 * What a CC element STORES: the uuid of the listed entry it follows, and its own
 * pin if it has one. Nothing else.
 *
 * A CC is a REFERENCE, not a copy. Everything it shows and everything it sends to
 * a screen — the payload, the title, the colour, what a run action is armed with
 * — is read off that entry every time it is drawn, so re-arming a `Next: Timeout`
 * element re-arms every CC of it at once and a slide edited elsewhere reaches the
 * screen as it now is.
 *
 * Which means EVERY CC has an element of its own in the sheet: something dropped
 * on a row from outside is appended as an element first (`PresentingFlow.addItemCcItem`
 * callers) and the CC then points at it. There is no such thing as a follower
 * with nothing to follow, so there is no dangling state to read defensively
 * around — a uuid that answers to nothing is an entry that has been removed, and
 * the CC goes with it.
 *
 * `screenIds` is the ONE thing a CC may say for itself: where it lands is about
 * this line of the sheet, not about what the element is. Absent means "wherever
 * the element itself is pinned, else wherever the host went".
 *
 * `mediaControl` is the second, and the one exception to the paragraph above: a
 * `Slide: Media Control` is settings and nothing else, and the settings are about
 * THIS attachment rather than about the element. "Start the video ten seconds in"
 * is a thing an operator means about one slide, so the same controller attached to
 * two slides must be able to mean two different things — which is exactly what a
 * value read off the shared element could never do.
 *
 * `actionArming` is the third, and the only one that OVERRIDES what the element
 * says rather than adding to it: the clock a `Next: Timeout` follower counts. The
 * element's own arming is still the default — absent here means "whatever the
 * element is armed with", so re-arming the element still re-arms every CC of it —
 * but one line of the sheet may now hold that timeout for four seconds where
 * another holds it for thirty, without a second timeout element per duration.
 * Stored as the whole answer rather than as a loose number so the "seconds OR a
 * time of day, never both" rule lives in one object; `actionKey` is never written
 * here, a key-armed action being one the operator presses and never a follower.
 */
export type PresentingFlowCcItemType = {
    uuid: string;
    screenIds?: number[];
    mediaControl?: PresentingFlowMediaControlType;
    actionArming?: PresentingFlowActionArmingType;
};

/**
 * Read a CC's own arming defensively — a hand-edited file, or one written by a
 * later version, must never turn a follower into an error row mid-service, and
 * anything that is not plainly one of the two answers simply means "follow the
 * element".
 *
 * A TIME wins over a number for the same reason `PresentingFlowItem.actionTime`
 * does: a record carrying both was written by something that did not obey the
 * alternation, and the time is the more specific of the two. A number that is not
 * above 0 is refused rather than clamped — it is the same answer the question
 * itself refuses, and a `0` overlaid on the element would be a follower that fires
 * its clock instantly.
 */
export function toPresentingFlowCcActionArming(
    value: any,
): PresentingFlowActionArmingType | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const { actionTime, actionNumber } = value;
    if (checkIsValidPresentingFlowActionTime(actionTime)) {
        return { actionTime };
    }
    if (typeof actionNumber === 'number' && actionNumber > 0) {
        return { actionNumber };
    }
    return null;
}

/**
 * A presenting flow entry's identity, stable for as long as the entry is in the sheet.
 *
 * Assigned when it is added and never rewritten — reordering, re-arming, parking,
 * pinning and colouring all leave it alone, which is exactly what makes it worth
 * pointing at. A DUPLICATE gets a new one: it is another line of the run sheet,
 * and its CCs must not move when the original's do.
 */
export function genPresentingFlowItemUuid() {
    return globalThis.crypto.randomUUID();
}

/** Whether a stored value is a uuid this app wrote — and could write again. */
export function checkIsValidPresentingFlowItemUuid(
    value: any,
): value is string {
    return typeof value === 'string' && value !== '';
}

/**
 * Stamped on every row, frame and card that IS a listed entry, so revealing what
 * a CC points at is one `querySelector` instead of a ref per row.
 *
 * The bare uuid, unscoped: it is unique across every presenting flow ever written, so
 * unlike the derived key it replaced it cannot pick up an identical-looking line
 * of a different run sheet.
 */
export const PRESENTING_FLOW_ITEM_UUID_ATTR = 'data-presenting-flow-item-uuid';

/**
 * Marks a CC row. Read by the floating preview's element frame, whose capture
 * handler moves the run cursor onto whatever is clicked inside it — a CC is
 * shown BY the run, never something the run stops on.
 */
export const PRESENTING_FLOW_CC_ROW_ATTR = 'data-presenting-flow-cc-row';

/**
 * Where a CC actually lands: its OWN pin if it has one, else wherever its host
 * just went. The same inheritance a document's slide makes against the element
 * above it — a CC pinned to nothing follows its host rather than going nowhere.
 */
export function resolveCcScreenIds(
    ccScreenIds: number[],
    hostScreenIds: number[],
) {
    return ccScreenIds.length > 0 ? ccScreenIds : hostScreenIds;
}

/**
 * The other reading of a CC's pin: it FILTERS the host's screens rather than
 * replacing them.
 *
 * For a follower that SHOWS something, replacing is right — "put this marquee on
 * screen 2 whatever the slide did" is a sentence with a meaning. For one that acts
 * on what its host just put up, it is not: a `Slide: Media Control` can only reach
 * media the host actually projected, so a pin naming a screen the host did not
 * reach must do NOTHING rather than run against an empty screen. Chosen per action
 * by `filtersHostScreenIds` on the registry entry.
 */
export function intersectCcScreenIds(
    ccScreenIds: number[],
    hostScreenIds: number[],
) {
    if (ccScreenIds.length === 0) {
        return hostScreenIds;
    }
    return hostScreenIds.filter((screenId) => {
        return ccScreenIds.includes(screenId);
    });
}
