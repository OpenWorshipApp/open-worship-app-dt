import { use, useCallback, useState } from 'react';

import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import AppDocument from './AppDocument';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { useAppEffect } from '../helper/debuggerHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { goToPath } from '../router/routeHelpers';
import { removePdfImagesPreview } from '../helper/pdfHelpers';
import {
    varyAppDocumentFromFilePath,
    useSelectedAppDocumentSetterContext,
    SelectedVaryAppDocumentContext,
    checkIsVaryAppDocumentOnScreen,
} from './appDocumentHelpers';
import PdfAppDocument from './PdfAppDocument';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import type {
    VaryAppDocumentDynamicType,
    VaryAppDocumentType,
} from './appDocumentTypeHelpers';
import { genLayoutTabs } from '../router/layoutHelpers';
import { tran } from '../lang/langHelpers';
import { openPopupWindow } from '../helper/domHelpers';
import PptxAppDocument from './PptxAppDocument';
import { removePptxHtmlsPreview } from '../server/pptxHelpers';
import DocxAppDocument from './DocxAppDocument';
import { removeDocxHtmlsPreview } from '../server/docxHelpers';
import appProvider from '../server/appProvider';
import { getIsShowingVaryAppDocumentPreviewer } from '../app-document-presenter/presenterRendererHelpers';

function genContextMenuItems(
    varyAppDocument: VaryAppDocumentDynamicType,
    setSelectedAppDocument: (value: VaryAppDocumentType | null) => void,
): ContextMenuItemType[] {
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: tran('Preview PDF'),
                onSelect: () => {
                    const { fileSource } = varyAppDocument;
                    openPopupWindow(
                        fileSource.src,
                        `pdf_preview-${fileSource.fullName}_${Date.now()}`,
                        fileSource.fullName,
                    );
                },
            },
            {
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
                menuElement: tran('Open PPTX'),
                onSelect: () => {
                    appProvider.systemUtils.openFile(varyAppDocument.filePath);
                },
            },
            {
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
                menuElement: tran('Open DOCX'),
                onSelect: () => {
                    appProvider.systemUtils.openFile(varyAppDocument.filePath);
                },
            },
            {
                menuElement: tran('Refresh DOCX Pages'),
                onSelect: async () => {
                    await removeDocxHtmlsPreview(varyAppDocument.filePath);
                    varyAppDocument.fileSource.fireUpdateEvent();
                },
            },
        ];
        return menuItems;
    }
    const { editorTab } = genLayoutTabs();
    const menuItems: ContextMenuItemType[] = [
        {
            menuElement: tran('Edit'),
            onSelect: () => {
                if (varyAppDocument) {
                    setSelectedAppDocument(varyAppDocument);
                    goToPath(editorTab.routePath);
                }
            },
        },
    ];
    return menuItems;
}

function FilePreviewAppDocumentNormalComp({
    varyAppDocument,
}: Readonly<{ varyAppDocument: AppDocumentSourceAbs }>) {
    const fileSource = FileSource.getInstance(varyAppDocument.filePath);
    const { canSave } = useEditingHistoryStatus(varyAppDocument.filePath);
    return (
        <div className="w-100 h-100 app-ellipsis">
            <i className="bi bi-file-earmark-slides" />
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
                style={{ color: '#2b579a' }}
            />
            {fileSource.name}
        </div>
    );
}

async function checkIsOnScreen(filePath: string) {
    const varyAppDocument = varyAppDocumentFromFilePath(filePath);
    const isOnScreen = await checkIsVaryAppDocumentOnScreen(varyAppDocument);
    return isOnScreen;
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
    useAppEffect(() => {
        if (varyAppDocument !== undefined) {
            return;
        }
        const newVaryAppDocument = varyAppDocumentFromFilePath(filePath);
        setVaryAppDocument(newVaryAppDocument);
    }, [varyAppDocument]);
    const handleReloading = useCallback(() => {
        setVaryAppDocument(undefined);
    }, []);
    const handleClicking = useCallback(() => {
        if (!varyAppDocument) {
            return;
        }
        setSelectedAppDocument(varyAppDocument);
        if (!getIsShowingVaryAppDocumentPreviewer()) {
            previewingEventListener.showVaryAppDocument(varyAppDocument);
        }
    }, [varyAppDocument, setSelectedAppDocument]);

    const handleRenaming = useCallback(
        async (newFileSource: FileSource) => {
            if (isSelected) {
                const newVaryAppDocument = varyAppDocumentFromFilePath(
                    newFileSource.filePath,
                );
                setSelectedAppDocument(newVaryAppDocument);
            }
        },
        [isSelected, setSelectedAppDocument],
    );

    return (
        <FileItemHandlerComp
            index={index}
            fileData={varyAppDocument}
            reload={handleReloading}
            filePath={filePath}
            onClick={handleClicking}
            renderChild={handleChildRendering}
            contextMenuItems={genContextMenuItems(
                varyAppDocument,
                setSelectedAppDocument,
            )}
            renamedCallback={handleRenaming}
            isSelected={isSelected}
            checkIsOnScreen={checkIsOnScreen}
        />
    );
}
