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
    /**
     * Run once Import Data has copied this folder back: `dirPath` is where it
     * went, `extractedDirPath` the unpacked copy it came from — for a folder
     * whose files mean nothing to the app until a setting points at them.
     */
    afterImport?: (dirPath: string, extractedDirPath: string) => Promise<void>;
};

/**
 * The archive keys a folder by `settingName`, so an app-managed folder still
 * needs one — a name that is deliberately NOT a `select-dir-*` setting, so
 * nothing can mistake it for a path the user picked.
 */
export const APP_MANAGED_BIBLE_DATA_KEY = 'app-dir-bible-data';
export const APP_MANAGED_RESOURCES_KEY = 'app-dir-resources';

async function getAppManagedDirPath(dirName: string) {
    const { appLocalStorage } = await import('./appLocalStorage');
    const { pathJoin } = await import('../../server/fileHelpers');
    return pathJoin(appLocalStorage.defaultStorageDirPath, dirName);
}

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
        // The overlay clips and pictures the Foreground panel's Video Show and
        // Image Show list -- kept apart from the backgrounds because they are
        // a different kind of material, and listed here so the Path Settings
        // page can re-aim them and the whole-data archive carries them. A
        // folder of overlay clips can be large; its row unticks like the
        // Background Videos one.
        title: 'Foreground Images',
        settingName: dirSourceSettingNames.FOREGROUND_IMAGE,
        defaultDirName: defaultDataDirNames.FOREGROUND_IMAGE,
        iconClassName: 'bi-images',
    },
    {
        title: 'Foreground Videos',
        settingName: dirSourceSettingNames.FOREGROUND_VIDEO,
        defaultDirName: defaultDataDirNames.FOREGROUND_VIDEO,
        iconClassName: 'bi-camera-reels',
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
        getDirPath: () => {
            return getAppManagedDirPath(appManagedDataDirNames.BIBLE_DATA);
        },
    },
    {
        // `<parent dir>/resources`, where the Resources panel's **Copy to Data
        // Directory** puts a folder (`src/resources/resourcesCopyHelpers.ts`).
        // App-managed for the same reason as the bible data: its place is
        // fixed under the parent directory, so there is no setting to read.
        //
        // The WHOLE folder goes in, sub-folders and all: these are the user's
        // own PDFs, notes and link lists, and nothing in it can be fetched
        // again. It can be large; its row can be unticked like the videos one.
        title: 'Resources',
        settingName: APP_MANAGED_RESOURCES_KEY,
        defaultDirName: appManagedDataDirNames.RESOURCES,
        iconClassName: 'bi-folder2-open',
        getDirPath: () => {
            return getAppManagedDirPath(appManagedDataDirNames.RESOURCES);
        },
        // The panel lists only the folders on its own list, and that list is
        // a setting rather than data, so it never travels: each folder the
        // archive held is put back on it, or the restore would show nothing.
        afterImport: async (dirPath, extractedDirPath) => {
            const { checkIsHiddenName, fsListDirents, pathJoin } =
                await import('../../server/fileHelpers');
            const { addResourcesFoldersToList } =
                await import('../../resources/resourcesFolderHelpers');
            const dirents = await fsListDirents(extractedDirPath);
            addResourcesFoldersToList(
                dirents
                    .filter((dirent) => {
                        return (
                            dirent.isDirectory &&
                            !checkIsHiddenName(dirent.name)
                        );
                    })
                    .map((dirent) => {
                        return pathJoin(dirPath, dirent.name);
                    }),
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
