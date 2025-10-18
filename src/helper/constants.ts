const SELECT_DIR = 'select-dir';
export const dirSourceSettingNames = {
    APP_DOCUMENT: `${SELECT_DIR}-app-document`,
    LYRIC: `${SELECT_DIR}-lyric`,
    PLAYLIST: `${SELECT_DIR}-playlist`,
    BACKGROUND_IMAGE: `${SELECT_DIR}-image-bg`,
    BACKGROUND_VIDEO: `${SELECT_DIR}-video-bg`,
    BACKGROUND_AUDIO: `${SELECT_DIR}-audio-bg`,
    BIBLE_PRESENT: `${SELECT_DIR}-bible-presenter`,
    BIBLE_READ: `${SELECT_DIR}-bible-read`,
};
export const defaultDataDirNames = {
    APP_DOCUMENT: 'documents',
    PLAYLIST: 'playlists',
    LYRIC: 'lyrics',
    BACKGROUND_IMAGE: 'images',
    BACKGROUND_VIDEO: 'videos',
    BACKGROUND_AUDIO: 'audios',
    BIBLE_PRESENT: 'bibles',
    BIBLE_READ: 'bibles-read',
};

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
