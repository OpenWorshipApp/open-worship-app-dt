import Slide from '../app-document-list/Slide';
import { CanvasItemTextPropsType } from '../slide-editor/canvas/CanvasItemText';

export type CanvasItemPropsTypeWithText = CanvasItemTextPropsType & {
    htmlText: string;
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
