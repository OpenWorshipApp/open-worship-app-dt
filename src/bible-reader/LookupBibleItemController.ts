import { createContext, use, type ReactNode } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { closeCurrentEditingBibleItem } from './readBibleHelpers';
import {
    elementDivider,
    genContextMenuItemShortcutKey,
} from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import BibleItemsViewController, {
    applyBibleItemHistoryPendingText,
    attemptAddingHistory,
    splitHorizontalId,
    splitVerticalId,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import { setBibleLookupInputFocus } from '../bible-lookup/selectionHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import type { EditingResultType } from '../helper/bible-helpers/bibleLogicHelpers2';
import {
    extractBibleTitle,
    getVersesCount,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import type { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import CacheManager from '../others/CacheManager';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { genFoundBibleItemContextMenu } from '../bible-lookup/bibleActionHelpers';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import { setBibleSearchingTabType } from '../bible-find/bibleFindHelpers';
import { tran } from '../lang/langHelpers';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';

import {
    closeEventMapper,
    ctrlShiftMetaKeys,
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
} from '../keyboard-shortcut/appShortcutMappers';

// Declared beside every other shortcut so Help -> Keyboard Shortcuts lists the
// keys this controller binds; re-exported for the existing callers.
export {
    closeEventMapper,
    ctrlShiftMetaKeys,
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
};

// One array for the registrations, so its identity never re-registers them.
export const splitEventMappers = [
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
];

class EditingBibleItem extends ReadIdOnlyBibleItem {
    get metadata() {
        throw new Error('metadata is not available on EditingBibleItem');
    }
    set metadata(_metadata: AnyObjectType) {
        throw new Error('metadata is not available on EditingBibleItem');
    }
    get target() {
        // target can be null while input text is invalid
        // should not be used
        throw new Error('target is not available on EditingBibleItem');
    }
    set target(_target: BibleTargetType) {
        throw new Error('target is not available on EditingBibleItem');
    }
}

class FoundBibleItem extends ReadIdOnlyBibleItem {
    get bibleKey() {
        return super.bibleKey;
    }
    set bibleKey(_bibleKey: string) {
        throw new Error('Read-only bibleKey');
    }
    get target() {
        return super.target;
    }
    set target(_target: BibleTargetType) {
        throw new Error('Read-only target');
    }
}

const editingResultCacher = new CacheManager<EditingResultType>(3);
class LookupBibleItemController extends BibleItemsViewController {
    isLookup = true;
    extraEditingActionButtons: ReactNode | null = null;
    setInputText: (inputText: string) => OptionalPromise<void> = (
        _: string,
    ) => {};
    inputTextTime: number = Date.now();
    setBibleKey = (_bibleKey: string) => {};
    reloadEditingResult = (_inputText: string) => {};
    onLookupSaveBibleItem = () => {};
    setIsAdvanceLookupOpened = (_isLookupOnline: boolean) => {};
    openBibleSearch = setBibleSearchingTabType;
    // What the box held when another view was selected. Until a result for
    // some other text is applied, a result that still answers it belongs to
    // the view selected BEFORE: it is looked up again for the new id the
    // moment the selection changes, while the box still holds the old text,
    // and `syncFoundBibleItem` stamps it with the new view's id. Shown as it
    // was, the newly selected view painted the previous one's passage until
    // its own title had been worked out and looked up (`toCurrentEditingResult`).
    private inputTextBeforeSelecting: string | null = null;

    constructor(settingNameSuffix = '') {
        super('lookup' + settingNameSuffix);
        if (this.straightBibleItems.length === 0) {
            const bibleItem = this.bibleItemFromJson({
                id: this.genBibleItemUniqueId(),
                bibleKey: BIBLE_KJV_KEY,
                metadata: {},
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 1,
                },
            });
            this.nestedBibleItems = [bibleItem];
        }
    }

    bibleItemFromJson(json: any): ReadIdOnlyBibleItem {
        if (json.id === this.getSavedBibleId()) {
            return EditingBibleItem.fromJson(json);
        }
        return super.bibleItemFromJson(json);
    }

    getSavedBibleId() {
        const settingId = getSetting(
            this.toSettingName('-selected-bible-item'),
        );
        const bibleItemId = settingId ? Number.parseInt(settingId) : -1;
        return bibleItemId;
    }

    forceReloadEditingResult() {
        editingResultCacher.clear();
        this.reloadEditingResult(this.inputText);
    }

    setSelectedBibleItem(bibleItemId: number) {
        if (bibleItemId !== this.getSavedBibleId()) {
            this.inputTextBeforeSelecting = this.inputText;
        }
        setSetting(
            this.toSettingName('-selected-bible-item'),
            bibleItemId.toString(),
        );
        this.forceReloadEditingResult();
    }

    /**
     * The open bible items with the editing one — whose `target` deliberately
     * throws — swapped for whatever the lookup input currently resolves to.
     *
     * Synchronous, so a consumer already holding the editing result (through
     * `EditingResultContext`) can use it during render instead of awaiting a
     * lookup it has in hand.
     */
    resolveStraightBibleItems(foundBibleItem: ReadIdOnlyBibleItem | null) {
        // The editing pane is known by its ID, not by its class.
        // `EditingBibleItem` is stamped only when the tree is re-parsed from
        // the setting (`bibleItemFromJson`); a split or a retarget rebuilds
        // the tree from the instances the caller held, after which the
        // editing pane is a plain item carrying the target it had when it was
        // LAST selected, not what the input resolves to now. Seen live: the
        // input on Genesis 29, the pane's stored Genesis 27 in the list, and
        // that deduped away against the pane it had been split from.
        const selectedId = this.selectedBibleItem.id;
        return this.straightBibleItems
            .map((bibleItem) => {
                if (
                    bibleItem instanceof EditingBibleItem ||
                    bibleItem.id === selectedId
                ) {
                    return foundBibleItem;
                }
                return bibleItem;
            })
            .filter((bibleItem): bibleItem is ReadIdOnlyBibleItem => {
                return bibleItem !== null;
            });
    }

    async getStraightBibleItemsForExportingMSWord() {
        const editingResult = await this.getEditingResult();
        return this.resolveStraightBibleItems(editingResult.result.bibleItem);
    }

    get selectedBibleItem() {
        const bibleItemId = this.getSavedBibleId();
        if (bibleItemId !== -1) {
            const bibleItem = this.straightBibleItems.find((bibleItem) => {
                return bibleItem.id === bibleItemId;
            });
            if (bibleItem !== undefined) {
                return EditingBibleItem.fromJson(bibleItem.toJson());
            }
        }
        this.selectedBibleItem = this.straightBibleItems[0];
        return this.selectedBibleItem;
    }

    set selectedBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        this.setSelectedBibleItem(bibleItem.id);
        this.applyTargetOrBibleKey(this.selectedBibleItem, bibleItem);
        this._loadNestedBibleItemsFromSetting();
        this.fireUpdateEvent();
    }

    // Called with every result the lookup is about to show.
    settleEditingResult(editingResult: EditingResultType) {
        if (
            this.inputTextBeforeSelecting !== null &&
            editingResult.oldInputText !== this.inputTextBeforeSelecting
        ) {
            this.inputTextBeforeSelecting = null;
        }
    }

    /**
     * The result the selected view should show: the one given, unless it
     * still answers the text the box held for the view selected before --
     * then the selected view's own passage, which is what the box is about
     * to be set to.
     */
    toCurrentEditingResult(
        editingResult: EditingResultType | null,
    ): EditingResultType | null {
        if (
            editingResult === null ||
            this.inputTextBeforeSelecting === null ||
            editingResult.oldInputText !== this.inputTextBeforeSelecting
        ) {
            return editingResult;
        }
        // `toJson`, not `target`: the selected item is an
        // `EditingBibleItem`, whose `target` throws.
        const selectedJson = this.selectedBibleItem.toJson();
        const foundBibleItem = editingResult.result.bibleItem;
        // Two views titled alike: the result already is this view's passage,
        // with any further ranges it carries, so it stands as it is.
        const selectedTarget = selectedJson.target;
        if (
            foundBibleItem !== null &&
            foundBibleItem.bibleKey === selectedJson.bibleKey &&
            foundBibleItem.target.bookKey === selectedTarget.bookKey &&
            foundBibleItem.target.chapter === selectedTarget.chapter &&
            foundBibleItem.target.verseStart === selectedTarget.verseStart &&
            foundBibleItem.target.verseEnd === selectedTarget.verseEnd
        ) {
            return editingResult;
        }
        return {
            ...editingResult,
            bibleKey: selectedJson.bibleKey,
            result: {
                ...editingResult.result,
                bookKey: selectedJson.target.bookKey,
                chapter: selectedJson.target.chapter,
                bibleItem: FoundBibleItem.fromJson(selectedJson),
                extraBibleItems: undefined,
            },
        };
    }

    checkIsBibleItemSelected(bibleItem: ReadIdOnlyBibleItem) {
        // Asked once per view on every render of the views: the saved id
        // answers it, without building the selected item each time. Only a
        // saved id no view carries goes through the getter, which selects
        // the first view.
        const savedId = this.getSavedBibleId();
        if (
            savedId !== -1 &&
            this.straightBibleItems.some((item) => {
                return item.id === savedId;
            })
        ) {
            return bibleItem.id === savedId;
        }
        return bibleItem.id === this.selectedBibleItem.id;
    }

    get selectedIndex() {
        return this.straightBibleItems.findIndex((bibleItem) => {
            return this.checkIsBibleItemSelected(bibleItem);
        });
    }

    protected syncTargetByColorNote(bibleItem: ReadIdOnlyBibleItem) {
        if (this.checkIsBibleItemSelected(bibleItem)) {
            const inputText = this.inputText;
            this.getEditingResult(inputText).then(({ result }) => {
                // Only while the box still holds the text this answered. Every
                // keystroke is looked up and the lookups finish in any order:
                // a slow `Mark 4:3` landing after `Mark 4:39` left every pane
                // in the colour group on verse 3 beside the box's verse 39.
                if (result.bibleItem === null || inputText !== this.inputText) {
                    return;
                }
                super.syncTargetByColorNote(result.bibleItem);
            });
            return;
        }
        super.syncTargetByColorNote(bibleItem);
    }

    setColorNote(bibleItem: ReadIdOnlyBibleItem, color: string | null) {
        super._setColorNote(bibleItem, color);
        const selectedColorNote = this.getColorNote(this.selectedBibleItem);
        const currentColorNote = this.getColorNote(bibleItem);
        const isSameWithSelected =
            selectedColorNote && selectedColorNote === currentColorNote;
        if (isSameWithSelected) {
            this.syncTargetByColorNote(this.selectedBibleItem);
        } else {
            this.syncTargetByColorNote(bibleItem);
        }
    }

    get inputText() {
        return getSetting(this.toSettingName('-input-text')) ?? '';
    }

    _setInputText(inputText: string) {
        this.inputTextTime = Date.now();
        setSetting(this.toSettingName('-input-text'), inputText);
        this.setInputText(inputText);
        setBibleLookupInputFocus();
    }

    set inputText(inputText: string) {
        this._setInputText(inputText);
        this.syncTargetByColorNote(this.selectedBibleItem);
        extractBibleTitle(
            this.selectedBibleItem.bibleKey,
            inputText,
            this.inputTextTime,
        ).then(async (editingResult) => {
            const { bibleKey, oldInputText } = editingResult;
            if (bibleKey !== this.selectedBibleItem.bibleKey) {
                await this.setEditingData(editingResult.bibleKey, null, true);
            }
            // Only while the box still holds the text this answered. The guard
            // was the `Date.now()` stamp, which two keystrokes inside one
            // millisecond share -- scripted typing does it -- so the answer to
            // a half-typed `Genesis 1:1-3` landing after the full reference
            // wrote the box back to it.
            if (inputText === this.inputText && oldInputText !== inputText) {
                this.inputText = oldInputText;
            }
        });
    }

    async setLookupContentFromBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        applyBibleItemHistoryPendingText();
        this.applyTargetOrBibleKey(this.selectedBibleItem, bibleItem);
    }

    private syncFoundBibleItem(editingResult: EditingResultType) {
        const bibleItem = editingResult.result.bibleItem;
        if (bibleItem !== null) {
            const newBibleItem = ReadIdOnlyBibleItem.fromJson({
                ...bibleItem.toJson(),
                id: this.selectedBibleItem.id,
            });
            editingResult.result.bibleItem = newBibleItem;
        }
        return { ...editingResult };
    }

    async getEditingResult(inputText?: string) {
        inputText = inputText ?? this.inputText;
        const cachedKey = `${this.selectedBibleItem.bibleKey}-${inputText}`;
        return unlocking(cachedKey, async () => {
            const cachedEditingResult =
                await editingResultCacher.get(cachedKey);
            if (cachedEditingResult !== null) {
                return this.syncFoundBibleItem(cachedEditingResult);
            }
            const editingResult = await extractBibleTitle(
                this.selectedBibleItem.bibleKey,
                inputText,
            );
            if (editingResult.result.bibleItem !== null) {
                const newFoundBibleItem = (editingResult.result.bibleItem =
                    FoundBibleItem.fromJson({
                        ...editingResult.result.bibleItem.toJson(),
                        extraBibleKeys: this.selectedBibleItem.extraBibleKeys,
                        isAudioEnabled: this.selectedBibleItem.isAudioEnabled,
                    }));
                newFoundBibleItem.toTitle().then((title) => {
                    // Only a passage the box still holds. Every keystroke is
                    // looked up, and the lookups finish in any order, so the
                    // half-typed `Genesis 1:1-3` of a fast `Genesis 1:1-31`
                    // could be the last to land and became the history entry.
                    if (inputText !== this.inputText) {
                        return;
                    }
                    attemptAddingHistory(newFoundBibleItem.bibleKey, title);
                });
            }
            await editingResultCacher.set(cachedKey, editingResult);
            return this.syncFoundBibleItem(editingResult);
        });
    }

    private async setEditingData(
        bibleKey: string | null,
        target: BibleTargetType | null,
        isSkipColorSync: boolean,
    ) {
        const editingResult = await this.getEditingResult();
        const foundBibleItem = editingResult.result.bibleItem;
        if (target === null && foundBibleItem !== null) {
            target = foundBibleItem.target;
        }
        const selectedBibleItem = this.selectedBibleItem;
        if (bibleKey !== null) {
            super.applyTargetOrBibleKey(
                selectedBibleItem,
                {
                    bibleKey,
                },
                isSkipColorSync,
            );
            this.setBibleKey(bibleKey);
        }
        if (target !== null) {
            const inputText = await bibleRenderHelper.toTitle(
                selectedBibleItem.bibleKey,
                target,
            );
            if (isSkipColorSync) {
                this._setInputText(inputText);
            } else {
                this.inputText = inputText;
            }
        }
    }

    applyTargetOrBibleKey(
        bibleItem: ReadIdOnlyBibleItem,
        {
            target,
            bibleKey,
            extraBibleKeys,
            isAudioEnabled,
        }: {
            target?: BibleTargetType;
            bibleKey?: string;
            extraBibleKeys?: string[];
            isAudioEnabled?: boolean;
        },
        isSkipColorSync = false,
    ) {
        if (extraBibleKeys !== undefined || isAudioEnabled !== undefined) {
            super.applyTargetOrBibleKey(
                bibleItem,
                { extraBibleKeys, isAudioEnabled },
                isSkipColorSync,
            );
            this.forceReloadEditingResult();
        }
        if (this.checkIsBibleItemSelected(bibleItem)) {
            this.setEditingData(
                bibleKey ?? null,
                target ?? null,
                isSkipColorSync,
            );
            return;
        }
        super.applyTargetOrBibleKey(
            bibleItem,
            {
                bibleKey,
                target,
                extraBibleKeys,
            },
            isSkipColorSync,
        );
    }

    async editBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        if (this.checkIsBibleItemSelected(bibleItem)) {
            return;
        }
        const { result } = await this.getEditingResult();
        // Worked out BEFORE the selection moves: awaited between the move and
        // writing the passage into the view left behind, it let that view
        // render once with the passage it had when it was selected -- its
        // title flicked back to it for a moment.
        const foundTitle =
            result.bibleItem === null ? null : await result.bibleItem.toTitle();
        // A view left on its book or chapter grid has no passage to keep. It
        // used to be closed; it stays, on the picked book's chapter 1, or
        // Genesis 1 before a book is picked -- what a split from the grid
        // opens. Not a lookup, so no history entry.
        const passageBibleItem =
            result.bibleItem ??
            (await this.genFirstChapterBibleItem(result.bookKey));
        const oldSelectedBibleItem = this.selectedBibleItem;
        this.selectedBibleItem = bibleItem;
        this.applyTargetOrBibleKey(oldSelectedBibleItem, passageBibleItem);
        if (foundTitle !== null) {
            attemptAddingHistory(passageBibleItem.bibleKey, foundTitle, true);
        }
    }

    /**
     * A passage for the selected view while it shows the book or chapter
     * grid, where there is no passage to copy -- for a split made from it,
     * and for the view itself when the editing moves away from it: the
     * picked book's chapter 1, or Genesis 1 before a book is picked. The
     * whole chapter, as typing `Genesis 1:` shows it.
     */
    async genFirstChapterBibleItem(bookKey: string | null, bibleKey?: string) {
        // `toJson`, not `target`: the selected item is an `EditingBibleItem`,
        // whose `target` throws. The version, extra versions and audio come
        // with it.
        const json = this.selectedBibleItem.toJson();
        const targetBibleKey = bibleKey ?? json.bibleKey;
        const targetBookKey = bookKey ?? 'GEN';
        const verseCount = await getVersesCount(
            targetBibleKey,
            targetBookKey,
            1,
        );
        return ReadIdOnlyBibleItem.fromJson({
            ...json,
            bibleKey: targetBibleKey,
            target: {
                bookKey: targetBookKey,
                chapter: 1,
                verseStart: 1,
                verseEnd: verseCount ?? 1,
            },
        });
    }

    /**
     * Split the selected view while it has no passage yet. The new view takes
     * `genFirstChapterBibleItem`; the selected one stays selected, still on
     * its grid -- the same source a Shift+click on a history entry splits.
     */
    async splitWithoutPassage(
        bookKey: string | null,
        isHorizontal: boolean,
        bibleKey?: string,
    ) {
        const newBibleItem = await this.genFirstChapterBibleItem(
            bookKey,
            bibleKey,
        );
        const selectedBibleItem = this.selectedBibleItem;
        if (isHorizontal) {
            this.addBibleItemLeft(selectedBibleItem, newBibleItem);
        } else {
            this.addBibleItemBottom(selectedBibleItem, newBibleItem);
        }
    }

    private applySplitShortcutKeys(menuItems: ContextMenuItemType[]) {
        for (const menuItem of menuItems) {
            if (menuItem.id === splitHorizontalId) {
                menuItem.childAfter = genContextMenuItemShortcutKey(
                    splitHorizontalEventMapper,
                );
            } else if (menuItem.id === splitVerticalId) {
                menuItem.childAfter = genContextMenuItemShortcutKey(
                    splitVerticalEventMapper,
                );
            }
        }
    }

    private genCloseContextMenu(
        bibleItem: ReadIdOnlyBibleItem,
        isBibleItemSelected: boolean,
    ): ContextMenuItemType[] {
        if (this.isAlone) {
            return [];
        }
        return [
            {
                menuElement: elementDivider,
            },
            {
                childBefore: genContextMenuItemIcon('x-lg', {
                    color: 'var(--bs-danger-text-emphasis)',
                }),
                menuElement: tran('Close'),
                keyboardShortcut: isBibleItemSelected
                    ? closeEventMapper
                    : undefined,
                onSelect: () => {
                    if (this.checkIsBibleItemSelected(bibleItem)) {
                        closeCurrentEditingBibleItem(this);
                    } else {
                        this.deleteBibleItem(bibleItem);
                    }
                },
            },
        ];
    }

    /**
     * The menu of the selected view while it shows the book or chapter grid:
     * only what needs no passage -- the splits, full view and close.
     */
    genNoPassageContextMenu(
        bookKey: string | null,
        uuid: string,
    ): ContextMenuItemType[] {
        const splitMenuItems = this.genSplitContextMenu(
            (isHorizontal, newBibleKey) => {
                this.splitWithoutPassage(
                    bookKey,
                    isHorizontal,
                    newBibleKey ?? undefined,
                );
            },
        );
        this.applySplitShortcutKeys(splitMenuItems);
        return [
            ...splitMenuItems,
            this.genFullViewContextMenuItem(uuid),
            ...this.genCloseContextMenu(this.selectedBibleItem, true),
        ];
    }

    async genContextMenu(
        event: any,
        bibleItem: ReadIdOnlyBibleItem,
        uuid: string,
    ): Promise<ContextMenuItemType[]> {
        const isBibleItemSelected = this.checkIsBibleItemSelected(bibleItem);
        const menu1 = genFoundBibleItemContextMenu(
            event,
            this,
            bibleItem,
            isBibleItemSelected,
        );
        const menus2 = await super.genContextMenu(event, bibleItem, uuid);
        if (isBibleItemSelected) {
            this.applySplitShortcutKeys(menus2);
        } else {
            menus2.push({
                childBefore: genContextMenuItemIcon('pencil-square'),
                menuElement: tran('Edit'),
                title: tran('Double click on header to edit'),
                onSelect: () => {
                    this.editBibleItem(bibleItem);
                },
            });
        }
        const menu3 = this.genCloseContextMenu(bibleItem, isBibleItemSelected);
        return [...menu1, ...menus2, ...menu3];
    }

    deleteBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        if (this.isAlone) {
            return;
        }
        super.deleteBibleItem(bibleItem);
    }

    async tryJumpingChapter(isNext: boolean) {
        const editingResult = await this.getEditingResult();
        const foundBibleItem = editingResult.result.bibleItem;
        if (foundBibleItem === null) {
            showSimpleToast(
                tran('Jumping Chapter'),
                tran('Unable to find the target bible item'),
            );
            return;
        }
        const nextTarget = await foundBibleItem.getJumpingChapter(isNext);
        if (nextTarget === null) {
            showSimpleToast(
                isNext
                    ? tran('Try Next Chapter')
                    : tran('Try Previous Chapter'),
                isNext
                    ? tran('Unable to find next chapter')
                    : tran('Unable to find previous chapter'),
            );
            return;
        }
        for (const element of document.querySelectorAll(
            `[data-scroll-on-next-chapter="1"]`,
        )) {
            (element as HTMLElement).scrollTop = 0;
        }
        const newFoundBibleItem = ReadIdOnlyBibleItem.fromJson(
            foundBibleItem.toJson(),
        );
        newFoundBibleItem.target = nextTarget;
        const title = await newFoundBibleItem.toTitle();
        this.inputText = title;
    }
}
export default LookupBibleItemController;

export function useLookupBibleItemControllerContext() {
    const viewController = useBibleItemsViewControllerContext();
    if (!viewController.isLookup) {
        throw new TypeError(
            'useLookupBibleItemControllerContext must be used within a' +
                ' BibleItemViewControllerContext',
        );
    }
    return viewController as LookupBibleItemController;
}

// The window's live lookup controller, reachable WITHOUT React context.
//
// The names & locations detail panels are window-level floating widgets (they
// are opened by clicking a name in any verse, from trees that have no lookup
// controller of their own), but one of their actions — "open in bible lookup" —
// genuinely needs the controller. Rather than force the panels to live inside a
// provider, the provider publishes itself here for as long as it is mounted.
let currentLookupBibleItemController: LookupBibleItemController | null = null;

export function registerLookupBibleItemController(
    viewController: LookupBibleItemController,
) {
    currentLookupBibleItemController = viewController;
    return () => {
        if (currentLookupBibleItemController === viewController) {
            currentLookupBibleItemController = null;
        }
    };
}

export function getCurrentLookupBibleItemController() {
    return currentLookupBibleItemController;
}

export const EditingResultContext = createContext<EditingResultType | null>(
    null,
);

/**
 * The lookup result as the bible views should show it. The provider does not
 * re-render when another view is selected; the views do, so the check that a
 * result belongs to the view selected before runs here.
 */
export function useEditingResult() {
    const editingResult = use(EditingResultContext);
    const viewController = useBibleItemsViewControllerContext();
    if (!(viewController instanceof LookupBibleItemController)) {
        return editingResult;
    }
    return viewController.toCurrentEditingResult(editingResult);
}
