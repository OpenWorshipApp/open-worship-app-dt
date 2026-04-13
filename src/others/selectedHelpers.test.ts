import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getDirPathBySettingNameMock,
    getSettingMock,
    setSettingMock,
    fsCheckDirExistMock,
    fsCheckFileExistMock,
    baseDirFileFullNameOrPathMap,
    baseDirResolvedFilePathMap,
} = vi.hoisted(() => ({
    getDirPathBySettingNameMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(async () => true),
    fsCheckFileExistMock: vi.fn(async () => true),
    baseDirFileFullNameOrPathMap: {} as Record<string, string | null | undefined>,
    baseDirResolvedFilePathMap: {} as Record<string, string | null | undefined>,
}));

vi.mock('../helper/DirSource', () => ({
    default: {
        getDirPathBySettingName: getDirPathBySettingNameMock,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
    fsCheckFileExist: fsCheckFileExistMock,
}));

vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class BaseDirFileSourceMock {
        private readonly settingName: string;
        private readonly fileFullNameOrFilePathValue: string;

        constructor(settingName: string, fileFullNameOrFilePath: string) {
            this.settingName = settingName;
            this.fileFullNameOrFilePathValue = fileFullNameOrFilePath;
        }

        get fileFullNameOrFilePath() {
            const key = `${this.settingName}|${this.fileFullNameOrFilePathValue}`;
            return baseDirFileFullNameOrPathMap[key];
        }

        get fileSource() {
            const key = `${this.settingName}|${this.fileFullNameOrFilePathValue}`;
            const resolved = baseDirResolvedFilePathMap[key];
            if (resolved === null || resolved === undefined) {
                return resolved === null ? null : undefined;
            }
            return { filePath: resolved };
        }
    },
}));

import {
    checkSelectedFilePathExist,
    getSelectedFilePath,
    getSelectedFilePathWithEnsure,
    setSelectedFilePath,
} from './selectedHelpers';

describe('selectedHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(baseDirFileFullNameOrPathMap)) {
            delete baseDirFileFullNameOrPathMap[key];
        }
        for (const key of Object.keys(baseDirResolvedFilePathMap)) {
            delete baseDirResolvedFilePathMap[key];
        }
        fsCheckDirExistMock.mockResolvedValue(true);
        fsCheckFileExistMock.mockResolvedValue(true);
        getDirPathBySettingNameMock.mockReturnValue('/base');
        getSettingMock.mockReturnValue('saved-name.txt');
    });

    test('validates existing selected file paths', async () => {
        expect(
            await checkSelectedFilePathExist('setting', 'base-setting', '/base/file.txt'),
        ).toBe(true);
        expect(setSettingMock).not.toHaveBeenCalled();
    });

    test('clears invalid selections when both file and base directory are unavailable', async () => {
        fsCheckFileExistMock.mockResolvedValue(false);
        getDirPathBySettingNameMock.mockReturnValue(null);

        expect(
            await checkSelectedFilePathExist('setting', 'base-setting', '/missing.txt'),
        ).toBe(false);
        expect(setSettingMock).toHaveBeenCalledWith('setting', '');
    });

    test('resolves relative selections through the base directory helper', () => {
        baseDirResolvedFilePathMap['base-setting|saved-name.txt'] =
            '/base/saved-name.txt';

        expect(getSelectedFilePath('setting', 'base-setting')).toBe(
            '/base/saved-name.txt',
        );
    });

    test('returns null when ensured selections are invalid', async () => {
        fsCheckFileExistMock.mockResolvedValue(false);
        fsCheckDirExistMock.mockResolvedValue(false);

        expect(
            await getSelectedFilePathWithEnsure('setting', 'base-setting'),
        ).toBeNull();
    });

    test('stores relative paths and clears settings for null selections', () => {
        baseDirFileFullNameOrPathMap['base-setting|/base/final.txt'] = 'final.txt';

        setSelectedFilePath('setting', 'base-setting', '/base/final.txt');
        setSelectedFilePath('setting', 'base-setting', null);

        expect(setSettingMock).toHaveBeenNthCalledWith(1, 'setting', 'final.txt');
        expect(setSettingMock).toHaveBeenNthCalledWith(2, 'setting', '');
    });
});
