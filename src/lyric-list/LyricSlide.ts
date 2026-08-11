import Slide from '../app-document-list/Slide';
import { notifyElementHighlight } from '../helper/domHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { bringDomToCenterView, cloneJson } from '../helper/helpers';
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

export const STAGE_CLASSNAME_PREFIX = 'ol-slide--lyric-stage';
export const INDEX_CLASSNAME_PREFIX = 'ol-slide--lyric-index';
export default class LyricSlide extends Slide {
    openLyricKey: string;
    // Position in the song's own structure, which is what the lyric previewer
    // counts in. `-1` for a slide that has no verse of its own to point back at
    // — the three extra slides (First/Info/None) and the attachment slides.
    openLyricIndex: number;

    constructor(
        filePath: string,
        json: LyricPropsType,
        openLyricKey: string,
        openLyricIndex = -1,
    ) {
        super(filePath, json as any);
        this.openLyricKey = openLyricKey;
        this.openLyricIndex = openLyricIndex;
        // Written straight into the json `super()` has just cloned: the `type`
        // and `name` setters would each deep-clone it again, and a whole song
        // builds one of these per verse per stage pane.
        const originalJson = this._originalJson as any;
        originalJson.type = LYRIC_SLIDE_TYPE_KEY;
        originalJson.name =
            openLyricIndex < 0
                ? openLyricKey
                : `(${openLyricIndex + 1})-${openLyricKey}`;
    }

    get extraClassnames() {
        return (
            `${STAGE_CLASSNAME_PREFIX}-${this.stage} ` +
            `${INDEX_CLASSNAME_PREFIX}-${this.openLyricIndex}`
        );
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

    /**
     * Brings the card of the verse at `index` into view.
     *
     * `root` scopes the lookup to ONE lyric previewer's subtree. It matters:
     * more than one can be mounted (a floating preview of the same `.owl`, a
     * second song), every one of them stamps the same index classes, and an
     * unscoped `document.querySelector` would always answer with whichever
     * happens to come first in the document.
     */
    static notifyLyricElement(index: number, root: ParentNode | null) {
        if (root === null || index < 0) {
            return;
        }
        notifyElementHighlight(
            () => {
                return root.querySelector(
                    `.${INDEX_CLASSNAME_PREFIX}-${index}`,
                );
            },
            {
                moveToView: bringDomToCenterView,
            },
        );
    }
}
