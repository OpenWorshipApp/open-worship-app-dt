import { use, useCallback, useState } from 'react';

import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import AppDocument, { openAppDocumentEditorExternal } from './AppDocument';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { removePdfImagesPreview } from '../helper/pdfHelpers';
import {
    varyAppDocumentFromFilePath,
    useSelectedAppDocumentSetterContext,
    SelectedVaryAppDocumentContext,
    checkIsVaryAppDocumentFilePathOnScreen,
} from './appDocumentHelpers';
import PdfAppDocument from './PdfAppDocument';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import type { VaryAppDocumentDynamicType } from './appDocumentTypeHelpers';
import { tran } from '../lang/langHelpers';
import { openPopupWindow } from '../helper/domHelpers';
import PptxAppDocument from './PptxAppDocument';
import { removePptxHtmlsPreview } from '../server/pptxHelpers';
import DocxAppDocument from './DocxAppDocument';
import { removeDocxHtmlsPreview } from '../server/docxHelpers';
import appProvider from '../server/appProvider';
import { getIsShowingVaryAppDocumentPreviewer } from '../app-document-presenter/presenterRendererHelpers';
import { printAppDocument } from './appDocumentPrintHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { handleAppDocumentDragStart } from '../helper/dragHelpers';
import { exportAppDocument } from './appDocumentArchiveHelpers';
import {
    checkHandleOpenSlidesPreviewClicking,
    closeAppDocumentPreviewFloating,
    genOpenSlidesPreviewContextMenu,
} from './appDocumentPreviewFloatingHelpers';

function genKindContextMenuItems(
    varyAppDocument: VaryAppDocumentDynamicType,
): ContextMenuItemType[] {
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('file-earmark-pdf'),
                menuElement: tran('Preview PDF'),
                onSelect: () => {
                    const { fileSource } = varyAppDocument;
                    const fileFullName = fileSource.fullName;
                    openPopupWindow(
                        fileSource.src,
                        `pdf_preview-${fileFullName}_${Date.now()}`,
                        fileFullName,
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Refresh PDF Images'),
                onSelect: async () => {
                    await removePdfImagesPreview(varyAppDocument.filePath);
                    varyAppDocument.fileSource.fireUpdateEvent();
                },
            },
        ];
        return menuItems;
    }
    if (PptxAppDocument.checkIsThisType(varyAppDocument)) {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('file-earmark-ppt'),
                menuElement: tran('Open PPTX'),
                onSelect: () => {
                    appProvider.systemUtils.openFile(varyAppDocument.filePath);
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Refresh PPTX Slides'),
                onSelect: async () => {
                    await removePptxHtmlsPreview(varyAppDocument.filePath);
                    varyAppDocument.fileSource.fireUpdateEvent();
                },
            },
        ];
        return menuItems;
    }
    if (DocxAppDocument.checkIsThisType(varyAppDocument)) {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('file-earmark-word'),
                menuElement: tran('Open DOCX'),
                onSelect: () => {
                    appProvider.systemUtils.openFile(varyAppDocument.filePath);
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Refresh DOCX Pages'),
                onSelect: async () => {
                    await removeDocxHtmlsPreview(varyAppDocument.filePath);
                    varyAppDocument.fileSource.fireUpdateEvent();
                },
            },
        ];
        return menuItems;
    }
    const menuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('pencil-square'),
            menuElement: (
                <>
                    {tran('Edit')}
                    <i className="bi bi-box-arrow-up-right ms-1" />
                </>
            ),
            onSelect: () => {
                if (!varyAppDocument) {
                    return;
                }
                openAppDocumentEditorExternal(varyAppDocument!);
            },
        },
    ];
    if (AppDocument.checkIsThisType(varyAppDocument)) {
        menuItems.push({
            childBefore: genContextMenuItemIcon('printer'),
            menuElement: tran('Print'),
            onSelect: () => {
                printAppDocument(varyAppDocument);
            },
        });
    }
    return menuItems;
}

function genContextMenuItems(
    varyAppDocument: VaryAppDocumentDynamicType,
    isSelected: boolean,
): ContextMenuItemType[] {
    const menuItems = genKindContextMenuItems(varyAppDocument);
    if (!varyAppDocument) {
        return menuItems;
    }
    menuItems.unshift(
        genOpenSlidesPreviewContextMenu(varyAppDocument.filePath, isSelected),
    );
    // Every kind can be exported: the bundle copies the document verbatim and
    // only walks the JSON kinds, so a PDF travels with its attached backgrounds
    // and color notes exactly as a slide document does.
    const { filePath } = varyAppDocument;
    menuItems.push({
        childBefore: genContextMenuItemIcon('file-earmark-arrow-down'),
        menuElement: tran('Export'),
        onSelect: () => {
            exportAppDocument(filePath);
        },
    });
    return menuItems;
}

function FilePreviewAppDocumentNormalComp({
    varyAppDocument,
}: Readonly<{ varyAppDocument: AppDocumentSourceAbs }>) {
    const fileSource = FileSource.getInstance(varyAppDocument.filePath);
    const { canSave } = useEditingHistoryStatus(varyAppDocument.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-file-earmark-slides"
                title="PowerPoint Document"
            />
            {fileSource.name}
            {canSave && <span style={{ color: 'red' }}>*</span>}
        </div>
    );
}

function FilePreviewPdfAppDocumentComp({
    pdfAppDocument,
}: Readonly<{ pdfAppDocument: PdfAppDocument }>) {
    const fileSource = FileSource.getInstance(pdfAppDocument.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-file-earmark-pdf"
                title="PDF Document"
                style={{ color: '#bd0b02' }}
            />
            {fileSource.name}
        </div>
    );
}

function FilePreviewPptxAppDocumentComp({
    pptxAppDocument,
}: Readonly<{ pptxAppDocument: PptxAppDocument }>) {
    const fileSource = FileSource.getInstance(pptxAppDocument.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-file-earmark-ppt"
                title="PowerPoint Document"
                style={{
                    color: '#d24726',
                }}
            />
            {fileSource.name}
        </div>
    );
}

function FilePreviewDocxAppDocumentComp({
    docxAppDocument,
}: Readonly<{ docxAppDocument: DocxAppDocument }>) {
    const fileSource = FileSource.getInstance(docxAppDocument.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-file-earmark-word"
                title="Word Document"
                style={{ color: '#2b579a' }}
            />
            {fileSource.name}
        </div>
    );
}

async function checkIsOnScreen(filePath: string) {
    return await checkIsVaryAppDocumentFilePathOnScreen(filePath);
}

function handleChildRendering(varyAppDocument: AppDocumentSourceAbs) {
    if (AppDocument.checkIsThisType(varyAppDocument)) {
        return (
            <FilePreviewAppDocumentNormalComp
                varyAppDocument={varyAppDocument}
            />
        );
    }
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        return (
            <FilePreviewPdfAppDocumentComp pdfAppDocument={varyAppDocument} />
        );
    }
    if (PptxAppDocument.checkIsThisType(varyAppDocument)) {
        return (
            <FilePreviewPptxAppDocumentComp pptxAppDocument={varyAppDocument} />
        );
    }
    if (DocxAppDocument.checkIsThisType(varyAppDocument)) {
        return (
            <FilePreviewDocxAppDocumentComp docxAppDocument={varyAppDocument} />
        );
    }
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i
                className="bi bi-question-diamond"
                style={{
                    color: 'yellow',
                }}
            />{' '}
            {varyAppDocument.fileSource.name}
        </div>
    );
}

export default function VaryAppDocumentFileComp({
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
    const setSelectedAppDocument = useSelectedAppDocumentSetterContext();
    const [varyAppDocument, setVaryAppDocument] =
        useState<VaryAppDocumentDynamicType>(undefined);
    const varyAppDocumentRef = useAppCurrentRef(varyAppDocument);
    useAppEffect(() => {
        if (varyAppDocument !== undefined) {
            return;
        }
        const newVaryAppDocument = varyAppDocumentFromFilePath(filePath);
        setVaryAppDocument(newVaryAppDocument);
    }, [varyAppDocument]);
    useFileSourceEvents(
        ['update'],
        () => {
            const newVaryAppDocument = varyAppDocumentFromFilePath(filePath);
            setVaryAppDocument(newVaryAppDocument);
        },
        [],
        filePath,
    );
    const handleReloading = useCallback(() => {
        varyAppDocumentRef.current?.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setSelectedAppDocumentRef = useAppCurrentRef(setSelectedAppDocument);
    const isSelectedRef = useAppCurrentRef(isSelected);
    const handleClicking = useCallback(async (event: any) => {
        // Before the loaded check: a widget is keyed by path alone, so the
        // shortcut works on a row whose document is still being read.
        if (
            checkHandleOpenSlidesPreviewClicking(
                event,
                filePath,
                isSelectedRef.current,
            )
        ) {
            return;
        }
        if (!varyAppDocumentRef.current) {
            return;
        }
        const isApplied = await setSelectedAppDocumentRef.current(
            varyAppDocumentRef.current,
        );
        // The pin refused the switch. Bail before the event: its listener force-
        // opens the Documents tab, so a refused click would pop the tab open.
        if (!isApplied) {
            return;
        }
        if (!getIsShowingVaryAppDocumentPreviewer()) {
            previewingEventListener.showVaryAppDocument(
                varyAppDocumentRef.current,
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A document travels as a plain reference so a playlist can hold "open this
    // document" without copying any of its slides.
    const handleDraggingStart = useCallback((event: any) => {
        handleAppDocumentDragStart(event, filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRenaming = useCallback(async (newFileSource: FileSource) => {
        // A widget is keyed by path, so the old one would linger over a file
        // that no longer exists.
        closeAppDocumentPreviewFloating(filePath);
        if (isSelectedRef.current) {
            const newVaryAppDocument = varyAppDocumentFromFilePath(
                newFileSource.filePath,
            );
            // Forced: a rename is not a switch, so the selection has to follow
            // it even while the document is pinned.
            setSelectedAppDocumentRef.current(newVaryAppDocument, {
                isForce: true,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <FileItemHandlerComp
            index={index}
            fileData={varyAppDocument}
            reload={handleReloading}
            filePath={filePath}
            onClick={handleClicking}
            renderChild={handleChildRendering}
            contextMenuItems={genContextMenuItems(varyAppDocument, isSelected)}
            renamedCallback={handleRenaming}
            isSelected={isSelected}
            checkIsOnScreen={checkIsOnScreen}
            onDragStart={handleDraggingStart}
        />
    );
}
