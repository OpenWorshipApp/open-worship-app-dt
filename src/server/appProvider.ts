import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export type MessageEventType = {
    returnValue: any;
};

export type MessageUtilsType = {
    channels: { screenMessageChannel: string };
    sendData: (channel: string, ...args: any[]) => void;
    sendDataSync: (channel: string, ...args: any[]) => any;
    listenForData: (
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
    stat: typeof fs.stat;
    mkdir: typeof fs.mkdir;
    writeFile: typeof fs.writeFile;
    rename: typeof fs.rename;
    unlink: typeof fs.unlink;
    rmdir: typeof fs.rmdir;
    readFile: typeof fs.readFile;
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
    writeFileFromBase64: (filePath: string, base64: string) => void;
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
    isDev: boolean;
    isWindows: boolean;
    is64System: boolean;
    isMac: boolean;
    isArm64: boolean;
    isLinux: boolean;
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
    isPageEditor: boolean;
    editorHomePage: string;
    isPageReader: boolean;
    readerHomePage: string;
    isPageScreen: boolean;
    screenHomePage: string;
    isPageSetting: boolean;
    settingHomePage: string;
    isPageExperiment: boolean;
    experimentHomePage: string;
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

type PowerPointHelperType = {
    countSlides: (filePath: string) => number | null;
};
type YTHelper = {
    on: (event: string, listener: (...args: any[]) => void) => YTHelper;
    off: (event: string, listener: (...args: any[]) => void) => YTHelper;
    exec: (
        args: string[],
        options?: { cwd?: string; env?: NodeJS.ProcessEnv },
    ) => YTHelper;
    ytDlpProcess: {
        pid: number;
    };
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
        };
        browserUtils: {
            pathToFileURL: (filePath: string) => string;
            openExternalURL: (url: string) => void;
        };
        messageUtils: MessageUtilsType;
        httpUtils: {
            request: typeof http.request;
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
        powerPointUtils: {
            getPowerPointHelper: (
                dotNetRoot?: string,
            ) => Promise<PowerPointHelperType | null>;
        };
        ytUtils: {
            getYTHelper: () => Promise<YTHelper>;
            ffmpegBinPath: string;
        };
    }
>;

const appProvider = (window as any).provider as AppProviderType;

export default appProvider;
