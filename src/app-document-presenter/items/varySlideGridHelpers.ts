import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';

/**
 * What every windowed grid of slide cards needs to lay one out, shared by the
 * documents previewer and by a run sheet's own preview of a document -- they
 * draw the SAME card, so a figure that lived in one of them would drift.
 *
 * A card is `margin: 2px` inside a 1px border (`VarySlideComp.scss`), so it
 * takes its thumbnail width plus 6, and its header is a fixed 35 high. Both
 * figures are only a FIRST GUESS: the grid measures a real row and corrects
 * itself, which is what keeps the header's line box right in Khmer and French.
 */
export const THUMBNAIL_EXTRA_WIDTH = 6;
export const THUMBNAIL_EXTRA_HEIGHT = 41;

/**
 * What a windowed list knows a slide by, so anything asking to be shown one
 * (the presented-slide highlight, a run player stepping onto it, the slide
 * being edited) names it the way the rest of the app already does.
 */
export function toVarySlideKey(varySlide: VarySlideType) {
    return toKeyByFilePath(varySlide.filePath, varySlide.id);
}

/**
 * How tall a card's body is, from the slide itself: a document may hold pages
 * of more than one shape (a PDF with a landscape page in it), and a grid that
 * assumed one height would lay those out on top of each other.
 */
export function genSlideHeightGetter(thumbnailWidth: number) {
    return (varySlide: VarySlideType) => {
        if (varySlide.width <= 0) {
            return 0;
        }
        return (thumbnailWidth * varySlide.height) / varySlide.width;
    };
}
