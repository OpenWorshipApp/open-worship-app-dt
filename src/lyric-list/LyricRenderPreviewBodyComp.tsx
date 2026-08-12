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
    return (
        <div
            className="w-100 h-100 p-0 m-0"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
            onContextMenu={handleContextMenuHandling}
        >
            <div
                className="w-100 p-2 app-lyric-render-preview-body"
                ref={(el) => {
                    const openLyric = lyricManager.openLyricPreviewer;
                    if (el === null || openLyric.container === el) {
                        return;
                    }
                    openLyric.container = el;
                    openLyric.mount();
                    return () => {
                        openLyric.container = null;
                    };
                }}
                style={{
                    height: 'fit-content',
                }}
            ></div>
        </div>
    );
}
