import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';
import type { TransitionEffectType } from './transitionEffectHelpers';

export const PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME =
    'page-base-virtual-bg-color';

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
};
export type AppDocumentListType = {
    [key: string]: VarySlideScreenDataType;
};
