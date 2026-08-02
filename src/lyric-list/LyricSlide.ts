import Slide from '../app-document-list/Slide';
import type { CanvasItemImagePropsType } from '../slide-editor/canvas/CanvasItemImage';

export type LyricType = {
    id: number;
    name?: string;
    canvasItems: CanvasItemImagePropsType[];
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
