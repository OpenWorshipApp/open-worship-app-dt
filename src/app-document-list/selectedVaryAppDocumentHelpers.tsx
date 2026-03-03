import { dirSourceSettingNames } from '../helper/constants';
import {
    getSelectedFilePath,
    getSelectedFilePathWithEnsure,
    setSelectedFilePath,
} from '../others/selectedHelpers';

export const SELECTED_APP_DOCUMENT_SETTING_NAME = 'selected-vary-app-document';

export function getSelectedVaryAppDocumentFilePath() {
    return getSelectedFilePath(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

export async function getSelectedVaryAppDocumentFilePathWithEnsure() {
    return await getSelectedFilePathWithEnsure(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

export function setSelectedVaryAppDocumentFilePath(filePath: string | null) {
    setSelectedFilePath(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
        filePath,
    );
}
