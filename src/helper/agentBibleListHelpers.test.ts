// @vitest-environment jsdom
/**
 * `owa_bible_item`'s worker, past its happy paths (those are in
 * `agentDataDispatch.coverage.test.ts`): a Bibles list has no editing
 * history, so the backup taken first is the only undo -- every refusal here
 * must leave the file untouched, every failure must say so and point at
 * `owa_undo`, and a change must be made to a list read FRESH inside the
 * backup. The file-name rules are the real ones.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        isReader: false,
        // A folder for each page's own Bibles list setting.
        dirs: {} as Record<string, string>,
        // `/bibles/Default.owb` -> the list the file holds.
        lists: {} as Record<string, any>,
        // Names whose joined path would leave the folder.
        escapingNames: new Set<string>(),
    },
    mocks: {
        handleError: vi.fn(),
        fromFilePath: vi.fn(),
        getDefault: vi.fn(),
        createBible: vi.fn(),
        resolveBibleItem: vi.fn(),
        fromVerseKey: vi.fn(),
        detachBackground: vi.fn(),
        findAgentFreeName: vi.fn(),
        renameAgentFile: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentFile: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        trashAgentFile: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPageReader() {
            return state.isReader;
        },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['owb'],
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            return state.dirs[settingName] ?? null;
        },
    },
}));
vi.mock('../bible-list/Bible', () => ({
    default: {
        getDirSourceSettingName: () => {
            return state.isReader ? 'reader-bibles' : 'presenter-bibles';
        },
        fromFilePath: mocks.fromFilePath,
        getDefault: mocks.getDefault,
        create: mocks.createBible,
    },
}));
vi.mock('./agentBibleHelpers', () => ({
    MAX_REFERENCE_LENGTH: 60,
    resolveVersionOrder: async (version: string | null) => {
        if (version !== null && !['KJV', 'KH'].includes(version)) {
            return {
                reason: `There is no version "${version}".`,
                versions: ['KJV', 'KH'],
            };
        }
        return {
            order: version === null ? ['KJV', 'KH'] : [version],
            installed: ['KJV', 'KH'],
        };
    },
    resolveBibleItem: mocks.resolveBibleItem,
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromVerseKey: mocks.fromVerseKey },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { detachBackground: mocks.detachBackground },
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    findAgentFreeName: mocks.findAgentFreeName,
    genNoBackupReason: (error: unknown) => {
        return `Nothing was changed: no backup (${(error as Error).message}).`;
    },
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    // The folder's lists by the names the panel shows, Default first.
    listAgentFiles: async (dirPath: string) => {
        return Object.keys(state.lists)
            .filter((filePath) => filePath.startsWith(`${dirPath}/`))
            .map((filePath) => ({
                filePath,
                name: filePath.slice(dirPath.length + 1).replace(/\.owb$/, ''),
            }))
            .sort((one, other) => {
                if (one.name === 'Default' || other.name === 'Default') {
                    return one.name === 'Default' ? -1 : 1;
                }
                return one.name.localeCompare(other.name);
            });
    },
    renameAgentFile: mocks.renameAgentFile,
    runWithAgentBackup: mocks.runWithAgentBackup,
    snapshotAgentFile: mocks.snapshotAgentFile,
    snapshotAgentFileForDelete: mocks.snapshotAgentFileForDelete,
    snapshotAgentSidecars: mocks.snapshotAgentSidecars,
    toAgentFilePath: (dirPath: string, name: string, extension: string) => {
        return state.escapingNames.has(name)
            ? null
            : `${dirPath}/${name}.${extension}`;
    },
    trashAgentFile: mocks.trashAgentFile,
}));

import { NoBackupError } from './agentBackupHelpers';
import { handleAgentBibleListRequest } from './agentBibleListHelpers';

function genPassage(id: number, title: string, fields: object = {}) {
    return {
        id,
        bibleKey: 'KJV',
        target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 },
        toTitleWithBibleKey: async () => title,
        toVerseFullKey: () => 'JHN 3:16',
        ...fields,
    };
}

function genList(items: any[]) {
    const list = {
        items,
        get itemsLength() {
            return items.length;
        },
        get maxItemId() {
            return items.reduce((max, one) => Math.max(max, one.id), 0);
        },
        getItemById: vi.fn((id: number) => {
            return items.find((one) => one.id === id) ?? null;
        }),
        setItemById: vi.fn(),
        addBibleItem: vi.fn((item: any) => {
            items.push({ ...item, id: list.maxItemId + 1 });
        }),
        deleteItem: vi.fn(),
        save: vi.fn(async () => true),
    };
    return list;
}

const JOHN = genPassage(0, '(KJV) John 3:16');

beforeEach(() => {
    state.isReader = false;
    state.dirs = {
        'presenter-bibles': '/bibles',
        'reader-bibles': '/reader-bibles',
    };
    state.lists = {};
    state.escapingNames = new Set();
    mocks.fromFilePath.mockImplementation(async (filePath: string) => {
        return state.lists[filePath] ?? null;
    });
    mocks.resolveBibleItem.mockImplementation(async (reference: string) => {
        return reference.startsWith('Hezekiah') ? null : JOHN;
    });
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({ meta: { id: 'undo-1' }, value: await change() }),
    );
    mocks.snapshotAgentFile.mockImplementation(async (filePath: string) => {
        return { type: 'file', filePath, text: 'the list as saved' };
    });
    mocks.snapshotAgentSidecars.mockResolvedValue([
        { type: 'file', filePath: '/bibles/Default.owb.bg.json', text: '{}' },
    ]);
    mocks.snapshotAgentFileForDelete.mockImplementation(
        async (filePath: string) => [{ type: 'file', filePath, text: 'x' }],
    );
    mocks.findAgentFreeName.mockImplementation(
        async (_dirPath: string, name: string) => `${name} (2)`,
    );
    mocks.createBible.mockResolvedValue({});
    mocks.renameAgentFile.mockImplementation(
        async (_from: string, newName: string) => `/bibles/${newName}.owb`,
    );
});

function request(fields: Record<string, unknown>) {
    return handleAgentBibleListRequest(fields);
}

describe('which list, in which folder', () => {
    test('the Reader’s lists are its own folder’s, and the answer says whose', async () => {
        state.isReader = true;
        state.lists = {
            '/bibles/Default.owb': genList([genPassage(9, 'Presenter')]),
            '/reader-bibles/Default.owb': genList([
                genPassage(1, '(KJV) John 3:16'),
            ]),
        };
        await expect(request({ action: 'list' })).resolves.toEqual({
            where: 'Reader',
            lists: [
                {
                    name: 'Default',
                    count: 1,
                    items: [{ id: 1, title: '(KJV) John 3:16' }],
                },
            ],
        });
    });

    test('one list is read by its name, and a name that is not there names the ones that are', async () => {
        state.lists = {
            '/bibles/Sunday.owb': genList([genPassage(4, '(KJV) Psalm 23:1')]),
            '/bibles/Default.owb': genList([]),
        };
        await expect(
            request({ action: 'list', list: ' Sunday ' }),
        ).resolves.toEqual({
            where: 'Presenter',
            lists: [
                {
                    name: 'Sunday',
                    count: 1,
                    items: [{ id: 4, title: '(KJV) Psalm 23:1' }],
                },
            ],
        });
        await expect(
            request({ action: 'list', list: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no Bibles list called "Easter" in the Presenter. ' +
                'The lists are "Default", "Sunday".',
        });
        state.lists = {};
        await expect(
            request({ action: 'list', list: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no Bibles list called "Easter" in the Presenter. ' +
                'There are no lists yet -- "add" saves into Default, which ' +
                'is made on the way.',
        });
    });

    test.each([
        ['../Sunday', 'A name cannot contain any of'],
        ['.hidden', 'A name cannot start with a dot.'],
        ['NUL', 'is a name this computer reserves for itself.'],
    ])('a list named "%s" is refused by the name rules', async (list, says) => {
        state.lists = { '/bibles/Default.owb': genList([]) };
        await expect(
            request({ action: 'add', list, reference: 'John 3:16' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(says),
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('a name whose joined path would leave the folder is refused', async () => {
        state.escapingNames.add('Sunday');
        await expect(
            request({ action: 'list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That list name would not stay inside the Bibles folder.',
        });
    });
});

describe('add', () => {
    test.each([
        [
            { reference: ' ' },
            'Say which passage to save: a reference such as "John 3:16".',
        ],
        [
            { reference: 'x'.repeat(61) },
            'That is longer than a reference. Give the book, chapter and ' +
                'verse only, such as "John 3:16".',
        ],
        [
            { reference: 'John 3:16', version: 'NIV' },
            'There is no version "NIV". Installed versions: KJV, KH.',
        ],
        [
            { reference: 'Hezekiah 3:1' },
            '"Hezekiah 3:1" could not be read as a passage in any installed ' +
                "version. Write it as the version's full book name, chapter " +
                'and verse -- "John 3:16", "Psalm 23:1-6" -- or a whole ' +
                'chapter as "Psalm 23". Installed versions: KJV, KH.',
        ],
        [
            { reference: 'Hezekiah 3:1', version: 'KH' },
            expect.stringContaining('could not be read as a passage in KH.'),
        ],
        [
            { reference: 'John 3:16', list: 'Easter' },
            expect.stringContaining('There is no Bibles list called "Easter"'),
        ],
    ])(
        '%o is refused, and nothing is backed up or saved',
        async (fields, reason) => {
            const list = genList([]);
            state.lists = { '/bibles/Default.owb': list };
            await expect(
                request({ action: 'add', ...fields }),
            ).resolves.toEqual({
                isError: true,
                reason,
            });
            expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
            expect(list.save).not.toHaveBeenCalled();
        },
    );

    test('into a Default list that is not there yet: made on the way, and its undo is "there was none"', async () => {
        const made = genList([]);
        mocks.getDefault.mockResolvedValue(made);
        await expect(
            request({ action: 'add', reference: 'John 3:16' }),
        ).resolves.toEqual({
            where: 'Presenter',
            added: '(KJV) John 3:16',
            version: 'KJV',
            list: 'Default',
            id: 1,
            undoId: 'undo-1',
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Saved “(KJV) John 3:16” to the Bibles list “Default”',
            [{ type: 'file', filePath: '/bibles/Default.owb', text: null }],
            expect.any(Function),
        );
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
        expect(made.addBibleItem).toHaveBeenCalledWith(JOHN);
        expect(made.save).toHaveBeenCalledOnce();
    });

    test('into an existing list: the saved file is backed up, then the list is read fresh', async () => {
        const list = genList([genPassage(3, 'Old')]);
        state.lists = { '/bibles/Default.owb': list };
        await expect(
            request({ action: 'add', reference: 'John 3:16' }),
        ).resolves.toMatchObject({ added: '(KJV) John 3:16', id: 4 });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'file',
                filePath: '/bibles/Default.owb',
                text: 'the list as saved',
            },
        ]);
        expect(
            mocks.snapshotAgentFile.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.fromFilePath.mock.invocationCallOrder[0]);
    });

    test('a Default that cannot be made, or a list that will not save, is reported with the way back', async () => {
        mocks.getDefault.mockResolvedValue(null);
        await expect(
            request({ action: 'add', reference: 'John 3:16' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Saving “(KJV) John 3:16” could not be finished: the Default ' +
                'list could not be made. Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();

        const list = genList([]);
        list.save.mockResolvedValue(false);
        state.lists = { '/bibles/Default.owb': list };
        await expect(
            request({ action: 'add', reference: 'John 3:16' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('the list could not be saved.'),
        });
    });

    test('a backup that cannot be saved is the whole answer: nothing was touched', async () => {
        const list = genList([]);
        state.lists = { '/bibles/Default.owb': list };
        mocks.runWithAgentBackup.mockRejectedValue(
            new NoBackupError('The backup folder is full.'),
        );
        await expect(
            request({ action: 'add', reference: 'John 3:16' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The backup folder is full.',
        });
        expect(list.addBibleItem).not.toHaveBeenCalled();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });
});

describe('update', () => {
    let list: ReturnType<typeof genList>;
    beforeEach(() => {
        list = genList([
            genPassage(5, '(KJV) John 3:16', {
                isAudioEnabled: true,
                extraBibleKeys: ['KJV'],
            }),
            genPassage(6, '(KJV) John 3:17'),
            // An item the file could not read: no id anybody can name.
            genPassage(-1, 'broken'),
        ]);
        state.lists = { '/bibles/Default.owb': list };
    });

    test.each([
        [
            { reference: 'John 3:17' },
            'Say which passage to change: its `id`, from action "list".',
        ],
        [
            { id: '5', reference: 'John 3:17' },
            'Say which passage to change: its `id`, from action "list".',
        ],
        [{ id: 5 }, 'Give a new `reference`, a new `version`, or both.'],
        [
            { id: 9, reference: 'John 3:17' },
            'The Bibles list "Default" has no passage with the id 9. Its ids ' +
                'are 5, 6 -- action "list" says which is which.',
        ],
        [
            { id: -1, reference: 'John 3:17' },
            expect.stringContaining('has no passage with the id -1.'),
        ],
        [
            { id: 5, reference: 'John 3:17', list: 'Easter' },
            expect.stringContaining('There is no Bibles list called "Easter"'),
        ],
        [
            { id: 5, version: 'NIV' },
            'There is no version "NIV". Installed versions: KJV, KH.',
        ],
        [
            { id: 5, reference: 'Hezekiah 3:1' },
            expect.stringContaining('"Hezekiah 3:1" could not be read'),
        ],
    ])('%o is refused before any backup', async (fields, reason) => {
        await expect(request({ action: 'update', ...fields })).resolves.toEqual(
            { isError: true, reason },
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(list.save).not.toHaveBeenCalled();
    });

    test('an empty list says so', async () => {
        state.lists = { '/bibles/Default.owb': genList([]) };
        await expect(
            request({ action: 'update', id: 1, version: 'KH' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'has no passage with the id 1. It is empty.',
            ),
        });
    });

    test('the same passage in another version: what it IS changes, its id and settings stay', async () => {
        const khmer = genPassage(0, '(KH) យ៉ូហាន ៣:១៦', {
            bibleKey: 'KH',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 16,
            },
        });
        mocks.fromVerseKey.mockResolvedValue(khmer);
        await expect(
            request({ action: 'update', id: 5, version: 'KH' }),
        ).resolves.toEqual({
            where: 'Presenter',
            updated: '(KH) យ៉ូហាន ៣:១៦',
            was: '(KJV) John 3:16',
            list: 'Default',
            id: 5,
            undoId: 'undo-1',
        });
        // Read by its language-neutral key, so the book name need not be
        // one the other version knows.
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('KH', 'JHN 3:16');
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Changed “(KJV) John 3:16” in the Bibles list “Default” to ' +
                '“(KH) យ៉ូហាន ៣:១៦”',
            [expect.objectContaining({ filePath: '/bibles/Default.owb' })],
            expect.any(Function),
        );
        expect(list.setItemById).toHaveBeenCalledWith(
            5,
            expect.objectContaining({
                id: 5,
                bibleKey: 'KH',
                target: khmer.target,
                isAudioEnabled: true,
                extraBibleKeys: ['KJV'],
            }),
        );
        expect(list.save).toHaveBeenCalledOnce();
    });

    test('a passage the other version cannot read is not changed', async () => {
        mocks.fromVerseKey.mockResolvedValue(null);
        await expect(
            request({ action: 'update', id: 5, version: 'KH' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                '(KJV) John 3:16 could not be read in KH, so it was not ' +
                'changed.',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('a new reference with no version is read in the passage’s own version first', async () => {
        list.items[0].bibleKey = 'KH';
        await request({ action: 'update', id: 5, reference: 'John 3:17' });
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 3:17', [
            'KH',
            'KJV',
            'KH',
        ]);
    });

    test('a backup that cannot be taken, a passage gone meanwhile, or a list that will not save is reported', async () => {
        mocks.snapshotAgentFile.mockRejectedValueOnce(new Error('disk busy'));
        await expect(
            request({ action: 'update', id: 5, reference: 'John 3:17' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (disk busy).',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();

        // Read again inside the backup, the passage is gone.
        mocks.fromFilePath
            .mockResolvedValueOnce(list)
            .mockResolvedValueOnce(genList([]));
        await expect(
            request({ action: 'update', id: 5, reference: 'John 3:17' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Changing “(KJV) John 3:16” could not be finished: the ' +
                'passage is not in the list any more. Anything it did get to ' +
                'do can be put back with owa_undo.',
        });
        expect(list.setItemById).not.toHaveBeenCalled();

        list.save.mockResolvedValue(false);
        await expect(
            request({ action: 'update', id: 5, reference: 'John 3:17' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('the list could not be saved.'),
        });
    });
});

describe('delete', () => {
    let list: ReturnType<typeof genList>;
    beforeEach(() => {
        list = genList([genPassage(5, '(KJV) John 3:16')]);
        state.lists = { '/bibles/Default.owb': list };
    });

    test.each([
        [{}, 'Say which passage to remove: its `id`, from action "list".'],
        [
            { id: 7 },
            'The Bibles list "Default" has no passage with the id 7. Its ids ' +
                'are 5 -- action "list" says which is which.',
        ],
        [
            { id: 5, list: 'Easter' },
            expect.stringContaining('There is no Bibles list called "Easter"'),
        ],
    ])('%o is refused before any backup', async (fields, reason) => {
        await expect(request({ action: 'delete', ...fields })).resolves.toEqual(
            { isError: true, reason },
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('the list and its backgrounds are backed up; the passage’s background goes with it', async () => {
        await expect(request({ action: 'delete', id: 5 })).resolves.toEqual({
            where: 'Presenter',
            deleted: '(KJV) John 3:16',
            list: 'Default',
            undoId: 'undo-1',
        });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'file',
                filePath: '/bibles/Default.owb',
                text: 'the list as saved',
            },
            {
                type: 'file',
                filePath: '/bibles/Default.owb.bg.json',
                text: '{}',
            },
        ]);
        expect(list.deleteItem).toHaveBeenCalledWith(list.items[0]);
        expect(mocks.detachBackground).toHaveBeenCalledWith(
            '/bibles/Default.owb',
            5,
        );
        expect(list.save.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.detachBackground.mock.invocationCallOrder[0],
        );
    });

    test('no backup, a passage gone meanwhile, or a failed save: reported, and the background kept', async () => {
        mocks.snapshotAgentSidecars.mockRejectedValueOnce(
            new Error('sidecar locked'),
        );
        await expect(request({ action: 'delete', id: 5 })).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (sidecar locked).',
        });

        mocks.fromFilePath
            .mockResolvedValueOnce(list)
            .mockResolvedValueOnce(genList([]));
        await expect(
            request({ action: 'delete', id: 5 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'Removing “(KJV) John 3:16” could not be finished: the ' +
                    'passage is not in the list any more.',
            ),
        });

        list.save.mockResolvedValue(false);
        await expect(
            request({ action: 'delete', id: 5 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('the list could not be saved.'),
        });
        expect(mocks.detachBackground).not.toHaveBeenCalled();
    });
});

describe('whole lists', () => {
    test('a new list is made behind a backup that says there was none', async () => {
        await expect(
            request({ action: 'create-list', list: 'Easter' }),
        ).resolves.toEqual({
            where: 'Presenter',
            created: 'Easter',
            undoId: 'undo-1',
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Made the Bibles list “Easter”',
            [{ type: 'file', filePath: '/bibles/Easter.owb', text: null }],
            expect.any(Function),
        );
        expect(mocks.createBible).toHaveBeenCalledWith('/bibles', 'Easter');
    });

    test('a new list is never made over one, nor under a bad name', async () => {
        state.lists = { '/bibles/Sunday.owb': genList([]) };
        await expect(
            request({ action: 'create-list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A Bibles list called "Sunday" is already there. ' +
                '"Sunday (2)" is free.',
        });
        await expect(
            request({ action: 'create-list', list: '' }),
        ).resolves.toEqual({ isError: true, reason: 'Give the file a name.' });
        state.escapingNames.add('Easter');
        await expect(
            request({ action: 'create-list', list: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That list name would not stay inside the Bibles folder.',
        });
        expect(mocks.createBible).not.toHaveBeenCalled();
    });

    test('a list that could not be made is reported', async () => {
        mocks.createBible.mockResolvedValue(null);
        await expect(
            request({ action: 'create-list', list: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the Bibles list “Easter” could not be finished: the ' +
                'list could not be made. Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
    });

    test('renaming Default says a new Default comes back; a taken or bad new name is refused', async () => {
        state.lists = {
            '/bibles/Default.owb': genList([]),
            '/bibles/Sunday.owb': genList([]),
        };
        await expect(
            request({ action: 'rename-list', newName: 'Old Default' }),
        ).resolves.toEqual({
            where: 'Presenter',
            renamedFrom: 'Default',
            renamedTo: 'Old Default',
            undoId: 'undo-1',
            note:
                'The app makes a new, empty Default list the next time the ' +
                'Bibles panel shows.',
        });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'rename',
                from: '/bibles/Default.owb',
                to: '/bibles/Old Default.owb',
            },
        ]);
        await expect(
            request({ action: 'rename-list', newName: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A Bibles list called "Sunday" is already there, so ' +
                '"Default" was not renamed.',
        });
        await expect(
            request({ action: 'rename-list', newName: '  ' }),
        ).resolves.toEqual({ isError: true, reason: 'Give the file a name.' });
        state.escapingNames.add('Elsewhere');
        await expect(
            request({ action: 'rename-list', newName: 'Elsewhere' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That new name would not stay inside the Bibles folder.',
        });
        await expect(
            request({ action: 'rename-list', list: 'Easter', newName: 'X' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        expect(mocks.renameAgentFile).toHaveBeenCalledOnce();
    });

    test('a rename that fails part way is reported with the way back', async () => {
        state.lists = { '/bibles/Sunday.owb': genList([]) };
        mocks.renameAgentFile.mockRejectedValue(new Error('file in use'));
        await expect(
            request({ action: 'rename-list', list: 'Sunday', newName: 'X' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Renaming the Bibles list “Sunday” could not be finished: ' +
                'file in use Anything it did get to do can be put back with ' +
                'owa_undo.',
        });
    });

    test('a whole list goes to the trash behind its backup, Default with a note', async () => {
        state.lists = {
            '/bibles/Default.owb': genList([
                genPassage(1, 'a'),
                genPassage(2, 'b'),
            ]),
        };
        await expect(request({ action: 'delete-list' })).resolves.toEqual({
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
            '/bibles/Default.owb',
        );
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(
            '/bibles/Default.owb',
        );
        expect(
            mocks.snapshotAgentFileForDelete.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.trashAgentFile.mock.invocationCallOrder[0]);
    });

    test('a list that is not there, cannot be backed up, or will not go to the trash is reported', async () => {
        await expect(
            request({ action: 'delete-list', list: 'Easter' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no Bibles list called "Easter"'),
        });
        state.lists = { '/bibles/Sunday.owb': genList([]) };
        mocks.snapshotAgentFileForDelete.mockRejectedValueOnce(
            new Error('cannot read'),
        );
        await expect(
            request({ action: 'delete-list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (cannot read).',
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();

        mocks.trashAgentFile.mockRejectedValue(
            new Error('"Sunday" could not be moved to the trash.'),
        );
        await expect(
            request({ action: 'delete-list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Moving the Bibles list “Sunday” to the trash could not be ' +
                'finished: "Sunday" could not be moved to the trash. Anything ' +
                'it did get to do can be put back with owa_undo.',
        });
    });

    test('a list that cannot be read is not deleted', async () => {
        state.lists = { '/bibles/Sunday.owb': null };
        await expect(
            request({ action: 'delete-list', list: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The Bibles list "Sunday" could not be read.',
        });
        expect(mocks.snapshotAgentFileForDelete).not.toHaveBeenCalled();
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});
