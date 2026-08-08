import type { AppDocumentMetadataType } from '../helper/AppEditableDocumentSourceAbs';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { handleError } from '../helper/errorHelpers';
import { cloneJson } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type {
    PresentingFlowActionArmingType,
    PresentingFlowActionIdType,
} from './presentingFlowActionHelpers';
import { PRESENTING_FLOW_ACTION_TYPE } from './presentingFlowActionHelpers';
import type { PresentingFlowCcItemType } from './presentingFlowCcHelpers';
import {
    checkIsValidPresentingFlowItemUuid,
    genPresentingFlowItemUuid,
} from './presentingFlowCcHelpers';
import type { PresentingFlowItemType } from './PresentingFlowItem';
import PresentingFlowItem from './PresentingFlowItem';

export type PresentingFlowType = {
    items: PresentingFlowItemType[];
    metadata: AppDocumentMetadataType;
};

/**
 * Write what a run action is armed with, DELETING whatever it was armed with
 * before: the three fields are alternatives, so a timeout re-armed with 7:05
 * that kept its old `30` would be one hand-edit away from silently counting
 * seconds again — and `PresentingFlowItem.actionTime` wins, so the stale one would be
 * the one that stopped mattering without ever being removed.
 */
function applyPresentingFlowActionArming(
    itemJson: PresentingFlowItemType,
    { actionNumber, actionTime, actionKey }: PresentingFlowActionArmingType,
) {
    delete itemJson.actionNumber;
    delete itemJson.actionTime;
    delete itemJson.actionKey;
    if (actionKey !== undefined) {
        itemJson.actionKey = actionKey;
    } else if (actionTime !== undefined) {
        itemJson.actionTime = actionTime;
    } else if (actionNumber !== undefined) {
        itemJson.actionNumber = actionNumber;
    }
}

/**
 * Whether a keyboard shortcut is still FREE in this sheet — the one uniqueness
 * rule a presenting flow has.
 *
 * One shortcut names one line: two lines answering to `Shift+A` would mean the
 * operator's press picked whichever came first, which is the very bug UUID
 * references were introduced to end. Checked on every write rather than at the
 * question, so the drag-in and duplicate paths cannot get round it, and refused
 * out loud — a shortcut that silently did not take is worse than one that was
 * never set.
 *
 * `skipIndex` is the entry being re-armed, which is of course allowed to keep
 * its own shortcut.
 */
function checkPresentingFlowActionKeyIsFree(
    itemJsonList: PresentingFlowItemType[],
    actionKey: string | undefined,
    skipIndex: number,
) {
    if (actionKey === undefined) {
        return true;
    }
    const isTaken = itemJsonList.some((itemJson, index) => {
        return (
            index !== skipIndex &&
            itemJson.type === PRESENTING_FLOW_ACTION_TYPE &&
            itemJson.actionKey === actionKey
        );
    });
    if (!isTaken) {
        return true;
    }
    showSimpleToast(
        tran('Keyboard Event'),
        `${tran('This shortcut is already used in this presenting flow')}: ${actionKey}`,
    );
    return false;
}

/**
 * The entry's identity, minting one if it has none.
 *
 * A file written before uuids existed has entries with no identity, and one is
 * given the moment something needs to POINT at that entry — never merely to read
 * the sheet. So a run sheet nobody attaches a CC in is left exactly as it is on
 * disk, and the uuid a CC is stored against is the one the file keeps.
 */
function ensurePresentingFlowItemUuid(itemJson: PresentingFlowItemType) {
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
function dropPresentingFlowCcItemsOfUuid(
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

export default class PresentingFlow extends AppEditableDocumentSourceAbs<PresentingFlowType> {
    static readonly mimetypeName: MimetypeNameType = 'presentingFlow';

    static genNewExtraJsonData() {
        return { items: [] as PresentingFlowItemType[] };
    }

    async getJsonData(isOriginal = false): Promise<PresentingFlowType | null> {
        const jsonData = await super.getJsonData(isOriginal);
        if (jsonData === null) {
            return null;
        }
        if (!Array.isArray(jsonData.items)) {
            jsonData.items = [];
        }
        return jsonData;
    }

    async getItems() {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return null;
        }
        // Bound as one list, because that is the only thing that knows what a
        // CC's uuid means — see `PresentingFlowItem.bindCcSources`.
        return PresentingFlowItem.bindCcSources(
            jsonData.items.map((json) => {
                try {
                    return PresentingFlowItem.fromJson(this.filePath, json);
                } catch (error: any) {
                    showSimpleToast(
                        'Instantiating Presenting Flow Item',
                        error.message,
                    );
                }
                return PresentingFlowItem.fromJsonError(this.filePath, json);
            }),
        );
    }

    // A presenting flow has no editor and no save button, so every mutation is written
    // straight through instead of parking in the editing history.
    private async setItems(items: PresentingFlowItemType[]) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return false;
        }
        jsonData.items = items;
        await this.setJsonData(jsonData);
        return await this.save();
    }

    /**
     * Read the items as plain json, let `handler` rearrange them, write back.
     * A handler returning `false` aborts without writing — that is load bearing:
     * an out-of-range `splice` is a silent no-op, so without it "Move up" on the
     * first row would still save the file and fire its update events.
     *
     * Serialized per presenting flow file, because this is a read-modify-write and it
     * is the funnel EVERY mutation goes through. Two of them overlapping — two
     * drops in the same tick, an auto-next writing while the operator drops —
     * both read the same list and the second write silently threw the first
     * away. Keyed apart from `FileSource`'s own read/write lock, which the read
     * and the write inside this callback each take in turn: sharing that key
     * would deadlock rather than serialize.
     */
    private async updateItemJsonList(
        handler: (itemJsonList: PresentingFlowItemType[]) => boolean | void,
    ) {
        return await unlocking(
            `presenting-flow-items-${this.filePath}`,
            async () => {
                const items = await this.getItems();
                if (items === null) {
                    return false;
                }
                const itemJsonList = items.map((item) => {
                    return item.toJson();
                });
                if (handler(itemJsonList) === false) {
                    return false;
                }
                return await this.setItems(itemJsonList);
            },
        );
    }

    private async insertItemJson(
        newItemJson: PresentingFlowItemType,
        toIndex?: number,
    ) {
        return await this.updateItemJsonList((itemJsonList) => {
            // Every way a NEW line arrives passes through here, so the shortcut
            // rule is asked once instead of at each of them. Content carries no
            // shortcut and answers free without looking at the list.
            if (
                !checkPresentingFlowActionKeyIsFree(
                    itemJsonList,
                    newItemJson.actionKey,
                    -1,
                )
            ) {
                return false;
            }
            if (toIndex === undefined || toIndex >= itemJsonList.length) {
                itemJsonList.push(newItemJson);
            } else {
                itemJsonList.splice(Math.max(toIndex, 0), 0, newItemJson);
            }
        });
    }

    async addItem(
        droppedData: DroppedDataType,
        dragData: DragDataType<any>,
        toIndex?: number,
    ) {
        try {
            const newItemJson = await PresentingFlowItem.fromDroppedData(
                droppedData,
                dragData,
            );
            if (newItemJson === null) {
                showSimpleToast(
                    tran('Adding Presenting Flow Item'),
                    tran('This item type cannot be added to a presenting flow'),
                );
                return false;
            }
            return await this.insertItemJson(newItemJson, toIndex);
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding Presenting Flow Item', error.message);
        }
        return false;
    }

    /**
     * An action is not dragged from anywhere — it is chosen from the presenting flow's
     * own menu, so it has its own way in rather than going through the drop
     * pipeline. `arming` is what the run family is armed with — a count of
     * seconds or a time of day — asked for by the menu before it gets here, and
     * `screenIds` is the same for the two screen actions that must NAME their
     * screens (`requiresScreenIds`).
     */
    async addActionItem(
        actionId: PresentingFlowActionIdType,
        arming?: PresentingFlowActionArmingType,
        toIndex?: number,
        screenIds?: number[],
    ) {
        try {
            return await this.insertItemJson(
                PresentingFlowItem.fromActionId(actionId, arming, screenIds),
                toIndex,
            );
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding Presenting Flow Action', error.message);
        }
        return false;
    }

    async removeItemAtIndex(index: number) {
        return await this.updateItemJsonList((itemJsonList) => {
            const itemJson = itemJsonList[index];
            if (itemJson === undefined) {
                return false;
            }
            itemJsonList.splice(index, 1);
            // Its followers go with it: a CC is a reference, and one naming a
            // line that is no longer in the sheet is not a follower at all.
            dropPresentingFlowCcItemsOfUuid(
                itemJsonList,
                itemJson.uuid ?? null,
            );
        });
    }

    /**
     * The copy lands directly BELOW the original so the run sheet the user is
     * looking at does not shift under them. Copying the raw json is what carries
     * the color note, the screen pins, the disabled slides and the CC elements
     * along with it — that is the whole point of duplicating rather than adding
     * the same file again.
     *
     * It is RE-KEYED, though: the copy is another line of the run sheet, so
     * things pointing at the original must go on pointing at the original. What
     * it copies is the references it HOLDS — the duplicate follows the same
     * elements — not the ones held to it.
     */
    async duplicateItemAtIndex(index: number) {
        return await this.updateItemJsonList((itemJsonList) => {
            const itemJson = itemJsonList[index];
            if (itemJson === undefined) {
                return false;
            }
            const newItemJson = cloneJson(itemJson) as PresentingFlowItemType;
            newItemJson.uuid = genPresentingFlowItemUuid();
            // And its SHORTCUT is left behind, for the same reason: one shortcut
            // names one line, so the copy cannot have the original's. Dropped
            // rather than refusing the duplicate — what is worth copying about a
            // `Keyboard Event` is the elements attached to it, and the copy says
            // plainly that it has no key yet by reading as an unarmed one.
            delete newItemJson.actionKey;
            itemJsonList.splice(index + 1, 0, newItemJson);
        });
    }

    async moveItemToIndex(fromIndex: number, toIndex: number) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[fromIndex] === undefined) {
                return false;
            }
            const [moving] = itemJsonList.splice(fromIndex, 1);
            itemJsonList.splice(
                Math.min(Math.max(toIndex, 0), itemJsonList.length),
                0,
                moving,
            );
        });
    }

    /**
     * Read ONE entry as plain json, let `mutate` change a copy of it, write it
     * back. Every per-entry setter below needs the same out-of-range guard that
     * `updateItemJsonList` documents, so it is written once here instead of
     * being repeated — and copying rather than mutating in place keeps the
     * items the caller already holds untouched.
     */
    private async updateItemJson(
        index: number,
        mutate: (itemJson: PresentingFlowItemType) => void,
    ) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[index] === undefined) {
                return false;
            }
            const itemJson = { ...itemJsonList[index] };
            mutate(itemJson);
            itemJsonList[index] = itemJson;
        });
    }

    /**
     * Re-arm a run action. Its own setter rather than remove-and-add-again: the
     * entry keeps its place in the sheet, its colour note and its parked flag,
     * which is the whole point of changing it in place mid-service.
     */
    async setItemActionArming(
        index: number,
        arming: PresentingFlowActionArmingType,
    ) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[index] === undefined) {
                return false;
            }
            // Not through `updateItemJson`, unlike every other per-entry setter:
            // this one has to see the whole sheet to know whether the shortcut it
            // is being handed is already spoken for. Itself excepted — re-arming
            // a line with the key it already has is not a clash.
            if (
                !checkPresentingFlowActionKeyIsFree(
                    itemJsonList,
                    arming.actionKey,
                    index,
                )
            ) {
                return false;
            }
            const itemJson = { ...itemJsonList[index] };
            applyPresentingFlowActionArming(itemJson, arming);
            itemJsonList[index] = itemJson;
        });
    }

    async setItemColorNote(index: number, colorNote: string | null) {
        return await this.updateItemJson(index, (itemJson) => {
            itemJson.colorNote = colorNote;
        });
    }

    /**
     * Pin an entry to the screens it must always go to. An empty list DELETES
     * the key rather than storing `[]`: "not pinned" is the absence of the
     * field, so an unpinned run sheet reads exactly as one written before this
     * existed.
     */
    async setItemScreenIds(index: number, screenIds: number[]) {
        return await this.updateItemJson(index, (itemJson) => {
            if (screenIds.length === 0) {
                delete itemJson.screenIds;
            } else {
                itemJson.screenIds = screenIds;
            }
        });
    }

    /**
     * Pin ONE slide of a document entry, as an exception to the element's own
     * pin. An empty list deletes that slide's entry — and the map with it once
     * the last exception is gone — so a document whose slides all follow it
     * again stores nothing extra.
     */
    async setItemSlideScreenIds(
        index: number,
        slideId: number,
        screenIds: number[],
    ) {
        return await this.updateItemJson(index, (itemJson) => {
            const slideScreenIds = { ...(itemJson.slideScreenIds ?? {}) };
            if (screenIds.length === 0) {
                delete slideScreenIds[`${slideId}`];
            } else {
                slideScreenIds[`${slideId}`] = screenIds;
            }
            if (Object.keys(slideScreenIds).length === 0) {
                delete itemJson.slideScreenIds;
            } else {
                itemJson.slideScreenIds = slideScreenIds;
            }
        });
    }

    /**
     * Park an entry out of the run, or put it back. `false` DELETES the key
     * rather than storing it, for the same reason an empty pin does: "in play"
     * is the absence of the field, so a run sheet nothing was ever parked in
     * reads exactly as one written before this existed.
     */
    async setItemDisabled(index: number, isDisabled: boolean) {
        return await this.updateItemJson(index, (itemJson) => {
            if (isDisabled) {
                itemJson.isDisabled = true;
            } else {
                delete itemJson.isDisabled;
            }
        });
    }

    /**
     * Park ONE slide of a document entry, as an exception to the element's own
     * flag — the same shape `setItemSlideScreenIds` has, and the list goes with
     * the last slide put back so a document fully in play stores nothing extra.
     */
    async setItemSlideDisabled(
        index: number,
        slideId: number,
        isDisabled: boolean,
    ) {
        return await this.updateItemJson(index, (itemJson) => {
            const disabledSlideIds = (itemJson.disabledSlideIds ?? []).filter(
                (disabledSlideId) => {
                    return disabledSlideId !== slideId;
                },
            );
            if (isDisabled) {
                disabledSlideIds.push(slideId);
            }
            if (disabledSlideIds.length === 0) {
                delete itemJson.disabledSlideIds;
            } else {
                itemJson.disabledSlideIds = disabledSlideIds;
            }
        });
    }

    /**
     * Read ONE host's CC list — the entry's own when `slideId` is null, else one
     * slide's — let `mutate` change a COPY of it, write it back.
     *
     * The copy is not optional: `updateItemJson` hands out a shallow
     * `{...itemJson}`, whose arrays are the very ones the caller's json holds,
     * so mutating the list in place would edit state nothing asked to edit.
     *
     * An empty list deletes the key, and `slideCcItems` goes with its last
     * slide — the same contract `setItemSlideScreenIds` and `setItemSlideDisabled`
     * keep, so an entry whose CCs have all been removed reads exactly as one
     * written before CCs existed.
     */
    private async updateItemCcList(
        index: number,
        slideId: number | null,
        mutate: (
            ccItemRefList: PresentingFlowCcItemType[],
            hostItemJson: PresentingFlowItemType,
            itemJsonList: PresentingFlowItemType[],
        ) => boolean | void,
    ) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[index] === undefined) {
                return false;
            }
            const itemJson = { ...itemJsonList[index] };
            const storedList =
                slideId === null
                    ? itemJson.ccItems
                    : itemJson.slideCcItems?.[`${slideId}`];
            const ccItemRefList = Array.isArray(storedList)
                ? [...storedList]
                : [];
            if (mutate(ccItemRefList, itemJson, itemJsonList) === false) {
                return false;
            }
            if (slideId === null) {
                if (ccItemRefList.length === 0) {
                    delete itemJson.ccItems;
                } else {
                    itemJson.ccItems = ccItemRefList;
                }
            } else {
                const slideCcItems = { ...(itemJson.slideCcItems ?? {}) };
                if (ccItemRefList.length === 0) {
                    delete slideCcItems[`${slideId}`];
                } else {
                    slideCcItems[`${slideId}`] = ccItemRefList;
                }
                if (Object.keys(slideCcItems).length === 0) {
                    delete itemJson.slideCcItems;
                } else {
                    itemJson.slideCcItems = slideCcItems;
                }
            }
            itemJsonList[index] = itemJson;
        });
    }

    /**
     * Attach one CC to a host, given the ELEMENT it must follow — or say why not.
     *
     * `resolveSourceJson` is handed the whole sheet and answers with the entry to
     * point at: one already listed, or one it has APPENDED. That is the rule the
     * whole design rests on — a CC always has an element of its own in the run
     * sheet, so something dropped from outside becomes a line at the bottom first
     * and the CC then references it. `isTarget` tells it which sort of CC this
     * host takes, since a `Jump to` may name things no follower may be.
     *
     * The two refusals read differently because they ARE different. A clock —
     * and every run action but `Jump to` — accepts NONE: nothing it does resolves
     * a screen for a follower to ride to, so the answer is "not this element",
     * not "not another one". A `Jump to` already aimed somewhere is FULL, and
     * re-aiming it is `Remove CC Element` then attach rather than a quiet no-op
     * that keeps the first.
     *
     * Checked here rather than at each affordance, because this is the one funnel
     * all three attach paths (the menu, a dropped payload, a dragged row) pass
     * through — and it is ONE write, so a sheet is never left holding an appended
     * element whose CC never arrived.
     */
    private async attachItemCcItem(
        index: number,
        slideId: number | null,
        resolveSourceJson: (
            itemJsonList: PresentingFlowItemType[],
            isTarget: boolean,
        ) => PresentingFlowItemType | null,
    ) {
        return await this.updateItemCcList(
            index,
            slideId,
            (ccItemRefList, hostItemJson, itemJsonList) => {
                // Only the ENTRY's own list is capped: the cap belongs to what
                // the entry is, and a document's slides are content whatever
                // the entry above them is.
                if (slideId === null) {
                    const maxCcItemCount =
                        PresentingFlowItem.getMaxCcItemCount(hostItemJson);
                    if (ccItemRefList.length >= maxCcItemCount) {
                        showSimpleToast(
                            tran('Adding CC Element'),
                            tran(
                                maxCcItemCount === 0
                                    ? 'This element does not accept CC element'
                                    : 'This element takes only one CC element',
                            ),
                        );
                        return false;
                    }
                }
                // Asked only once the host has agreed to take another, so a
                // refused attach never leaves an appended element behind.
                const sourceJson = resolveSourceJson(
                    itemJsonList,
                    slideId === null &&
                        PresentingFlowItem.checkIsCcTargetHost(hostItemJson),
                );
                if (sourceJson === null) {
                    showSimpleToast(
                        tran('Adding CC Element'),
                        tran('This item type cannot be a CC element'),
                    );
                    return false;
                }
                const uuid = ensurePresentingFlowItemUuid(sourceJson);
                // A line following itself would fire twice on one click.
                if (uuid === hostItemJson.uuid) {
                    return false;
                }
                ccItemRefList.push({ uuid });
            },
        );
    }

    /**
     * Attach a CC naming an entry that is ALREADY LISTED, by its uuid — what the
     * `Add CC Elements` menu does, having listed exactly those entries.
     */
    async addItemCcItem(index: number, slideId: number | null, uuid: string) {
        return await this.attachItemCcItem(index, slideId, (itemJsonList) => {
            return (
                itemJsonList.find((itemJson) => {
                    return itemJson.uuid === uuid;
                }) ?? null
            );
        });
    }

    async removeItemCcItemAtIndex(
        index: number,
        slideId: number | null,
        ccIndex: number,
    ) {
        return await this.updateItemCcList(index, slideId, (ccItemRefList) => {
            if (ccItemRefList[ccIndex] === undefined) {
                return false;
            }
            ccItemRefList.splice(ccIndex, 1);
        });
    }

    async moveItemCcItemToIndex(
        index: number,
        slideId: number | null,
        fromCcIndex: number,
        toCcIndex: number,
    ) {
        return await this.updateItemCcList(index, slideId, (ccItemRefList) => {
            if (ccItemRefList[fromCcIndex] === undefined) {
                return false;
            }
            const [moving] = ccItemRefList.splice(fromCcIndex, 1);
            ccItemRefList.splice(
                Math.min(Math.max(toCcIndex, 0), ccItemRefList.length),
                0,
                moving,
            );
        });
    }

    /**
     * Read ONE CC as plain json, let `mutate` change a copy of it, write it
     * back — the CC-level twin of `updateItemJson`, and it carries the same
     * out-of-range guard for the same reason.
     */
    private async updateItemCcItemRef(
        index: number,
        slideId: number | null,
        ccIndex: number,
        mutate: (ccItemRef: PresentingFlowCcItemType) => void,
    ) {
        return await this.updateItemCcList(index, slideId, (ccItemRefList) => {
            if (ccItemRefList[ccIndex] === undefined) {
                return false;
            }
            const ccItemRef = { ...ccItemRefList[ccIndex] };
            mutate(ccItemRef);
            ccItemRefList[ccIndex] = ccItemRef;
        });
    }

    /**
     * Pin a CC to screens of its own — the ONE thing a CC says for itself, since
     * everything else about it is the element it points at. Clearing it does NOT
     * send the CC nowhere: it hands the CC back to that element's own pin, and
     * failing that to whatever its host resolved to, exactly as clearing a
     * slide's pin hands it back to the document element above it.
     */
    async setItemCcItemScreenIds(
        index: number,
        slideId: number | null,
        ccIndex: number,
        screenIds: number[],
    ) {
        return await this.updateItemCcItemRef(
            index,
            slideId,
            ccIndex,
            (ccItemRef) => {
                if (screenIds.length === 0) {
                    delete ccItemRef.screenIds;
                } else {
                    ccItemRef.screenIds = screenIds;
                }
            },
        );
    }

    /**
     * Attach something DROPPED on a row as that row's CC.
     *
     * The payload has no line of its own in the sheet, so one is APPENDED at the
     * bottom and the CC points at that: a follower always has an element to
     * follow, and the operator can then re-arm, pin or colour it in the one place
     * it lives. Mirrors `addItem` — the same builder, so the appended line is
     * exactly what dropping the same payload on the presenting flow itself would have
     * made — and refuses the same kinds `resolveCcItemJson` does: neither a
     * document nor an audio track reaches a screen, so following one there would
     * promise something nothing delivers.
     */
    async addItemCcFromDroppedData(
        index: number,
        slideId: number | null,
        droppedData: DroppedDataType,
        dragData: DragDataType<any>,
    ) {
        try {
            const newItemJson = await PresentingFlowItem.fromDroppedData(
                droppedData,
                dragData,
            );
            return await this.attachItemCcItem(
                index,
                slideId,
                (itemJsonList, isTarget) => {
                    if (
                        newItemJson === null ||
                        PresentingFlowItem.resolveCcItemJson(
                            newItemJson,
                            isTarget,
                        ) === null
                    ) {
                        return null;
                    }
                    itemJsonList.push(newItemJson);
                    return newItemJson;
                },
            );
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding CC Element', error.message);
        }
        return false;
    }

    /**
     * Attach an element that is ALREADY LISTED — in this presenting flow or another —
     * as a CC, naming it by where it sits rather than by a dragged payload.
     *
     * This is the only way some kinds can be attached by dragging at all: a
     * slide, a document and an ACTION all return `null` from `dragSerialize`
     * (an action is not even a drag type), so their rows carry no payload for
     * `addItemCcFromDroppedData` to read. Reading the entry back out of its own
     * presenting flow sidesteps that entirely and works for every kind at once.
     *
     * A row of THIS sheet is pointed at where it already is. One dragged out of
     * ANOTHER sheet is appended here first, uuids being an identity within one
     * presenting flow — and it would be a follower naming a line this run sheet does not
     * list, which is precisely what a reference may never be.
     *
     * The source index is checked against the list it came from rather than
     * trusted: a presenting flow can be edited between the drag starting and the drop.
     */
    async addItemCcFromItemIndex(
        index: number,
        slideId: number | null,
        sourceFilePath: string,
        sourceIndex: number,
    ) {
        try {
            const sourceItems =
                await PresentingFlow.getInstance(sourceFilePath).getItems();
            const sourceItem = sourceItems?.[sourceIndex];
            const sourceJson =
                sourceItem === undefined || sourceItem.isError
                    ? null
                    : sourceItem.toJson();
            const isOwnItem = sourceFilePath === this.filePath;
            return await this.attachItemCcItem(
                index,
                slideId,
                (itemJsonList, isTarget) => {
                    if (
                        sourceJson === null ||
                        PresentingFlowItem.resolveCcItemJson(
                            sourceJson,
                            isTarget,
                        ) === null
                    ) {
                        return null;
                    }
                    if (isOwnItem) {
                        // By uuid rather than by the index it was dragged from:
                        // this sheet may have been reordered since, and the
                        // json read above is a copy, not the listed object.
                        const listedJson = itemJsonList.find((itemJson) => {
                            return (
                                itemJson.uuid !== undefined &&
                                itemJson.uuid === sourceJson.uuid
                            );
                        });
                        if (listedJson !== undefined) {
                            return listedJson;
                        }
                        const listedByIndex = itemJsonList[sourceIndex];
                        if (listedByIndex !== undefined) {
                            return listedByIndex;
                        }
                    }
                    const newItemJson = cloneJson(
                        sourceJson,
                    ) as PresentingFlowItemType;
                    // Everything that belongs to the line it was copied FROM,
                    // in the sheet it was copied from: this is a new line here.
                    newItemJson.uuid = genPresentingFlowItemUuid();
                    delete newItemJson.ccItems;
                    delete newItemJson.slideCcItems;
                    // Its shortcut belongs to the sheet it came from, where it
                    // was unique; carried over it could collide here, and a line
                    // copied in as a jump target was never meant to answer to a
                    // key of this run sheet's anyway.
                    delete newItemJson.actionKey;
                    itemJsonList.push(newItemJson);
                    return newItemJson;
                },
            );
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding CC Element', error.message);
        }
        return false;
    }

    async clearItems() {
        return await this.setItems([]);
    }

    static async create(dir: string, name: string) {
        return super.create(dir, name, this.genNewExtraJsonData());
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
