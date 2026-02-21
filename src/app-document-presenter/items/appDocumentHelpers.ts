import type AppDocument from '../../app-document-list/AppDocument';
import Slide from '../../app-document-list/Slide';
import CanvasController from '../../slide-editor/canvas/CanvasController';
import CanvasItemImage from '../../slide-editor/canvas/CanvasItemImage';

export const APP_DOCUMENT_ITEM_CLASS = 'data-vary-app-document-item';

export async function createNewSlidesFromDroppedData(
    appDocument: AppDocument,
    files: File[] | Blob[],
) {
    const resolvedNewSlides = await Promise.all(
        files.map(async (file) => {
            const slide = await appDocument.genNewSlide();
            const canvasItem = await CanvasItemImage.genFromFile(0, 0, file);
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
