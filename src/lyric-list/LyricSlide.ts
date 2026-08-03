import Slide from '../app-document-list/Slide';
import { type CanvasItemHtmlPropsType } from '../slide-editor/canvas/CanvasItemHtml';

export type LyricType = {
    id: number;
    name?: string;
    canvasItems: CanvasItemHtmlPropsType[];
    metadata: {
        width: number;
        height: number;
    };
};

export default class LyricSlide extends Slide {
    openLyricKey: string;
    stage: number;

    constructor(
        filePath: string,
        json: LyricType,
        openLyricKey: string,
        stage: number,
    ) {
        super(filePath, json);
        this.openLyricKey = openLyricKey;
        this.stage = stage;
    }
}
