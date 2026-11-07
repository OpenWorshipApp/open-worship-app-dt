// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// The two pickers a Long Text Show card is made of: a menu at the cursor that
// answers with what was picked, or with null once it is put away unpicked.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dictionaries: [] as Record<string, string>[],
        // The menu on screen: its items and the way it is put away.
        menuItems: [] as any[],
        closeMenu: null as null | (() => void),
        dirPath: '/data/documents',
        filePaths: [] as string[],
    },
    mocks: {
        menu: vi.fn(),
        getInstance: vi.fn(),
        getFilePathsQuick: vi.fn(),
        handleError: vi.fn(),
        toast: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => {
        return `icon:${name}`;
    },
}));
vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'app-document-dir' },
}));
vi.mock('../helper/DirSource', () => ({
    default: { getInstance: mocks.getInstance },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../server/fileHelpers', () => ({
    getFileName: (name: string) => {
        return name.replace(/\.[^.]+$/, '');
    },
    pathBasename: (filePath: string) => {
        return filePath.split(/[\\/]/).at(-1) ?? '';
    },
}));
vi.mock('./foregroundLongTextLangHelpers', () => ({
    getLongTextLangCodes: () => ['en', 'km', 'fr', 'de'],
    toLongTextLanguageLabel: (langCode: string) => {
        return `${langCode.toUpperCase()} - name`;
    },
}));

import {
    chooseLongTextLangCode,
    chooseLyricFilePath,
} from './foregroundLongTextMenuHelpers';

const dictionaries = readLangPackageDictionaries();

beforeEach(() => {
    state.dictionaries = dictionaries;
    state.menuItems = [];
    state.closeMenu = null;
    state.dirPath = '/data/documents';
    state.filePaths = [];
    mocks.menu.mockImplementation((_event: any, menuItems: any[]) => {
        state.menuItems = menuItems;
        return {
            promiseDone: new Promise<void>((resolve) => {
                state.closeMenu = resolve;
            }),
        };
    });
    mocks.getFilePathsQuick.mockImplementation(async () => {
        return state.filePaths;
    });
    mocks.getInstance.mockImplementation(async () => {
        return {
            dirPath: state.dirPath,
            getFilePathsQuick: mocks.getFilePathsQuick,
        };
    });
});

// Lets the picker reach the point where its menu is up.
async function flush() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

function pick(label: string) {
    const item = state.menuItems.find((menuItem) => {
        return menuItem.menuElement === label;
    });
    if (item === undefined) {
        throw new Error(`no menu item "${label}"`);
    }
    item.onSelect();
}

describe('choosing a language for a card', () => {
    test('offers only the languages the session does not have yet', async () => {
        const event = { clientX: 3, clientY: 4 };
        const answer = chooseLongTextLangCode(event, ['en', 'fr']);
        await flush();
        expect(mocks.menu).toHaveBeenCalledTimes(1);
        expect(mocks.menu.mock.calls[0][0]).toBe(event);
        expect(mocks.menu.mock.calls[0][2]).toEqual({
            shouldAutoFocusContainer: true,
        });
        expect(
            state.menuItems.map((item) => {
                return item.menuElement;
            }),
        ).toEqual(['KM - name', 'DE - name']);
        pick('DE - name');
        // The menu closing after the pick changes nothing.
        state.closeMenu!();
        await expect(answer).resolves.toBe('de');
    });

    test('a menu put away unpicked answers null', async () => {
        const answer = chooseLongTextLangCode({}, []);
        await flush();
        expect(state.menuItems).toHaveLength(4);
        state.closeMenu!();
        await expect(answer).resolves.toBeNull();
    });
});

describe('choosing a lyric file for a card', () => {
    test('lists the lyric files of the Documents folder, marking the current one', async () => {
        state.filePaths = [
            '/data/documents/Amazing Grace.lyric',
            '/data/documents/sub/How Great.lyric',
        ];
        const answer = chooseLyricFilePath(
            { clientX: 0 },
            '/data/documents/sub/How Great.lyric',
        );
        await flush();
        expect(mocks.getInstance).toHaveBeenCalledWith('app-document-dir');
        // Lyric files only, never the folder's PDF and PowerPoint extras.
        expect(mocks.getFilePathsQuick).toHaveBeenCalledWith('lyric', true);
        expect(
            state.menuItems.map((item) => {
                return [item.menuElement, item.childBefore, item.title];
            }),
        ).toEqual([
            [
                'Amazing Grace',
                'icon:music-note',
                '/data/documents/Amazing Grace.lyric',
            ],
            ['How Great', 'icon:check2', '/data/documents/sub/How Great.lyric'],
        ]);
        pick('Amazing Grace');
        await expect(answer).resolves.toBe(
            '/data/documents/Amazing Grace.lyric',
        );
        expect(mocks.toast).not.toHaveBeenCalled();
    });

    test('a menu put away unpicked answers null', async () => {
        state.filePaths = ['/data/documents/One.lyric'];
        const answer = chooseLyricFilePath({}, '');
        await flush();
        state.closeMenu!();
        await expect(answer).resolves.toBeNull();
    });

    test('no Documents folder means no menu, and says why', async () => {
        state.dirPath = '';
        await expect(chooseLyricFilePath({}, '')).resolves.toBeNull();
        expect(mocks.getFilePathsQuick).not.toHaveBeenCalled();
        expect(mocks.menu).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Choose Lyric',
            'No lyric file in the Documents folder',
        );
    });

    test('a folder that cannot be read is reported and treated as empty', async () => {
        const error = new Error('EACCES');
        mocks.getFilePathsQuick.mockRejectedValueOnce(error);
        await expect(chooseLyricFilePath({}, '')).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(mocks.menu).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledTimes(1);
    });

    test('a folder with no lyric in it says so', async () => {
        state.filePaths = [];
        await expect(chooseLyricFilePath({}, '')).resolves.toBeNull();
        expect(mocks.menu).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledTimes(1);
        expect(mocks.handleError).not.toHaveBeenCalled();
    });
});
