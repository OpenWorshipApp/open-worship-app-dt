import { dirSourceSettingNames } from '../helper/constants';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import {
    getSelectedFilePath,
    getSelectedFilePathWithEnsure,
    setSelectedFilePath,
} from '../others/selectedHelpers';

export const SELECTED_APP_DOCUMENT_SETTING_NAME = 'selected-vary-app-document';

// Lyrics used to carry their own selection, so a second row stayed highlighted
// in the same list. Both keys stored a path relative to the same documents
// directory, so the old value can simply move over — but only into an empty
// slot, since a document selection is the more recent thing the user looked at.
const LEGACY_SELECTED_LYRIC_SETTING_NAME = 'selected-lyric';
let isSelectedLyricSettingMigrated = false;
// Lazily, never at module scope: reading a setting touches the local storage
// directory, and this module is imported by nearly every renderer.
function ensureSelectedLyricSettingMigrated() {
    if (isSelectedLyricSettingMigrated) {
        return;
    }
    isSelectedLyricSettingMigrated = true;
    const legacyFilePath = getSetting(LEGACY_SELECTED_LYRIC_SETTING_NAME);
    if (!legacyFilePath) {
        return;
    }
    if (!getSetting(SELECTED_APP_DOCUMENT_SETTING_NAME)) {
        setSetting(SELECTED_APP_DOCUMENT_SETTING_NAME, legacyFilePath);
    }
    removeSetting(LEGACY_SELECTED_LYRIC_SETTING_NAME);
}

export function getSelectedVaryAppDocumentFilePath() {
    ensureSelectedLyricSettingMigrated();
    return getSelectedFilePath(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

export async function getSelectedVaryAppDocumentFilePathWithEnsure() {
    ensureSelectedLyricSettingMigrated();
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
