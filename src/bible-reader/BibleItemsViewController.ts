import { ReactNode, createContext, use, useState } from 'react';

import { tran } from '../lang/langHelpers';
import EventHandler from '../event/EventHandler';
import { useAppEffect } from '../helper/debuggerHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { handleError } from '../helper/errorHelpers';
import { BibleItemType } from '../bible-list/bibleItemHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showBibleOption } from '../bible-lookup/BibleSelectionComp';
import appProvider from '../server/appProvider';
import {
    APP_FULL_VIEW_CLASSNAME,
    bringDomToCenterView,
    bringDomToNearestView,
    bringDomToTopView,
    genTimeoutAttempt,
} from '../helper/helpers';
import {
    BIBLE_VIEW_TEXT_CLASS,
    VERSE_TEXT_CLASS,
} from '../helper/bibleViewHelpers';
import {
    getLangDataFromBibleKey,
    getShouldModelNewLine,
    setShouldModelNewLine,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import {
    elementDivider,
    genContextMenuItemIcon,
} from '../context-menu/AppContextMenuComp';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import {
    checkIsVerseAtBottom,
    checkIsVersePartialInvisible,
} from './readBibleScrollHelpers';

export type UpdateEventType = 'update';
export const RESIZE_SETTING_NAME = 'bible-previewer-render';

export type NestedBibleItemsType = ReadIdOnlyBibleItem | NestedBibleItemsType[];
export type NestedObjectsType = BibleItemType | NestedObjectsType[];

export const splitHorizontalId = 'split-horizontal';
export const splitVerticalId = 'split-vertical';

export const bibleHistoryStore: {
    addBibleItemHistory: (text: string) => void;
} = {
    addBibleItemHistory: (_text: string) => {},
};
const attemptTimeout = genTimeoutAttempt(4e3, true);
let pendingText = '';
export function applyBibleItemHistoryPendingText() {
    if (!pendingText) {
        return;
    }
    bibleHistoryStore.addBibleItemHistory(pendingText);
    pendingText = '';
}
export function attemptAddingHistory(
    bibleKey: string,
    text: string,
    isImmediate = false,
) {
    pendingText = `(${bibleKey}) ${text}`;
    if (isImmediate) {
        applyBibleItemHistoryPendingText();
        return;
    }
    attemptTimeout(() => {
        applyBibleItemHistoryPendingText();
    });
}

function toStraightItems(
    nestedBibleItems: NestedBibleItemsType,
): ReadIdOnlyBibleItem[] {
    const traverse = (items: any): any => {
        if (Array.isArray(items)) {
            return items.flatMap((item) => {
                return traverse(item);
            });
        }
        return [items];
    };
    const allBibleItems: ReadIdOnlyBibleItem[] = traverse(nestedBibleItems);
    return allBibleItems;
}

function deepSanitizeNestedItems(nestedBibleItems: NestedBibleItemsType): {
    nestedBibleItems: NestedBibleItemsType;
    isFoundError: boolean;
} {
    let isFoundError = false;
    if (Array.isArray(nestedBibleItems)) {
        if (
            nestedBibleItems.length === 1 &&
            nestedBibleItems[0] instanceof ReadIdOnlyBibleItem
        ) {
            return {
                nestedBibleItems: nestedBibleItems[0],
                isFoundError: true,
            };
        }
        nestedBibleItems = nestedBibleItems
            .map((item) => {
                const sanitized = deepSanitizeNestedItems(item);
                if (sanitized.isFoundError) {
                    isFoundError = true;
                }
                return sanitized.nestedBibleItems;
            })
            .filter((item1) => {
                if (Array.isArray(item1) && item1.length === 0) {
                    isFoundError = true;
                    return false;
                }
                return true;
            });
    }
    return { nestedBibleItems, isFoundError };
}

export function sanitizeNestedItems(nestedBibleItems: NestedBibleItemsType) {
    while (true) {
        const sanitized = deepSanitizeNestedItems(nestedBibleItems);
        if (sanitized.isFoundError) {
            nestedBibleItems = sanitized.nestedBibleItems;
            continue;
        }
        break;
    }
    if (nestedBibleItems instanceof ReadIdOnlyBibleItem) {
        nestedBibleItems = [nestedBibleItems];
    }
    return [...nestedBibleItems];
}

export function stringifyNestedBibleItem(
    nestedBibleItems: NestedBibleItemsType,
): NestedObjectsType {
    if (Array.isArray(nestedBibleItems)) {
        return nestedBibleItems.map((item1) => {
            return stringifyNestedBibleItem(item1);
        });
    }
    return nestedBibleItems.toJson();
}

function checkIsIdentical(
    nestedBibleItem1: NestedBibleItemsType,
    nestedBibleItem2: NestedBibleItemsType | number,
) {
    if (Array.isArray(nestedBibleItem1)) {
        if (!Array.isArray(nestedBibleItem2)) {
            return false;
        }
        if (nestedBibleItem1.length !== nestedBibleItem2.length) {
            return false;
        }
        for (let i = 0; i < nestedBibleItem1.length; i++) {
            if (!checkIsIdentical(nestedBibleItem1[i], nestedBibleItem2[i])) {
                return false;
            }
        }
        return true;
    }
    if (Array.isArray(nestedBibleItem2)) {
        return false;
    }
    return nestedBibleItem1.checkIsSameId(nestedBibleItem2);
}
function checkIsIndexGTZero(index: number) {
    return index > 0;
}
function checkIsIndexLTLengthM1(index: number, length: number) {
    return index < length - 1;
}

function seekParent(
    nestedBibleItems: NestedBibleItemsType,
    targetNestedBibleItemOrId: NestedBibleItemsType | number,
    isHorizontal: boolean = true,
): {
    parentNestedBibleItems: NestedBibleItemsType[];
    isHorizontal: boolean;
    targetNestedBibleItem: NestedBibleItemsType;
} | null {
    if (Array.isArray(nestedBibleItems)) {
        for (const nestedBibleItem of nestedBibleItems) {
            if (checkIsIdentical(nestedBibleItem, targetNestedBibleItemOrId)) {
                return {
                    parentNestedBibleItems: nestedBibleItems,
                    isHorizontal,
                    targetNestedBibleItem: nestedBibleItem,
                };
            } else if (Array.isArray(nestedBibleItem)) {
                const foundParent = seekParent(
                    nestedBibleItem,
                    targetNestedBibleItemOrId,
                    !isHorizontal,
                );
                if (foundParent !== null) {
                    return foundParent;
                }
            }
        }
    }
    return null;
}
function getFirstBibleItemAtIndex(
    nestedBibleItems: NestedBibleItemsType,
    index: number,
    isOrientation: boolean,
    isGoBack: boolean,
): ReadIdOnlyBibleItem | null {
    if (Array.isArray(nestedBibleItems)) {
        if (index < 0) {
            index = nestedBibleItems.length - 1;
        } else if (index >= nestedBibleItems.length) {
            index = 0;
        }
        const target = nestedBibleItems[index];
        if (target instanceof ReadIdOnlyBibleItem) {
            return target;
        } else {
            return getFirstBibleItemAtIndex(
                target,
                isOrientation ? 0 : target.length - 1,
                isGoBack ? !isOrientation : isOrientation,
                isGoBack,
            );
        }
    }
    return null;
}

const movingPosition: { [key: string]: [boolean, boolean] } = {
    // [isHorizontal, isGoBack]
    left: [true, true],
    right: [true, false],
    top: [false, true],
    bottom: [false, false],
};
export type MovingPositionType = keyof typeof movingPosition;

const BIBLE_ITEMS_PREVIEW_SETTING = 'bible-items-preview';
class BibleItemsViewController extends EventHandler<UpdateEventType> {
    isLookup = true;
    shouldSelectFirstItem = false;
    private readonly _settingNameSuffix: string;
    setBibleVerseKey = (_verseKey: string) => {};
    handleScreenBibleVersesHighlighting = (
        _verseKey: string,
        _isToTop: boolean,
    ) => {};
    constructor(settingNameSuffix: string) {
        super();
        this._settingNameSuffix = `-${settingNameSuffix}`;
    }
    get colorNoteMap() {
        const str = getSetting(this.toSettingName('bible-items-color-note'));
        try {
            if (str) {
                return JSON.parse(str);
            }
        } catch (error) {
            handleError(error);
        }
        return {};
    }
    set colorNoteMap(newColorNoteMap: { [key: number]: string }) {
        const json = JSON.stringify(newColorNoteMap);
        setSetting(this.toSettingName('bible-items-color-note'), json);
    }
    get shouldNewLine() {
        return getSetting(this.toSettingName('-view-new-line')) !== 'false';
    }
    set shouldNewLine(shouldNewLine: boolean) {
        setSetting(
            this.toSettingName('-view-new-line'),
            shouldNewLine ? 'true' : 'false',
        );
        this.fireUpdateEvent();
    }
    get shouldModelNewLine() {
        if (!this.shouldNewLine) {
            return false;
        }
        return getShouldModelNewLine();
    }
    set shouldModelNewLine(shouldModelNewLine: boolean) {
        setShouldModelNewLine(shouldModelNewLine);
        this.fireUpdateEvent();
    }

    get bibleCrossReferenceVerseKey() {
        const verseKey =
            getSetting(this.toSettingName('-bible-verse-key')) ?? '';
        // (KJV) GEN 1:2-3
        if (verseKey?.startsWith('(')) {
            return verseKey;
        }
        return '';
    }
    set bibleCrossReferenceVerseKey(bibleVerseKey: string) {
        setSetting(this.toSettingName('-bible-verse-key'), bibleVerseKey);
        this.setBibleVerseKey(bibleVerseKey);
    }

    bibleItemFromJson(json: any): ReadIdOnlyBibleItem {
        return ReadIdOnlyBibleItem.fromJson(json);
    }
    parseNestedBibleItem(json: any): NestedBibleItemsType {
        if (Array.isArray(json)) {
            const nestedBibleItems: NestedBibleItemsType = json.map(
                (item: any) => {
                    return this.parseNestedBibleItem(item);
                },
            );
            const straightBibleItems = toStraightItems(nestedBibleItems);
            const allIds = straightBibleItems.map((item) => {
                return item.id;
            });
            if (
                allIds.length !==
                new Set(
                    allIds.filter((id) => {
                        return id !== -1;
                    }),
                ).size
            ) {
                throw new Error('Duplicate ReadOnlyBibleItem ID found');
            }
            return nestedBibleItems;
        }
        return this.bibleItemFromJson(json);
    }
    get nestedBibleItems() {
        try {
            const jsonStr = getSetting(this.toSettingName('-data')) || '[]';
            const json = JSON.parse(jsonStr);
            return this.parseNestedBibleItem(json);
        } catch (error) {
            handleError(error);
        }
        setSetting(this.toSettingName('-data'), '[]');
        return [];
    }
    set nestedBibleItems(newNestedBibleItems: NestedBibleItemsType) {
        newNestedBibleItems = sanitizeNestedItems(newNestedBibleItems);
        const jsonStr = JSON.stringify(
            stringifyNestedBibleItem(newNestedBibleItems),
        );
        setSetting(this.toSettingName('-data'), jsonStr);
        this.fireUpdateEvent();
    }
    get straightBibleItems() {
        return toStraightItems(this.nestedBibleItems);
    }
    get isAlone() {
        return this.straightBibleItems.length < 2;
    }
    getColorNote(bibleItem: ReadIdOnlyBibleItem) {
        return this.colorNoteMap[bibleItem.id] ?? '';
    }
    _setColorNote(bibleItem: ReadIdOnlyBibleItem, color: string | null) {
        const colorNoteMap = this.colorNoteMap;
        if (color === null || color === '') {
            delete colorNoteMap[bibleItem.id];
        } else {
            colorNoteMap[bibleItem.id] = color;
        }
        const allBibleItemIds = new Set(
            this.straightBibleItems.map((item) => {
                return item.id.toString();
            }),
        );
        for (const id in colorNoteMap) {
            if (!allBibleItemIds.has(id)) {
                delete colorNoteMap[id];
            }
        }
        this.colorNoteMap = colorNoteMap;
    }
    setColorNote(bibleItem: ReadIdOnlyBibleItem, color: string | null) {
        this._setColorNote(bibleItem, color);
        this.syncTargetByColorNote(bibleItem);
    }
    getBibleItemsByColorNote(colorNote: string) {
        if (!colorNote) {
            return [];
        }
        const allBibleItems = this.straightBibleItems;
        return allBibleItems.filter((bibleItem) => {
            return this.getColorNote(bibleItem) === colorNote;
        });
    }
    toSettingName(suffixSettingName: string) {
        return `${BIBLE_ITEMS_PREVIEW_SETTING}${this._settingNameSuffix}${suffixSettingName}`;
    }

    finalRenderer(_bibleItem: ReadIdOnlyBibleItem): ReactNode {
        throw new Error(
            'Method not implemented. You need to implement finalRenderer method',
        );
    }

    genBibleItemUniqueId() {
        return Date.now() + Math.round(Math.random() * 1e6);
    }

    fireUpdateEvent() {
        this.addPropEvent('update');
    }
    getNeighborBibleItems(
        bibleItem: ReadIdOnlyBibleItem,
        positions: MovingPositionType[],
    ): {
        left: ReadIdOnlyBibleItem | null;
        right: ReadIdOnlyBibleItem | null;
        top: ReadIdOnlyBibleItem | null;
        bottom: ReadIdOnlyBibleItem | null;
    } {
        const seekNeighbor = (
            nestedBibleItems: NestedBibleItemsType,
            targetNestedBibleItem: NestedBibleItemsType,
            position: MovingPositionType,
        ): ReadIdOnlyBibleItem | null => {
            if (!positions.includes(position)) {
                return null;
            }
            const [isHorizontal, isGoBack] = movingPosition[position];
            const found = seekParent(nestedBibleItems, targetNestedBibleItem);
            if (found === null) {
                return null;
            }
            const index = found.parentNestedBibleItems.indexOf(
                found.targetNestedBibleItem,
            );
            const isOrientation = found.isHorizontal === isHorizontal;
            const isMatchIndex = isGoBack
                ? checkIsIndexGTZero(index)
                : checkIsIndexLTLengthM1(
                      index,
                      found.parentNestedBibleItems.length,
                  );
            if (!(isOrientation && isMatchIndex)) {
                const found1 = seekNeighbor(
                    nestedBibleItems,
                    found.parentNestedBibleItems,
                    position,
                );
                if (found1 !== null) {
                    return found1;
                }
            }
            return getFirstBibleItemAtIndex(
                found.parentNestedBibleItems,
                index + (isGoBack ? -1 : 1),
                isOrientation,
                isGoBack,
            );
        };
        const nestedBibleItems = this.nestedBibleItems;
        const left = seekNeighbor(nestedBibleItems, bibleItem, 'left');
        const right = seekNeighbor(nestedBibleItems, bibleItem, 'right');
        const top = seekNeighbor(nestedBibleItems, bibleItem, 'top');
        const bottom = seekNeighbor(nestedBibleItems, bibleItem, 'bottom');
        return {
            left,
            right,
            top,
            bottom,
        };
    }
    seek(
        bibleItem: ReadIdOnlyBibleItem,
        toastTitle: string = 'Seek Item',
        toastMessage: string = 'Unable to seek bible item',
    ) {
        const nestedBibleItems = this.nestedBibleItems;
        const foundParent = seekParent(nestedBibleItems, bibleItem);
        if (foundParent === null) {
            showSimpleToast(toastTitle, toastMessage);
            throw new Error('Bible item not found in nested structure');
        }
        const {
            parentNestedBibleItems,
            isHorizontal,
            targetNestedBibleItem: foundBibleItem,
        } = foundParent;
        const index = parentNestedBibleItems.indexOf(foundBibleItem);
        return {
            nestedBibleItems,
            parentNestedBibleItems,
            index,
            isHorizontal,
        };
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
        try {
            const { nestedBibleItems, parentNestedBibleItems, index } =
                this.seek(
                    bibleItem,
                    'Change Item',
                    'Unable to change bible item',
                );
            const actualBibleItem = parentNestedBibleItems[
                index
            ] as ReadIdOnlyBibleItem;
            if (extraBibleKeys !== undefined) {
                actualBibleItem.extraBibleKeys = extraBibleKeys;
            }
            if (isAudioEnabled !== undefined) {
                actualBibleItem.isAudioEnabled = isAudioEnabled;
            }
            if (bibleKey !== undefined) {
                bibleItem.bibleKey = bibleKey;
                actualBibleItem.bibleKey = bibleKey;
            }
            if (target !== undefined) {
                actualBibleItem.target = target;
            }

            this.nestedBibleItems = nestedBibleItems;
            if (!isSkipColorSync) {
                this.syncTargetByColorNote(actualBibleItem);
            }
        } catch (error) {
            handleError(error);
        }
    }

    deleteBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        try {
            const { nestedBibleItems, parentNestedBibleItems, index } =
                this.seek(
                    bibleItem,
                    'Remove Item',
                    'Unable to remove bible item',
                );
            parentNestedBibleItems.splice(index, 1);
            this.nestedBibleItems = nestedBibleItems;
        } catch (error) {
            handleError(error);
        }
    }

    addBibleItem(
        bibleItem: ReadIdOnlyBibleItem | null,
        newBibleItem: ReadIdOnlyBibleItem,
        isHorizontal: boolean,
        isBefore: boolean,
        isNoColorNote: boolean,
    ) {
        const sourceColor =
            bibleItem === null ? null : this.getColorNote(bibleItem);
        newBibleItem = ReadIdOnlyBibleItem.fromJson({
            ...newBibleItem.toJson(),
            id: this.genBibleItemUniqueId(),
        });
        if (bibleItem === null) {
            this.nestedBibleItems = [newBibleItem];
            return;
        }
        try {
            const {
                nestedBibleItems,
                parentNestedBibleItems,
                isHorizontal: foundIsHorizontal,
                index,
            } = this.seek(bibleItem, 'Add Item', 'Unable to add bible item');
            if (isHorizontal === foundIsHorizontal) {
                parentNestedBibleItems.splice(
                    index + (isBefore ? 0 : 1),
                    0,
                    newBibleItem,
                );
            } else {
                parentNestedBibleItems[index] = isBefore
                    ? [newBibleItem, bibleItem]
                    : [bibleItem, newBibleItem];
            }
            this.nestedBibleItems = nestedBibleItems;
            if (!isNoColorNote && sourceColor) {
                this.setColorNote(newBibleItem, sourceColor);
            }
            newBibleItem.toTitle().then((title) => {
                attemptAddingHistory(newBibleItem.bibleKey, title, true);
            });
        } catch (error) {
            handleError(error);
        }
    }
    addBibleItemLeft(
        bibleItem: ReadIdOnlyBibleItem,
        newBibleItem: ReadIdOnlyBibleItem,
        isNoColorNote = false,
    ) {
        this.addBibleItem(bibleItem, newBibleItem, true, true, isNoColorNote);
    }
    addBibleItemRight(
        bibleItem: ReadIdOnlyBibleItem,
        newBibleItem: ReadIdOnlyBibleItem,
        isNoColorNote = false,
    ) {
        this.addBibleItem(bibleItem, newBibleItem, true, false, isNoColorNote);
    }
    addBibleItemTop(
        bibleItem: ReadIdOnlyBibleItem,
        newBibleItem: ReadIdOnlyBibleItem,
        isNoColorNote = false,
    ) {
        this.addBibleItem(bibleItem, newBibleItem, false, true, isNoColorNote);
    }
    addBibleItemBottom(
        bibleItem: ReadIdOnlyBibleItem,
        newBibleItem: ReadIdOnlyBibleItem,
        isNoColorNote = false,
    ) {
        this.addBibleItem(bibleItem, newBibleItem, false, false, isNoColorNote);
    }
    async genContextMenu(
        _event: any,
        bibleItem: ReadIdOnlyBibleItem,
        uuid: string,
    ): Promise<ContextMenuItemType[]> {
        const langData = await getLangDataFromBibleKey(bibleItem.bibleKey);
        return [
            {
                menuElement: elementDivider,
            },
            {
                childBefore: genContextMenuItemIcon('vr'),
                menuElement: tran('Split Horizontal'),
                onSelect: () => {
                    this.addBibleItemLeft(bibleItem, bibleItem);
                },
                id: splitHorizontalId,
            },
            {
                menuElement: 'Split Horizontal to',
                onSelect: (event1: any) => {
                    showBibleOption(event1, (newBibleKey: string) => {
                        const newBibleItem = ReadIdOnlyBibleItem.fromJson(
                            bibleItem.toJson(),
                        );
                        newBibleItem.bibleKey = newBibleKey;
                        this.addBibleItemLeft(bibleItem, newBibleItem);
                    });
                },
            },
            {
                childBefore: genContextMenuItemIcon('hr'),
                menuElement: 'Split Vertical',
                onSelect: () => {
                    this.addBibleItemBottom(bibleItem, bibleItem);
                },
                id: splitVerticalId,
            },
            {
                menuElement: 'Split Vertical to',
                onSelect: (event2: any) => {
                    showBibleOption(event2, (newBibleKey: string) => {
                        const newBibleItem = ReadIdOnlyBibleItem.fromJson(
                            bibleItem.toJson(),
                        );
                        newBibleItem.bibleKey = newBibleKey;
                        this.addBibleItemBottom(bibleItem, newBibleItem);
                    });
                },
            },
            ...(langData
                ? langData.extraBibleContextMenuItems(bibleItem, appProvider)
                : []),
            {
                childBefore: genContextMenuItemIcon('arrows-fullscreen'),
                menuElement: 'Toggle Widget Full View',
                onSelect: () => {
                    document
                        .querySelector(`#uuid-${uuid}`)
                        ?.classList.toggle(APP_FULL_VIEW_CLASSNAME);
                },
            },
        ];
    }
    appendBibleItem(bibleItem: ReadIdOnlyBibleItem) {
        const newBibleItem = ReadIdOnlyBibleItem.fromJson({
            ...bibleItem.toJson(),
            id: this.genBibleItemUniqueId(),
        });
        let nestedBibleItems = this.nestedBibleItems;
        if (!Array.isArray(nestedBibleItems)) {
            nestedBibleItems = [nestedBibleItems];
        }
        this.nestedBibleItems = [...nestedBibleItems, newBibleItem];
        return newBibleItem;
    }
    getVerseElements<T>(bibleItemId: number, kjvVerseKey?: string) {
        const containerDoms = document.querySelectorAll(
            `.${BIBLE_VIEW_TEXT_CLASS}[data-bible-item-id="${bibleItemId}"]`,
        );
        const elements = Array.from(containerDoms).reduce(
            (elements: T[], containerDom: any) => {
                const dataString = kjvVerseKey
                    ? `div[data-kjv-verse-key="${kjvVerseKey}"]`
                    : `.${VERSE_TEXT_CLASS}`;
                const newElements = Array.from(
                    containerDom.querySelectorAll(
                        `.${BIBLE_VIEW_TEXT_CLASS} ${dataString}`,
                    ),
                ) as any as T[];
                elements.push(...newElements);
                return elements;
            },
            [],
        );
        return elements;
    }
    syncBibleVerseSelection(
        bibleItem: ReadIdOnlyBibleItem,
        verseKey: string,
        isToTop: boolean,
    ) {
        for (const element of this.getVerseElements<HTMLDivElement>(
            bibleItem.id,
            verseKey,
        )) {
            this.handleVersesSelecting(element, isToTop, true);
        }
    }
    handleVersesHighlighting(kjvVerseKey: string, isToTop = false) {
        const elements = document.querySelectorAll(
            `.bible-view div[data-kjv-verse-key="${kjvVerseKey}"]`,
        );
        for (const element of Array.from(elements)) {
            this.handleVersesSelecting(element as any, isToTop, true);
        }
    }
    handleVersesSelecting(
        targetDom: HTMLDivElement,
        isToTop: boolean,
        isForceSelect = false,
        bibleItem?: ReadIdOnlyBibleItem,
    ) {
        const classList = targetDom.classList;
        if (!isForceSelect && classList.contains('selected')) {
            classList.remove('selected');
            return;
        }
        if (targetDom.parentElement) {
            for (const element of targetDom.parentElement.childNodes) {
                (element as any).classList.remove('selected');
            }
        }
        classList.add('selected');
        if (isToTop) {
            bringDomToTopView(targetDom);
        } else {
            const isPartialInvisible = checkIsVersePartialInvisible(targetDom);
            const isElementInBottomView = checkIsVerseAtBottom(targetDom);
            if (isPartialInvisible && isElementInBottomView) {
                bringDomToCenterView(targetDom);
            } else {
                bringDomToNearestView(targetDom);
            }
        }
        if (bibleItem === undefined) {
            return;
        }
        this.bibleCrossReferenceVerseKey = targetDom.dataset.verseKey ?? '';
        const kjvBibleVerseKey = targetDom.dataset.kjvVerseKey;
        if (kjvBibleVerseKey === undefined) {
            return;
        }
        this.handleScreenBibleVersesHighlighting(kjvBibleVerseKey, isToTop);

        const colorNote = this.getColorNote(bibleItem);
        if (!colorNote) {
            return;
        }
        for (const bibleItem1 of this.getBibleItemsByColorNote(colorNote)) {
            if (bibleItem1.id !== bibleItem.id) {
                this.syncBibleVerseSelection(
                    bibleItem1,
                    kjvBibleVerseKey,
                    isToTop,
                );
            }
        }
    }
    protected syncTargetByColorNote(bibleItem: ReadIdOnlyBibleItem) {
        const colorNote = this.getColorNote(bibleItem);
        const targetBibleItems = this.getBibleItemsByColorNote(colorNote);
        for (const targetBibleItem of targetBibleItems) {
            if (targetBibleItem.id === bibleItem.id) {
                continue;
            }
            this.applyTargetOrBibleKey(
                targetBibleItem,
                {
                    target: bibleItem.target,
                },
                true,
            );
        }
    }
}

export const BibleItemsViewControllerContext =
    createContext<BibleItemsViewController | null>(null);

export function useBibleItemsViewControllerContext() {
    const viewController = use(BibleItemsViewControllerContext);
    if (viewController === null) {
        throw new Error(
            'useBibleItemViewControllerUpdateEvent must be used within a' +
                ' BibleItemViewControllerContext',
        );
    }
    return viewController;
}

export function useBibleItemViewControllerUpdateEvent(callback?: () => void) {
    const viewController = useBibleItemsViewControllerContext();
    const [nestedBibleItems, setNestedBibleItems] = useState(
        viewController.nestedBibleItems,
    );
    useAppEffect(() => {
        const update = () => {
            callback?.();
            setNestedBibleItems(viewController.nestedBibleItems);
        };
        const instanceEvents = viewController.registerEventListener(
            ['update'],
            update,
        );
        return () => {
            viewController.unregisterEventListener(instanceEvents);
        };
    }, [viewController]);
    return nestedBibleItems;
}

export default BibleItemsViewController;
