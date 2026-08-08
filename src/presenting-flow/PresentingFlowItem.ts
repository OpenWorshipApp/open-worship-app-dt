import { type CSSProperties } from 'react';

import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { deserializeDragData } from '../helper/dragHelpers';
import FileSource from '../helper/FileSource';
import { cloneJson } from '../helper/helpers';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import { tran } from '../lang/langHelpers';
import {
    toForegroundDragIconName,
    toForegroundDragLabel,
} from '../presenter-foreground/foregroundDragHelpers';
import type {
    PresentingFlowActionArmingType,
    PresentingFlowActionIdType,
    PresentingFlowRunActionType,
    PresentingFlowScreenActionType,
} from './presentingFlowActionHelpers';
import {
    PRESENTING_FLOW_ACTION_TYPE,
    findPresentingFlowAction,
} from './presentingFlowActionHelpers';
import { checkIsValidPresentingFlowActionKey } from './presentingFlowActionKeyHelpers';
import {
    checkIsValidPresentingFlowActionTime,
    toPresentingFlowActionTimeLabel,
} from './presentingFlowActionTimeHelpers';
import type { PresentingFlowCcItemType } from './presentingFlowCcHelpers';
import {
    checkIsValidPresentingFlowItemUuid,
    genPresentingFlowItemUuid,
    toPresentingFlowCcActionArming,
} from './presentingFlowCcHelpers';
import type { PresentingFlowMediaControlType } from './presentingFlowMediaControlHelpers';
import {
    presentingFlowMediaControlModeLabelMap,
    toPresentingFlowMediaControl,
    toPresentingFlowMediaControlSummary,
} from './presentingFlowMediaControlHelpers';
import { toDocumentIcon, toDragTypeIconName } from './presentingFlowHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

export const ERROR_TYPE = 'error';

export const slideDragTypeList = [
    DragTypeEnum.SLIDE,
    DragTypeEnum.LYRIC_SLIDE,
    DragTypeEnum.PDF_SLIDE,
    DragTypeEnum.PPTX_SLIDE,
    DragTypeEnum.DOCX_SLIDE,
] as DragTypeEnum[];

export const backgroundDragTypeList = [
    DragTypeEnum.BACKGROUND_COLOR,
    DragTypeEnum.BACKGROUND_IMAGE,
    DragTypeEnum.BACKGROUND_VIDEO,
    DragTypeEnum.BACKGROUND_CAMERA,
    DragTypeEnum.BACKGROUND_WEB,
] as DragTypeEnum[];

export const acceptedDragTypeList = [
    ...backgroundDragTypeList,
    ...slideDragTypeList,
    DragTypeEnum.BIBLE_ITEM,
    DragTypeEnum.APP_DOCUMENT,
    DragTypeEnum.FOREGROUND,
    // Audio is deliberately NOT in `backgroundDragTypeList`: it is played
    // locally rather than shown, so it must not reach the screen pipeline.
    DragTypeEnum.BACKGROUND_AUDIO,
] as DragTypeEnum[];

/**
 * What a presenting flow stores per entry.
 *
 * Slides and documents are kept as REFERENCES (`filePath` + `id`), never as a
 * snapshot of the dragged payload: a presenting flow is built days before it is used,
 * and a song edited in between must project its new text. Everything else
 * (backgrounds, bible verses, foregrounds) is already self-describing and small,
 * so its drag payload is stored verbatim in `data`.
 *
 * An ACTION is the one entry that is not content at all: it stores nothing but
 * its id in `data` (and, for the ones that are armed, `actionNumber` or
 * `actionTime`), and no `title` — its label is translated on the fly, so a run
 * sheet reads in whichever language it is opened in.
 */
export type PresentingFlowItemType = {
    type: DragTypeEnum | typeof ERROR_TYPE | typeof PRESENTING_FLOW_ACTION_TYPE;
    // This entry's identity, what every CC and every `Jump to` points at. Written
    // on add and never rewritten; see `genPresentingFlowItemUuid`. Optional in the type
    // for the one moment it is absent — a file written before uuids existed,
    // which `PresentingFlow.getJsonData` fills in on read.
    uuid?: string;
    filePath?: string;
    id?: number;
    // Lyric slides only: which rendering stage the slide came from.
    stage?: number;
    data?: any;
    // ACTION entries of the run family only: the one number that action is armed
    // with — seconds, for the two that walk the run on. Kept out of `data`,
    // which is the action's id and nothing else, so the id a file was written
    // with is still readable on its own.
    actionNumber?: number;
    // ACTION entries that may be armed with a TIME OF DAY (`canBeTimeArmed` —
    // the timeout, and only it): `HH:mm` in 24-hour form, stored INSTEAD of
    // `actionNumber` rather than beside it, since an entry counts down either to
    // a wall-clock time or from a number of seconds and never both.
    actionTime?: string;
    // ACTION entries that may be armed with a KEYBOARD SHORTCUT (`canBeKeyArmed`
    // — the `Keyboard Event`, and only it): `Ctrl+Shift+A`, stored INSTEAD of the
    // two above, since a line is fired by a key or by a clock and never by both.
    // UNIQUE within the presenting flow — one shortcut names one line, enforced by
    // `PresentingFlow` on every write. See `presentingFlowActionKeyHelpers`.
    actionKey?: string;
    extraStyle?: CSSProperties;
    // Label captured when the item was added. Purely cosmetic — resolving the
    // real name would mean reading every referenced file just to draw a row.
    title?: string;
    // Same colour vocabulary as the file lists. Stored on the entry rather than
    // in the shared colour-note settings: two presenting flows may well want the same
    // slide flagged differently.
    colorNote?: string | null;
    // The screens this entry ALWAYS goes to, whatever is selected — a preset the
    // operator pins from the row's menu. On the entry for the same reason
    // `colorNote` is: two run sheets may well aim the same slide at different
    // screens. Absent (rather than empty) when nothing is pinned.
    screenIds?: number[];
    // DOCUMENT entries only: a pin for INDIVIDUAL slides, keyed by slide id. A
    // slide with no entry here follows the element's own `screenIds`, so
    // pinning the document still aims all of its slides at once and this holds
    // only the per-slide exceptions. Keyed by id rather than by position, so
    // editing the document elsewhere cannot silently re-point a pin.
    slideScreenIds?: { [slideId: string]: number[] };
    // Parked: the entry stays LISTED and keeps its whole menu, but it takes no
    // part in the run — it cannot be clicked, dropped or stepped onto a screen.
    // Stored on the entry for the same reason `colorNote` is, and it has to be:
    // the same song may be parked in one run sheet and live in another, and a
    // pdf/pptx slide has no writable flag of its own to borrow.
    isDisabled?: boolean;
    // DOCUMENT entries only: the slides parked INSIDE the document, by id — the
    // per-slide exception to the element's own flag, exactly as
    // `slideScreenIds` is to `screenIds`. Absent (rather than empty) when the
    // whole document is in play.
    disabledSlideIds?: number[];
    // The elements that ride along when this one is shown, each naming a LISTED
    // entry by its uuid (see `PresentingFlowCcItemType`). A reference and not a copy,
    // so a CC shows and sends whatever its element is right now — and one level
    // only falls out of it: a CC has no payload for a CC of its own to hang off.
    ccItems?: PresentingFlowCcItemType[];
    // DOCUMENT entries only: CCs attached to ONE of its slides, keyed by slide
    // id — the same shape, and for the same reason, as `slideScreenIds` and
    // `disabledSlideIds`. The element's own `ccItems` ride along with EVERY
    // slide of it; these ride with one.
    slideCcItems?: { [slideId: string]: PresentingFlowCcItemType[] };
    // `Slide: Media Control` only, and NEVER written on a listed element: it lives
    // on the CC record (`PresentingFlowCcItemType.mediaControl`) because the settings
    // belong to one attachment, and `buildCcItems` overlays it here so the resolved
    // follower reads it through one getter like everything else. Present in this
    // type for that overlay alone — `resolveCcItemJson` strips any that a
    // hand-edited file put on an element.
    mediaControl?: PresentingFlowMediaControlType;
};

/**
 * Read a stored id list defensively: a hand-edited file, or one written by a
 * later version, must never turn a run-sheet row into an error row mid-service.
 * A value that makes no sense simply means "not pinned".
 */
function toScreenIds(value: any): number[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((screenId) => {
        return typeof screenId === 'number';
    });
}

/**
 * Write what a run action is armed with, DELETING whatever it was armed with
 * before: the three fields are alternatives, so a timeout re-armed with 7:05
 * that kept its old `30` would be one hand-edit away from silently counting
 * seconds again — and `PresentingFlowItem.actionTime` wins, so the stale one
 * would be the one that stopped mattering without ever being removed.
 *
 * Lives here rather than beside its first caller because there are now two: the
 * ELEMENT is re-armed by `PresentingFlow.setItemActionArming`, and a resolved CC
 * has its host's own arming overlaid by `buildCcItems`. Two copies of the
 * delete-the-others rule is exactly one copy too many.
 */
export function applyPresentingFlowActionArming(
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

export default class PresentingFlowItem {
    private readonly originalJson: Readonly<PresentingFlowItemType>;
    filePath: string;
    jsonError: any;
    // CC ELEMENTS ONLY, both written by `buildCcItems` where the overlay happens
    // and false for everything else — a LISTED element is re-armed through its own
    // row, which re-arms every follower of it at once, and that is still what
    // absence means here.
    //
    // Two booleans rather than one because the row asks two questions: whether to
    // OFFER this follower a clock of its own at all, and whether it is already
    // holding one (a filled glyph, and the entry that hands it back to the
    // element). Neither can be re-derived from the resolved json — an overlaid
    // arming is indistinguishable from the element's own.
    canBeCcArmed = false;
    hasOwnActionArming = false;
    // Built on first ask and dying with this instance — an item is rebuilt
    // every time the file is re-read, so this can never outlive the json it
    // came from. Deliberately not a module map: that is the kind of cache that
    // grows for as long as the app is open.
    private ccItemsCache: PresentingFlowItem[] | null = null;
    private slideCcItemsCache: Map<number, PresentingFlowItem[]> | null = null;
    // The sheet this entry is a line OF, as a uuid lookup — what its CC
    // references resolve against. Null until `bindCcSources` hands it over, and
    // null forever for an item built on its own (a CC, a test), which is right:
    // only a LISTED entry has siblings to follow.
    private ccSourceMap: ReadonlyMap<string, PresentingFlowItem> | null = null;

    constructor(filePath: string, json: PresentingFlowItemType) {
        this.filePath = filePath;
        this.originalJson = Object.freeze(cloneJson(json));
    }

    /**
     * Let every entry of one sheet resolve the CCs it holds.
     *
     * A CC names a SIBLING, so no item can answer for its own followers alone —
     * the list is the only thing that knows what the uuids mean. Called once by
     * `PresentingFlow.getItems`, right where the whole list exists and nowhere else.
     *
     * Nothing is built here and nothing is held beyond the items themselves: the
     * map points at the very objects the caller already has, and it is dropped
     * with them. A sheet with no CCs anywhere — which is nearly every sheet —
     * builds no map at all and pays one pass of two boolean reads.
     */
    static bindCcSources(presentingFlowItems: PresentingFlowItem[]) {
        const hasAnyCcItem = presentingFlowItems.some((presentingFlowItem) => {
            return (
                presentingFlowItem.hasCcItems ||
                presentingFlowItem.hasSlideCcItems
            );
        });
        if (!hasAnyCcItem) {
            return presentingFlowItems;
        }
        const ccSourceMap = new Map<string, PresentingFlowItem>();
        for (const presentingFlowItem of presentingFlowItems) {
            const { uuid } = presentingFlowItem;
            // First one wins: two entries sharing a uuid is a hand-edited file
            // (or one duplicated by a version that did not re-key), and pointing
            // at the first of them is the same answer every other lookup in this
            // panel gives for two identical lines.
            if (uuid !== null && !ccSourceMap.has(uuid)) {
                ccSourceMap.set(uuid, presentingFlowItem);
            }
        }
        for (const presentingFlowItem of presentingFlowItems) {
            presentingFlowItem.ccSourceMap = ccSourceMap;
        }
        return presentingFlowItems;
    }

    /**
     * This entry's identity, or null for one that has none — an error row, and
     * a CC built for display, neither of which anything may point at.
     */
    get uuid(): string | null {
        const { uuid } = this.originalJson;
        return checkIsValidPresentingFlowItemUuid(uuid) ? uuid : null;
    }

    get extraStyle() {
        return this.originalJson.extraStyle ?? {};
    }
    get type() {
        return this.originalJson.type;
    }
    get itemFilePath() {
        return this.originalJson.filePath ?? '';
    }
    get id() {
        return this.originalJson.id ?? -1;
    }
    get stage() {
        return this.originalJson.stage ?? 0;
    }
    get data() {
        return this.originalJson.data;
    }
    get colorNote() {
        return this.originalJson.colorNote ?? null;
    }
    get screenIds(): number[] {
        return toScreenIds(this.originalJson.screenIds);
    }

    /**
     * A slide's OWN pin, empty when it has none. Kept separate from
     * `getSlideScreenIds` because the menu and the badge need to know whether
     * this slide is pinned in its own right or merely following the document:
     * "No Specific Screen" on a slide clears its exception and hands it back to
     * the element, rather than pinning it to nothing.
     */
    getOwnSlideScreenIds(slideId: number): number[] {
        const map = this.originalJson.slideScreenIds;
        if (map === null || typeof map !== 'object') {
            return [];
        }
        return toScreenIds((map as any)[`${slideId}`]);
    }

    /** Where this slide actually goes: its own pin, else the element's. */
    getSlideScreenIds(slideId: number): number[] {
        const ownScreenIds = this.getOwnSlideScreenIds(slideId);
        return ownScreenIds.length > 0 ? ownScreenIds : this.screenIds;
    }

    /**
     * Parked out of the run. Read defensively like the pins above: a
     * hand-edited file must never turn a row into an error row mid-service, and
     * anything that is not plainly `true` simply means "in play".
     */
    get isDisabled() {
        return this.originalJson.isDisabled === true;
    }

    /**
     * Whether ONE slide of a document entry is parked. A parked document parks
     * everything under it, so this answers for its slides too — an operator who
     * disables the document does not then have to disable each of its slides.
     */
    checkIsSlideDisabled(slideId: number) {
        return this.isDisabled || this.checkIsOwnSlideDisabled(slideId);
    }

    /**
     * Whether a slide is parked for ANY reason: the document itself disabled
     * it, or this run sheet did. Every affordance that greys a slide out or
     * steps over it asks this one question, so it is answered here rather than
     * each of them remembering to OR the two halves together.
     */
    checkIsVarySlideDisabled(varySlide: { id: number; isDisabled?: boolean }) {
        return (
            varySlide.isDisabled === true ||
            this.checkIsSlideDisabled(varySlide.id)
        );
    }

    /** Its OWN flag, ignoring the document's — what the slide's menu toggles. */
    checkIsOwnSlideDisabled(slideId: number) {
        const { disabledSlideIds } = this.originalJson;
        return (
            Array.isArray(disabledSlideIds) &&
            disabledSlideIds.includes(slideId)
        );
    }

    /**
     * How many CC elements this entry may HOST, from json alone so every attach
     * path can ask before building anything.
     *
     * Unlimited for content — a slide may bring a marquee, a background and a
     * verse with it — and answered by the REGISTRY entry for an action, whichever
     * family it is in: a `Jump to` takes exactly the ONE line it goes to, the
     * clocks none at all (nothing they do resolves a screen for a follower to
     * ride to), and `Screen: Show`/`Screen: Hide` none either, being about the
     * window rather than about what is on it. An unknown id — a file from a later
     * version — hosts nothing, the same as an error row, which has no present of
     * its own to ride.
     */
    static getMaxCcItemCount(itemJson: PresentingFlowItemType) {
        if (itemJson.type === ERROR_TYPE) {
            return 0;
        }
        if (itemJson.type !== PRESENTING_FLOW_ACTION_TYPE) {
            return Infinity;
        }
        return findPresentingFlowAction(itemJson.data)?.ccItemCount ?? 0;
    }

    get maxCcItemCount() {
        return PresentingFlowItem.getMaxCcItemCount(this.originalJson);
    }

    /** Whether another CC may still be attached here — what every gate asks. */
    get canHostMoreCcItems() {
        return this.ccItems.length < this.maxCcItemCount;
    }

    /**
     * Asked BEFORE anything is built, and answered without touching the json's
     * contents: the overwhelmingly common run sheet has no CCs at all, and it
     * must pay a length check rather than an array of wrapped items per row.
     */
    get hasCcItems() {
        const { ccItems } = this.originalJson;
        return Array.isArray(ccItems) && ccItems.length > 0;
    }

    /**
     * Whether this DOCUMENT entry has any per-slide CC at all — asked once per
     * expanded document rather than once per slide row, since a ~90-slide
     * document is what this panel is measured against.
     */
    get hasSlideCcItems() {
        const { slideCcItems } = this.originalJson;
        return (
            slideCcItems !== null &&
            typeof slideCcItems === 'object' &&
            Object.keys(slideCcItems).length > 0
        );
    }

    checkHasSlideCcItems(slideId: number) {
        const map = this.originalJson.slideCcItems;
        if (map === null || typeof map !== 'object') {
            return false;
        }
        const list = (map as any)[`${slideId}`];
        return Array.isArray(list) && list.length > 0;
    }

    /**
     * Resolve a stored CC list against the sheet, one reference at a time.
     *
     * A reference that answers to nothing is DROPPED and its host row survives —
     * unlike a bad entry, which `PresentingFlow.getItems` turns into an error row. That
     * asymmetry is deliberate: an entry that cannot be read is a line of the run
     * sheet the operator has to know about, while a follower that cannot be read
     * must not cost them the slide it was attached to, mid-service. It is also
     * what "the element was removed" looks like — its followers go with it, here
     * and in the file (`PresentingFlow.removeItemAtIndex`).
     *
     * The element's own line-of-the-sheet things — its CCs, its per-slide maps,
     * its parked flag — are left behind by `resolveCcItemJson`, so a follower can
     * never carry followers of its own and is never parked. Only the CC's own PIN
     * is written over the element's.
     */
    private buildCcItems(
        rawList: any,
        isTarget: boolean,
    ): PresentingFlowItem[] {
        const ccSourceMap = this.ccSourceMap;
        if (!Array.isArray(rawList) || ccSourceMap === null) {
            return [];
        }
        const items: PresentingFlowItem[] = [];
        for (const raw of rawList) {
            const sourceItem = ccSourceMap.get(raw?.uuid);
            // Never itself: a line that followed itself would fire twice on one
            // click, once as the host and once as its own follower.
            if (sourceItem === undefined || sourceItem === this) {
                continue;
            }
            const ccJson = PresentingFlowItem.resolveCcItemJson(
                sourceItem.toJson(),
                isTarget,
            );
            if (ccJson === null) {
                continue;
            }
            const screenIds = toScreenIds(raw?.screenIds);
            if (screenIds.length > 0) {
                ccJson.screenIds = screenIds;
            }
            // The second thing a CC says for itself, and the only one that is not
            // an override of the element's: a `Slide: Media Control` element holds
            // no settings at all, so this IS the settings rather than a preference
            // written over them. See `PresentingFlowCcItemType.mediaControl`.
            const mediaControl = toPresentingFlowMediaControl(
                raw?.mediaControl,
            );
            if (mediaControl !== null) {
                ccJson.mediaControl = mediaControl;
            }
            // The third, and the only one written OVER what the element says: a
            // `Next: Timeout` follower may hold its own clock, so "show this and
            // go on four seconds later" and "show that and go on in thirty" are
            // one timeout element attached twice rather than two elements. A
            // TARGET is left out — a `Jump to`'s pointer is never fired, so a
            // clock on it would be a row promising a duration nothing counts; the
            // run lands on the ELEMENT and fires what the element is armed with.
            // Answered from json once, here, rather than in each of the row, the
            // menu and the clock.
            const canBeCcArmed =
                !isTarget && PresentingFlowItem.checkCanBeCcArmed(ccJson);
            const actionArming = canBeCcArmed
                ? toPresentingFlowCcActionArming(raw?.actionArming)
                : null;
            if (actionArming !== null) {
                applyPresentingFlowActionArming(ccJson, actionArming);
            }
            const ccItem = new PresentingFlowItem(this.filePath, ccJson);
            ccItem.canBeCcArmed = canBeCcArmed;
            ccItem.hasOwnActionArming = actionArming !== null;
            items.push(ccItem);
        }
        return items;
    }

    /**
     * The CCs riding along with this element itself, never more than it may
     * host: a hand-edited `Jump to` carrying three of them jumps to the first
     * and must not DRAW the other two, or the row would promise something the
     * action cannot do. Capped on read as well as on write, exactly as
     * `isDisabled` is stripped in both directions.
     */
    get ccItems(): PresentingFlowItem[] {
        if (!this.hasCcItems) {
            return [];
        }
        this.ccItemsCache ??= this.buildCcItems(
            this.originalJson.ccItems,
            PresentingFlowItem.checkIsCcTargetHost(this.originalJson),
        ).slice(0, this.maxCcItemCount);
        return this.ccItemsCache;
    }

    /** The CCs riding along with ONE slide of this document entry. */
    getSlideCcItems(slideId: number): PresentingFlowItem[] {
        if (!this.checkHasSlideCcItems(slideId)) {
            return [];
        }
        this.slideCcItemsCache ??= new Map();
        let items = this.slideCcItemsCache.get(slideId);
        if (items === undefined) {
            // Never a target: a `Jump to` is armed on the ENTRY, and a document's
            // slide is content whatever the entry above it is.
            items = this.buildCcItems(
                (this.originalJson.slideCcItems as any)[`${slideId}`],
                false,
            );
            this.slideCcItemsCache.set(slideId, items);
        }
        return items;
    }

    /**
     * Everything that rides along when ONE slide of this document entry is
     * shown: the element's own CCs first, then that slide's.
     *
     * A document is never presented as a unit — clicking it opens the previewer
     * — so a CC on the element would otherwise never fire at all. Riding with
     * every slide is what "this marquee is on while this song is being run"
     * means, and it is idempotent: re-applying the same foreground or background
     * on the next slide lands the screen in the state it is already in.
     */
    getEffectiveSlideCcItems(slideId: number): PresentingFlowItem[] {
        if (!this.hasCcItems) {
            return this.getSlideCcItems(slideId);
        }
        if (!this.checkHasSlideCcItems(slideId)) {
            return this.ccItems;
        }
        return [...this.ccItems, ...this.getSlideCcItems(slideId)];
    }

    get isError() {
        return this.type === ERROR_TYPE;
    }
    get isSlide() {
        return slideDragTypeList.includes(this.type as DragTypeEnum);
    }
    get isBackground() {
        return backgroundDragTypeList.includes(this.type as DragTypeEnum);
    }
    get isBibleItem() {
        return this.type === DragTypeEnum.BIBLE_ITEM;
    }
    get isAppDocument() {
        return this.type === DragTypeEnum.APP_DOCUMENT;
    }
    get isForeground() {
        return this.type === DragTypeEnum.FOREGROUND;
    }
    get isAudio() {
        return this.type === DragTypeEnum.BACKGROUND_AUDIO;
    }
    get isAction() {
        return this.type === PRESENTING_FLOW_ACTION_TYPE;
    }
    /** Never null while this is an action — `validate` rejects unknown ids. */
    get action() {
        return findPresentingFlowAction(this.data);
    }
    /**
     * The action narrowed to its family, or null. Two getters rather than one
     * `action.target === ...` test at each call site: what an action does to a
     * screen and what it does to the run are different enough that a caller
     * which forgot to tell them apart would be a screen action running the
     * clock, or a run action asking which screen to run the clock on.
     */
    get screenAction(): PresentingFlowScreenActionType | null {
        const { action } = this;
        return action?.target === 'screen' ? action : null;
    }
    get runAction(): PresentingFlowRunActionType | null {
        const { action } = this;
        return action?.target === 'run' ? action : null;
    }
    /** What a run action is armed with. 0 when this is not one. */
    get actionNumber() {
        const { actionNumber } = this.originalJson;
        return typeof actionNumber === 'number' ? actionNumber : 0;
    }
    /**
     * The TIME OF DAY it is armed with instead, or null — which is also the
     * answer for an action that cannot be armed with one at all, so a
     * hand-edited `actionTime` on an interval is ignored everywhere at once
     * rather than in each of the row, the question and the clock.
     */
    get actionTime(): string | null {
        if (this.runAction?.canBeTimeArmed !== true) {
            return null;
        }
        const { actionTime } = this.originalJson;
        return checkIsValidPresentingFlowActionTime(actionTime)
            ? actionTime
            : null;
    }
    /**
     * The SHORTCUT it is armed with, or null — which is also the answer for an
     * action that may not carry one, so a hand-edited `actionKey` on a clock is
     * ignored everywhere at once (the row, the question, and the preview's
     * registration) rather than in each of them.
     */
    get actionKey(): string | null {
        if (this.runAction?.canBeKeyArmed !== true) {
            return null;
        }
        const { actionKey } = this.originalJson;
        return checkIsValidPresentingFlowActionKey(actionKey)
            ? actionKey
            : null;
    }
    /**
     * What a `Slide: Media Control` follower is set to do, or null.
     *
     * Null for every other action too — the same "ignored everywhere at once" rule
     * `actionTime` follows, so a `mediaControl` a hand-edited file put on a
     * `Clear All` is invisible to the row, the panel and the apply loop together
     * rather than in each of them. Read defensively for the same reason: a bad
     * config must not turn a line of a live run sheet into an error row.
     *
     * Only ever non-null on a resolved CC — `buildCcItems` is what puts it there.
     * The listed element answers null, which is why clicking it does nothing.
     */
    get mediaControl(): PresentingFlowMediaControlType | null {
        if (this.action?.id !== 'slide-media-control') {
            return null;
        }
        return toPresentingFlowMediaControl(this.originalJson.mediaControl);
    }
    /** How this run action is armed, as the question asks and answers it. */
    get actionArming(): PresentingFlowActionArmingType {
        // A key-armed action is armed with a key and with nothing else, so it
        // answers with the key or with NOTHING — never with the `{actionNumber:
        // 0}` the clocks' default would give, which the question would then open
        // on as though it were a count of seconds.
        if (this.runAction?.canBeKeyArmed === true) {
            const { actionKey } = this;
            return actionKey === null ? {} : { actionKey };
        }
        const { actionTime } = this;
        return actionTime !== null
            ? { actionTime }
            : { actionNumber: this.actionNumber };
    }
    /**
     * Whether the CCs attached here are FOLLOWERS that this line must resolve
     * screens for by itself.
     *
     * True for exactly one thing: a `Keyboard Event`, which shows nothing of its
     * own, so unless it resolves the screens its followers land on, nothing does.
     * A `Jump to`'s one CC is a pointer (`ccItemsAreTargets`) and the clocks host
     * none, so both answer false and go on being fired without touching a screen.
     */
    get hostsCcFollowers() {
        const { runAction } = this;
        return (
            runAction !== null &&
            runAction.ccItemCount > 0 &&
            !runAction.ccItemsAreTargets
        );
    }
    /**
     * An action that drives the RUN rather than a screen. It reaches no screen
     * by any route — not by click, not by drag, not by a pin — so it is kept out
     * of `isScreenReachable` entirely and answered for separately.
     */
    get isRunAction() {
        return this.runAction !== null;
    }
    /**
     * A document opens a preview and audio plays locally, so neither goes to a
     * screen — they are the item kinds the screen pipeline cannot take. An
     * action does reach a screen, but it is RUN on one rather than shown, so it
     * is deliberately not part of this.
     */
    get isShowableOnScreen() {
        return (
            !this.isError &&
            !this.isAppDocument &&
            !this.isAudio &&
            !this.isAction
        );
    }
    /**
     * Everything an operator can send to a screen from a run sheet — content to
     * show, or a screen action to run there. What the click, the drag, the
     * next-key and the right-click menu all gate on.
     */
    get isScreenReachable() {
        return this.isShowableOnScreen || this.screenAction !== null;
    }
    /**
     * Everything the RUN stops on and fires: what reaches a screen, plus the run
     * actions, which reach no screen at all. Wider than `isScreenReachable` by
     * exactly that family — a run sheet whose next-key stepped OVER its own
     * "carry on by yourself" element would never start one.
     */
    get isRunReachable() {
        return this.isScreenReachable || this.isRunAction;
    }
    /**
     * Everything that can be PINNED to a screen — wider than
     * `isScreenReachable` by exactly two kinds, and for the same reason both
     * times: the element itself is never shown, but something UNDER it is, and
     * that something has to be able to land on the screen the run sheet names.
     * A document, whose slides are what the run walks; and a `Keyboard Event`,
     * whose CC elements are what its shortcut puts up. Audio and an error row
     * stay out: neither reaches a screen by any route, so a pin on them would
     * promise nothing.
     */
    get isScreenPinnable() {
        return (
            this.isScreenReachable ||
            this.isAppDocument ||
            this.hostsCcFollowers
        );
    }

    get iconName() {
        if (this.isError) {
            return 'exclamation-triangle';
        }
        if (this.isAction) {
            return this.action?.iconName ?? 'eraser';
        }
        if (this.isForeground) {
            return toForegroundDragIconName(this.data?.target);
        }
        if (this.isAppDocument) {
            return toDocumentIcon(this.itemFilePath)[0];
        }
        return toDragTypeIconName(this.type);
    }

    /** Only the kinds whose icon carries meaning in colour set this. */
    get iconColor() {
        if (this.type === DragTypeEnum.BACKGROUND_COLOR) {
            return this.data;
        }
        if (this.isAppDocument) {
            return toDocumentIcon(this.itemFilePath)[1];
        }
        if (this.isAction) {
            return this.action?.color;
        }
        return undefined;
    }

    get title() {
        // Translated here rather than captured on add, unlike every other kind:
        // an action has no name of its own to preserve, and its label is one the
        // app already ships in every language.
        if (this.isAction) {
            const { action } = this;
            if (action === null) {
                return this.type;
            }
            // A run action's number is WHAT IT DOES, so it is read straight off
            // the row rather than hidden in a menu. Appended to the translated
            // label rather than being part of it: `tran` is keyed by the English
            // label and would throw on a key with a number baked into it. One
            // armed with something else (a `Jump to` names its target with a CC)
            // reads as its label alone — the CC row under it says where it goes.
            if (action.target !== 'run') {
                // A media controller's settings are WHAT IT DOES, on exactly the
                // same reasoning as a clock's number, so the row says them: the
                // translated mode, then the numbers. Both go on AFTER `tran`, never
                // into a key. The listed ELEMENT has no settings (they live on the
                // attachment), so it reads as the bare label and the CC rows under
                // its hosts are where the detail is.
                const { mediaControl } = this;
                if (mediaControl === null) {
                    return tran(action.label);
                }
                const summary =
                    toPresentingFlowMediaControlSummary(mediaControl);
                const mode = tran(
                    presentingFlowMediaControlModeLabelMap[mediaControl.mode],
                );
                return (
                    `${tran(action.label)} (${mode}` +
                    (summary === '' ? ')' : ` ${summary})`)
                );
            }
            // The SHORTCUT is what the operator has to find on the row — it is
            // the whole of what tells one `Keyboard Event` from another, and it
            // is what they are about to press. Read as it is stored
            // (`Ctrl+Shift+A`), which means the same thing on every platform.
            if (action.canBeKeyArmed) {
                const { actionKey } = this;
                return actionKey === null
                    ? tran(action.label)
                    : `${tran(action.label)} (${actionKey})`;
            }
            if (action.number === null) {
                return tran(action.label);
            }
            // A time of day reads as a TIME (`7:05 PM`), which is the whole
            // reason to arm one with it: a bare `43500` is the sum the operator
            // was trying not to do.
            const { actionTime } = this;
            const arming =
                actionTime !== null
                    ? toPresentingFlowActionTimeLabel(actionTime)
                    : `${this.actionNumber}`;
            return `${tran(action.label)} (${arming})`;
        }
        // Same reasoning as an action's: a damaged entry has no name of its own
        // to preserve, so its label is translated on read rather than baked in
        // English into the row when the error is built.
        if (this.isError) {
            return tran('Invalid item');
        }
        return this.originalJson.title ?? this.type;
    }

    /** Short badge identifying WHICH element this is, next to the type icon. */
    get idLabel() {
        if (this.isSlide) {
            return `#${this.id}`;
        }
        if (this.isAction) {
            return this.action?.badge ?? '';
        }
        return '';
    }

    /**
     * Rebuild the payload the screen pipeline expects. Slides are re-read from
     * their document here, which is also why this is async.
     */
    async toDroppedData(): Promise<DroppedDataType | null> {
        // An action carries no payload at all — it is applied to a screen
        // manager directly (`applyPresentingFlowActionOnScreens`).
        if (this.isError || this.isAction) {
            return null;
        }
        if (this.isSlide) {
            const varySlide = await this.getVarySlide();
            if (varySlide === null) {
                return null;
            }
            return { type: this.type as DragTypeEnum, item: varySlide };
        }
        return deserializeDragData({
            type: this.type as DragTypeEnum,
            data: this.data,
        });
    }

    /**
     * Resolve the referenced slide. The document graphs are imported lazily:
     * they are heavy, they form an initialization cycle with each other, and a
     * presenting flow that is merely listed must not pull them in at all.
     */
    async getVarySlide(): Promise<VarySlideType | null> {
        if (!this.isSlide || !this.itemFilePath) {
            return null;
        }
        try {
            if (this.type === DragTypeEnum.LYRIC_SLIDE) {
                const { getLyricAppDocumentStageByStage } =
                    await import('../lyric-list/lyricHelpers');
                const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
                    this.itemFilePath,
                    this.stage,
                );
                return await lyricAppDocument.getSlideById(this.id);
            }
            const { varyAppDocumentFromFilePath } =
                await import('../app-document-list/appDocumentHelpers');
            const varyAppDocument = varyAppDocumentFromFilePath(
                this.itemFilePath,
            );
            return (await varyAppDocument.getItemById(
                this.id,
            )) as VarySlideType | null;
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    /**
     * Put this item back on a drag event. Slides cannot be resolved
     * synchronously, so they travel as a reference and the drop side resolves
     * them — see `PresentingFlowItemComp`.
     */
    dragSerialize(): DragDataType<any> | null {
        if (
            this.isSlide ||
            this.isAppDocument ||
            this.isError ||
            this.isAction
        ) {
            return null;
        }
        return { type: this.type as DragTypeEnum, data: this.data };
    }

    static async fromDroppedData(
        { type, item }: DroppedDataType,
        dragData: DragDataType<any>,
    ): Promise<PresentingFlowItemType | null> {
        if (!acceptedDragTypeList.includes(type)) {
            return null;
        }
        if (slideDragTypeList.includes(type)) {
            const varySlide = item as VarySlideType;
            const fileSource = FileSource.getInstance(varySlide.filePath);
            return {
                type,
                uuid: genPresentingFlowItemUuid(),
                filePath: varySlide.filePath,
                id: varySlide.id,
                ...(type === DragTypeEnum.LYRIC_SLIDE
                    ? { stage: (varySlide as any).stage ?? 0 }
                    : {}),
                title:
                    `${fileSource.name} #${varySlide.id}` +
                    (varySlide.name ? ` ${varySlide.name}` : ''),
            };
        }
        if (type === DragTypeEnum.APP_DOCUMENT) {
            const documentFilePath = item.filePath as string;
            return {
                type,
                uuid: genPresentingFlowItemUuid(),
                filePath: documentFilePath,
                data: documentFilePath,
                title: FileSource.getInstance(documentFilePath).name,
            };
        }
        const title = await toDroppedDataTitle(type, item, dragData);
        const extraStyle = await toDroppedExtraStyle(type, dragData);
        return {
            type,
            uuid: genPresentingFlowItemUuid(),
            data: dragData.data,
            title,
            extraStyle,
        };
    }

    /**
     * An action, as it is stored. Only the id travels — the label follows the
     * app's language and what the action does lives in code, so a presenting flow
     * written today keeps working when either changes — plus, for the run
     * family, whatever it was armed with, and for the two that must name their
     * screens, the pin they were added with.
     *
     * `screenIds` is written through the SAME field an ordinary pin uses, and an
     * empty one is left out rather than stored as `[]`: "not pinned" is the
     * absence of the key everywhere else (`PresentingFlow.setItemScreenIds`), so a
     * `Screen: Show` re-aimed from the row's own `Set Specific Screen` and one
     * added from the menu leave identical json.
     */
    static fromActionId(
        actionId: PresentingFlowActionIdType,
        arming: PresentingFlowActionArmingType = {},
        screenIds: number[] = [],
    ): PresentingFlowItemType {
        return {
            type: PRESENTING_FLOW_ACTION_TYPE,
            uuid: genPresentingFlowItemUuid(),
            data: actionId,
            ...arming,
            ...(screenIds.length > 0 ? { screenIds } : {}),
        };
    }

    /**
     * Whether this host's CC NAMES a line rather than following it.
     *
     * A `Jump to` is the one of those: its CC is a pointer at another line, so
     * what may be attached to it is not "what can ride to a screen" but "what is
     * in this run sheet" — a document above all, which is the thing an operator
     * most often wants to go back to and the one thing a follower may never be.
     *
     * Answered by the REGISTRY entry (`ccItemsAreTargets`), not by "is it a run
     * action": a `Keyboard Event` is one too, and its CCs are ordinary followers
     * that go to a screen — treating them as targets would let a document be
     * attached to one and then quietly drop it when the key was pressed.
     */
    static checkIsCcTargetHost(hostItemJson: PresentingFlowItemType) {
        if (hostItemJson.type !== PRESENTING_FLOW_ACTION_TYPE) {
            return false;
        }
        const action = findPresentingFlowAction(hostItemJson.data);
        return action?.target === 'run' && action.ccItemsAreTargets;
    }

    /**
     * Whether a FOLLOWER of this element may be armed with a clock of its own,
     * from json alone so the overlay can ask before anything is built.
     *
     * The three conditions are one sentence: it has to be a run action (a screen
     * action is not armed with anything), one that may follow a line at all
     * (`canBeCcItem`), and one armed with a NUMBER — which as things stand is the
     * `Next: Timeout` and nothing else. `Next: Clear Interval` is a follower too
     * and is armed with nothing, so there is no per-attachment answer to give;
     * a later clock that means something else by its number gets this for free.
     */
    static checkCanBeCcArmed(itemJson: PresentingFlowItemType) {
        if (itemJson.type !== PRESENTING_FLOW_ACTION_TYPE) {
            return false;
        }
        const action = findPresentingFlowAction(itemJson.data);
        return (
            action?.target === 'run' &&
            action.canBeCcItem &&
            action.number !== null
        );
    }

    /**
     * A listed element AS ITS FOLLOWERS SEE IT — what a CC row draws and what
     * rides to a screen when its host fires. Built fresh from the element every
     * time it is asked for, which is what makes a CC a reference: re-arm the
     * element and every CC of it is re-armed with it.
     *
     * Stripped of everything that belongs to being an ELEMENT rather than a
     * follower: its own CCs (so one level falls out rather than being enforced),
     * the per-slide maps that only mean something under a document row, and its
     * parked flag — a CC is never parked, so following a PARKED element gives a
     * follower that is in play, which is the only reading that makes sense: it
     * was attached deliberately, and the element stays parked. Its PIN is kept,
     * with the CC's own written over it by `buildCcItems`.
     *
     * Null for what cannot follow anything, which is also the gate every attach
     * path asks BEFORE appending anything: an error row has no payload, a
     * document is opened rather than shown, and audio is played from its own
     * panel — the same three `isShowableOnScreen` already refuses — plus the run
     * actions that say so themselves (`canBeCcItem`): a `Next: Timeout` IS worth
     * attaching to a line ("show this, go on by yourself ten seconds later"),
     * while an interval attached to a line nobody is watching would keep walking
     * the sheet forward with no input able to stop it.
     *
     * `isTarget` is the other kind of CC entirely — the one a `Jump to` is armed
     * with, which NAMES a line instead of following it (`checkIsCcTargetHost`).
     * Nothing is ever applied from it, so only an error row is refused.
     */
    static resolveCcItemJson(
        itemJson: PresentingFlowItemType,
        isTarget = false,
    ): PresentingFlowItemType | null {
        const {
            ccItems: _ccItems,
            slideCcItems: _slideCcItems,
            slideScreenIds: _slideScreenIds,
            disabledSlideIds: _disabledSlideIds,
            isDisabled: _isDisabled,
            // A media controller's settings belong to the ATTACHMENT, so the
            // element never legitimately has any — stripped so a hand-edited file
            // that put one there cannot become a second, invisible source of
            // settings competing with the CC's own.
            mediaControl: _mediaControl,
            ...ccJson
        } = cloneJson(itemJson) as PresentingFlowItemType;
        // An error row has no payload to copy either way — there is nothing to
        // ride to a screen and nothing to point at.
        if (ccJson.type === ERROR_TYPE) {
            return null;
        }
        // A TARGET only names a line; it is never applied to anything, so every
        // reason a follower is refused (it reaches no screen, or it would fire
        // on its own) simply does not arise. A document — which can never be a
        // follower — is exactly what a `Jump to` is usually aimed at.
        if (isTarget) {
            return ccJson;
        }
        if (
            ccJson.type === DragTypeEnum.APP_DOCUMENT ||
            ccJson.type === DragTypeEnum.BACKGROUND_AUDIO
        ) {
            return null;
        }
        if (ccJson.type === PRESENTING_FLOW_ACTION_TYPE) {
            const action = findPresentingFlowAction(ccJson.data);
            if (action?.target === 'run' && !action.canBeCcItem) {
                return null;
            }
        }
        return ccJson;
    }

    /**
     * Every CC reference an entry owns, host by host — the very objects, so a
     * caller that rewrites one rewrites the entry. What `PresentingFlow` walks to drop
     * the followers of an element being removed.
     */
    static readCcItemRefList(
        json: PresentingFlowItemType,
    ): PresentingFlowCcItemType[] {
        const ccItemRefList: PresentingFlowCcItemType[] = [];
        if (Array.isArray(json.ccItems)) {
            ccItemRefList.push(...json.ccItems);
        }
        const { slideCcItems } = json;
        if (slideCcItems !== null && typeof slideCcItems === 'object') {
            for (const list of Object.values(slideCcItems)) {
                if (Array.isArray(list)) {
                    ccItemRefList.push(...list);
                }
            }
        }
        return ccItemRefList;
    }

    static fromJson(filePath: string, json: PresentingFlowItemType) {
        this.validate(json);
        return new PresentingFlowItem(filePath, json);
    }

    static fromJsonError(filePath: string, json: AnyObjectType) {
        const item = new PresentingFlowItem(filePath, {
            type: ERROR_TYPE,
            // The uuid is carried over when the damaged entry still has a valid
            // one, so the error row keeps a stable React key across a reorder
            // like every healthy row. What is damaged is the entry's payload;
            // its identity usually survives.
            uuid: checkIsValidPresentingFlowItemUuid(json.uuid)
                ? json.uuid
                : undefined,
        });
        item.jsonError = json;
        return item;
    }

    toJson(): PresentingFlowItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return cloneJson(this.originalJson) as PresentingFlowItemType;
    }

    /**
     * Deliberately says NOTHING about `ccItems`/`slideCcItems`. A throw here
     * turns the WHOLE entry into an error row (`PresentingFlow.getItems`), and a
     * follower that cannot be read must never cost the operator the line it was
     * attached to — CCs are validated one at a time, on read, in `buildCcItems`.
     */
    static validate(json: AnyObjectType) {
        if (json.type === PRESENTING_FLOW_ACTION_TYPE) {
            // An id nothing answers to becomes an error row rather than a row
            // that quietly does nothing when the operator presses it mid-service.
            const action = findPresentingFlowAction(json.data);
            if (action === null) {
                loggerHelpers.appError(json);
                throw new Error('Invalid presenting flow action id');
            }
            // A run action armed with a NUMBER is that number — one carrying
            // none (or 0, or a hand-edited `-5`) would arm a clock that never
            // fires, so it is an error row for the same reason an unknown id is.
            // A valid TIME OF DAY counts instead of the number, for the one
            // action that may carry one: that entry has been armed, just not
            // with seconds. One armed with something ELSE is not checked here at
            // all — they all have `number === null`, so this whole test is
            // skipped. A `Jump to` with nothing attached yet, or a
            // `Keyboard Event` with no shortcut, is a line still being written,
            // and its own menu is the only way to finish it: an error row would
            // take that menu away.
            if (
                action.target === 'run' &&
                action.number !== null &&
                !(
                    action.canBeTimeArmed &&
                    checkIsValidPresentingFlowActionTime(json.actionTime)
                ) &&
                (typeof json.actionNumber !== 'number' ||
                    !Number.isFinite(json.actionNumber) ||
                    json.actionNumber <= 0)
            ) {
                loggerHelpers.appError(json);
                throw new Error('Invalid presenting flow action number');
            }
            return;
        }
        if (
            !acceptedDragTypeList.includes(json.type) ||
            (json.filePath !== undefined &&
                typeof json.filePath !== 'string') ||
            (json.id !== undefined && typeof json.id !== 'number') ||
            (slideDragTypeList.includes(json.type) &&
                (typeof json.filePath !== 'string' ||
                    typeof json.id !== 'number'))
        ) {
            loggerHelpers.appError(json);
            throw new Error('Invalid presenting flow item data');
        }
    }

    clone() {
        return PresentingFlowItem.fromJson(this.filePath, this.toJson());
    }
}

async function toDroppedDataTitle(
    type: DragTypeEnum,
    item: any,
    dragData: DragDataType<any>,
) {
    if (type === DragTypeEnum.BACKGROUND_COLOR) {
        return `${item}`;
    }
    if (type === DragTypeEnum.BACKGROUND_CAMERA) {
        return 'Camera';
    }
    if (
        backgroundDragTypeList.includes(type) ||
        type === DragTypeEnum.BACKGROUND_AUDIO
    ) {
        // Image/video/audio/web backgrounds deserialize to a `FileSource`, so
        // the name is read off it — re-instantiating from `src` would treat the
        // `file://` URL as a path and mangle the name.
        return item?.fullName ?? item?.src ?? `${type}`;
    }
    if (type === DragTypeEnum.BIBLE_ITEM) {
        const { bibleKey, target } = dragData.data ?? {};
        if (target === undefined) {
            return 'Bible Item';
        }
        const fullVerseTitle = await bibleRenderHelper.toTitle(
            bibleKey,
            target,
        );
        if (fullVerseTitle !== null) {
            return `(${bibleKey}) ${fullVerseTitle}`;
        }
        const verse =
            target.verseStart === target.verseEnd
                ? `${target.verseStart}`
                : `${target.verseStart}-${target.verseEnd}`;
        return `(${bibleKey}) ${target.bookKey} ${target.chapter}:${verse}`;
    }
    if (type === DragTypeEnum.FOREGROUND) {
        return toForegroundDragLabel(item);
    }
    return `${type}`;
}

async function toDroppedExtraStyle(
    type: DragTypeEnum,
    dragData: DragDataType<any>,
): Promise<CSSProperties> {
    if (type === DragTypeEnum.BIBLE_ITEM) {
        const fontFamily = await getBibleFontFamily(dragData.data?.bibleKey);
        return { fontFamily };
    }
    return {};
}
