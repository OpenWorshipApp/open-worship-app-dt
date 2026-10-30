import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dirents: [] as { name: string; isDirectory: boolean }[],
    fsListDirentsMock: vi.fn(),
    addResourcesFoldersToListMock: vi.fn(),
}));

vi.mock('./appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data' },
}));

vi.mock('../../server/fileHelpers', () => ({
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    fsListDirents: h.fsListDirentsMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../resources/resourcesFolderHelpers', () => ({
    addResourcesFoldersToList: h.addResourcesFoldersToListMock,
}));

import {
    APP_MANAGED_BIBLE_DATA_KEY,
    APP_MANAGED_RESOURCES_KEY,
    dataDirectories,
    getDataDirectoryBySettingName,
    selectableDataDirectories,
} from './dataDirectories';

beforeEach(() => {
    h.fsListDirentsMock.mockImplementation(async () => h.dirents);
});

describe('dataDirectories', () => {
    test('every folder has its own setting name', () => {
        const settingNames = dataDirectories.map((dataDirectory) => {
            return dataDirectory.settingName;
        });
        expect(new Set(settingNames).size).toBe(settingNames.length);
        expect(settingNames).toContain(APP_MANAGED_BIBLE_DATA_KEY);
        expect(settingNames).toContain(APP_MANAGED_RESOURCES_KEY);
    });

    test('the Path Settings page lists only the folders a user can point', () => {
        expect(selectableDataDirectories.length).toBe(
            dataDirectories.length - 2,
        );
        expect(
            selectableDataDirectories.some((dataDirectory) => {
                return dataDirectory.getDirPath !== undefined;
            }),
        ).toBe(false);
        expect(
            selectableDataDirectories.map((dataDirectory) => {
                return dataDirectory.title;
            }),
        ).not.toContain('Bibles XML');
    });

    test('finds a folder by its setting name, or nothing', () => {
        expect(getDataDirectoryBySettingName(APP_MANAGED_RESOURCES_KEY)).toBe(
            dataDirectories.at(-1),
        );
        expect(getDataDirectoryBySettingName('select-dir-nowhere')).toBeNull();
    });

    test('the app-managed folders sit under the data folder', async () => {
        const bibleData = getDataDirectoryBySettingName(
            APP_MANAGED_BIBLE_DATA_KEY,
        )!;
        const resources = getDataDirectoryBySettingName(
            APP_MANAGED_RESOURCES_KEY,
        )!;

        await expect(bibleData.getDirPath!()).resolves.toBe(
            '/data/bibles-data',
        );
        await expect(resources.getDirPath!()).resolves.toBe('/data/resources');
        // Only the hand-added XML files of the Bible folder travel.
        expect(bibleData.fileNamePattern!.test('KJV.XML')).toBe(true);
        expect(bibleData.fileNamePattern!.test('KJV.xml.cache')).toBe(false);
    });

    test('restored resource folders are put back on the panel list', async () => {
        const resources = getDataDirectoryBySettingName(
            APP_MANAGED_RESOURCES_KEY,
        )!;
        h.dirents = [
            { name: 'Sermons', isDirectory: true },
            { name: '.trash', isDirectory: true },
            { name: 'notes.md', isDirectory: false },
            { name: 'Songs PDF', isDirectory: true },
        ];

        await resources.afterImport!('/data/resources', '/tmp/extracted');

        expect(h.fsListDirentsMock).toHaveBeenCalledWith('/tmp/extracted');
        expect(h.addResourcesFoldersToListMock).toHaveBeenCalledWith([
            '/data/resources/Sermons',
            '/data/resources/Songs PDF',
        ]);
    });
});
