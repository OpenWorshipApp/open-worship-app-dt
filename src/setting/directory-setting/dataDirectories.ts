import {
    appManagedDataDirNames,
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
    /**
     * Set ONLY on an app-managed folder — one the user cannot point anywhere,
     * so it has no directory setting to read. Resolved on demand (the archive
     * panel is the only thing that asks) and its presence is also what keeps
     * the folder off the Path Settings page: there is nothing to choose there.
     */
    getDirPath?: () => Promise<string | null>;
    /**
     * Archive only the files at the TOP of this folder whose name matches —
     * for a folder that also holds material the app can rebuild for itself.
     * Everything else in it, sub-folders included, stays out of the archive.
     */
    fileNamePattern?: RegExp;
};

/**
 * The archive keys a folder by `settingName`, so an app-managed folder still
 * needs one — a name that is deliberately NOT a `select-dir-*` setting, so
 * nothing can mistake it for a path the user picked.
 */
export const APP_MANAGED_BIBLE_DATA_KEY = 'app-dir-bible-data';

export const dataDirectories: DataDirectoryType[] = [
    {
        title: 'Documents',
        settingName: dirSourceSettingNames.APP_DOCUMENT,
        defaultDirName: defaultDataDirNames.APP_DOCUMENT,
        iconClassName: 'bi-file-earmark-text',
    },
    {
        title: 'Presenting Flows',
        settingName: dirSourceSettingNames.PRESENTING_FLOW,
        defaultDirName: defaultDataDirNames.PRESENTING_FLOW,
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
        title: 'Background Webs',
        settingName: dirSourceSettingNames.BACKGROUND_WEB,
        defaultDirName: defaultDataDirNames.BACKGROUND_WEB,
        iconClassName: 'bi-globe2',
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
        title: 'Bible Notes',
        settingName: dirSourceSettingNames.BIBLE_NOTES,
        defaultDirName: defaultDataDirNames.BIBLE_NOTES,
        iconClassName: 'bi-journal-text',
    },
    {
        // The bible XMLs the user added by hand, which live at the top of the
        // bible data folder. App-managed: `BibleDataReader.getWritableBiblePath`
        // fixes that folder under the parent directory, which is why it is
        // resolved here rather than read from a setting. Imported lazily so the
        // catalogue — pulled in by the Path Settings page — does not drag the
        // storage module along.
        //
        // Only the `.xml` files go in: the rest of the folder is the DOWNLOADED
        // bible databases (hundreds of MB of sub-folders), which the app can
        // fetch again and which would otherwise dominate every backup. Case
        // insensitive because a hand-added file may well arrive as `.XML`.
        title: 'Bibles XML',
        settingName: APP_MANAGED_BIBLE_DATA_KEY,
        defaultDirName: appManagedDataDirNames.BIBLE_DATA,
        iconClassName: 'bi-filetype-xml',
        fileNamePattern: /\.xml$/i,
        getDirPath: async () => {
            const { appLocalStorage } = await import('./appLocalStorage');
            const { pathJoin } = await import('../../server/fileHelpers');
            return pathJoin(
                appLocalStorage.defaultStorage,
                appManagedDataDirNames.BIBLE_DATA,
            );
        },
    },
];

/**
 * The folders the user can point somewhere — the only ones the Path Settings
 * page has anything to show for.
 */
export const selectableDataDirectories = dataDirectories.filter(
    (dataDirectory) => {
        return dataDirectory.getDirPath === undefined;
    },
);

export function getDataDirectoryBySettingName(settingName: string) {
    return (
        dataDirectories.find((dataDirectory) => {
            return dataDirectory.settingName === settingName;
        }) ?? null
    );
}
