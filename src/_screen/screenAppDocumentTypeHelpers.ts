import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';

export type VarySlideScreenDataType = {
    filePath: string;
    itemJson: VarySlideDataType;
    isRenderFullWidth: boolean;
};
export type AppDocumentListType = {
    [key: string]: VarySlideScreenDataType;
};
