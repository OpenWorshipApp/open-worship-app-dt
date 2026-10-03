import type LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import {
    OPEN_LYRIC_FIRST_KEY,
    OPEN_LYRIC_INFO_KEY,
    OPEN_LYRIC_NONE_KEY,
} from './LyricAppDocument';
import type LyricSlide from './LyricSlide';
import {
    genLookAheadItemsList,
    type LookAheadArrangementType,
} from './lyricLookAheadHelpers';
import { type CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import { type LyricStepRefType } from './lyricStructureHelpers';

const EXTRA_SLIDE_KEYS = [
    OPEN_LYRIC_FIRST_KEY,
    OPEN_LYRIC_INFO_KEY,
    OPEN_LYRIC_NONE_KEY,
];

type StageClassType = abstract new (
    ...args: any[]
) => LyricAppDocumentStageAbstract;

// The song's own slides only — First, Info, None and the sections — which
// lead the deck. The attachment slides after them keep their full size: they
// are media, not words to sing.
function applyLookAhead(
    lyricAppDocument: LyricAppDocumentStageAbstract,
    slides: LyricSlide[],
    arrangement: LookAheadArrangementType,
) {
    const firstAttachmentIndex = slides.findIndex((slide) => {
        return (
            slide.openLyricIndex < 0 &&
            !EXTRA_SLIDE_KEYS.includes(slide.openLyricKey)
        );
    });
    const lyricSlides =
        firstAttachmentIndex < 0
            ? slides
            : slides.slice(0, firstAttachmentIndex);
    const itemsList = genLookAheadItemsList(
        lyricSlides.map((slide) => slide.canvasItemsJson),
        lyricAppDocument.canvasItemBounds,
        arrangement,
        (box, html): CanvasItemPropsType => {
            return {
                ...lyricAppDocument.genCanvasItemHtmlProps(-1, html),
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
            };
        },
    );
    lyricSlides.forEach((slide, i) => {
        // Straight into the json the slide already owns, as `LyricSlide`'s
        // constructor does: the `canvasItemsJson` setter would deep-clone
        // every slide's html once more and mark the slide changed.
        slide._originalJson.canvasItems = itemsList[i];
    });
}

/**
 * Turns a stage's LOOK into a look-ahead ARRANGEMENT: every slide shows
 * itself large and, smaller and dimmer around it, the slides the
 * `arrangement` names -- the next one or two in a row underneath, or the
 * previous at the top left and the next at the bottom right (see
 * `lyricLookAheadHelpers`) -- starting from the deck's first slide. What is
 * IN each box is whatever `Base` renders -- stage 1's section titles and
 * chords for the band's monitor, stage 0's plain centred lines for a screen
 * the audience can read.
 *
 * ONE render per song, as on every other stage: `Base` builds the deck at
 * full size and every box shows that same markup scaled down, so
 * looking ahead costs no second open-lyric pass.
 */
export function withLyricLookAhead<TBase extends StageClassType>(
    Base: TBase,
    arrangement: LookAheadArrangementType,
) {
    abstract class LyricAppDocumentStageLookAhead extends Base {
        async getStageSlides(key?: string, step?: LyricStepRefType) {
            const slides = await super.getStageSlides(key, step);
            if (key === undefined) {
                applyLookAhead(this, slides, arrangement);
            }
            return slides;
        }

        // What comes next depends on the slide's place in the deck, which the
        // single-key path cannot know (a Chorus sung twice is one part with
        // two different successors). So a single slide is read off the whole
        // deck — whose element map is the cached whole-song one.
        async getSlideById(id: number) {
            const slides = await this.getSlides();
            return slides.find((slide) => slide.id === id) ?? null;
        }
    }
    return LyricAppDocumentStageLookAhead;
}
