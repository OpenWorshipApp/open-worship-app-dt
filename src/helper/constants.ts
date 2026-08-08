const SELECT_DIR = 'select-dir';
export const dirSourceSettingNames = {
    APP_DOCUMENT: `${SELECT_DIR}-app-document`,
    PRESENTING_FLOW: `${SELECT_DIR}-presenting-flow`,
    BACKGROUND_IMAGE: `${SELECT_DIR}-image-bg`,
    BACKGROUND_VIDEO: `${SELECT_DIR}-video-bg`,
    BACKGROUND_WEB: `${SELECT_DIR}-web-bg`,
    BACKGROUND_AUDIO: `${SELECT_DIR}-audio-bg`,
    BIBLE_PRESENT: `${SELECT_DIR}-bible-presenter`,
    BIBLE_READ: `${SELECT_DIR}-bible-read`,
    BIBLE_NOTES: `${SELECT_DIR}-bible-notes`,
};
export const defaultDataDirNames = {
    APP_DOCUMENT: 'documents',
    PRESENTING_FLOW: 'presenting-flows',
    BACKGROUND_IMAGE: 'images',
    BACKGROUND_VIDEO: 'videos',
    BACKGROUND_WEB: 'webs',
    BACKGROUND_AUDIO: 'audios',
    BIBLE_PRESENT: 'bibles',
    BIBLE_READ: 'bibles-read',
    BIBLE_NOTES: 'bible-notes',
};

/**
 * Data folders the APP owns the location of: they sit beside the user-chosen
 * ones under the parent directory (`appLocalStorage.defaultStorage`) and have
 * no `dirSourceSettingNames` entry, because there is nothing to choose. Kept
 * out of `defaultDataDirNames` for exactly that reason — that object is walked
 * key by key to write a directory setting (`selectPathForChildDir`).
 */
export const appManagedDataDirNames = {
    BIBLE_DATA: 'bibles-data',
};

/**
 * Marks the one-off rename migration (`presentingFlowRenameMigration`) as done.
 * Held here, in a leaf module, so `init()` can check it without pulling the
 * migration itself into the launch bundle.
 */
export const PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME =
    'presenting-flow-rename-migrated';

export const fontSizeSettingNames = {
    BIBLE_PRESENTER: 'bible-preview-font-size:presenter',
    BIBLE_READING: 'bible-preview-font-size:reader',
};

export const screenManagerSettingNames = {
    VARY_APP_DOCUMENT: 'screen-vary-app-document-manager',
    FOREGROUND: 'screen-foreground-manager',
    BACKGROUND: 'screen-bg-manager',
    FULL_TEXT: 'screen-ft-manager',
    MANAGERS: 'screen-managers',
};

// Marks elements that are editor/preview-only affordances (e.g. the play
// badge drawn over a video canvas item). The screen output hides every
// element carrying this attribute.
export const PREVIEW_ONLY_ATTR = 'data-preview-only';
