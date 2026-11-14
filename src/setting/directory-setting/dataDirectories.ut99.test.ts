import { beforeEach, describe, expect, test, vi } from 'vitest';

// The one list of data folders: what Path Settings shows, what the archive
// finds by setting name, and the two app-managed folders resolved on demand.
const { state, mocks } = vi.hoisted(() => ({
    state: { defaultStorageDirPath: '/home/data' },
    mocks: {
        listDirents: vi.fn(),
        addFolders: vi.fn(),
    },
}));

vi.mock('./appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorageDirPath() {
            return state.defaultStorageDirPath;
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    fsListDirents: mocks.listDirents,
}));
vi.mock('../../resources/resourcesFolderHelpers', () => ({
    addResourcesFoldersToList: mocks.addFolders,
}));

import {
    APP_MANAGED_BIBLE_DATA_KEY,
    APP_MANAGED_RESOURCES_KEY,
    dataDirectories,
    getDataDirectoryBySettingName,
    selectableDataDirectories,
} from './dataDirectories';
import {
    appManagedDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';

beforeEach(() => {
    state.defaultStorageDirPath = '/home/data';
});

describe('the data folders', () => {
    test('Path Settings lists every folder but the app-managed ones, in order', () => {
        expect(selectableDataDirectories.map((one) => one.title)).toEqual([
            'Documents',
            'Presenting Flows',
            'Background Images',
            'Background Videos',
            'Background Audios',
            'Background Webs',
            'Foreground Images',
            'Foreground Videos',
            'Bible Present',
            'Bible Reader',
            'Bible Notes',
        ]);
        expect(dataDirectories.slice(-2).map((one) => one.title)).toEqual([
            'Bibles XML',
            'Resources',
        ]);
        // The archive keys a folder by its setting name.
        const settingNames = dataDirectories.map((one) => one.settingName);
        expect(new Set(settingNames).size).toBe(settingNames.length);
    });

    test('a folder is found by its setting name, and nothing for another', () => {
        expect(
            getDataDirectoryBySettingName(dirSourceSettingNames.APP_DOCUMENT)
                ?.title,
        ).toBe('Documents');
        expect(
            getDataDirectoryBySettingName(APP_MANAGED_RESOURCES_KEY)?.title,
        ).toBe('Resources');
        expect(getDataDirectoryBySettingName('select-dir-unknown')).toBeNull();
    });
});

describe('the app-managed folders', () => {
    test('the bibles XML folder lies under the data folder and takes .xml only', async () => {
        const bibles = getDataDirectoryBySettingName(
            APP_MANAGED_BIBLE_DATA_KEY,
        )!;
        await expect(bibles.getDirPath!()).resolves.toBe(
            `/home/data/${appManagedDataDirNames.BIBLE_DATA}`,
        );
        state.defaultStorageDirPath = '/stick/data';
        await expect(bibles.getDirPath!()).resolves.toBe(
            `/stick/data/${appManagedDataDirNames.BIBLE_DATA}`,
        );
        expect(
            ['KJV.xml', 'MadeUp.XML', 'kjv.db', 'KJV.xml.bak'].filter((name) =>
                bibles.fileNamePattern!.test(name),
            ),
        ).toEqual(['KJV.xml', 'MadeUp.XML']);
        expect(bibles.afterImport).toBeUndefined();
    });

    test('the resources folder lies under the data folder and is taken whole', async () => {
        const resources = getDataDirectoryBySettingName(
            APP_MANAGED_RESOURCES_KEY,
        )!;
        await expect(resources.getDirPath!()).resolves.toBe(
            `/home/data/${appManagedDataDirNames.RESOURCES}`,
        );
        expect(resources.fileNamePattern).toBeUndefined();
    });

    test('imported resources put each visible folder back on the panel list', async () => {
        mocks.listDirents.mockResolvedValue([
            { name: 'Sermons', isDirectory: true, isFile: false },
            { name: '.cache', isDirectory: true, isFile: false },
            { name: 'notes.txt', isDirectory: false, isFile: true },
            { name: 'Youth', isDirectory: true, isFile: false },
        ]);
        const resources = getDataDirectoryBySettingName(
            APP_MANAGED_RESOURCES_KEY,
        )!;
        await resources.afterImport!(
            '/home/data/resources',
            '/tmp/x/resources',
        );
        expect(mocks.listDirents).toHaveBeenCalledWith('/tmp/x/resources');
        expect(mocks.addFolders).toHaveBeenCalledExactlyOnceWith([
            '/home/data/resources/Sermons',
            '/home/data/resources/Youth',
        ]);
    });
});
