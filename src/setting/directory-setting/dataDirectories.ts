import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';

/**
 * Every folder the app keeps user data in, in the order the Path Settings page
 * lists them. Declared once so that page and the whole-data archive
 * (`src/setting/data-archive/dataArchiveHelpers.ts`) can never disagree about
 * what "the data" is — a folder added here shows up in both.
 *
 * `title` is an English key that goes through `tran`.
 */
export type DataDirectoryType = {
    title: string;
    settingName: string;
    defaultDirName: string;
    iconClassName: string;
};

export const dataDirectories: DataDirectoryType[] = [
    {
        title: 'Documents',
        settingName: dirSourceSettingNames.APP_DOCUMENT,
        defaultDirName: defaultDataDirNames.APP_DOCUMENT,
        iconClassName: 'bi-file-earmark-text',
    },
    {
        title: 'Playlists',
        settingName: dirSourceSettingNames.PLAYLIST,
        defaultDirName: defaultDataDirNames.PLAYLIST,
        iconClassName: 'bi-collection-play',
    },
    {
        title: 'Background Images',
        settingName: dirSourceSettingNames.BACKGROUND_IMAGE,
        defaultDirName: defaultDataDirNames.BACKGROUND_IMAGE,
        iconClassName: 'bi-image',
    },
    {
        title: 'Background Videos',
        settingName: dirSourceSettingNames.BACKGROUND_VIDEO,
        defaultDirName: defaultDataDirNames.BACKGROUND_VIDEO,
        iconClassName: 'bi-film',
    },
    {
        title: 'Background Audios',
        settingName: dirSourceSettingNames.BACKGROUND_AUDIO,
        defaultDirName: defaultDataDirNames.BACKGROUND_AUDIO,
        iconClassName: 'bi-volume-up',
    },
    {
        title: 'Bible Present',
        settingName: dirSourceSettingNames.BIBLE_PRESENT,
        defaultDirName: defaultDataDirNames.BIBLE_PRESENT,
        iconClassName: 'bi-book',
    },
    {
        title: 'Bible Reader',
        settingName: dirSourceSettingNames.BIBLE_READ,
        defaultDirName: defaultDataDirNames.BIBLE_READ,
        iconClassName: 'bi-book-half',
    },
    {
        title: 'Notes',
        settingName: dirSourceSettingNames.BIBLE_NOTES,
        defaultDirName: defaultDataDirNames.BIBLE_NOTES,
        iconClassName: 'bi-journal-text',
    },
];

export function getDataDirectoryBySettingName(settingName: string) {
    return (
        dataDirectories.find((dataDirectory) => {
            return dataDirectory.settingName === settingName;
        }) ?? null
    );
}
