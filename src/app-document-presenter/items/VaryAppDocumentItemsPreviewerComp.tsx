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
import Slide from '../../app-document-list/Slide';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from '../../slide-editor/canvas/canvasHelpers';
import CanvasItemImage from '../../slide-editor/canvas/CanvasItemImage';
import { showSimpleToast } from '../../toast/toastHelpers';
import CanvasController from '../../slide-editor/canvas/CanvasController';

const handlePasting = async (varyAppDocument: VaryAppDocumentType) => {
    if (!AppDocument.checkIsThisType(varyAppDocument)) {
        return;
    }
    const copiedSlides = await AppDocument.getCopiedSlides();
    for (const copiedSlide of copiedSlides) {
        varyAppDocument.addSlides([copiedSlide]);
    }
};

const handleDataDropping = async (
    appDocument: AppDocument,
    event: DragEvent,
) => {
    changeDragEventStyle(event, 'opacity', '1');
    const newSlides = [];
    for await (const file of readDroppedFiles(event)) {
        if (!checkIsSupportMediaType(file.type)) {
            showSimpleToast(
                '`Insert Image or Video',
                '`Unsupported file type!',
            );
        } else {
            newSlides.push(async () => {
                const slide = await appDocument.genNewSlide();
                const canvasItem = await CanvasItemImage.genFromFile(
                    0,
                    0,
                    file,
                );
                if (canvasItem instanceof CanvasItemImage === false) {
                    return null;
                }
                CanvasController.scaleCanvasItemToSize(
                    canvasItem,
                    slide.width,
                    slide.height,
                    canvasItem.props.mediaWidth,
                    canvasItem.props.mediaHeight,
                );
                const canvasItemsJson = slide.canvasItemsJson;
                canvasItemsJson.push(canvasItem.toJson());
                slide.canvasItemsJson = canvasItemsJson;
                return slide;
            });
        }
    }
    const resolvedNewSlides = await Promise.all(
        newSlides.map((callee) => {
            return callee();
        }),
    );
    const filteredNewSlides = resolvedNewSlides.filter(
        (slide): slide is Slide => {
            return slide instanceof Slide;
        },
    );
    if (filteredNewSlides.length === 0) {
        return;
    }
    await appDocument.addSlides(filteredNewSlides);
};

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
