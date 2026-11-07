import { beforeEach, describe, expect, test, vi } from 'vitest';

// The Bibles-list worker behind `owa_bible_item`. A list has no editing
// history, so the backup taken before a change is its only undo: these tests
// hold the worker to "no backup, no change", a refused name staying refused,
// and every failure being an answer rather than a throw.
const { providerState, state, mocks } = vi.hoisted(() => ({
    providerState: { isPageReader: false },
    state: { dir: '/bibles' as string | null },
    mocks: {
        handleError: vi.fn(),
        getDirPath: vi.fn(),
        fromFilePath: vi.fn(),
        getDefault: vi.fn(),
        createBible: vi.fn(),
        resolveVersionOrder: vi.fn(),
        resolveBibleItem: vi.fn(),
        fromVerseKey: vi.fn(),
        detachBackground: vi.fn(),
        listAgentFiles: vi.fn(),
        findAgentFreeName: vi.fn(),
        renameAgentFile: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentFile: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        toAgentFilePath: vi.fn(),
        trashAgentFile: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({ default: providerState }));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['owb'],
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (name: string) => mocks.getDirPath(name),
    },
}));
vi.mock('../bible-list/Bible', () => ({
    default: {
        getDirSourceSettingName: () => 'bible-presenter',
        fromFilePath: (filePath: string) => mocks.fromFilePath(filePath),
        getDefault: () => mocks.getDefault(),
        create: (dirPath: string, name: string) =>
            mocks.createBible(dirPath, name),
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: (bibleKey: string, key: string) =>
            mocks.fromVerseKey(bibleKey, key),
    },
}));
vi.mock('./agentBibleHelpers', () => ({
    MAX_REFERENCE_LENGTH: 40,
    resolveVersionOrder: (version: string | null) =>
        mocks.resolveVersionOrder(version),
    resolveBibleItem: (reference: string, order: string[]) =>
        mocks.resolveBibleItem(reference, order),
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        detachBackground: (filePath: string, id: number) =>
            mocks.detachBackground(filePath, id),
    },
}));
vi.mock('./agentBackupHelpers', () => {
    class NoBackupError extends Error {}
    return {
        NoBackupError,
        findAgentFreeName: (...args: any[]) => mocks.findAgentFreeName(...args),
        genNoBackupReason: (error: any) =>
            `Nothing was changed: no backup (${error?.message ?? error}).`,
        genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
        listAgentFiles: (...args: any[]) => mocks.listAgentFiles(...args),
        renameAgentFile: (...args: any[]) => mocks.renameAgentFile(...args),
        runWithAgentBackup: (...args: any[]) =>
            mocks.runWithAgentBackup(...args),
        snapshotAgentFile: (...args: any[]) => mocks.snapshotAgentFile(...args),
        snapshotAgentFileForDelete: (...args: any[]) =>
            mocks.snapshotAgentFileForDelete(...args),
        snapshotAgentSidecars: (...args: any[]) =>
            mocks.snapshotAgentSidecars(...args),
        toAgentFilePath: (...args: any[]) => mocks.toAgentFilePath(...args),
        trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
    };
});

import { handleAgentBibleListRequest } from './agentBibleListHelpers';
import { NoBackupError } from './agentBackupHelpers';

const DIR = '/bibles';
const DEFAULT_PATH = `${DIR}/Default.owb`;
const SUNDAY_PATH = `${DIR}/Sunday.owb`;

function genFiles(...names: string[]) {
    return names.map((name) => {
        return { name, filePath: `${DIR}/${name}.owb` };
    });
}

function genPassage(bibleKey: string, title: string, chapter = 3) {
    return {
        bibleKey,
        target: { bookKey: 'JHN', chapter, verseStart: 16, verseEnd: 16 },
        toTitleWithBibleKey: async () => title,
    };
}

function genItem(id: number, title: string, bibleKey = 'KJV') {
    return {
        ...genPassage(bibleKey, title),
        id,
        toVerseFullKey: () => 'JHN 3:16',
    };
}

function genBible(items: any[], { isSaved = true } = {}) {
    return {
        items,
        get itemsLength() {
            return items.length;
        },
        maxItemId: items.reduce((max, item) => Math.max(max, item.id), 0),
        getItemById: (id: number) => {
            return (
                items.find((item) => {
                    return item.id === id;
                }) ?? null
            );
        },
        addBibleItem: vi.fn(),
        setItemById: vi.fn(),
        deleteItem: vi.fn(),
        save: vi.fn(async () => isSaved),
    };
}

beforeEach(() => {
    providerState.isPageReader = false;
    state.dir = DIR;
    mocks.getDirPath.mockImplementation(() => state.dir);
    mocks.toAgentFilePath.mockImplementation(
        (dir: string, name: string, extension: string) => {
            return `${dir}/${name}.${extension}`;
        },
    );
    mocks.listAgentFiles.mockResolvedValue(genFiles('Default', 'Sunday'));
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => {
            return { meta: { id: 'undo-1' }, value: await change() };
        },
    );
    mocks.snapshotAgentFile.mockImplementation(async (filePath: string) => {
        return { type: 'file', filePath, text: 'saved list' };
    });
    mocks.snapshotAgentSidecars.mockResolvedValue([]);
    mocks.snapshotAgentFileForDelete.mockImplementation(
        async (filePath: string) => {
            return [{ type: 'file', filePath, text: 'saved list' }];
        },
    );
    mocks.resolveVersionOrder.mockImplementation(
        async (version: string | null) => {
            return { order: [version ?? 'KJV'], installed: ['KJV', 'KH'] };
        },
    );
    mocks.resolveBibleItem.mockImplementation(
        async (reference: string, order: string[]) => {
            return genPassage(order[0], `${order[0]} ${reference}`);
        },
    );
    mocks.findAgentFreeName.mockResolvedValue('Sunday (2)');
    mocks.renameAgentFile.mockResolvedValue(`${DIR}/Monday.owb`);
    mocks.trashAgentFile.mockResolvedValue(undefined);
    mocks.detachBackground.mockResolvedValue(undefined);
    mocks.createBible.mockResolvedValue({});
});

describe('the request', () => {
    test('an unknown action and a missing folder are answered, naming the page', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'toString' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('Unknown action.'),
        });
        providerState.isPageReader = true;
        state.dir = null;
        await expect(
            handleAgentBibleListRequest({ action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'No Bibles folder is set up for the Reader yet.',
            ),
        });
        expect(mocks.getDirPath).toHaveBeenCalledWith('bible-presenter');
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
    });
});

describe('naming a list', () => {
    test('a named list is listed alone, truncated past sixty passages, in the Reader', async () => {
        providerState.isPageReader = true;
        const items = Array.from({ length: 61 }, (_, index) => {
            return genItem(index + 1, `KJV John 3:${index + 1}`);
        });
        mocks.fromFilePath.mockResolvedValue(genBible(items));
        const result: any = await handleAgentBibleListRequest({
            action: 'list',
            list: ' Sunday ',
        });
        expect(mocks.fromFilePath).toHaveBeenCalledExactlyOnceWith(SUNDAY_PATH);
        expect(result.where).toBe('Reader');
        expect(result.lists).toHaveLength(1);
        expect(result.lists[0]).toMatchObject({
            name: 'Sunday',
            count: 61,
            isTruncated: true,
        });
        expect(result.lists[0].items).toHaveLength(60);
        expect(result.lists[0].items[59]).toEqual({
            id: 60,
            title: 'KJV John 3:60',
        });
        expect(result).not.toHaveProperty('listCount');
    });

    test('more than thirty lists are named thirty at a time, an unreadable one as empty', async () => {
        const names = Array.from({ length: 31 }, (_, index) => {
            return `List ${index + 1}`;
        });
        mocks.listAgentFiles.mockResolvedValue(genFiles(...names));
        mocks.fromFilePath.mockResolvedValue(null);
        const result: any = await handleAgentBibleListRequest({
            action: 'list',
        });
        expect(result).toMatchObject({ isTruncated: true, listCount: 31 });
        expect(result.lists).toHaveLength(30);
        expect(result.lists[0]).toEqual({
            name: 'List 1',
            count: 0,
            items: [],
        });
    });

    test('a list that is not there is refused with the lists that are', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'list', list: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no Bibles list called "Easter" in the Presenter. ' +
                'The lists are "Default", "Sunday".',
        });
        mocks.listAgentFiles.mockResolvedValue([]);
        await expect(
            handleAgentBibleListRequest({ action: 'list', list: 'Easter' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'There are no lists yet -- "add" saves into Default',
            ),
        });
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
    });

    test('a name with a path in it is refused, not cleaned, before any file is read', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'list', list: '../Sunday' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('A name cannot contain'),
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'delete-list',
                list: 'CON',
            }),
        ).resolves.toMatchObject({
            reason: '"CON" is a name this computer reserves for itself.',
        });
        expect(mocks.toAgentFilePath).not.toHaveBeenCalled();
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
    });

    test('a name whose joined path leaves the folder is refused', async () => {
        mocks.toAgentFilePath.mockReturnValueOnce(null);
        await expect(
            handleAgentBibleListRequest({ action: 'list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That list name would not stay inside the Bibles folder.',
        });
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
    });

    test('a list that cannot be read is an answer, not a throw', async () => {
        mocks.fromFilePath.mockResolvedValue(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'delete',
                list: 'Sunday',
                id: 1,
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The Bibles list "Sunday" could not be read.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });
});

describe('add', () => {
    test('says what is missing before reading anything', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'add', reference: '  ' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Say which passage to save'),
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                list: 'Easter',
                reference: 'John 3:16',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        expect(mocks.resolveBibleItem).not.toHaveBeenCalled();
    });

    test('a reference longer than a reference is refused unread', async () => {
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16 and then the whole of the chapter after',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('That is longer than a reference'),
        });
        expect(mocks.resolveVersionOrder).not.toHaveBeenCalled();
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
    });

    test('an unknown version is refused with the installed ones, or none named', async () => {
        mocks.resolveVersionOrder.mockResolvedValueOnce({
            isError: true,
            reason: 'No Bible version called "NIV" is installed.',
            versions: ['KJV', 'KH'],
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
                version: 'NIV',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'No Bible version called "NIV" is installed. ' +
                'Installed versions: KJV, KH.',
        });
        mocks.resolveVersionOrder.mockResolvedValueOnce({
            isError: true,
            reason: 'No Bible version is installed on this machine.',
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Bible version is installed on this machine.',
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
    });

    test('a passage no version reads is refused, naming where it looked', async () => {
        mocks.resolveBibleItem.mockResolvedValue(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'Hezekiah 3:16',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringMatching(
                /^"Hezekiah 3:16" could not be read as a passage in any installed version\. .*Installed versions: KJV, KH\.$/,
            ),
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'Hezekiah 3:16',
                version: 'KH',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('as a passage in KH. Write'),
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('no backup, no change: a refused backup leaves the list untouched', async () => {
        const bible = genBible([genItem(1, 'KJV John 1:1')]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.runWithAgentBackup.mockRejectedValueOnce(
            new NoBackupError('Nothing was changed: the backup failed.'),
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                list: 'Sunday',
                reference: 'John 3:16',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: the backup failed.',
        });
        expect(mocks.snapshotAgentFile).toHaveBeenCalledWith(SUNDAY_PATH);
        expect(bible.addBibleItem).not.toHaveBeenCalled();
        expect(bible.save).not.toHaveBeenCalled();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a failed snapshot of the list saves nothing into it', async () => {
        const bible = genBible([]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.snapshotAgentFile.mockRejectedValueOnce(new Error('read-only'));
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (read-only).',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(bible.addBibleItem).not.toHaveBeenCalled();
    });

    test('a missing Default is made on the way, its undo restoring nothing', async () => {
        mocks.listAgentFiles.mockResolvedValue(genFiles('Sunday'));
        const made = genBible([]);
        made.maxItemId = 7;
        mocks.getDefault.mockResolvedValue(made);
        const result = await handleAgentBibleListRequest({
            action: 'add',
            reference: 'John 3:16',
        });
        expect(result).toEqual({
            where: 'Presenter',
            added: 'KJV John 3:16',
            version: 'KJV',
            list: 'Default',
            id: 7,
            undoId: 'undo-1',
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Saved “KJV John 3:16” to the Bibles list “Default”',
            [{ type: 'file', filePath: DEFAULT_PATH, text: null }],
            expect.any(Function),
        );
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
        expect(made.addBibleItem).toHaveBeenCalledOnce();
    });

    test('a Default that cannot be made is a failure the undo can clean up', async () => {
        mocks.listAgentFiles.mockResolvedValue([]);
        mocks.getDefault.mockResolvedValue(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Saving “KJV John 3:16” could not be finished: the Default ' +
                'list could not be made. Anything it did get to do can be ' +
                'put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });

    test('a list that will not save is reported as unfinished', async () => {
        const bible = genBible([], { isSaved: false });
        mocks.fromFilePath.mockResolvedValue(bible);
        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'could not be finished: the list could not be saved.',
            ),
        });
        expect(bible.addBibleItem).toHaveBeenCalledOnce();
    });
});

describe('update', () => {
    test('needs an integer id and something to change', async () => {
        for (const id of [undefined, '5', 1.5]) {
            await expect(
                handleAgentBibleListRequest({
                    action: 'update',
                    id,
                    reference: 'John 3:16',
                }),
            ).resolves.toMatchObject({
                reason: expect.stringContaining('Say which passage to change'),
            });
        }
        await expect(
            handleAgentBibleListRequest({ action: 'update', id: 1 }),
        ).resolves.toMatchObject({
            reason: 'Give a new `reference`, a new `version`, or both.',
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 1,
                list: 'Easter',
                version: 'KH',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
    });

    test('an unknown id names the real ids, leaving placeholders out', async () => {
        mocks.fromFilePath.mockResolvedValue(
            genBible([
                genItem(-1, 'unreadable'),
                genItem(2, 'KJV John 1:1'),
                genItem(4, 'KJV John 1:2'),
            ]),
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 9,
                version: 'KH',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'The Bibles list "Default" has no passage with the id 9. ' +
                'Its ids are 2, 4 -- action "list" says which is which.',
        });
        // A placeholder is not a passage anybody can name.
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: -1,
                version: 'KH',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no passage with the id -1'),
        });
        mocks.fromFilePath.mockResolvedValue(genBible([]));
        await expect(
            handleAgentBibleListRequest({
                action: 'delete',
                id: 3,
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('It is empty.'),
        });
    });

    test('another version re-reads the same passage by its key', async () => {
        const item = genItem(2, 'KJV John 3:16');
        const bible = genBible([item]);
        mocks.fromFilePath.mockResolvedValue(bible);
        // The other version's own title (symbols, full-width digits): the
        // worker carries it through as it is.
        const otherVersion = genPassage('KH', 'KH ✝ ３:１６');
        mocks.fromVerseKey.mockResolvedValue(otherVersion);
        const result = await handleAgentBibleListRequest({
            action: 'update',
            id: 2,
            version: 'KH',
        });
        expect(result).toEqual({
            where: 'Presenter',
            updated: 'KH ✝ ３:１６',
            was: 'KJV John 3:16',
            list: 'Default',
            id: 2,
            undoId: 'undo-1',
        });
        expect(mocks.resolveVersionOrder).toHaveBeenCalledWith('KH');
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('KH', 'JHN 3:16');
        expect(mocks.resolveBibleItem).not.toHaveBeenCalled();
        expect(bible.setItemById).toHaveBeenCalledWith(
            2,
            expect.objectContaining({ id: 2, bibleKey: 'KH' }),
        );
        expect(mocks.snapshotAgentFile).toHaveBeenCalledWith(DEFAULT_PATH);
    });

    test('a version that cannot read the passage changes nothing', async () => {
        const bible = genBible([genItem(2, 'KJV John 3:16')]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.fromVerseKey.mockResolvedValue(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                version: 'KH',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'KJV John 3:16 could not be read in KH, so it was not changed.',
        });
        mocks.resolveVersionOrder.mockResolvedValueOnce({
            isError: true,
            reason: 'No Bible version called "XX" is installed.',
            versions: ['KJV'],
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                version: 'XX',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'No Bible version called "XX" is installed. ' +
                'Installed versions: KJV.',
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
        expect(bible.setItemById).not.toHaveBeenCalled();
    });

    test('a new reference is read first in the version the passage has', async () => {
        const bible = genBible([genItem(2, 'KH John 3:16', 'KH')]);
        mocks.fromFilePath.mockResolvedValue(bible);
        await handleAgentBibleListRequest({
            action: 'update',
            id: 2,
            reference: 'John 3:17',
        });
        expect(mocks.resolveVersionOrder).toHaveBeenCalledWith(null);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 3:17', [
            'KH',
            'KJV',
        ]);
        // A version the machine no longer has is not tried first.
        bible.items[0].bibleKey = 'OLD';
        await handleAgentBibleListRequest({
            action: 'update',
            id: 2,
            reference: 'John 3:17',
        });
        expect(mocks.resolveBibleItem).toHaveBeenLastCalledWith('John 3:17', [
            'KJV',
        ]);
        mocks.resolveBibleItem.mockResolvedValueOnce(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                reference: 'Hezekiah 1:1',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('"Hezekiah 1:1" could not be read'),
        });
    });

    test('a failed snapshot prevents the change', async () => {
        const bible = genBible([genItem(2, 'KJV John 3:16')]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.snapshotAgentFile.mockRejectedValueOnce(new Error('disk full'));
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                reference: 'John 3:17',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (disk full).',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(bible.setItemById).not.toHaveBeenCalled();
    });

    test('a passage gone from the fresh copy, or a list that will not save, is unfinished', async () => {
        const first = genBible([genItem(2, 'KJV John 3:16')]);
        mocks.fromFilePath
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(genBible([]));
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                reference: 'John 3:17',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Changing “KJV John 3:16” could not be finished: the passage ' +
                'is not in the list any more. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });
        const unsaved = genBible([genItem(2, 'KJV John 3:16')], {
            isSaved: false,
        });
        mocks.fromFilePath.mockResolvedValue(unsaved);
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 2,
                reference: 'John 3:17',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('the list could not be saved.'),
        });
        expect(unsaved.setItemById).toHaveBeenCalledOnce();
        expect(mocks.handleError).toHaveBeenCalledTimes(2);
    });
});

describe('delete', () => {
    test('needs an id and a list that is there', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'delete' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Say which passage to remove'),
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'delete',
                id: 1,
                list: 'Easter',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        mocks.fromFilePath.mockResolvedValue(genBible([genItem(1, 'x')]));
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 8 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no passage with the id 8'),
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
    });

    test('backs up the list AND its sidecars, and a failed one deletes nothing', async () => {
        const bible = genBible([genItem(1, 'KJV John 3:16')]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.snapshotAgentSidecars.mockRejectedValueOnce(
            new Error('sidecar locked'),
        );
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 1 }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (sidecar locked).',
        });
        expect(mocks.snapshotAgentSidecars).toHaveBeenCalledWith(DEFAULT_PATH);
        expect(bible.deleteItem).not.toHaveBeenCalled();
        expect(mocks.detachBackground).not.toHaveBeenCalled();
    });

    test('a deleted passage takes its attached background with it, and answers an undo id', async () => {
        const item = genItem(3, 'KJV John 3:16');
        const bible = genBible([genItem(1, 'KJV John 1:1'), item]);
        mocks.fromFilePath.mockResolvedValue(bible);
        mocks.snapshotAgentSidecars.mockResolvedValue([
            { type: 'file', filePath: `${DEFAULT_PATH}.bg.json`, text: '{}' },
        ]);
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 3 }),
        ).resolves.toEqual({
            where: 'Presenter',
            deleted: 'KJV John 3:16',
            list: 'Default',
            undoId: 'undo-1',
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Removed “KJV John 3:16” from the Bibles list “Default”',
            [
                { type: 'file', filePath: DEFAULT_PATH, text: 'saved list' },
                {
                    type: 'file',
                    filePath: `${DEFAULT_PATH}.bg.json`,
                    text: '{}',
                },
            ],
            expect.any(Function),
        );
        expect(bible.deleteItem).toHaveBeenCalledWith(item);
        expect(mocks.detachBackground).toHaveBeenCalledWith(DEFAULT_PATH, 3);
    });

    test('a passage gone or a list that will not save keeps its background', async () => {
        mocks.fromFilePath
            .mockResolvedValueOnce(genBible([genItem(1, 'KJV John 3:16')]))
            .mockResolvedValueOnce(genBible([]));
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 1 }),
        ).resolves.toMatchObject({
            reason:
                'Removing “KJV John 3:16” could not be finished: the ' +
                'passage is not in the list any more. Anything it did get ' +
                'to do can be put back with owa_undo.',
        });
        const unsaved = genBible([genItem(1, 'KJV John 3:16')], {
            isSaved: false,
        });
        mocks.fromFilePath.mockResolvedValue(unsaved);
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 1 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('the list could not be saved.'),
        });
        expect(unsaved.deleteItem).toHaveBeenCalledOnce();
        expect(mocks.detachBackground).not.toHaveBeenCalled();
    });
});

describe('whole lists', () => {
    test('create-list refuses a bad name, a path outside, and a taken name', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'create-list', list: '' }),
        ).resolves.toMatchObject({ reason: 'Give the file a name.' });
        mocks.toAgentFilePath.mockReturnValueOnce(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'create-list',
                list: 'Easter',
            }),
        ).resolves.toMatchObject({
            reason: 'That list name would not stay inside the Bibles folder.',
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'create-list',
                list: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A Bibles list called "Sunday" is already there. ' +
                '"Sunday (2)" is free.',
        });
        expect(mocks.findAgentFreeName).toHaveBeenCalledWith(
            DIR,
            'Sunday',
            'owb',
        );
        expect(mocks.createBible).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('create-list makes the list behind an undo that trashes it again', async () => {
        providerState.isPageReader = true;
        await expect(
            handleAgentBibleListRequest({
                action: 'create-list',
                list: ' Easter ',
            }),
        ).resolves.toEqual({
            where: 'Reader',
            created: 'Easter',
            undoId: 'undo-1',
        });
        expect(mocks.createBible).toHaveBeenCalledWith(DIR, 'Easter');
    });

    test('create-list that makes nothing is unfinished', async () => {
        mocks.createBible.mockResolvedValue(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'create-list',
                list: 'Easter',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the Bibles list “Easter” could not be finished: the ' +
                'list could not be made. Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Made the Bibles list “Easter”',
            [{ type: 'file', filePath: `${DIR}/Easter.owb`, text: null }],
            expect.any(Function),
        );
    });

    test('rename-list refuses before renaming anything', async () => {
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Easter',
                newName: 'Lent',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Sunday',
                newName: 'Lent?',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('A name cannot contain'),
        });
        mocks.toAgentFilePath
            .mockImplementationOnce((dir: string, name: string) => {
                return `${dir}/${name}.owb`;
            })
            .mockReturnValueOnce(null);
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Sunday',
                newName: 'Lent',
            }),
        ).resolves.toMatchObject({
            reason: 'That new name would not stay inside the Bibles folder.',
        });
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Sunday',
                newName: 'Default',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A Bibles list called "Default" is already there, so ' +
                '"Sunday" was not renamed.',
        });
        expect(mocks.renameAgentFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('renaming Default says a new one will be made, and a failed rename is unfinished', async () => {
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                newName: 'Archive',
            }),
        ).resolves.toEqual({
            where: 'Presenter',
            renamedFrom: 'Default',
            renamedTo: 'Archive',
            undoId: 'undo-1',
            note:
                'The app makes a new, empty Default list the next time the ' +
                'Bibles panel shows.',
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Renamed the Bibles list “Default” to “Archive”',
            [{ type: 'rename', from: DEFAULT_PATH, to: `${DIR}/Archive.owb` }],
            expect.any(Function),
        );
        mocks.renameAgentFile.mockRejectedValueOnce(
            new Error('"Sunday" could not be renamed.'),
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Sunday',
                newName: 'Lent',
            }),
        ).resolves.toMatchObject({
            reason:
                'Renaming the Bibles list “Sunday” could not be finished: ' +
                '"Sunday" could not be renamed. Anything it did get to do ' +
                'can be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });

    test('delete-list sends Default to the trash with an undo id', async () => {
        mocks.fromFilePath.mockResolvedValue(
            genBible([genItem(1, 'a'), genItem(2, 'b')]),
        );
        await expect(
            handleAgentBibleListRequest({ action: 'delete-list' }),
        ).resolves.toEqual({
            where: 'Presenter',
            deleted: 'Default',
            isInTrash: true,
            count: 2,
            undoId: 'undo-1',
            note:
                'It is in the trash, and owa_undo puts it back. The app makes ' +
                'a new, empty Default list the next time the Bibles panel ' +
                'shows.',
        });
        expect(mocks.snapshotAgentFileForDelete).toHaveBeenCalledWith(
            DEFAULT_PATH,
        );
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(DEFAULT_PATH);
    });

    test('delete-list refuses a missing list, and trashes nothing unbacked', async () => {
        await expect(
            handleAgentBibleListRequest({
                action: 'delete-list',
                list: 'Easter',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        mocks.fromFilePath.mockResolvedValue(genBible([]));
        mocks.snapshotAgentFileForDelete.mockRejectedValueOnce(
            new Error('too big'),
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'delete-list',
                list: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (too big).',
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
    });

    test('a list the trash will not take is reported, not deleted outright', async () => {
        mocks.fromFilePath.mockResolvedValue(genBible([]));
        mocks.trashAgentFile.mockRejectedValueOnce(
            new Error('"Sunday" could not be moved to the trash.'),
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'delete-list',
                list: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Moving the Bibles list “Sunday” to the trash could not be ' +
                'finished: "Sunday" could not be moved to the trash. ' +
                'Anything it did get to do can be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});
