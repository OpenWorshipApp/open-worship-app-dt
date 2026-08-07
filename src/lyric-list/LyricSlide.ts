import Slide from '../app-document-list/Slide';
import { DragTypeEnum } from '../helper/DragInf';
import { cloneJson } from '../helper/helpers';
import { type AnyObjectType } from '../helper/typeHelpers';
import { type CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';

// Kept here, not in `./lyricHelpers`, so this leaf data class stays free of the
// lyric helper graph (`OpenLyric`, `Lyric`, the stage classes). Importing the
// helpers pulled `LyricAppDocument` in while `Slide`/`AppDocument` were still
// initializing, which threw "Cannot access 'Slide' before initialization".
export const LYRIC_SLIDE_TYPE_KEY = 'lyric-slide';

export type LyricPropsType = {
    id: number;
    name?: string;
    canvasItems: CanvasItemPropsType[];
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
        super.validate(json);
    }

    // `Slide.dragSerialize` reads `this.dragType`, so overriding the getter is
    // enough — the payload builder no longer needs a subclass of its own.
    override get dragType(): DragTypeEnum {
        return DragTypeEnum.LYRIC_SLIDE;
    }
}
