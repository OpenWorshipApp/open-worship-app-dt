import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import PptxSlide from '../../app-document-list/PptxSlide';

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

/**
 * One CARD of a slide grid. A PPTX slide cut into sub-slides (2, 2.01, 2.02)
 * draws a card for each, and every one of them has to be its own cell: laid
 * out as one cell holding several cards, the row squeezed them into the room
 * of fewer, those rows came out narrower than the rest, and the row height
 * measured off such a row left every later row too short, overlapping the row
 * below it.
 *
 * `ownerSlide` is the slide the card belongs to -- itself, or the PPTX slide a
 * sub-slide was cut from -- which is what the card's menu, pins and parking
 * are about. `index` is the card's own number less one (`PptxSlide.calcIndex`
 * for a sub-slide), the same one the badge shows.
 */
export type VarySlideGridItemType = {
    varySlide: VarySlideType;
    ownerSlide: VarySlideType;
    index: number;
};

export function toVarySlideGridItems(varySlides: VarySlideType[]) {
    const gridItems: VarySlideGridItemType[] = [];
    varySlides.forEach((varySlide, i) => {
        gridItems.push({ varySlide, ownerSlide: varySlide, index: i });
        if (PptxSlide.checkIsThisType(varySlide)) {
            varySlide.subSlides.forEach((subSlide, j) => {
                gridItems.push({
                    varySlide: subSlide,
                    ownerSlide: varySlide,
                    index: PptxSlide.calcIndex(i, j),
                });
            });
        }
    });
    return gridItems;
}

export function toVarySlideGridItemKey(gridItem: VarySlideGridItemType) {
    return toVarySlideKey(gridItem.varySlide);
}
