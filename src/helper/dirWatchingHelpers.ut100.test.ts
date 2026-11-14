import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A list on a folder SESSION of its own -- a stick, a shared drive -- is
// heard too, but only the session in front, and only when it is not inside
// a folder already watched.
const h = vi.hoisted(() => ({
    pathSeparator: '/',
    parentDirPath: '/data' as string | null,
    childDirPaths: {} as Record<string, string>,
    activeSettingNames: {} as Record<string, string>,
    watch: vi.fn(),
}));

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [
        'select-dir-app-document',
        'select-dir-video-bg',
    ],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => {
        return h.activeSettingNames[settingName] ?? settingName;
    },
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
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
    h.activeSettingNames = {};
    h.watch.mockReset();
});

afterEach(() => {
    // `watchingState` is module state: release it so the next test starts.
    unwatchDataDir();
});

describe('the folder a list session is on', () => {
    test('a session on a stick is watched beside the data folder', async () => {
        h.activeSettingNames = {
            'select-dir-app-document': 'select-dir-app-document-sunday',
        };
        h.childDirPaths = {
            'select-dir-app-document-sunday': '/media/stick/sunday',
        };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['/data', '/media/stick/sunday']);
    });

    test('a session inside the data folder, or with no folder set, adds no watch', async () => {
        h.activeSettingNames = {
            'select-dir-app-document': 'select-dir-app-document-sunday',
            'select-dir-video-bg': 'select-dir-video-bg-easter',
        };
        h.childDirPaths = {
            'select-dir-app-document-sunday': '/data/sessions/sunday',
        };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['/data']);
    });

    test('a list on its own folder, no session, is not asked twice', async () => {
        h.parentDirPath = null;
        h.childDirPaths = { 'select-dir-video-bg': '/videos' };
        await watchDataDir();
        expect(getWatchedDirPaths()).toEqual(['/videos']);
    });
});
