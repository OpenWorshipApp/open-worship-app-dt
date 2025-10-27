import { VaryAppDocumentItemDataType } from '../app-document-list/appDocumentTypeHelpers';

export type VaryAppDocumentItemScreenDataType = {
    filePath: string;
    itemJson: VaryAppDocumentItemDataType;
    isPdfFullWidth: boolean;
};
export type AppDocumentListType = {
    [key: string]: VaryAppDocumentItemScreenDataType;
};
