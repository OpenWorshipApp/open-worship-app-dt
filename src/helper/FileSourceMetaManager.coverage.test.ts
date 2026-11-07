import { beforeEach, describe, expect, test, vi } from 'vitest';

// The archive side of the color notes (a file's whole set of notes, read and
// written in one pass) and the branches the sibling suite leaves out.
const { mocks, settingState } = vi.hoisted(() => ({
    mocks: {
        showSimpleToast: vi.fn(),
        appHandleError: vi.fn(),
        fsCheckFileExist: vi.fn(),
        checkIsAppFile: vi.fn(),
        getInstance: vi.fn(),
    },
    settingState: {
        value: {} as Record<string, string>,
        writeCount: 0,
    },
}));

vi.mock('../event/ToastEventListener', () => ({
    default: { showSimpleToast: mocks.showSimpleToast },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        appUtils: { handleError: mocks.appHandleError },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../server/fileHelpers', () => ({
    checkIsAppFile: mocks.checkIsAppFile,
    fsCheckFileExist: mocks.fsCheckFileExist,
    fsCheckDirExist: async () => true,
    checkIsNativeAbsolutePath: (filePath: string) => filePath.startsWith('/'),
    pathDirname: (filePath: string) => {
        return filePath.substring(0, filePath.lastIndexOf('/'));
    },
    KEY_SEPARATOR: '::',
}));
vi.mock('./FileSource', () => ({
    default: { getInstance: mocks.getInstance },
}));
vi.mock('./helpers', () => ({
    isColor: (color: unknown) => {
        return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color);
    },
}));
vi.mock('./SettingManager', () => ({
    default: class SettingManagerMock<T> {
        getSetting() {
            return settingState.value as T;
        }

        setSetting(value: T) {
            settingState.writeCount += 1;
            settingState.value = { ...(value as Record<string, string>) };
        }
    },
}));

import FileSourceMetaManager, {
    COLOR_NOTE_SELF_KEY,
    getColorNoteFilePathSettings,
    setColorNoteFilePathSettings,
    subscribeColorNoteFilePathSetting,
} from './FileSourceMetaManager';

beforeEach(() => {
    settingState.value = {};
    settingState.writeCount = 0;
    mocks.fsCheckFileExist.mockResolvedValue(true);
    mocks.checkIsAppFile.mockReturnValue(false);
});

describe('a file’s color notes as one set', () => {
    test('collects the file’s own note and its items’, nothing else', () => {
        settingState.value = {
            '/docs/a.ows': '#ff0000',
            '/docs/a.ows::3': '#0000ff',
            '/docs/a.ows::4': 'not a color',
            // Another file whose name merely starts the same way.
            '/docs/a.owsx': '#00ff00',
            '/docs/b.ows::1': '#00ff00',
        };
        expect(getColorNoteFilePathSettings('/docs/a.ows')).toEqual({
            [COLOR_NOTE_SELF_KEY]: '#ff0000',
            '3': '#0000ff',
        });
        expect(getColorNoteFilePathSettings('/docs/none.ows')).toEqual({});
    });

    test('writes the valid notes back in one save and tells their readers', () => {
        const selfReader = vi.fn();
        const itemReader = vi.fn();
        const releases = [
            subscribeColorNoteFilePathSetting('/docs/a.ows', null, selfReader),
            subscribeColorNoteFilePathSetting('/docs/a.ows', '5', itemReader),
        ];
        try {
            setColorNoteFilePathSettings('/docs/a.ows', {
                [COLOR_NOTE_SELF_KEY]: '#ff0000',
                '5': '#0000ff',
                '6': 'purple-ish',
                '7': 12,
            });
        } finally {
            releases.forEach((release) => release());
        }
        expect(settingState.value).toEqual({
            '/docs/a.ows': '#ff0000',
            '/docs/a.ows::5': '#0000ff',
        });
        expect(settingState.writeCount).toBe(1);
        expect(selfReader).toHaveBeenCalledExactlyOnceWith('#ff0000');
        expect(itemReader).toHaveBeenCalledExactlyOnceWith('#0000ff');
    });

    test('saves nothing when no note in the set is a color', () => {
        settingState.value = { '/docs/a.ows': '#ff0000' };
        setColorNoteFilePathSettings('/docs/a.ows', { '1': 'red?', '2': null });
        expect(settingState.writeCount).toBe(0);
        expect(settingState.value).toEqual({ '/docs/a.ows': '#ff0000' });
    });
});

describe('FileSourceMetaManager.getColorNote', () => {
    test('reads a non-app file’s note from the settings', async () => {
        mocks.getInstance.mockReturnValue({ fullName: 'slides.pdf' });
        settingState.value = { '/docs/slides.pdf': '#123456' };
        expect(
            await FileSourceMetaManager.getColorNote('/docs/slides.pdf'),
        ).toBe('#123456');
        expect(mocks.checkIsAppFile).toHaveBeenCalledWith('slides.pdf');
    });

    test('answers null for an app file whose stored note is not a color', async () => {
        mocks.checkIsAppFile.mockReturnValue(true);
        mocks.getInstance.mockReturnValue({
            fullName: 'song.ows',
            readFileJsonData: async () => ({
                metadata: { colorNote: 'blue?' },
            }),
        });
        expect(
            await FileSourceMetaManager.getColorNote('/docs/song.ows'),
        ).toBeNull();
        expect(mocks.appHandleError).not.toHaveBeenCalled();
    });
});

describe('FileSourceMetaManager.checkAllColorNotes', () => {
    test('keeps a note whose file could not be checked, and logs why', async () => {
        settingState.value = {
            '/net/share/a.ows': '#ff0000',
            '/docs/gone.ows::2': '#00ff00',
        };
        const error = new Error('EIO: network drive');
        mocks.fsCheckFileExist.mockImplementation(async (filePath: string) => {
            if (filePath === '/net/share/a.ows') {
                throw error;
            }
            return false;
        });
        await FileSourceMetaManager.checkAllColorNotes();
        expect(mocks.appHandleError).toHaveBeenCalledWith(error);
        expect(settingState.value).toEqual({ '/net/share/a.ows': '#ff0000' });
    });
});
