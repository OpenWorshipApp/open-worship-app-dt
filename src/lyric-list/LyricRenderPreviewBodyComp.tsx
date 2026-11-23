import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import './LyricRenderPreviewBodyComp.scss';

import { useCallback } from 'react';
import { useLyricManagerContext } from './LyricManager';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import { genEditSlideContextMenuItem } from '../app-document-list/appDocumentHelpers';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { FileEditingMenuComp } from '../editing-manager/editingHelpers';
import appProvider from '../server/appProvider';
import { handleError } from '../helper/errorHelpers';
import { type OpenLyric } from 'open-lyric';

/**
 * One mount at a time per previewer.
 *
 * `OpenLyric.mount()` is async: it appends the song's root at once but only
 * counts as mounted a microtask later. A second `mount()` inside that gap
 * (StrictMode's ref → cleanup → ref, a quick close and open of a pane) appends
 * a second root, and the first call, finding itself superseded, then removes
 * the SECOND one — leaving a root the previewer no longer knows of. Nothing
 * removes that one again, so the next mount drew the song twice. Chaining the
 * mounts lets each superseded one take its own root away before the next
 * starts. Keyed weakly: the chain goes with its previewer.
 */
const mountChainMap = new WeakMap<OpenLyric, Promise<void>>();
function mountOpenLyric(openLyric: OpenLyric, element: HTMLElement) {
    openLyric.container = element;
    const mounting = (mountChainMap.get(openLyric) ?? Promise.resolve())
        .then(() => {
            // Moved elsewhere, or taken off, while this one waited its turn.
            if (openLyric.container !== element) {
                return;
            }
            return openLyric.mount();
        })
        .catch(handleError);
    mountChainMap.set(openLyric, mounting);
}

export default function LyricRenderPreviewBodyComp() {
    const lyricManager = useLyricManagerContext();
    const lyricManagerRef = useAppCurrentRef(lyricManager);
    const handleContextMenuHandling = useCallback(
        (event: any) => {
            const currentLyricManager = lyricManagerRef.current;
            const menuItems: ContextMenuItemType[] = [
                genLyricReloadContextMenuItem(() => {
                    currentLyricManager.openLyricPreviewer.reload();
                }),
                genEditSlideContextMenuItem(() => {
                    openPopupLyricEditorWindow(currentLyricManager.lyric);
                }),
            ];
            showAppContextMenu(event, menuItems);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // Stable for the manager's life: an inline ref is a new function on every
    // render, and React then runs the old one's cleanup and the new one — the
    // whole song unmounted and rendered again for a render that changed
    // nothing in it.
    const handleSongElement = useCallback(
        (element: HTMLDivElement | null) => {
            const openLyric = lyricManager.openLyricPreviewer;
            if (element === null || openLyric.container === element) {
                return;
            }
            mountOpenLyric(openLyric, element);
            return () => {
                // Only its own: the previewer may be in another body by now.
                if (openLyric.container === element) {
                    openLyric.container = null;
                }
            };
        },
        [lyricManager],
    );
    return (
        <div className="w-100 h-100 d-flex flex-column app-overflow-hidden">
            {/*
                The song's Undo / Redo / Discard changed / Save, the same row
                the Stage Previewer carries under its header -- here too, so
                they are at hand beside the words being changed. Above the
                scroll area, so it stays put however far the song is scrolled,
                and it takes no room while the song has no history
                (`FileEditingMenuComp` renders nothing, `:empty` hides the row).
                The Presenter's only, as the Stage Previewer's is. No global
                save shortcut: the Stage Previewer registers it for this song,
                and a second registration would save twice.
            */}
            {appProvider.isPagePresenter ? (
                <div className="app-lyric-render-preview-editing-menu">
                    <FileEditingMenuComp
                        editableDocument={lyricManager.lyric}
                    />
                </div>
            ) : null}
            <div
                className="w-100 p-0 m-0 flex-fill"
                style={{
                    minHeight: 0,
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}
                onContextMenu={handleContextMenuHandling}
            >
                {/* The lyric's own menu. Sticky in a zero-height row so it stays
                    reachable however far the words are scrolled. */}
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        height: 0,
                        zIndex: 3,
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <ContextMenuDotsButtonComp
                        className="me-2"
                        onOpening={handleContextMenuHandling}
                    />
                </div>
                <div
                    className="w-100 p-2 app-lyric-render-preview-body app-selectable-text"
                    ref={handleSongElement}
                    style={{
                        height: 'fit-content',
                    }}
                ></div>
            </div>
        </div>
    );
}
