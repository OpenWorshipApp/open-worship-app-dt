import type { VarySlideDataType } from '../app-document-list/appDocumentTypeHelpers';

export type VarySlideScreenDataType = {
    filePath: string;
    itemJson: VarySlideDataType;
    isPdfFullWidth: boolean;
};
export type AppDocumentListType = {
    [key: string]: VarySlideScreenDataType;
};
