import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import type BibleItem from './BibleItem';
import {
    checkIsSameBibleTarget,
    type BibleTargetType,
} from '../helper/bible-helpers/bibleTargetHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';

export type BibleItemType = {
    id: number;
    bibleKey: string;
    extraBibleKeys?: string[];
    isAudioEnabled?: boolean;
    target: BibleTargetType;
    metadata: AnyObjectType;
};

export function genBibleItemCopyingContextMenu(
    bibleItem: BibleItem,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('Copy Title'),
            onSelect: () => {
                bibleItem.copyTitleToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('Copy Text'),
            onSelect: () => {
                bibleItem.copyTextToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('Copy All'),
            onSelect: () => {
                bibleItem.copyToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('Copy Verse Full Key'),
            onSelect: () => {
                bibleItem.copyVerseFullKeyToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('Copy Chapter Full Key'),
            onSelect: () => {
                bibleItem.copyChapterFullKeyToClipboard();
            },
        },
    ];
}

/**
 * The SAME passage in a DIFFERENT translation is not a duplicate -- reading two
 * translations side by side is what this list is for, so the `bibleKey` is part
 * of an item's identity here. Without it, a KJV/LSG pair of John 3 warned about
 * itself.
 */
export function genDuplicatedMessage(
    list: BibleItem[],
    { target, bibleKey }: BibleItem,
    i: number,
) {
    let warningMessage;
    const duplicated = list.find(
        ({ target: target1, bibleKey: bibleKey1 }, i1) => {
            return (
                bibleKey === bibleKey1 &&
                checkIsSameBibleTarget(target, target1) &&
                i !== i1
            );
        },
    );
    if (duplicated) {
        const itemNum = list.indexOf(duplicated) + 1;
        warningMessage = `Duplicated with item number ${itemNum}`;
    }
    return warningMessage;
}
