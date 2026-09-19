export { APP_DOCUMENT_ITEM_CLASS } from './appDocumentConstants';

import type AppDocument from '../../app-document-list/AppDocument';
import Slide from '../../app-document-list/Slide';
import { handleError } from '../../helper/errorHelpers';
import CanvasController from '../../slide-editor/canvas/CanvasController';
import CanvasItemImage from '../../slide-editor/canvas/CanvasItemImage';
import CanvasItemVideo from '../../slide-editor/canvas/CanvasItemVideo';

export async function createNewSlidesFromDroppedData(
    appDocument: AppDocument,
    files: File[] | Blob[],
) {
    const resolvedNewSlides = await Promise.all(
        files.map(async (file) => {
            const slide = await appDocument.genNewSlide();
            // A file that fails to decode should only skip its own slide,
            // not reject the whole dropped batch.
            const canvasItem = await CanvasController.genMediaItemFromFile(
                0,
                0,
                file,
            ).catch((error) => {
                handleError(error);
                return null;
            });
            if (
                canvasItem instanceof CanvasItemImage === false &&
                canvasItem instanceof CanvasItemVideo === false
            ) {
                return null;
            }
            CanvasController.scaleCanvasItemToSize(
                canvasItem,
                slide.width,
                slide.height,
                canvasItem.props.mediaWidth,
                canvasItem.props.mediaHeight,
            );
            canvasItem.applyProps({
                left: (slide.width - canvasItem.props.width) / 2,
                top: (slide.height - canvasItem.props.height) / 2,
            });
            const canvasItemsJson = slide.canvasItemsJson;
            canvasItemsJson.push(canvasItem.toJson());
            slide.canvasItemsJson = canvasItemsJson;
            return slide;
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
}
