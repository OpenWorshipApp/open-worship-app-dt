import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';

export const PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME =
    'page-base-virtual-bg-color';

export type VarySlideScreenDataType = {
    filePath: string;
    itemJson: VarySlideDataType;
    isRenderFullWidth: boolean;
    // color painted behind the page of pdf/pptx/docx slides, matching the
    // "Preview BG" color in the presenter; older persisted data lacks it
    virtualBackgroundColor?: string | null;
};
export type AppDocumentListType = {
    [key: string]: VarySlideScreenDataType;
};
