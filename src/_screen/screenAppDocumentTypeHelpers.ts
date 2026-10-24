import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';
import type { TransitionEffectType } from './transitionEffectHelpers';

export const PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME =
    'page-base-virtual-bg-color';

/**
 * A slide beside the presented one on a stage screen (`documentStageHelpers`),
 * `offset` places from it in the document.
 */
export type StageLookAheadSideType = {
    offset: number;
    itemJson: VarySlideDataType;
    // Its own corner count, on a stage that shows counts. Absent in data an
    // earlier build saved.
    label?: string | null;
};

/**
 * What a stage screen draws around a document's slide that is not on the
 * slide itself: the corner count and the slides around it. Worked out on the
 * presenter, which has the document open (`genStageLookAheadData`), and
 * carried here so the screen window never opens the document.
 */
export type StageLookAheadDataType = {
    stage: number;
    label: string | null;
    // One per side box of the stage's arrangement, `null` past either end.
    sideList: (StageLookAheadSideType | null)[];
};

export type VarySlideScreenDataType = {
    filePath: string;
    itemJson: VarySlideDataType;
    isRenderFullWidth: boolean;
    // color painted behind the page of pdf/pptx/docx slides, matching the
    // "Preview BG" color in the presenter; older persisted data lacks it
    virtualBackgroundColor?: string | null;
    /**
     * The slide's own transition, else its slides preview's, read from the
     * document's `.transition.json` on the presenter (`applyVarySlideData`) and
     * carried here so the screen window never reads the sidecar. Absent -- the
     * key itself, never `undefined` -- means the screen's `Slide:` effect.
     */
    transitionEffect?: TransitionEffectType;
    /**
     * Only on a screen whose `St:` is 1 or up, and only for a document that is
     * not a song (a song's slide is rebuilt for the stage instead). Absent --
     * the key itself -- means the slide is drawn as it is.
     */
    stageLookAhead?: StageLookAheadDataType;
};
export type AppDocumentListType = {
    [key: string]: VarySlideScreenDataType;
};
