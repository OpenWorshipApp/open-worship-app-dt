import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import BibleItem from './BibleItem';
import { BibleTargetType } from './bibleRenderHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import { AnyObjectType } from '../helper/typeHelpers';

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
            menuElement: '`Copy Title',
            onSelect: () => {
                bibleItem.copyTitleToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: '`Copy Text',
            onSelect: () => {
                bibleItem.copyTextToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: '`Copy All',
            onSelect: () => {
                bibleItem.copyToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: '`Copy Verse Full Key',
            onSelect: () => {
                bibleItem.copyVerseFullKeyToClipboard();
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: '`Copy Chapter Full Key',
            onSelect: () => {
                bibleItem.copyChapterFullKeyToClipboard();
            },
        },
    ];
}

export function genDuplicatedMessage(
    list: BibleItem[],
    { target }: BibleItem,
    i: number,
) {
    let warningMessage;
    const duplicated = list.find(({ target: target1 }, i1) => {
        return (
            target.bookKey === target1.bookKey &&
            target.chapter === target1.chapter &&
            target.verseStart === target1.verseStart &&
            target.verseEnd === target1.verseEnd &&
            i !== i1
        );
    });
    if (duplicated) {
        const itemNum = list.indexOf(duplicated) + 1;
        warningMessage = `Duplicated with item number ${itemNum}`;
    }
    return warningMessage;
}
