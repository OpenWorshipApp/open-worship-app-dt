import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import type BibleItem from './BibleItem';
import {
    checkIsSameBibleTarget,
    type BibleTargetType,
} from '../helper/bible-helpers/bibleTargetHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import {
    createMouseEvent,
    getMenuItemAnchor,
} from '../context-menu/contextMenuEventHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import { handleError } from '../helper/errorHelpers';

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
        {
            childBefore: genContextMenuItemIcon('three-dots', {
                color: 'var(--bs-secondary-text-emphasis)',
            }),
            menuElement: tran('More…'),
            title: tran('Every way to copy the title and text'),
            onSelect: (event) => {
                // Read now: this menu is gone once the module has loaded.
                const anchor = getMenuItemAnchor(event);
                // Loaded at the press: every format and its preview.
                import('./bibleItemCopyFormatHelpers')
                    .then(({ showBibleItemCopyFormatMenu }) => {
                        return showBibleItemCopyFormatMenu(bibleItem, anchor);
                    })
                    .catch(handleError);
            },
        },
    ];
}

/**
 * One `Copy` in place of every way to copy (2026-10-22 in a Bible view's
 * menu; 2026-11-07 in every other menu of a passage, the user: _replace all
 * contextmenu that copying bible text to use only `Copy`_): it opens the copy
 * menu where it was chosen.
 */
export function genBibleItemCopyContextMenuItem(
    bibleItem: BibleItem,
): ContextMenuItemType {
    return {
        childBefore: genContextMenuItemIcon('copy'),
        menuElement: tran('Copy'),
        onSelect: (event) => {
            // Read now: this menu is gone by the time the next one opens.
            const anchor = getMenuItemAnchor(event);
            // Loaded at the press: a verse window imports this module and
            // keeps the menu UI out of its own chunk.
            import('../context-menu/appContextMenuHelpers')
                .then(({ showAppContextMenu }) => {
                    showAppContextMenu(
                        createMouseEvent(
                            anchor?.x ?? window.innerWidth / 2,
                            anchor?.y ?? window.innerHeight / 4,
                        ),
                        genBibleItemCopyingContextMenu(bibleItem),
                    );
                })
                .catch(handleError);
        },
    };
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
