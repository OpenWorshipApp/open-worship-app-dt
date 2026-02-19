import type { DragEvent } from 'react';

import { useAppDocumentItemThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import AppDocumentItemsComp from './AppDocumentItemsComp';
import AppDocument from '../../app-document-list/AppDocument';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { defaultRangeSize } from './AppDocumentPreviewerFooterComp';
import SlidesMenuComp from './SlidesMenuComp';
import { SLIDE_ITEMS_CONTAINER_CLASS_NAME } from './varyAppDocumentHelpers';
import {
    useSlideItemsControlEventContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import ScrollingHandlerComp from '../../scrolling/ScrollingHandlerComp';
import type { VaryAppDocumentType } from '../../app-document-list/appDocumentTypeHelpers';
import { changeDragEventStyle } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
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
        if (checkIsSupportMediaType(file.type)) {
            files.push(file);
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
                tran('Unsupported file type!'),
            );
        }
    }
    await createNewSlidesFromDroppedData(appDocument, files);
}

export default function VaryAppDocumentItemsPreviewerComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const onEvent = useSlideItemsControlEventContext();
    const [thumbSizeScale, setThumbnailSizeScale] =
        useAppDocumentItemThumbnailSizeScale();
    return (
        <div
            className={
                `${SLIDE_ITEMS_CONTAINER_CLASS_NAME}` +
                ' app-focusable w-100 h-100 pb-5'
            }
            tabIndex={0}
            onBlur={(event) => {
                onEvent(event);
            }}
            onKeyUp={(event) => {
                if (document.activeElement !== event.currentTarget) {
                    return;
                }
                onEvent(event);
            }}
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
            <ScrollingHandlerComp />
        </div>
    );
}
