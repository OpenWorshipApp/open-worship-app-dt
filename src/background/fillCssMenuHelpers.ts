import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { genFillCssText } from './fillCssTextHelpers';
import { parseFill } from './fillValueHelpers';

/**
 * The right-click row that copies a fill's CSS (`genFillCssText`), on a
 * gradient or pattern tile and on a saved fill alike; none for a value that
 * is not a fill. The text is built when the row is chosen, not when the menu
 * opens.
 */
export function genFillCopyCssMenuItems(
    fillSrc: string,
): ContextMenuItemType[] {
    const fill = parseFill(fillSrc);
    if (fill === null) {
        return [];
    }
    const label = tran('Copy CSS');
    return [
        {
            childBefore: genContextMenuItemIcon('filetype-css'),
            menuElement: label,
            onSelect: () => {
                void copyToClipboard(genFillCssText(fill), label);
            },
        },
    ];
}
