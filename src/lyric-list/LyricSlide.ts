import Slide from '../app-document-list/Slide';
import { DragTypeEnum } from '../helper/DragInf';
import { cloneJson } from '../helper/helpers';
import { type AnyObjectType } from '../helper/typeHelpers';
import { type CanvasItemHtmlPropsType } from '../slide-editor/canvas/CanvasItemHtml';
import { LYRIC_SLIDE_TYPE_KEY } from './lyricHelpers';

export type LyricPropsType = {
    id: number;
    name?: string;
    canvasItems: CanvasItemHtmlPropsType[];
    metadata: {
        width: number;
        height: number;
    };
    type: 'lyric-slide';
    stage: number;
};

export default class LyricSlide extends Slide {
    openLyricKey: string;

    constructor(filePath: string, json: LyricPropsType, openLyricKey: string) {
        super(filePath, json as any);
        (this._originalJson as any).type = LYRIC_SLIDE_TYPE_KEY;
        this.openLyricKey = openLyricKey;
    }

    get stage() {
        return (this._originalJson as any).stage as number;
    }

    static tryValidate(json: AnyObjectType) {
        try {
            this.validate(json);
            return true;
        } catch (_error) {}
        return false;
    }

    static validate(json: AnyObjectType) {
        if (json.type !== LYRIC_SLIDE_TYPE_KEY) {
            throw new Error('Invalid type');
        }
        json = cloneJson(json);
        json.type = 'slide';
        Slide.validate(json);
    }

    dragSerialize() {
        const data = super.dragSerialize();
        data.type = DragTypeEnum.LYRIC_SLIDE;
        return data;
    }
}
