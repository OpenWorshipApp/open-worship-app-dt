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

function genContextMenuItems(
    lyric: Lyric | null | undefined,
): ContextMenuItemType[] {
    if (lyric === null || lyric === undefined) {
        return [];
    }
    return [
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
                title="Lyric"
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
    const handleClicking = useCallback(() => {
        if (!lyricRef.current) {
            return;
        }
        // A lyric is selected as a document, exactly like a PPTX or a PDF: one
        // selection, one previewer. The previewer swaps its body for a lyric.
        const lyricAppDocument = LyricAppDocument.getInstance(filePath);
        setSelectedVaryAppDocumentRef.current(lyricAppDocument);
        if (!getIsShowingVaryAppDocumentPreviewer()) {
            previewingEventListener.showVaryAppDocument(lyricAppDocument);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChildRendering = useCallback((lyric: AppDocumentSourceAbs) => {
        return <LyricFilePreviewComp lyric={lyric as Lyric} />;
    }, []);
    // Same reference-only payload as any other document, so a lyric can be
    // dropped into a playlist too.
    const handleDraggingStart = useCallback((event: any) => {
        handleAppDocumentDragStart(event, filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isSelectedRef = useAppCurrentRef(isSelected);
    const handleRenaming = useCallback(async (newFileSource: FileSource) => {
        if (isSelectedRef.current) {
            setSelectedVaryAppDocumentRef.current(
                LyricAppDocument.getInstance(newFileSource.filePath),
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
            contextMenuItems={genContextMenuItems(lyric)}
            isSelected={isSelected}
            checkIsOnScreen={checkIsOnScreen}
            renamedCallback={handleRenaming}
            onDragStart={handleDraggingStart}
        />
    );
}
