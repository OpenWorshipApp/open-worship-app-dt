import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

// A child folder set to the parent directory itself — or, on Windows, to
// another spelling of it — costs no watch of its own.
const h = vi.hoisted(() => ({
    pathSeparator: '/',
    parentDirPath: '/data' as string | null,
    childDirPaths: {} as Record<string, string>,
    watch: vi.fn(),
}));

vi.mock('./DirSource', () => ({
    default: {
        getAllInstances: () => [],
        getInstanceByDirPath: () => null,
        getDirPathBySettingName: (settingName: string) => {
            return h.childDirPaths[settingName] ?? null;
        },
    },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: () => ({ fireUpdateEvent: () => {} }),
        fireDeleteEventByPath: () => {},
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: async () => true,
    fsCheckFileExist: async () => false,
    pathJoin: (...paths: string[]) => paths.join(h.pathSeparator),
    pathDirname: (filePath: string) => {
        return filePath
            .split(h.pathSeparator)
            .slice(0, -1)
            .join(h.pathSeparator);
    },
    pathResolve: (dirPath: string) => dirPath,
    get pathSeparator() {
        return h.pathSeparator;
    },
}));
vi.mock('../server/comparisonHelpers', () => ({
    checkAreArraysEqual: () => true,
}));
vi.mock('../server/appProvider', () => ({
    default: { fileUtils: { watch: h.watch } },
}));
vi.mock('./errorHelpers', () => ({ handleError: () => {} }));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getSelectedParentDirectory: async () => h.parentDirPath,
    },
}));
vi.mock('../setting/directory-setting/dataDirectories', () => ({
    selectableDataDirectories: [
        { settingName: 'select-dir-app-document' },
        { settingName: 'select-dir-video-bg' },
    ],
}));

import { unwatchDataDir, watchDataDir } from './dirWatchingHelpers';

function getWatchedDirPaths() {
    return h.watch.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
    h.pathSeparator = '/';
    h.parentDirPath = '/data';
    h.childDirPaths = {};
});

afterEach(() => {
    // `watchingState` is module state: release it so the next test starts.
    unwatchDataDir();
});

describe('the folders the data watch is rooted at', () => {
    test('a child folder set to the parent directory itself adds no watch', async () => {
        h.childDirPaths = { 'select-dir-app-document': '/data' };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['/data']);
    });

    test('on Windows another spelling of a folder is the same folder', async () => {
        h.pathSeparator = '\\';
        h.parentDirPath = 'C:\\Data';
        h.childDirPaths = {
            'select-dir-app-document': 'c:\\data',
            'select-dir-video-bg': 'C:\\DATA\\Videos',
        };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['C:\\Data']);
    });

    test('elsewhere a folder spelled in another case is another folder', async () => {
        h.parentDirPath = '/Data';
        h.childDirPaths = { 'select-dir-app-document': '/data' };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['/Data', '/data']);
    });
});
