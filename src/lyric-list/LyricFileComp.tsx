import { use, useCallback, useState } from 'react';

import Lyric from './Lyric';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import LyricAppDocument from './LyricAppDocument';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import {
    checkIsVaryAppDocumentFilePathOnScreen,
    SelectedVaryAppDocumentContext,
    useSelectedAppDocumentSetterContext,
} from '../app-document-list/appDocumentHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import { getIsShowingVaryAppDocumentPreviewer } from '../app-document-presenter/presenterRendererHelpers';
import { tran } from '../lang/langHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { handleAppDocumentDragStart } from '../helper/dragHelpers';
import { exportAppDocument } from '../app-document-list/appDocumentArchiveHelpers';
import {
    checkHandleOpenSlidesPreviewClicking,
    closeAppDocumentPreviewFloating,
    genOpenSlidesPreviewContextMenu,
} from '../app-document-list/appDocumentPreviewFloatingHelpers';

function genContextMenuItems(
    lyric: Lyric | null | undefined,
    isSelected: boolean,
): ContextMenuItemType[] {
    if (lyric === null || lyric === undefined) {
        return [];
    }
    return [
        genOpenSlidesPreviewContextMenu(lyric.filePath, isSelected),
        {
            childBefore: genContextMenuItemIcon('pencil-square'),
            menuElement: (
                <span>
                    {tran('Edit')} <i className="bi bi-box-arrow-up-right" />
                </span>
            ),
            onSelect: () => {
                openPopupLyricEditorWindow(lyric);
            },
        },
        {
            childBefore: genContextMenuItemIcon('file-earmark-arrow-down'),
            menuElement: tran('Export'),
            onSelect: () => {
                exportAppDocument(lyric.filePath);
            },
        },
    ];
}

function LyricFilePreviewComp({ lyric }: Readonly<{ lyric: Lyric }>) {
    const fileSource = FileSource.getInstance(lyric.filePath);
    const { canSave } = useEditingHistoryStatus(lyric.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-music-note"
                title={tran('Lyric')}
                style={{ color: 'var(--bs-info)' }}
            />
            {fileSource.name}
            {canSave && <span style={{ color: 'red' }}>*</span>}
        </div>
    );
}

async function checkIsOnScreen(filePath: string) {
    return await checkIsVaryAppDocumentFilePathOnScreen(filePath);
}

export default function LyricFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const selectedContext = use(SelectedVaryAppDocumentContext);
    const isSelected =
        selectedContext !== null &&
        selectedContext.selectedVaryAppDocument?.filePath === filePath;
    const setSelectedVaryAppDocument = useSelectedAppDocumentSetterContext();
    const [lyric, setLyric] = useState<Lyric | null | undefined>(undefined);
    const lyricRef = useAppCurrentRef(lyric);
    useAppEffect(() => {
        if (lyric !== undefined) {
            return;
        }
        setLyric(Lyric.getInstance(filePath));
    }, [lyric]);
    useFileSourceEvents(
        ['update'],
        () => {
            setLyric(Lyric.getInstance(filePath));
        },
        [],
        filePath,
    );
    const handleReloading = useCallback(() => {
        lyricRef.current?.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setSelectedVaryAppDocumentRef = useAppCurrentRef(
        setSelectedVaryAppDocument,
    );
    const isSelectedRef = useAppCurrentRef(isSelected);
    const handleClicking = useCallback(async (event: any) => {
        // Before the loaded check: a widget is keyed by path alone, so the
        // shortcut works on a row whose lyric is still being read.
        if (
            checkHandleOpenSlidesPreviewClicking(
                event,
                filePath,
                isSelectedRef.current,
            )
        ) {
            return;
        }
        if (!lyricRef.current) {
            return;
        }
        // A lyric is selected as a document, exactly like a PPTX or a PDF: one
        // selection, one previewer. The previewer swaps its body for a lyric.
        const lyricAppDocument = LyricAppDocument.getInstance(filePath);
        const isApplied =
            await setSelectedVaryAppDocumentRef.current(lyricAppDocument);
        // The pin refused the switch. Bail before the event: its listener force-
        // opens the Documents tab, so a refused click would pop the tab open.
        if (!isApplied) {
            return;
        }
        if (!getIsShowingVaryAppDocumentPreviewer()) {
            previewingEventListener.showVaryAppDocument(lyricAppDocument);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChildRendering = useCallback((lyric: AppDocumentSourceAbs) => {
        return <LyricFilePreviewComp lyric={lyric as Lyric} />;
    }, []);
    // Same reference-only payload as any other document, so a lyric can be
    // dropped into a presenting flow too.
    const handleDraggingStart = useCallback((event: any) => {
        handleAppDocumentDragStart(event, filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRenaming = useCallback(async (newFileSource: FileSource) => {
        // A widget is keyed by path, so the old one would linger over a file
        // that no longer exists.
        closeAppDocumentPreviewFloating(filePath);
        if (isSelectedRef.current) {
            // Forced: a rename is not a switch, so the selection has to follow
            // it even while the document is pinned.
            setSelectedVaryAppDocumentRef.current(
                LyricAppDocument.getInstance(newFileSource.filePath),
                { isForce: true },
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <FileItemHandlerComp
            index={index}
            fileData={lyric}
            reload={handleReloading}
            filePath={filePath}
            onClick={handleClicking}
            renderChild={handleChildRendering}
            contextMenuItems={genContextMenuItems(lyric, isSelected)}
            isSelected={isSelected}
            checkIsOnScreen={checkIsOnScreen}
            renamedCallback={handleRenaming}
            onDragStart={handleDraggingStart}
        />
    );
}
