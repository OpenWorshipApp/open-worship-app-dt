import { beforeEach, describe, expect, test, vi } from 'vitest';

// The study-file worker's residual roads (UT-102): a Bible that fails while it
// is read, a quote longer than one is read whole, a token two parts share.
// The mock surface is `agentStudyFileHelpers.ut101.test.ts`'s, copied: the
// pure rules are the real `agentStudyFileRules`, the disk, the Bibles, the
// backup store and the Resources panel are fakes.

type VerseSpecType = {
    chapter: number;
    localeChapter: string;
    localeVerse: string;
    text: string;
};
type TargetType = {
    bookKey: string;
    chapter: number;
    verseStart: number;
    verseEnd: number;
    chapterEnd?: number;
};
type ItemSpecType = {
    bibleKey: string;
    title: string;
    target: TargetType;
    verses: VerseSpecType[] | null;
};

const { state, mocks, NoBackupErrorMock } = vi.hoisted(() => {
    class NoBackupErrorMock extends Error {}
    return {
        NoBackupErrorMock,
        state: {
            sep: '/',
            dataDir: '/data/resources',
            tempDir: '/temp',
            files: new Map<string, string>(),
            dirs: new Set<string>(),
            stamps: new Map<string, number | null>(),
            clock: 1000,
            installed: ['KJV'] as string[],
            // `<bibleKey>|<reference>` -> the passage that Bible reads.
            items: new Map<string, ItemSpecType>(),
            // `<bibleKey>|<verse key>` -> what `BibleItem.fromVerseKey` gives.
            keyItems: new Map<string, ItemSpecType>(),
            verseCounts: new Map<string, number>(),
            folderList: ['/elsewhere'] as string[],
            backupCount: 0,
            // The Bible Notes folder of the session in front (EC-509).
            bibleNotesDir: null as string | null,
        },
        mocks: {
            tran: vi.fn(),
            resolveVersionOrder: vi.fn(),
            resolveBibleItem: vi.fn(),
            getVersesCount: vi.fn(),
            fromVerseKey: vi.fn(),
            openMarkdownPreview: vi.fn(),
            announceResourcesChanged: vi.fn(),
            invalidateResourcesScanCache: vi.fn(),
            filterUnlisted: vi.fn(),
            addFolders: vi.fn(),
            runWithAgentBackup: vi.fn(),
            handleError: vi.fn(),
            writeFile: vi.fn(),
            deleteFile: vi.fn(),
            listDirents: vi.fn(),
            getFileStamp: vi.fn(),
            createDir: vi.fn(),
        },
    };
});

function joinPath(...parts: string[]) {
    return parts
        .filter((part) => {
            return part !== '';
        })
        .join(state.sep);
}

function toDirName(filePath: string) {
    const index = Math.max(
        filePath.lastIndexOf('/'),
        filePath.lastIndexOf('\\'),
    );
    return index < 0 ? '' : filePath.slice(0, index);
}

function toBaseName(filePath: string) {
    return filePath.split(/[\\/]/).at(-1) ?? '';
}

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: async (dirPath: string) => state.dirs.has(dirPath),
    fsCheckFileExist: async (filePath: string) => state.files.has(filePath),
    fsCreateDir: (...args: unknown[]) => mocks.createDir(...args),
    fsDeleteFile: (...args: unknown[]) => mocks.deleteFile(...args),
    fsGetFileStamp: (...args: unknown[]) => mocks.getFileStamp(...args),
    fsListDirents: (...args: unknown[]) => mocks.listDirents(...args),
    fsReadFile: async (filePath: string) => {
        const text = state.files.get(filePath);
        if (text === undefined) {
            throw new Error(`no file ${filePath}`);
        }
        return text;
    },
    fsWriteFile: (...args: unknown[]) => mocks.writeFile(...args),
    getTempPath: () => state.tempDir,
    pathBasename: (filePath: string) => toBaseName(filePath),
    pathJoin: (...parts: string[]) => joinPath(...parts),
}));
vi.mock('../resources/resourcesCopyHelpers', () => ({
    getResourcesDataDirPath: () => state.dataDir,
    // The app's own rule: `name.md`, then `name (1).md`, never a taken one.
    genFreeFilePath: async (dirPath: string, fullName: string) => {
        const dotIndex = fullName.lastIndexOf('.');
        const [name, extension] =
            dotIndex > 0
                ? [fullName.slice(0, dotIndex), fullName.slice(dotIndex)]
                : [fullName, ''];
        let index = 0;
        let filePath = joinPath(dirPath, fullName);
        while (state.files.has(filePath) || state.dirs.has(filePath)) {
            index += 1;
            filePath = joinPath(dirPath, `${name} (${index})${extension}`);
        }
        return filePath;
    },
}));
vi.mock('../resources/resourcesFolderHelpers', () => ({
    getResourcesFolderList: () => state.folderList,
    filterUnlistedResourcesFolders: (...args: unknown[]) =>
        mocks.filterUnlisted(...args),
    addResourcesFoldersToList: (...args: unknown[]) =>
        mocks.addFolders(...args),
}));
vi.mock('../bible-list/note/bibleNotesDirHelpers', () => ({
    getActiveBibleNotesDirPath: () => state.bibleNotesDir,
}));
vi.mock('../resources/resourcesScanHelpers', () => ({
    MAX_SCAN_DEPTH: 2,
    invalidateResourcesScanCache: (...args: unknown[]) =>
        mocks.invalidateResourcesScanCache(...args),
}));
vi.mock('../resources/resourcesChangedEvent', () => ({
    announceResourcesChanged: () => mocks.announceResourcesChanged(),
}));
vi.mock('../resources/resourcePreviewOpenHelpers', () => ({
    openMarkdownPreview: (...args: unknown[]) =>
        mocks.openMarkdownPreview(...args),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: NoBackupErrorMock,
    genUndoField: (meta: { id: string }) => ({
        undoId: meta.id,
        undo: `owa_undo with id "${meta.id}" puts this back.`,
    }),
    runWithAgentBackup: (...args: unknown[]) =>
        mocks.runWithAgentBackup(...args),
}));
vi.mock('./errorHelpers', () => ({
    handleError: (...args: unknown[]) => mocks.handleError(...args),
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (...args: unknown[]) => mocks.tran(...args),
}));
vi.mock('./agentBibleHelpers', () => ({
    resolveVersionOrder: (...args: unknown[]) =>
        mocks.resolveVersionOrder(...args),
    resolveBibleItem: (...args: unknown[]) => mocks.resolveBibleItem(...args),
}));
vi.mock('./bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: (...args: unknown[]) => mocks.getVersesCount(...args),
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: (...args: unknown[]) => mocks.fromVerseKey(...args),
    },
}));

import { handleAgentStudyRequest } from './agentStudyFileHelpers';
import { STUDY_MAX_QUOTED_VERSES } from './agentStudyFileRules';

const FOOTNOTE = 'Drafted with the app assistant. Check it against your Bible.';

function studyDir() {
    return joinPath(state.dataDir, 'Default');
}

function genVerses(
    chapter: number,
    from: number,
    to: number,
    toText: (verse: number) => string = (verse) => `Words of verse ${verse}.`,
): VerseSpecType[] {
    const verses: VerseSpecType[] = [];
    for (let verse = from; verse <= to; verse++) {
        verses.push({
            chapter,
            localeChapter: String(chapter),
            localeVerse: String(verse),
            text: toText(verse),
        });
    }
    return verses;
}

function addItem(ref: string, spec: ItemSpecType) {
    state.items.set(`${spec.bibleKey}|${ref}`, spec);
}

function toFakeItem(spec: ItemSpecType) {
    return {
        bibleKey: spec.bibleKey,
        target: spec.target,
        toTitle: async () => spec.title,
        toVerseTextList: async () => spec.verses,
    };
}

function genStudyText(title: string, body: string) {
    return [
        `# ${title}`,
        '',
        '> **John 3:16** (KJV)',
        '>',
        '> **16** For God so loved the world.',
        '',
        body,
        '',
        '---',
        '',
        `*${FOOTNOTE}*`,
        '',
    ].join('\n');
}

function putStudyFile(name: string, text: string) {
    state.dirs.add(studyDir());
    const filePath = joinPath(studyDir(), name);
    state.files.set(filePath, text);
    return filePath;
}

beforeEach(() => {
    state.sep = '/';
    state.dataDir = '/data/resources';
    state.tempDir = '/temp';
    state.files = new Map();
    state.dirs = new Set();
    state.stamps = new Map();
    state.clock = 1000;
    state.installed = ['KJV'];
    state.items = new Map();
    state.keyItems = new Map();
    state.verseCounts = new Map();
    state.folderList = ['/elsewhere'];
    state.backupCount = 0;
    state.bibleNotesDir = null;

    mocks.tran.mockImplementation((key: string) => key);
    mocks.resolveVersionOrder.mockImplementation(
        async (version: string | null) => {
            if (state.installed.length === 0) {
                return {
                    isError: true,
                    reason: 'No Bible version is installed on this machine.',
                };
            }
            if (version !== null) {
                const wanted = state.installed.find((key) => {
                    return key.toLowerCase() === version.toLowerCase();
                });
                return wanted === undefined
                    ? {
                          isError: true,
                          reason: `No Bible version called "${version}" is installed.`,
                      }
                    : { order: [wanted], installed: state.installed };
            }
            return { order: state.installed, installed: state.installed };
        },
    );
    mocks.resolveBibleItem.mockImplementation(
        async (ref: string, order: string[]) => {
            for (const bibleKey of order) {
                const spec = state.items.get(`${bibleKey}|${ref}`);
                if (spec !== undefined) {
                    return toFakeItem(spec);
                }
            }
            return null;
        },
    );
    mocks.getVersesCount.mockImplementation(
        async (bibleKey: string, bookKey: string, chapter: number) => {
            const count = state.verseCounts.get(
                `${bibleKey}|${bookKey}|${chapter}`,
            );
            if (count === undefined) {
                throw new Error('no such chapter');
            }
            return count;
        },
    );
    mocks.fromVerseKey.mockImplementation(
        async (bibleKey: string, verseKey: string) => {
            const spec = state.keyItems.get(`${bibleKey}|${verseKey}`);
            return spec === undefined ? null : toFakeItem(spec);
        },
    );
    mocks.writeFile.mockImplementation(
        async (filePath: string, text: string) => {
            state.files.set(filePath, text);
            state.clock += 1;
            state.stamps.set(filePath, state.clock);
        },
    );
    mocks.deleteFile.mockImplementation(async (filePath: string) => {
        state.files.delete(filePath);
    });
    mocks.createDir.mockImplementation(async (dirPath: string) => {
        state.dirs.add(dirPath);
    });
    mocks.listDirents.mockImplementation(async (dirPath: string) => {
        const dirents = [];
        for (const filePath of state.files.keys()) {
            if (toDirName(filePath) === dirPath) {
                dirents.push({
                    name: toBaseName(filePath),
                    isFile: true,
                    isDirectory: false,
                });
            }
        }
        for (const subDirPath of state.dirs) {
            if (toDirName(subDirPath) === dirPath) {
                dirents.push({
                    name: toBaseName(subDirPath),
                    isFile: false,
                    isDirectory: true,
                });
            }
        }
        return dirents;
    });
    mocks.getFileStamp.mockImplementation(async (filePath: string) => {
        const modifiedAt = state.stamps.get(filePath);
        return modifiedAt === null || modifiedAt === undefined
            ? null
            : { size: 1, modifiedAt };
    });
    mocks.filterUnlisted.mockImplementation((candidates: string[]) => {
        return candidates;
    });
    mocks.addFolders.mockImplementation((dirPaths: string[]) => dirPaths);
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => {
            state.backupCount += 1;
            const meta = { id: `backup-${state.backupCount}` };
            return { meta, value: await change() };
        },
    );
});

const NAME = 'JHN.3.16 The Night Visit.md';
const FILE = `Default/${NAME}`;
const KJV_WORDS =
    'For God so loved the world, that he gave his only begotten Son.';
const MEMORY_WORDS =
    'For God so loved the world, he gave his one and only Son.';
const ROMANS_WORDS = 'But God commendeth his love toward us.';
const BODY = ['## The Setting', '', 'At night.'].join('\n');

function addJohn(ref = 'John 3:16', from = 16, to = 16) {
    addItem(ref, {
        bibleKey: 'KJV',
        title: ref,
        target: { bookKey: 'JHN', chapter: 3, verseStart: from, verseEnd: to },
        verses: genVerses(3, from, to, (verse) => {
            return verse === 16 ? KJV_WORDS : `Words of verse ${verse}.`;
        }),
    });
}

function addRomans() {
    addItem('Romans 5:8', {
        bibleKey: 'KJV',
        title: 'Romans 5:8',
        target: { bookKey: 'ROM', chapter: 5, verseStart: 8, verseEnd: 8 },
        verses: genVerses(5, 8, 8, () => ROMANS_WORDS),
    });
}

// The Bible fails on the reference named: its item cannot be found, or its
// verses cannot be read.
function failOn(ref: string, where: 'item' | 'verses') {
    mocks.resolveBibleItem.mockImplementation(
        async (asked: string, order: string[]) => {
            const spec = state.items.get(`${order[0]}|${asked}`);
            if (asked !== ref) {
                return spec === undefined ? null : toFakeItem(spec);
            }
            if (where === 'item') {
                throw new Error('the Bible file could not be read');
            }
            return {
                ...toFakeItem(spec!),
                toVerseTextList: async () => {
                    throw new Error('the verses could not be read');
                },
            };
        },
    );
}

function appendTo(append: string) {
    return handleAgentStudyRequest({
        action: 'draft',
        file: FILE,
        section: 'The Setting',
        append,
    });
}

describe('draft: a passage new to the study, when its Bible fails', () => {
    const SENT =
        '> **Romans 5:8** (KJV)\n>\n> **8** But God showed his love to us.';

    beforeEach(() => {
        addRomans();
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
    });

    test.each(['item', 'verses'] as const)(
        'leaves the quote as written when the %s cannot be read',
        async (where) => {
            failOn('Romans 5:8', where);
            const result: any = await appendTo(SENT);
            expect(result.drafted).toBe(true);
            expect(result.content).toContain(`At night.\n\n${SENT}\n`);
            expect(result.change).not.toContain('was quoted from');
            expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Romans 5:8', [
                'KJV',
            ]);
        },
    );

    test('writes it as the Bible reads it when nothing fails', async () => {
        const result: any = await appendTo(SENT);
        expect(result.content).toContain(`> **8** ${ROMANS_WORDS}`);
        expect(result.change).toContain('was quoted from');
    });
});

describe('draft: a verse quoted in a form of the model’s own, the rest', () => {
    beforeEach(() => {
        addJohn();
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
    });

    test.each(['item', 'verses'] as const)(
        'leaves a quote from memory as sent when its %s cannot be read',
        async (where) => {
            failOn('John 3:16', where);
            const sent = `> "${MEMORY_WORDS}" (John 3:16)`;
            const result: any = await appendTo(sent);
            expect(result.drafted).toBe(true);
            expect(result.content).toContain(`At night.\n\n${sent}\n`);
            expect(result.change).not.toContain('Bible reads it');
            expect(result.change).not.toContain('do not read');
        },
    );

    test('leaves a quote of more verses than are read whole as sent', async () => {
        const last = 16 + STUDY_MAX_QUOTED_VERSES;
        addJohn(`John 3:16-${last}`, 16, last);
        const sent = `> "${MEMORY_WORDS}" (John 3:16-${last})`;
        const result: any = await appendTo(sent);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith(
            `John 3:16-${last}`,
            ['KJV'],
        );
        expect(result.content).toContain(`At night.\n\n${sent}\n`);
        expect(result.change).not.toContain('Bible reads it');
        // One verse fewer is read whole, and written as the Bible reads it.
        const fits = last - 1;
        addJohn(`John 3:16-${fits}`, 16, fits);
        const written: any = await appendTo(
            `> "${MEMORY_WORDS}" (John 3:16-${fits})`,
        );
        expect(written.change).toContain('was written as that Bible reads it');
    });
});

describe('draft: a token two halves read from one Bible', () => {
    test('is read once, and quoted in both', async () => {
        // The translation's own Bible is not installed: its half is read
        // from the order the study's half is.
        const body = [
            '## The Setting',
            '',
            'At night.',
            '',
            '---',
            '',
            '# Quellon Tabbit',
            '',
            '> **Jon 3:16** (TRB)',
            '>',
            '> **16** Zor velun tabbit.',
            '',
            '## Vorrin',
            '',
            'Tella mun.',
        ].join('\n');
        addRomans();
        const study = genStudyText('The Night Visit', body);
        putStudyFile(NAME, study);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            content: study
                .replace('At night.', 'At night [^Romans 5:8].')
                .replace('Tella mun.', 'Tella [^Romans 5:8] mun.'),
        });
        expect(result.content).toContain('At night Romans 5:8.');
        expect(result.content).toContain('Tella Romans 5:8 mun.');
        expect(
            mocks.resolveBibleItem.mock.calls.filter(([ref]) => {
                return ref === 'Romans 5:8';
            }),
        ).toEqual([['Romans 5:8', ['KJV']]]);
    });
});
