import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';

/**
 * The `Reload` item, shared by every place a lyric can be re-rendered from: the
 * rendered song's own context menu, a stage pane's, and the Stage Previewer
 * header's `⋮` button. One definition so the three can never drift apart in
 * label or icon — WHAT each of them re-renders differs, which is why the action
 * itself stays with the caller.
 *
 * A leaf module on purpose: `LyricAppDocument` is one of the callers, and it
 * cannot reach `lyricHelpers` statically without closing the
 * `lyricHelpers → LyricAppDocumentStage0 → …  → LyricAppDocument` cycle.
 */
export function genLyricReloadContextMenuItem(
    onSelect: () => void,
): ContextMenuItemType {
    return {
        childBefore: genContextMenuItemIcon('arrow-clockwise'),
        menuElement: tran('Reload'),
        onSelect,
    };
}
