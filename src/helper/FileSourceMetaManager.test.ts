import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    appHandleErrorMock,
    fsCheckFileExistMock,
    checkIsAppFileMock,
    fileSourceGetInstanceMock,
    isColorMock,
    settingState,
} = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    appHandleErrorMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    checkIsAppFileMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    isColorMock: vi.fn(),
    settingState: {
        value: {} as Record<string, string>,
    },
}));

vi.mock('../event/ToastEventListener', () => ({
    default: {
        showSimpleToast: showSimpleToastMock,
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appUtils: {
            handleError: appHandleErrorMock,
        },
    },
}));

vi.mock('../server/fileHelpers', () => ({
    checkIsAppFile: checkIsAppFileMock,
    fsCheckFileExist: fsCheckFileExistMock,
    KEY_SEPARATOR: '::',
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('./helpers', () => ({
    isColor: isColorMock,
}));

vi.mock('./SettingManager', () => ({
    default: class SettingManagerMock<T> {
        getSetting() {
            return settingState.value as T;
        }

        setSetting(value: T) {
            settingState.value = { ...(value as Record<string, string>) };
        }
    },
}));

import FileSourceMetaManager, {
    getColorNoteFilePathSetting,
    setColorNoteFilePathSetting,
} from './FileSourceMetaManager';

function createFileSource(
    fullName: string,
    jsonData: Record<string, unknown> | null = null,
) {
    return {
        fullName,
        readFileJsonData: vi.fn(async () => jsonData),
        writeFileData: vi.fn(async (data: string) => data),
    };
}

describe('FileSourceMetaManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        settingState.value = {};

        fsCheckFileExistMock.mockResolvedValue(true);
        checkIsAppFileMock.mockReturnValue(false);
        isColorMock.mockImplementation((color: string) => {
            return ['red', 'blue', 'green'].includes(color);
        });
    });

    test('stores and retrieves non-app color-note settings', () => {
        setColorNoteFilePathSetting('/docs/file.txt', null, 'red');
        setColorNoteFilePathSetting('/docs/file.txt', 7, 'blue');

        expect(settingState.value).toEqual({
            '/docs/file.txt': 'red',
            '/docs/file.txt::7': 'blue',
        });
        expect(getColorNoteFilePathSetting('/docs/file.txt', null)).toBe('red');
        expect(getColorNoteFilePathSetting('/docs/file.txt', 7)).toBe('blue');

        settingState.value['/docs/file.txt'] = 'invalid';
        expect(getColorNoteFilePathSetting('/docs/file.txt', null)).toBeNull();

        setColorNoteFilePathSetting('/docs/file.txt', null, null);
        expect(settingState.value['/docs/file.txt']).toBeUndefined();
    });

    test('returns null when the file does not exist', async () => {
        fsCheckFileExistMock.mockResolvedValue(false);

        expect(
            await FileSourceMetaManager.getColorNote('/missing/file.txt'),
        ).toBeNull();
        expect(
            await FileSourceMetaManager.setColorNote(
                '/missing/file.txt',
                'red',
            ),
        ).toBeNull();
    });

    test('reads color notes from app documents and reports unreadable files', async () => {
        checkIsAppFileMock.mockReturnValue(true);

        const goodFileSource = createFileSource('slide.owa', {
            metadata: { colorNote: 'blue' },
        });
        const badFileSource = createFileSource('broken.owa', null);

        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return filePath.includes('broken') ? badFileSource : goodFileSource;
        });

        expect(
            await FileSourceMetaManager.getColorNote('/docs/slide.owa'),
        ).toBe('blue');
        expect(
            await FileSourceMetaManager.getColorNote('/docs/broken.owa'),
        ).toBeUndefined();
        expect(appHandleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Unable to read data from /docs/broken.owa}',
            }),
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith({
            title: 'Color Note',
            message: 'Unable to read file',
        });
    });

    test('writes color notes to app documents and plain files', async () => {
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return filePath.endsWith('.owa')
                ? createFileSource('slide.owa', { metadata: { saved: true } })
                : createFileSource('note.txt');
        });
        checkIsAppFileMock.mockImplementation((fullName: string) => {
            return fullName.endsWith('.owa');
        });

        const writeResult = await FileSourceMetaManager.setColorNote(
            '/docs/slide.owa',
            'green',
        );

        const appFileSource = fileSourceGetInstanceMock.mock.results[0].value;
        expect(appFileSource.writeFileData).toHaveBeenCalledWith(
            JSON.stringify({ metadata: { saved: true, colorNote: 'green' } }),
        );
        expect(writeResult).toBe(
            JSON.stringify({ metadata: { saved: true, colorNote: 'green' } }),
        );

        await FileSourceMetaManager.setColorNote('/docs/plain.txt', 'red');
        expect(settingState.value['/docs/plain.txt']).toBe('red');
    });

    test('cleans up stale file-path settings', async () => {
        settingState.value = {
            '/docs/keep.txt': 'red',
            '/docs/remove.txt': 'blue',
            '/docs/slide.owa::4': 'green',
        };

        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath === '/docs/keep.txt';
        });

        await FileSourceMetaManager.checkAllColorNotes();

        expect(settingState.value).toEqual({
            '/docs/keep.txt': 'red',
        });
    });
});
