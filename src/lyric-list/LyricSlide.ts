import Slide from '../app-document-list/Slide';
import type { CanvasItemHtmlPropsType } from '../slide-editor/canvas/CanvasItemHtml';

// `text` is the markdown source the `html` was rendered from.
export type CanvasItemPropsTypeWithText = CanvasItemHtmlPropsType & {
    text: string;
};
export type LyricType = {
    id: number;
    name?: string;
    canvasItems: CanvasItemPropsTypeWithText[];
    metadata: {
        width: number;
        height: number;
    };
};

export default class LyricSlide extends Slide {
    constructor(filePath: string, json: LyricType) {
        super(filePath, json);
    }
}
