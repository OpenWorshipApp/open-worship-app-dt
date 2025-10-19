import { createContext } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { closeCurrentEditingBibleItem } from './readBibleHelpers';
import { EventMapper } from '../event/KeyboardEventListener';
import {
    elementDivider,
    genContextMenuItemIcon,
    genContextMenuItemShortcutKey,
} from '../context-menu/AppContextMenuComp';
import BibleItemsViewController, {
    applyBibleItemHistoryPendingText,
    attemptAddingHistory,
    ReadIdOnlyBibleItem,
    splitHorizontalId,
    splitVerticalId,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import { setBibleLookupInputFocus } from '../bible-lookup/selectionHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    EditingResultType,
    extractBibleTitle,
} from '../helper/bible-helpers/serverBibleHelpers2';
import {
    bibleRenderHelper,
    BibleTargetType,
} from '../bible-list/bibleRenderHelpers';
import CacheManager from '../others/CacheManager';
import { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { genFoundBibleItemContextMenu } from '../bible-lookup/bibleActionHelpers';
import { setBibleSearchingTabType } from '../bible-find/BibleFindPreviewerComp';

export const closeEventMapper: EventMapper = {
    wControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    mControlKey: ['Meta'],
    key: 'w',
};

export const ctrlShiftMetaKeys: any = {
    wControlKey: ['Ctrl', 'Shift'],
    lControlKey: ['Ctrl', 'Shift'],
    mControlKey: ['Meta', 'Shift'],
};

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
    setInputText: (inputText: string) => OptionalPromise<void> = (
        _: string,
    ) => {};
    setBibleKey = (_bibleKey: string) => {};
    reloadEditingResult = (_inputText: string) => {};
    onLookupSaveBibleItem = () => {};
    setIsBibleSearching = (_isLookupOnline: boolean) => {};
    openBibleSearch = setBibleSearchingTabType;

    constructor() {
        super('lookup');
        if (this.straightBibleItems.length === 0) {
            const bibleItem = this.bibleItemFromJson({
                id: this.genBibleItemUniqueId(),
                bibleKey: 'KJV',
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
        setSetting(
            this.toSettingName('-selected-bible-item'),
            bibleItemId.toString(),
        );
        this.forceReloadEditingResult();
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
        this.fireUpdateEvent();
    }
    checkIsBibleItemSelected(bibleItem: ReadIdOnlyBibleItem) {
        return bibleItem.id === this.selectedBibleItem.id;
    }
    get selectedIndex() {
        return this.straightBibleItems.findIndex((bibleItem) => {
            return this.checkIsBibleItemSelected(bibleItem);
        });
    }
    protected syncTargetByColorNote(bibleItem: ReadIdOnlyBibleItem) {
        if (this.checkIsBibleItemSelected(bibleItem)) {
            this.getEditingResult().then(({ result }) => {
                if (result.bibleItem === null) {
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
        setSetting(this.toSettingName('-input-text'), inputText);
        this.setInputText(inputText);
        setBibleLookupInputFocus();
    }
    set inputText(inputText: string) {
        this._setInputText(inputText);
        this.syncTargetByColorNote(this.selectedBibleItem);
        extractBibleTitle(this.selectedBibleItem.bibleKey, inputText).then(
            async (editingResult) => {
                const { bibleKey, oldInputText } = editingResult;
                if (bibleKey !== this.selectedBibleItem.bibleKey) {
                    await this.setEditingData(
                        editingResult.bibleKey,
                        null,
                        true,
                    );
                }
                if (oldInputText !== this.inputText) {
                    this.inputText = oldInputText;
                }
            },
        );
    }

    async setLookupContentFromBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        applyBibleItemHistoryPendingText();
        this.applyTargetOrBibleKey(this.selectedBibleItem, bibleItem);
        this.inputText = await bibleItem.toTitle();
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
        const foundBibleItem = (await this.getEditingResult()).result.bibleItem;
        const oldSelectedBibleItem = this.selectedBibleItem;
        this.selectedBibleItem = bibleItem;
        if (foundBibleItem === null) {
            this.deleteBibleItem(oldSelectedBibleItem);
        } else {
            attemptAddingHistory(
                foundBibleItem.bibleKey,
                await foundBibleItem.toTitle(),
                true,
            );
            this.applyTargetOrBibleKey(oldSelectedBibleItem, foundBibleItem);
        }
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
        if (!isBibleItemSelected) {
            menus2.push({
                menuElement: 'Edit',
                title: 'Double click on header to edit',
                onSelect: () => {
                    this.editBibleItem(bibleItem);
                },
            });
        } else {
            const menu2IdMap: { [key: string]: ContextMenuItemType } =
                Object.fromEntries(
                    menus2.map((menuItem) => [menuItem.id, menuItem]),
                );
            if (menu2IdMap[splitHorizontalId]) {
                menu2IdMap[splitHorizontalId].childAfter =
                    genContextMenuItemShortcutKey({
                        ...ctrlShiftMetaKeys,
                        key: 's',
                    });
            }
            if (menu2IdMap[splitVerticalId]) {
                menu2IdMap[splitVerticalId].childAfter =
                    genContextMenuItemShortcutKey({
                        ...ctrlShiftMetaKeys,
                        key: 'v',
                    });
            }
        }
        const menu3: ContextMenuItemType[] = this.isAlone
            ? []
            : [
                  {
                      menuElement: elementDivider,
                  },
                  {
                      childBefore: genContextMenuItemIcon('x-lg', {
                          color: 'var(--bs-danger-text-emphasis)',
                      }),
                      menuElement: 'Close',
                      childAfter: isBibleItemSelected
                          ? genContextMenuItemShortcutKey(closeEventMapper)
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
                'Jumping Chapter',
                'Unable to find the target bible item',
            );
            return;
        }
        const nextTarget = await foundBibleItem.getJumpingChapter(isNext);
        if (nextTarget === null) {
            showSimpleToast(
                `Try ${isNext ? 'Next' : 'Previous'} Chapter`,
                `Unable to find ${isNext ? 'next' : 'previous'} chapter`,
            );
            return;
        }
        for (const element of document.querySelectorAll(`[data-scroll-on-next-chapter="1"]`)) {
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
    if (viewController instanceof LookupBibleItemController === false) {
        throw new Error(
            'useLookupBibleItemControllerContext must be used within a' +
                ' BibleItemViewControllerContext',
        );
    }
    return viewController;
}

export const EditingResultContext = createContext<EditingResultType | null>(
    null,
);
