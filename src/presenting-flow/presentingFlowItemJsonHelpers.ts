/**
 * The rules a presenting flow keeps on its stored entries, as plain JSON --
 * shared by the panel's own writes (`PresentingFlow`) and by the help window's
 * assistant, which changes many lines in ONE write
 * (`src/helper/agentFlowEditRules.ts`, 2026-11-07: _add `Open in Chatbot` …
 * chatbot can help the presenting flow modification_). One copy of each rule:
 * a second one in the assistant's module would be the first to drift.
 *
 * Nothing here toasts, reads a file or translates: the caller says why.
 */
import { cloneJson } from '../helper/helpers';
import { PRESENTING_FLOW_ACTION_TYPE } from './presentingFlowActionHelpers';
import {
    checkIsValidPresentingFlowItemUuid,
    genPresentingFlowItemUuid,
} from './presentingFlowCcHelpers';
import type { PresentingFlowItemType } from './PresentingFlowItem';
import PresentingFlowItem from './PresentingFlowItem';

/**
 * Whether a keyboard shortcut is already TAKEN in this sheet -- the one
 * uniqueness rule a presenting flow has. One shortcut names one line: two lines
 * answering to `Shift+A` would mean the operator's press picked whichever came
 * first. `skipIndex` is the entry being re-armed, which may keep its own.
 */
export function checkIsPresentingFlowActionKeyTaken(
    itemJsonList: PresentingFlowItemType[],
    actionKey: string | undefined,
    skipIndex: number,
) {
    if (actionKey === undefined) {
        return false;
    }
    return itemJsonList.some((itemJson, index) => {
        return (
            index !== skipIndex &&
            itemJson.type === PRESENTING_FLOW_ACTION_TYPE &&
            itemJson.actionKey === actionKey
        );
    });
}

/**
 * The entry's identity, minting one if it has none.
 *
 * A file written before uuids existed has entries with no identity, and one is
 * given the moment something needs to POINT at that entry — never merely to read
 * the sheet. So a run sheet nobody attaches a CC in is left exactly as it is on
 * disk, and the uuid a CC is stored against is the one the file keeps.
 */
export function ensurePresentingFlowItemUuid(itemJson: PresentingFlowItemType) {
    if (!checkIsValidPresentingFlowItemUuid(itemJson.uuid)) {
        itemJson.uuid = genPresentingFlowItemUuid();
    }
    return itemJson.uuid as string;
}

/**
 * Drop every CC pointing at a uuid that is no longer listed — what removing an
 * element does to its followers, on every host and every host's slides at once.
 *
 * A CC is a reference, so an element being taken out of the sheet takes its
 * followers with it: leaving them would leave rows naming a line that is not
 * there. Answers whether anything was actually dropped.
 */
export function dropPresentingFlowCcItemsOfUuid(
    itemJsonList: PresentingFlowItemType[],
    uuid: string | null,
) {
    if (uuid === null) {
        return false;
    }
    let isChanged = false;
    for (const itemJson of itemJsonList) {
        const ccItemRefList = PresentingFlowItem.readCcItemRefList(itemJson);
        if (
            !ccItemRefList.some((ccItemRef) => {
                return ccItemRef?.uuid === uuid;
            })
        ) {
            continue;
        }
        isChanged = true;
        const keep = (list: any) => {
            return (Array.isArray(list) ? list : []).filter((ccItemRef) => {
                return ccItemRef?.uuid !== uuid;
            });
        };
        if (itemJson.ccItems !== undefined) {
            const ccItems = keep(itemJson.ccItems);
            if (ccItems.length === 0) {
                delete itemJson.ccItems;
            } else {
                itemJson.ccItems = ccItems;
            }
        }
        const { slideCcItems } = itemJson;
        if (slideCcItems !== undefined && slideCcItems !== null) {
            for (const [slideId, list] of Object.entries(slideCcItems)) {
                const kept = keep(list);
                if (kept.length === 0) {
                    delete slideCcItems[slideId];
                } else {
                    slideCcItems[slideId] = kept;
                }
            }
            if (Object.keys(slideCcItems).length === 0) {
                delete itemJson.slideCcItems;
            }
        }
    }
    return isChanged;
}

/**
 * A COPY of a line, as Duplicate makes it: the raw json, so the colour note,
 * the screen pins, the parked slides and the CC elements come along -- the
 * whole point of duplicating rather than adding the same file again.
 *
 * It is RE-KEYED: the copy is another line of the run sheet, so things
 * pointing at the original go on pointing at the original. And its SHORTCUT is
 * left behind, for the same reason -- one shortcut names one line.
 */
export function duplicatePresentingFlowItemJson(
    itemJson: PresentingFlowItemType,
): PresentingFlowItemType {
    const newItemJson = cloneJson(itemJson) as PresentingFlowItemType;
    newItemJson.uuid = genPresentingFlowItemUuid();
    delete newItemJson.actionKey;
    return newItemJson;
}
