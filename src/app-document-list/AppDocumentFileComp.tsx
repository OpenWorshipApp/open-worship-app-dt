import { use, useState } from 'react';

import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import AppDocument from './AppDocument';
import { getIsShowingVaryAppDocumentPreviewer } from '../app-document-presenter/PresenterComp';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { goToPath } from '../router/routeHelpers';
import { previewPdf } from '../server/appHelpers';
import { removePdfImagesPreview } from '../helper/pdfHelpers';
import {
    varyAppDocumentFromFilePath,
    useSelectedAppDocumentSetterContext,
    SelectedVaryAppDocumentContext,
    checkIsVaryAppDocumentOnScreen,
} from './appDocumentHelpers';
import PdfAppDocument from './PdfAppDocument';
import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import {
    VaryAppDocumentDynamicType,
    VaryAppDocumentType,
} from './appDocumentTypeHelpers';
import { genLayoutTabs } from '../router/popupLayoutHelpers';

function genContextMenuItems(
    varyAppDocument: VaryAppDocumentDynamicType,
    setSelectedDocument: (value: VaryAppDocumentType | null) => void,
): ContextMenuItemType[] {
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        return [
            {
                menuElement: 'Preview PDF',
                onSelect: () => {
                    previewPdf(varyAppDocument.fileSource.src);
                },
            },
            {
                menuElement: 'Refresh PDF Images',
                onSelect: async () => {
                    await removePdfImagesPreview(varyAppDocument.filePath);
                    varyAppDocument.fileSource.fireUpdateEvent();
                },
            },
        ];
    }
    const { editorTab } = genLayoutTabs();
    return [
        {
            menuElement: 'Edit',
            onSelect: () => {
                if (varyAppDocument) {
                    setSelectedDocument(varyAppDocument);
                    goToPath(editorTab.routePath);
                }
            },
        },
    ];
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
            <i className="bi bi-filetype-pdf" />
            {fileSource.name}
        </div>
    );
}

async function checkIsOnScreen(filePath: string) {
    const varyAppDocument = varyAppDocumentFromFilePath(filePath);
    const isOnScreen = await checkIsVaryAppDocumentOnScreen(varyAppDocument);
    return isOnScreen;
}

export default function AppDocumentFileComp({
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
        useState<VaryAppDocumentDynamicType>(null);
    useAppEffect(() => {
        if (varyAppDocument !== null) {
            return;
        }
        const newVaryAppDocument = varyAppDocumentFromFilePath(filePath);
        setVaryAppDocument(newVaryAppDocument);
    }, [varyAppDocument]);
    useFileSourceEvents(
        ['update'],
        () => {
            setVaryAppDocument(null);
        },
        [varyAppDocument],
        filePath,
    );
    const handleReloading = () => {
        setVaryAppDocument(null);
    };
    const handleClicking = () => {
        if (!varyAppDocument) {
            return;
        }
        setSelectedAppDocument(varyAppDocument);
        if (!getIsShowingVaryAppDocumentPreviewer()) {
            previewingEventListener.showVaryAppDocument(varyAppDocument);
        }
    };
    const handleChildRendering = (varyAppDocument: AppDocumentSourceAbs) => {
        if (AppDocument.checkIsThisType(varyAppDocument)) {
            return (
                <FilePreviewAppDocumentNormalComp
                    varyAppDocument={varyAppDocument}
                />
            );
        }
        if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
            return (
                <FilePreviewPdfAppDocumentComp
                    pdfAppDocument={varyAppDocument}
                />
            );
        }
        return null;
    };
    const handleRenaming = async (newFileSource: FileSource) => {
        if (isSelected) {
            const newVaryAppDocument = varyAppDocumentFromFilePath(
                newFileSource.filePath,
            );
            setSelectedAppDocument(newVaryAppDocument);
        }
    };

    return (
        <FileItemHandlerComp
            index={index}
            data={varyAppDocument}
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
