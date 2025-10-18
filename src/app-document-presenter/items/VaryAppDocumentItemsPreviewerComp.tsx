import { DragEvent } from 'react';

import { useAppDocumentItemThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import AppDocumentItemsComp from './AppDocumentItemsComp';
import AppDocument from '../../app-document-list/AppDocument';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { defaultRangeSize } from './AppDocumentPreviewerFooterComp';
import SlidesMenuComp from './SlidesMenuComp';
import { DIV_CLASS_NAME } from './varyAppDocumentHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import ScrollingHandlerComp from '../../scrolling/ScrollingHandlerComp';
import { VaryAppDocumentType } from '../../app-document-list/appDocumentTypeHelpers';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from '../../slide-editor/canvas/canvasHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { createNewSlidesFromDroppedData } from './appDocumentHelpers';

const handlePasting = async (varyAppDocument: VaryAppDocumentType) => {
    if (!AppDocument.checkIsThisType(varyAppDocument)) {
        return;
    }
    const copiedSlides = await AppDocument.getCopiedSlides();
    for (const copiedSlide of copiedSlides) {
        varyAppDocument.addSlides([copiedSlide]);
    }
};

async function handleDataDropping(appDocument: AppDocument, event: DragEvent) {
    changeDragEventStyle(event, 'opacity', '1');
    const files: File[] = [];
    for await (const file of readDroppedFiles(event)) {
        if (!checkIsSupportMediaType(file.type)) {
            showSimpleToast(
                '`Insert Image or Video',
                '`Unsupported file type!',
            );
        } else {
            files.push(file);
        }
    }
    await createNewSlidesFromDroppedData(appDocument, files);
}

export default function VaryAppDocumentItemsPreviewerComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const [thumbSizeScale, setThumbnailSizeScale] =
        useAppDocumentItemThumbnailSizeScale();
    return (
        <div
            className={`${DIV_CLASS_NAME} app-focusable w-100 h-100 pb-5`}
            tabIndex={0}
            style={{ overflow: 'auto' }}
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: thumbSizeScale,
                    setValue: setThumbnailSizeScale,
                    defaultSize: defaultRangeSize,
                });
            }}
            onContextMenu={(event) => {
                varyAppDocument.showContextMenu(event);
            }}
            onPaste={
                varyAppDocument.isEditable
                    ? handlePasting.bind(null, varyAppDocument)
                    : undefined
            }
            onDragOver={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '0.5');
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '1');
            }}
            onDrop={(event) => {
                event.preventDefault();
                if (varyAppDocument instanceof AppDocument === false) {
                    return;
                }
                handleDataDropping(varyAppDocument, event);
            }}
        >
            {varyAppDocument.isEditable ? <SlidesMenuComp /> : null}
            <AppDocumentItemsComp />
            <ScrollingHandlerComp style={{ bottom: '40px' }} />
        </div>
    );
}
