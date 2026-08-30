import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { LOOKUP_GRAPH_SOURCE_ID } from './lookupGraphIds';
import { openGraphPreview } from './graphViewStore';

export const GRAPH_PREVIEW_ICON_CLASS = 'bi bi-diagram-3';

export type GraphMenuTargetType = {
    // `name` / `location` for the lookup source, and `verse` wherever a call
    // site can also hand over a verse — see below.
    kind: string;
    recordId: string;
    name: string;
};

/**
 * The "Open Graph Preview" item, ready to concatenate into any context menu.
 *
 * A verse is not a record and has no relations, so it yields NO item rather
 * than a disabled one — and `showAppContextMenu` already returns early on an
 * empty list. That is what lets every call site pass its own `kind` straight
 * through with no cast and no branch of its own.
 */
export function genGraphPreviewContextMenuItems(
    target: Readonly<GraphMenuTargetType>,
): ContextMenuItemType[] {
    if (target.kind !== 'name' && target.kind !== 'location') {
        return [];
    }
    const { kind, recordId, name } = target;
    return [
        {
            id: 'open-graph-preview',
            menuElement: tran('Open Graph Preview'),
            childBefore: genContextMenuItemIcon('diagram-3'),
            onSelect: () => {
                openGraphPreview(LOOKUP_GRAPH_SOURCE_ID, {
                    kind,
                    recordId,
                    name,
                });
            },
        },
    ];
}

/**
 * Right-click handler for anywhere a lookup record is already clickable.
 *
 * Takes the NATIVE event: `showAppContextMenu` calls `preventDefault` and
 * `stopPropagation` on what it is handed, which is also what stops the bible
 * view's own context menu from opening behind this one.
 */
export function showGraphPreviewContextMenu(
    event: MouseEvent,
    target: Readonly<GraphMenuTargetType>,
) {
    const itemList = genGraphPreviewContextMenuItems(target);
    if (itemList.length === 0) {
        return;
    }
    showAppContextMenu(event, itemList);
}
