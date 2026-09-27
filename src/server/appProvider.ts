import type http from 'node:http';
import type fs from 'node:fs';
import type zlip from 'node:zlib';
import type path from 'node:path';
import type * as nodeCrypto from 'node:crypto';

export type MessageEventType = {
    returnValue: any;
};

export type MessageUtilsType = {
    messageChannels: { screenMessage: string };
    sendData: (channel: string, ...args: any[]) => void;
    sendDataSync: (channel: string, ...args: any[]) => any;
    listenForData: (
        channel: string,
        callback: (event: MessageEventType, ...args: any[]) => void,
    ) => void;
    removeListener: (
        channel: string,
        callback: (event: MessageEventType, ...args: any[]) => void,
    ) => void;
    listenOnceForData: (
        channel: string,
        callback: (event: MessageEventType, ...args: any[]) => void,
    ) => void;
};

export type FileUtilsType = {
    createWriteStream: typeof fs.createWriteStream;
    createReadStream: typeof fs.createReadStream;
    readdir: typeof fs.readdir;
    readdirSync: typeof fs.readdirSync;
    stat: typeof fs.stat;
    mkdir: typeof fs.mkdir;
    writeFile: typeof fs.writeFile;
    rename: typeof fs.rename;
    renameSync: typeof fs.renameSync;
    unlink: typeof fs.unlink;
    rmdir: typeof fs.rmdir;
    readFile: typeof fs.readFile;
    openSync: typeof fs.openSync;
    readSync: typeof fs.readSync;
    fstatSync: typeof fs.fstatSync;
    closeSync: typeof fs.closeSync;
    readFileSync: typeof fs.readFileSync;
    writeFileSync: typeof fs.writeFileSync;
    unlinkSync: typeof fs.unlinkSync;
    existsSync: typeof fs.existsSync;
    mkdirSync: typeof fs.mkdirSync;
    copyFile: typeof fs.copyFile;
    copyBlobFile: (
        blobUrl: string,
        dest: fs.PathLike,
        callback: fs.NoParamCallback,
    ) => void;
    watch: typeof fs.watch;
    writeFileFromBase64Sync: (filePath: string, base64: string) => void;
    gunzipSync: typeof zlip.gunzipSync;
};

export type PathUtilsType = {
    sep: typeof path.sep;
    basename: typeof path.basename;
    dirname: typeof path.dirname;
    resolve: typeof path.resolve;
    join: typeof path.join;
};

export type SystemUtilsType = {
    copyToClipboard: (str: string) => void;
    commitHash?: string;
    isDev: boolean;
    isWindows: boolean;
    isWindowsStore: boolean;
    is64System: boolean;
    isMac: boolean;
    isArm64: boolean;
    isLinux: boolean;
    isUbuntu: boolean;
    isFedora: boolean;
    // Whether the OS compositor can put a translucent backdrop behind a
    // window, i.e. whether the `appGlassy` popup feature does anything. A
    // renderer that styles itself for glass must read this and not assume it.
    isGlassCapable: boolean;
    openFile: (filePath: string) => void;
    generateFileMD5: (filePath: string) => Promise<string>;
    generateMD5: (input: string) => string;
};

export type AppInfoType = {
    name: string;
    title: string;
    titleFull: string;
    description: string;
    author: string;
    homepage: string;
    gitRepository: string;
    version: string;
    versionNumber: number;
};
// An installed family and the CSS font weights it ships, `['400', '700']`
// (`electron/fontListHelpers.ts`).
export type FontListType = {
    [key: string]: string[];
};
export type AppUtilsType = {
    handleError: (error: any) => void;
    base64Encode: (str: string) => string;
    base64Decode: (str: string) => string;
};

export enum AppTypeEnum {
    Desktop = 'desktop',
    Web = 'web',
    Mobile = 'mobile',
}

export type PagePropsType = {
    isPageFinder: boolean;
    finderHomePage: string;
    isPagePresenter: boolean;
    presenterHomePage: string;
    isPageAppDocumentEditor: boolean;
    appDocumentEditorHomePage: string;
    isPageReader: boolean;
    readerHomePage: string;
    isPageScreen: boolean;
    screenHomePage: string;
    isPageSetting: boolean;
    settingHomePage: string;
    isPageExperiment: boolean;
    isPageLyricEditor: boolean;
    lyricEditorHomePage: string;
    isPageAbout: boolean;
    aboutHomePage: string;
    isPageChatbot: boolean;
    chatbotHomePage: string;
    isPageAichat: boolean;
    aichatHomePage: string;
    isPageLWShare: boolean;
    isMainPage: boolean;
    lwShareHomePage: string;
    bibleNoteHomePage: string;
    isPageMarkdownPreview: boolean;
    markdownPreviewHomePage: string;
    webEditorHomePage: string;
    experimentHomePage: string;
    getIsMouseOverApp: () => boolean;
    getIsWindowFocused: () => boolean;
};

interface SQLite3DatabaseType {
    close: () => void;
    loadExtension: (path: string) => void;
    enableLoadExtension: (allow: boolean) => void;
    exec: (sql: string) => void;
    open: () => any;
    prepare: (sql: string) => any;
    createSession: (options: any) => any;
    applyChangeset: (changeset: any, options: any) => void;
}
export type SQLiteDatabaseType = {
    database: SQLite3DatabaseType;
    exec: (sql: string) => void;
    createTable: (createTableSQL: string) => void;
    getAll: (sql: string) => any[];
    close: () => void;
};

type YTHelper = {
    on: (event: string, listener: (...args: any[]) => void) => YTHelper;
    off: (event: string, listener: (...args: any[]) => void) => YTHelper;
    exec: (
        args: string[],
        options?: { cwd?: string; env?: NodeJS.ProcessEnv },
    ) => YTHelper;
    // For the calls that only want yt-dlp's stdout (`-g`, `-J`, ...) rather
    // than a download to follow along with.
    execPromise: (
        args: string[],
        options?: { cwd?: string; env?: NodeJS.ProcessEnv },
    ) => Promise<string>;
    ytDlpProcess: {
        pid: number;
    };
};

type EnvUtilsType = {
    isFEUseEffectWarning: boolean;
};

export type AppProviderType = Readonly<
    PagePropsType & {
        appType: AppTypeEnum;
        isDesktop: boolean;
        fontUtils: {
            getFonts: () => Promise<FontListType>;
        };
        cryptoUtils: {
            encrypt: (text: string, key: string) => string;
            decrypt: (text: string, key: string) => string;
            createHash: (algorithm: string) => nodeCrypto.Hash;
        };
        browserUtils: {
            pathToFileURL: (filePath: string) => string;
            openExternalURL: (url: string) => void;
        };
        messageUtils: MessageUtilsType;
        httpUtils: {
            request: typeof http.request;
            requestHttp: typeof http.request;
        };
        fileUtils: FileUtilsType;
        pathUtils: PathUtilsType;
        systemUtils: SystemUtilsType;
        appInfo: AppInfoType;
        reload: () => void;
        appUtils: AppUtilsType;
        databaseUtils: {
            getSQLiteDatabaseInstance: (
                databaseName: string,
            ) => Promise<SQLiteDatabaseType>;
        };
        presenterHomePage: string;
        readerHomePage: string;
        currentHomePage: string;
        ytUtils: {
            // The path is passed in: the binaries live in the user's data
            // directory now, which the preload cannot resolve. See
            // `src/helper/extra-bin/extraBinHelpers.tsx`.
            getYTHelper: (ytDlpBinPath: string) => Promise<YTHelper>;
        };
        windowTitle: string;
        POPUP_FRAME_NAME_PREFIX: string;
        init: () => Promise<void>;
        envUtils: EnvUtilsType;
        // The one field that changes while the window runs (`Readonly` is
        // shallow). Filled at start-up, never by the preload, which is frozen.
        sessionData: {
            // The data folder that `fileHelpers` aliases as `$DATA_DIR_PATH`
            // in file contents; `null` turns the aliasing off.
            defaultStorageDirPath: string | null;
        };
    }
>;

let isMouseOverApp = false;
document.addEventListener('mouseenter', () => {
    isMouseOverApp = true;
});
document.addEventListener('mouseleave', () => {
    isMouseOverApp = false;
});

const providerSource = (globalThis as any).provider;

const HOME_PAGE_KEY_PATTERN = /^(\w+)HomePage$/;

/**
 * Names the page from the renderer's OWN location. The preload names it too,
 * once, from whatever location it saw while it ran, and a Reader once booted
 * with every `isPage*` flag false: no way back to the Presenter, and the
 * Presenter's Bibles list and settings read and written in its place. The
 * page being drawn is this document, so its pathname is the truth; the
 * `*HomePage` paths the preload publishes do not depend on the location, so
 * they are still right to match against. A disagreement is logged, because
 * it is the evidence of how the preload came to see another page.
 */
export function toPageFlags(
    source: { [key: string]: unknown } | undefined,
    pathname: string,
) {
    const flags: { [key: string]: unknown } = {};
    if (!source || !pathname) {
        return flags;
    }
    flags.currentHomePage = pathname;
    const mismatches: string[] = [];
    for (const [key, value] of Object.entries(source)) {
        const match = HOME_PAGE_KEY_PATTERN.exec(key);
        if (match === null || key === 'currentHomePage') {
            continue;
        }
        if (typeof value !== 'string' || !value) {
            continue;
        }
        const name = match[1];
        const flagKey = `isPage${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        const isCurrentPage = pathname.startsWith(value);
        if (
            typeof source[flagKey] === 'boolean' &&
            source[flagKey] !== isCurrentPage
        ) {
            mismatches.push(flagKey);
        }
        flags[flagKey] = isCurrentPage;
    }
    if (mismatches.length > 0) {
        console.warn(
            `[appProvider] the preload named page "${source.currentHomePage}"` +
                ` but this is "${pathname}"; corrected ${mismatches.join(', ')}`,
        );
    }
    return flags;
}

const pageFlags = toPageFlags(
    providerSource,
    globalThis.location?.pathname ?? '',
);

const appProvider = {
    ...providerSource,
    ...pageFlags,
    windowTitle: document.title,
    sessionData: { defaultStorageDirPath: null },
    isMainPage: Boolean(
        (pageFlags.isPageReader ?? providerSource?.isPageReader) ||
        (pageFlags.isPagePresenter ?? providerSource?.isPagePresenter),
    ),
    getIsMouseOverApp: () => {
        return isMouseOverApp;
    },
    getIsWindowFocused: () => {
        return document.hasFocus();
    },
} as AppProviderType;

// for security reason, appProvider should not be accessible globally
if (providerSource) {
    delete (globalThis as any).provider;
}

export default appProvider;
