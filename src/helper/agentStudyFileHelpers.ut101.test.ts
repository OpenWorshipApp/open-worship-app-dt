import { beforeEach, describe, expect, test, vi } from 'vitest';

// The study-file worker behind `owa_resource_file`'s `draft`, `save`,
// `preview` and `translate` (EC-464, EC-478, EC-479). The pure rules are the
// real `agentStudyFileRules`; the disk, the Bibles, the backup store and the
// Resources panel are fakes this file builds, every write landing in an
// in-memory folder tree the assertions read back.

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
import {
    STUDY_FILE_MAX_CHARS,
    STUDY_REMOVE_ALONE_REASON,
    toStudyTextHash,
} from './agentStudyFileRules';

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

function addMatthew3() {
    addItem('Matthew 3:3-7', {
        bibleKey: 'KJV',
        title: 'Matthew 3:3-7',
        target: { bookKey: 'MAT', chapter: 3, verseStart: 3, verseEnd: 7 },
        verses: genVerses(3, 3, 7, (verse) =>
            verse === 3
                ? '<span class="wj">For this</span>   is he that was spoken of'
                : `Words of verse ${verse}.`,
        ),
    });
    addItem('Isaiah 40:3', {
        bibleKey: 'KJV',
        title: 'Isaiah 40:3',
        target: { bookKey: 'ISA', chapter: 40, verseStart: 3, verseEnd: 3 },
        verses: genVerses(40, 3, 3, () => 'The voice of him that crieth'),
    });
    state.verseCounts.set('KJV|MAT|3', 17);
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

test('an action it does not know names the four it does', async () => {
    for (const action of [undefined, 'list', 'delete']) {
        await expect(handleAgentStudyRequest({ action })).resolves.toEqual({
            isError: true,
            reason: 'Give action "draft", "translate", "save" or "preview".',
        });
    }
});

describe('draft: a new study', () => {
    test('is named from the PARSED reference, quotes the passage and its tokens, and writes nothing', async () => {
        addMatthew3();
        // The app's parser reads the model's own words as Matthew 3:3-7.
        addItem('matt 3:3-7', state.items.get('KJV|Matthew 3:3-7')!);
        const result = await handleAgentStudyRequest({
            action: 'draft',
            ref: '  matt 3:3-7 ',
            title: 'The Voice',
            content: [
                '# A title of its own the app drops',
                '## Background',
                'John prepared the way, as [^Isaiah 40:3] says.',
                '',
                '[^Isaiah 40:3]',
                '',
                '```mermaid',
                'flowchart LR',
                '  A[Prophecy] --> B[Fulfilment]',
                '```',
            ].join('\n'),
        });
        // The model wrote "matt 3:3-7"; the app parsed it with KJV's names.
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('matt 3:3-7', [
            'KJV',
        ]);
        expect(result).toEqual({
            drafted: true,
            isChange: false,
            name: 'MAT.3.3-7 The Voice.md',
            passage: 'Matthew 3:3-7',
            bible: 'KJV',
            diagramCount: 1,
            warnings: [],
            content: [
                '# The Voice',
                '',
                '> **Matthew 3:3-7** (KJV)',
                '>',
                // Markup and runs of spaces taken out of the verse's words.
                '> **3** For this is he that was spoken of',
                '>',
                '> **4** Words of verse 4.',
                '>',
                '> **5** Words of verse 5.',
                '>',
                '> **6** Words of verse 6.',
                '>',
                '> **7** Words of verse 7.',
                '',
                '## Background',
                // Inside a sentence a token is the reference as the Bible
                // writes it; alone on its line, the verse quoted.
                'John prepared the way, as Isaiah 40:3 says.',
                '',
                '> **Isaiah 40:3** (KJV)',
                '>',
                '> **3** The voice of him that crieth',
                '',
                '```mermaid',
                'flowchart LR',
                '  A[Prophecy] --> B[Fulfilment]',
                '```',
                '',
                '---',
                '',
                `*${FOOTNOTE}*`,
                '',
            ].join('\n'),
        });
        expect(mocks.getVersesCount).toHaveBeenCalledWith('KJV', 'MAT', 3);
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(state.files.size).toBe(0);
    });

    test('takes the next free name when the one it would have is taken', async () => {
        addMatthew3();
        putStudyFile('MAT.3.3-7 The Voice.md', 'old');
        putStudyFile('MAT.3.3-7 The Voice (1).md', 'older');
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: '## Notes\nA few words.',
        });
        expect(result.name).toBe('MAT.3.3-7 The Voice (2).md');
        expect(result.nameTaken).toBe('MAT.3.3-7 The Voice.md');
    });

    test('names a whole chapter without a span, and writes the span when the chapter length cannot be read', async () => {
        addItem('John 3', {
            bibleKey: 'KJV',
            title: 'John 3',
            target: { bookKey: 'JHN', chapter: 3, verseStart: 1, verseEnd: 36 },
            verses: genVerses(3, 1, 36),
        });
        state.verseCounts.set('KJV|JHN|3', 36);
        const whole: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'John 3',
            title: 'New Birth',
            content: 'Plain words.',
        });
        expect(whole.name).toBe('JHN.3.New Birth.md');
        expect(whole.warnings).toEqual([]);

        state.verseCounts.clear();
        const unknownLength: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'John 3',
            title: 'New Birth',
            content: 'Plain words.',
        });
        expect(unknownLength.name).toBe('JHN.3.1-36 New Birth.md');
    });

    test('numbers a passage over two chapters chapter:verse, and quotes a long one only so far', async () => {
        addItem('John 3:16-4:2', {
            bibleKey: 'KJV',
            title: 'John 3:16-4:2',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 2,
                chapterEnd: 4,
            },
            verses: [...genVerses(3, 16, 17), ...genVerses(4, 1, 2)],
        });
        const crossed: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'John 3:16-4:2',
            title: 'Two Chapters',
            content: 'Plain words.',
        });
        expect(crossed.name).toBe('JHN.3.16-4.2 Two Chapters.md');
        expect(crossed.content).toContain('> **3:16** Words of verse 16.');
        expect(crossed.content).toContain('> **4:2** Words of verse 2.');

        addItem('Psalms 119', {
            bibleKey: 'KJV',
            title: 'Psalms 119',
            target: {
                bookKey: 'PSA',
                chapter: 119,
                verseStart: 1,
                verseEnd: 176,
            },
            verses: genVerses(119, 1, 176),
        });
        state.verseCounts.set('KJV|PSA|119', 176);
        const long: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Psalms 119',
            title: 'The Word',
            content: 'Plain words.',
        });
        expect(long.warnings).toEqual([
            'The passage is quoted to its first 60 verses.',
        ]);
        expect(long.content).toContain('> **60** Words of verse 60.');
        expect(long.content).not.toContain('> **61**');
        expect(long.content).toContain('>\n> …\n');
    });

    test('reads a token naming its own Bible from that Bible, and says when one is quoted only in part', async () => {
        state.installed = ['KJV', 'ABC'];
        addMatthew3();
        addItem('John 1:23', {
            bibleKey: 'ABC',
            title: 'John 1:23 in ABC',
            target: {
                bookKey: 'JHN',
                chapter: 1,
                verseStart: 23,
                verseEnd: 23,
            },
            verses: genVerses(1, 23, 23, () => 'ABC words.'),
        });
        addItem('Psalms 119:1-40', {
            bibleKey: 'KJV',
            title: 'Psalms 119:1-40',
            target: {
                bookKey: 'PSA',
                chapter: 119,
                verseStart: 1,
                verseEnd: 40,
            },
            verses: genVerses(119, 1, 40),
        });
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: '[^(abc) John 1:23]\n\nAnd more:\n\n[^Psalms 119:1-40]',
        });
        // The token's own Bible first, matched whatever its case, each
        // Bible tried once.
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 1:23', [
            'ABC',
            'KJV',
        ]);
        // Any other token: the passage's Bible first.
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Psalms 119:1-40', [
            'KJV',
            'ABC',
        ]);
        expect(result.content).toContain('> **John 1:23 in ABC** (ABC)');
        expect(result.content).toContain('> **30** Words of verse 30.');
        expect(result.content).not.toContain('> **31**');
        expect(result.warnings).toEqual([
            '[^Psalms 119:1-40] is quoted to its first 30 verses.',
        ]);
    });

    test('quotes from the Bible asked for, the footnote in the app’s language, English when that cannot be read', async () => {
        state.installed = ['KJV', 'ABC'];
        addItem('Matthew 3:3-7', {
            bibleKey: 'ABC',
            title: 'Matthew 3:3-7 in ABC',
            target: { bookKey: 'MAT', chapter: 3, verseStart: 3, verseEnd: 7 },
            verses: genVerses(3, 3, 7),
        });
        mocks.tran.mockImplementation((key: string) => `[xx] ${key}`);
        const translated: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: 'Plain words.',
            bible: 'abc',
        });
        expect(mocks.resolveVersionOrder).toHaveBeenCalledWith('abc');
        expect(translated.bible).toBe('ABC');
        expect(translated.content).toContain(
            '> **Matthew 3:3-7 in ABC** (ABC)',
        );
        expect(translated.content).toContain(`*[xx] ${FOOTNOTE}*`);
        expect(mocks.tran).toHaveBeenCalledWith(FOOTNOTE);

        mocks.tran.mockImplementation(() => {
            throw new Error('no dictionary');
        });
        const english: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: 'Plain words.',
            bible: 'ABC',
        });
        expect(english.content.endsWith(`*${FOOTNOTE}*\n`)).toBe(true);
    });

    test('refuses what it cannot write, each in a sentence, before reading a Bible', async () => {
        const refusals: [Record<string, unknown>, string][] = [
            [{ title: 'The Voice', content: 'x' }, 'Give `ref`'],
            [
                { ref: 'x'.repeat(81), title: 'The Voice', content: 'x' },
                'Give `ref`',
            ],
            [{ ref: 'Matthew 3:3-7', content: 'x' }, 'Give a short `title`'],
            [
                { ref: 'Matthew 3:3-7', title: 'A: B', content: 'x' },
                'A name cannot contain',
            ],
            [
                { ref: 'Matthew 3:3-7', title: 'The Voice' },
                'Write the study itself',
            ],
            [
                {
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: '# Only a title',
                },
                'Write the study itself',
            ],
            [
                {
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: 'a'.repeat(48_001),
                },
                'The study is 48001 characters; keep it under 48000',
            ],
            [
                {
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: '```mermaid\nflowchart LR\n  A --> B',
                },
                'A ``` block is not closed. Fix it and call draft again.',
            ],
            [
                {
                    ref: 'Matthew 3:3-7',
                    title: 'The Voice',
                    content: '<div>x</div>\n```mermaid\nnotachart\n```',
                },
                'Fix these and call draft again.',
            ],
        ];
        for (const [request, reason] of refusals) {
            const result: any = await handleAgentStudyRequest({
                action: 'draft',
                ...request,
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toContain(reason);
        }
        expect(mocks.resolveVersionOrder).not.toHaveBeenCalled();
        expect(mocks.resolveBibleItem).not.toHaveBeenCalled();
    });

    test('a NEW study draws at most six diagrams', async () => {
        addMatthew3();
        const diagram = '```mermaid\nflowchart LR\n  A --> B\n```';
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: Array.from({ length: 7 }, () => diagram).join('\n\n'),
        });
        expect(result.reason).toBe(
            '7 diagrams is more than 6: keep the 2 to 4 that teach the ' +
                'passage best. Fix it and call draft again.',
        );
    });

    // EC-609: the help window drafts a new study translated, not saved
    // yet, as a new study holding the study and its translation after it.
    test('drafted with its translations, draws six diagrams a half and sixteen in all', async () => {
        addMatthew3();
        const diagram = '```mermaid\nflowchart LR\n  A --> B\n```';
        const genDiagrams = (count: number) => {
            return Array.from({ length: count }, () => [diagram, '']).flat();
        };
        // The study's words, then each translation after a rule.
        const genStudy = (...counts: number[]) => {
            return counts.flatMap((count, index) => {
                return [
                    ...(index === 0
                        ? []
                        : ['---', '', `# Xx Voice ${index}`, '']),
                    '## Words',
                    '',
                    ...genDiagrams(count),
                ];
            });
        };
        const draft = (lines: string[]) => {
            return handleAgentStudyRequest({
                action: 'draft',
                ref: 'Matthew 3:3-7',
                title: 'The Voice',
                content: lines.join('\n'),
            });
        };
        const tooMany = (count: number, max: number) => {
            return (
                `${count} diagrams is more than ${max}: keep the ` +
                (max === 6 ? '2 to 4' : 'ones') +
                ' that teach the passage best. Fix it and call draft again.'
            );
        };
        const both: any = await draft(genStudy(4, 4));
        expect(both).toMatchObject({ drafted: true, diagramCount: 8 });
        expect(both.content).toContain('\n---\n\n# Xx Voice 1\n\n## Words\n');
        const sixEach: any = await draft(genStudy(6, 6));
        expect(sixEach.diagramCount).toBe(12);
        const halfOver: any = await draft(genStudy(4, 7));
        expect(halfOver.reason).toBe(tooMany(7, 6));
        const wholeOver: any = await draft(genStudy(6, 6, 6));
        expect(wholeOver.reason).toBe(tooMany(18, 16));
        // A rule with no `#` title after it opens no translation: one
        // study, its seven diagrams one too many.
        const ruled: any = await draft([
            ...genStudy(4),
            '---',
            '',
            '## More',
            '',
            ...genDiagrams(3),
        ]);
        expect(ruled.reason).toBe(tooMany(7, 6));
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('refuses a Bible or a passage no installed Bible has', async () => {
        const request = {
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: 'Plain words.',
        };
        state.installed = [];
        await expect(handleAgentStudyRequest(request)).resolves.toEqual({
            isError: true,
            reason: 'No Bible version is installed on this machine.',
        });

        state.installed = ['KJV'];
        await expect(
            handleAgentStudyRequest({ ...request, bible: 'NOPE' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Bible version called "NOPE" is installed.',
        });

        await expect(handleAgentStudyRequest(request)).resolves.toEqual({
            isError: true,
            reason:
                'No installed Bible could read "Matthew 3:3-7" as a ' +
                'passage. Give it as Book Chapter:Verse, e.g. "Matthew ' +
                '3:3-7" or "John 3".',
        });

        addItem('Matthew 3:3-7', {
            bibleKey: 'KJV',
            title: 'Matthew 3:3-7',
            target: { bookKey: 'MAT', chapter: 3, verseStart: 3, verseEnd: 7 },
            verses: [],
        });
        await expect(handleAgentStudyRequest(request)).resolves.toEqual({
            isError: true,
            reason: 'The Bible KJV has no Matthew 3:3-7.',
        });
    });

    test('names the tokens no installed Bible can read, and refuses too many of them', async () => {
        addMatthew3();
        const unread: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: 'See [^Isaiah 40:3], [^Hezekiah 9:9] and [^Nowhere 1:1].',
        });
        expect(unread).toEqual({
            isError: true,
            reason:
                'No installed Bible could read [^Hezekiah 9:9], ' +
                '[^Nowhere 1:1]. Write each as [^Book Chapter:Verse] in ' +
                'English (e.g. [^Isaiah 40:3]), or as plain words, and call ' +
                'draft again.',
        });

        const many = Array.from({ length: 25 }, (_, index) => {
            return `[^John 1:${index + 1}]`;
        }).join(' ');
        const tooMany: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: many,
        });
        expect(tooMany.reason).toBe(
            'The study names 25 verses as [^…]; keep it to 24 and write ' +
                'any other reference as plain words.',
        );
    });

    test('refuses a file the quoted passage makes longer than a study file holds', async () => {
        addItem('Psalms 119', {
            bibleKey: 'KJV',
            title: 'Psalms 119',
            target: {
                bookKey: 'PSA',
                chapter: 119,
                verseStart: 1,
                verseEnd: 176,
            },
            verses: genVerses(119, 1, 176, () => 'w'.repeat(400)),
        });
        state.verseCounts.set('KJV|PSA|119', 176);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Psalms 119',
            title: 'The Word',
            content: 'b'.repeat(45_000),
        });
        expect(result.isError).toBe(true);
        const length = Number(
            /file is (\d+) characters/.exec(result.reason)?.[1],
        );
        expect(length).toBeGreaterThan(STUDY_FILE_MAX_CHARS);
        expect(result.reason).toContain(
            `shorten the study by ${length - STUDY_FILE_MAX_CHARS} and call ` +
                'draft again.',
        );
    });
});

describe('draft: a change to a study in Default', () => {
    const OLD_BODY = [
        '## Background',
        '',
        'The old background.',
        '',
        '## Prayer',
        '',
        'Lord, teach us.',
    ].join('\n');

    test('rewrites one section by its heading and answers the hash it was drafted from', async () => {
        const oldText = genStudyText('The New Birth', OLD_BODY);
        putStudyFile('JHN.3.16 The New Birth.md', oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'Default/JHN.3.16 The New Birth.md',
            section: 'background',
            content: 'A new background.',
        });
        expect(result).toEqual({
            drafted: true,
            isChange: true,
            name: 'JHN.3.16 The New Birth.md',
            file: 'Default/JHN.3.16 The New Birth.md',
            hash: toStudyTextHash(oldText),
            change: 'It changes “Background” (1 line(s) in, 1 out).',
            diagramCount: 0,
            warnings: [],
            content: oldText.replace(
                'The old background.',
                'A new background.',
            ),
        });
        // Nothing is written by a draft.
        expect(
            state.files.get(joinPath(studyDir(), 'JHN.3.16 The New Birth.md')),
        ).toBe(oldText);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('adds words at the end before the app’s last lines, and quotes a new token', async () => {
        addMatthew3();
        const oldText = genStudyText('The New Birth', OLD_BODY);
        putStudyFile('JHN.3.16 The New Birth.md', oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'JHN.3.16 The New Birth.md',
            append: '## More\n\n[^Isaiah 40:3]',
        });
        expect(result.content).toBe(
            genStudyText(
                'The New Birth',
                [
                    OLD_BODY,
                    '',
                    '## More',
                    '',
                    '> **Isaiah 40:3** (KJV)',
                    '>',
                    '> **3** The voice of him that crieth',
                ].join('\n'),
            ),
        );
        expect(result.change).toBe('It adds “More” (4 line(s) in, 0 out).');
    });

    test('takes the WHOLE new text in `content`, keeping apart only the lines written anew', async () => {
        const oldText = genStudyText(
            'The New Birth',
            'John 3:1 one.\nJohn 3:2 two.',
        );
        putStudyFile('JHN.3.16 The New Birth.md', oldText);
        const newText = genStudyText(
            'The New Birth',
            'John 3:1 one.\nJohn 3:2 two.\n\nJohn 3:3 three.\nJohn 3:4 four.',
        );
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'JHN.3.16 The New Birth.md',
            content: newText,
        });
        // The two old lines stay run together as the file had them; the
        // two new ones, one reference a line, are put a line apart.
        expect(result.content).toContain('John 3:1 one.\nJohn 3:2 two.\n');
        expect(result.content).toContain('John 3:3 three.\n\nJohn 3:4 four.');
    });

    test('accepts the file’s whole path, in any case and with either slash', async () => {
        state.sep = '\\';
        state.dataDir = 'C:\\Data\\resources';
        const oldText = genStudyText('The New Birth', OLD_BODY);
        putStudyFile('JHN.3.16 The New Birth.md', oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'c:/data/RESOURCES/Default/JHN.3.16 The New Birth.md',
            section: 'Prayer',
            append: 'Amen.',
        });
        expect(result.file).toBe('Default/JHN.3.16 The New Birth.md');
        expect(result.content).toContain('Lord, teach us.\n\nAmen.\n');
    });

    test('changes nothing outside Default and no file but a Markdown one', async () => {
        putStudyFile('CON.md', 'x');
        for (const file of [
            'Other/JHN.3.16 Notes.md',
            'Default/JHN.3.16 Notes.txt',
            'Default/sub/JHN.3.16 Notes.md',
            'Default/',
            'Default/CON.md',
            '',
        ]) {
            const result: any = await handleAgentStudyRequest({
                action: 'draft',
                file,
                ref: file === '' ? '' : undefined,
                append: 'More.',
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toMatch(
                file === ''
                    ? /^Give `ref`/
                    : /^Only a Markdown study file in Resources → Default/,
            );
        }
        await expect(
            handleAgentStudyRequest({
                action: 'draft',
                file: 'Default/Missing.md',
                append: 'More.',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                "Default/Missing.md is not there. List the chapter's files " +
                'and name one as listed.',
        });
    });

    test('refuses a change it cannot make, in a sentence', async () => {
        const oldText = genStudyText('The New Birth', OLD_BODY);
        putStudyFile('JHN.3.16 The New Birth.md', oldText);
        const file = 'Default/JHN.3.16 The New Birth.md';
        const cases: [Record<string, unknown>, string][] = [
            [
                { section: 'Missing', content: 'x' },
                'The file has no section “Missing”.',
            ],
            [
                {},
                'Give the new words: `section` (a heading) with its new ' +
                    '`content`, `append` for words added at the end, or the ' +
                    'WHOLE new text in `content`.',
            ],
            [
                { append: '```mermaid\nnotachart\n```' },
                'Diagram 1 will not be drawn: it starts with "notachart"',
            ],
            [
                { append: 'x'.repeat(STUDY_FILE_MAX_CHARS) },
                'characters; keep it under 65536.',
            ],
            [
                { content: oldText },
                'That is the file as it already is: nothing would change.',
            ],
            [
                { append: 'See [^Nowhere 1:1].' },
                'No installed Bible could read [^Nowhere 1:1].',
            ],
            [{ append: 'x', bible: 'NOPE' }, 'No Bible version called "NOPE"'],
        ];
        for (const [request, reason] of cases) {
            const result: any = await handleAgentStudyRequest({
                action: 'draft',
                file,
                ...request,
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toContain(reason);
        }
    });

    test('a whole file may hold sixteen diagrams, not more', async () => {
        const diagram = '```mermaid\nflowchart LR\n  A --> B\n```';
        putStudyFile(
            'JHN.3.16 The New Birth.md',
            genStudyText('The New Birth', OLD_BODY),
        );
        const sixteen: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'Default/JHN.3.16 The New Birth.md',
            append: Array.from({ length: 16 }, () => diagram).join('\n\n'),
        });
        expect(sixteen.diagramCount).toBe(16);
        const seventeen: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'Default/JHN.3.16 The New Birth.md',
            append: Array.from({ length: 17 }, () => diagram).join('\n\n'),
        });
        expect(seventeen.reason).toContain('17 diagrams is more than 16');
    });

    test('refuses a file already longer than a change can hold', async () => {
        putStudyFile('JHN.3.16 Long.md', 'x'.repeat(STUDY_FILE_MAX_CHARS + 1));
        await expect(
            handleAgentStudyRequest({
                action: 'draft',
                file: 'Default/JHN.3.16 Long.md',
                append: 'More.',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'JHN.3.16 Long.md is longer than a change here can hold ' +
                'whole. Make a new study file instead.',
        });
    });
});

describe('draft: an exact replace', () => {
    const BODY = [
        '## Setting',
        '',
        'John baptized in Aenon near Salim.',
        '',
        '```mermaid',
        'flowchart LR',
        '  A["Aenon"] --> B["Salim"]',
        '```',
        '',
        '## Prayer',
        '',
        'Lord of Aenon, teach us.',
    ].join('\n');
    const NAME = 'JHN.3.16 The New Birth.md';
    const FILE = `Default/${NAME}`;

    test('writes each `from` as its `to`, moving nothing else, and names the diagrams it changed', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            replace: [{ from: 'Aenon', to: 'Enon' }],
        });
        expect(result).toEqual({
            drafted: true,
            isChange: true,
            name: NAME,
            file: FILE,
            hash: toStudyTextHash(oldText),
            change:
                'It writes “Enon” for “Aenon” (3 places); nothing else ' +
                'changes.',
            replaced: [{ from: 'Aenon', to: 'Enon', count: 3 }],
            diagramsChanged: [0],
            diagramCount: 1,
            warnings: [],
            content: oldText.replaceAll('Aenon', 'Enon'),
        });
        expect(state.files.get(joinPath(studyDir(), NAME))).toBe(oldText);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('keeps to the part `section` names', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'prayer',
            replace: [{ from: 'Aenon', to: 'Enon' }],
        });
        expect(result.replaced).toEqual([
            { from: 'Aenon', to: 'Enon', count: 1 },
        ]);
        expect(result.diagramsChanged).toEqual([]);
        expect(result.content).toBe(
            oldText.replace('Lord of Aenon', 'Lord of Enon'),
        );
    });

    test('reads an empty list as no replace: a whole text beside it is drafted as one', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const newText = oldText.replace('Lord of Aenon,', 'Lord,');
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            content: newText,
            replace: [],
        });
        expect(result.isError).toBeUndefined();
        expect(result.replaced).toBeUndefined();
        expect(result.diagramsChanged).toBeUndefined();
        expect(result.content).toBe(newText);
    });

    test('refuses what it cannot write as asked, in a sentence', async () => {
        putStudyFile(NAME, genStudyText('The New Birth', BODY));
        const pair = [{ from: 'Aenon', to: 'Enon' }];
        const cases: [Record<string, unknown>, string][] = [
            [
                { replace: pair, append: 'More.' },
                '`replace` writes words anew where they stand: send it ' +
                    'without `content` or `append`',
            ],
            [
                { replace: pair, content: 'All new.' },
                '`replace` writes words anew where they stand',
            ],
            [
                { replace: [] },
                'To fix some words where they stand, `replace`: each ' +
                    '`from` as the file writes it, and its `to`.',
            ],
            [
                { replace: 'Aenon' },
                'Give `replace` as a list of {"from", "to"}',
            ],
            [
                { replace: [{ from: 'Bethany', to: 'Bethel' }] },
                'Pair 1: “Bethany” is not in the file',
            ],
            [
                { replace: [{ from: 'loved', to: 'loves' }] },
                'is there only where a replace leaves the words as they are',
            ],
            [
                { replace: [{ from: 'Salim', to: '<b>Salim</b>' }] },
                'Raw HTML (<b>) is not written into a study file',
            ],
            [
                { replace: pair, section: 'Missing' },
                'The file has no section “Missing”.',
            ],
        ];
        for (const [request, reason] of cases) {
            const result: any = await handleAgentStudyRequest({
                action: 'draft',
                file: FILE,
                ...request,
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toContain(reason);
        }
    });
});

// EC-543: a part taken out whole -- no other call could take one out of a
// long study, nor put a new translation in the place of an old one.
describe('draft: a part taken out', () => {
    const BODY = [
        '## Setting',
        '',
        'John baptized in Aenon near Salim.',
        '',
        '## Prayer',
        '',
        'Lord, teach us.',
    ].join('\n');
    const NAME = 'JHN.3.16 The New Birth.md';
    const FILE = `Default/${NAME}`;

    test('drafts the file without the part, every other line as it was, writing nothing', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'setting',
            remove: true,
        });
        expect(result).toEqual({
            drafted: true,
            isChange: true,
            name: NAME,
            file: FILE,
            hash: toStudyTextHash(oldText),
            change: 'It removes “Setting” (0 line(s) in, 2 out).',
            diagramCount: 0,
            warnings: [],
            content: oldText.replace(
                '## Setting\n\nJohn baptized in Aenon near Salim.\n\n',
                '',
            ),
        });
        expect(state.files.get(joinPath(studyDir(), NAME))).toBe(oldText);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('reads `remove` false as no removal', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'Prayer',
            content: 'Lord, keep us.',
            remove: false,
        });
        expect(result.content).toBe(
            oldText.replace('Lord, teach us.', 'Lord, keep us.'),
        );
    });

    test('refuses a removal with words beside it, no part, or the title', async () => {
        putStudyFile(NAME, genStudyText('The New Birth', BODY));
        const cases: [Record<string, unknown>, string][] = [
            [{ content: 'New words.' }, STUDY_REMOVE_ALONE_REASON],
            [{ append: 'More.' }, STUDY_REMOVE_ALONE_REASON],
            [
                { replace: [{ from: 'Lord', to: 'God' }] },
                STUDY_REMOVE_ALONE_REASON,
            ],
            [
                { section: '' },
                'Name the part to take out in `section`: its heading, as ' +
                    'the file writes it.',
            ],
            [
                { section: 'The New Birth' },
                "“The New Birth” is the study's own title",
            ],
            [{ section: 'Missing' }, 'The file has no section “Missing”.'],
        ];
        for (const [request, reason] of cases) {
            const result: any = await handleAgentStudyRequest({
                action: 'draft',
                file: FILE,
                section: 'Prayer',
                remove: true,
                ...request,
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toContain(reason);
        }
    });
});

// EC-544: new words for a part that holds parts of its own keep them.
describe('draft: a part’s own words', () => {
    const BODY = [
        '## Places',
        '',
        'Where it happens.',
        '',
        '### Aenon',
        '',
        'Near Salim.',
        '',
        '### Judea',
        '',
        'The land.',
    ].join('\n');
    const NAME = 'JHN.3.16 The New Birth.md';
    const FILE = `Default/${NAME}`;

    test('writes the words above the parts it holds, and says they were kept', async () => {
        const oldText = genStudyText('The New Birth', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'Places',
            content: 'Two places by the water.',
        });
        expect(result.content).toBe(
            oldText.replace('Where it happens.', 'Two places by the water.'),
        );
        expect(result.change).toBe(
            'It changes “Places” (1 line(s) in, 1 out). The parts under ' +
                '“Places” were kept as they were, below these words: ' +
                '“Aenon”, “Judea”. To take one out, draft it with `remove`.',
        );
    });
});

// EC-548: an introduction written for the title keeps the passage the app
// quoted under it, and the passage is taken out by its reference.
describe('draft: the passage quoted under the title', () => {
    const BODY = ['## The Setting', '', 'At night.'].join('\n');
    const NAME = 'JHN.3.16 The Night Visit.md';
    const FILE = `Default/${NAME}`;
    const PASSAGE =
        '> **John 3:16** (KJV)\n>\n> **16** For God so loved the world.\n\n';

    test('keeps the passage above words written for the title, and says so', async () => {
        const oldText = genStudyText('The Night Visit', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'The Night Visit',
            content: 'A study of one night.',
        });
        expect(result.content).toBe(
            oldText.replace(PASSAGE, `${PASSAGE}A study of one night.\n\n`),
        );
        expect(result.change).toContain(
            'The passage “John 3:16” quoted under “The Night Visit” was ' +
                'kept as it was, above these words: the app quotes it from ' +
                'the Bible.',
        );
    });

    test('takes the passage out by its reference, every other line kept', async () => {
        const oldText = genStudyText('The Night Visit', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'John 3:16',
            remove: true,
        });
        expect(result.content).toBe(oldText.replace(PASSAGE, ''));
    });
});

// EC-549: a passage the app quoted, copied back with words changed, is put
// back as it was quoted -- by a part's new words or a whole new text.
describe('draft: a quoted passage copied back changed', () => {
    const BODY = ['## The Setting', '', 'At night.'].join('\n');
    const NAME = 'JHN.3.16 The Night Visit.md';
    const FILE = `Default/${NAME}`;

    test('puts it back in new words for the title, and says so', async () => {
        const oldText = genStudyText('The Night Visit', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'The Night Visit',
            content:
                '> **John 3:16** (KJV)\n>\n> **16** For God so greatly ' +
                'loved the world.\n\nA study of one night.',
        });
        expect(result.content).toBe(
            oldText.replace(
                'the world.\n\n',
                'the world.\n\nA study of one night.\n\n',
            ),
        );
        expect(result.change).toContain(
            'The passage “John 3:16” was put back as the app quoted it ' +
                'from the Bible: the words sent changed 1 of its line(s)',
        );
    });

    test('puts it back in a whole new text, every other word as sent', async () => {
        const oldText = genStudyText('The Night Visit', BODY);
        putStudyFile(NAME, oldText);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            content: oldText
                .replace('the world.', 'the whole world.')
                .replace('At night.', 'By night.'),
        });
        expect(result.content).toBe(oldText.replace('At night.', 'By night.'));
        expect(result.change).toContain(
            'was put back as the app quoted it from the Bible',
        );
    });
});

// EC-541: a translation under the study writes a name with another vowel
// sign than the Bible it quotes, and a model cannot see the difference.
describe('draft: a replace the study’s name check puts right', () => {
    // A made-up language written in one block whose vowels are signs on
    // its letters, made by code point.
    const letter = (index: number) => {
        return String.fromCodePoint(0x1000 + index);
    };
    const [SIGN_I, SIGN_II, SIGN_U] = [0x102d, 0x102e, 0x102f].map((code) => {
        return String.fromCodePoint(code);
    });
    const digits = (text: string) => {
        return text.replace(/\d/g, (digit) => {
            return String.fromCodePoint(0x1040 + Number(digit));
        });
    };
    const ZENON = `${letter(0)}${SIGN_I}${letter(1)}${letter(2)}${SIGN_U}`;
    const ZENON_SLIP = `${letter(0)}${SIGN_II}${letter(1)}${letter(2)}${SIGN_U}`;
    const QALIM = `${letter(3)}${SIGN_U}${letter(4)}${letter(5)}${SIGN_I}`;
    const WORD = `${letter(12)}${letter(13)}`;
    const NAME = 'JHN.3.23 The New Birth.md';
    const FILE = `Default/${NAME}`;
    const OLD_TEXT = [
        '# The New Birth',
        '',
        '> **John 3:23** (KJV)',
        '>',
        '> **23** And John also was baptizing in Zenon near to Qalim.',
        '',
        '## Places',
        '',
        'They baptized at Zenon near Qalim.',
        '',
        '---',
        '',
        `# ${WORD}`,
        '',
        `> **${WORD} ${digits('3:23')}** (ZB)`,
        '>',
        `> **${digits('23')}** ${WORD} ${ZENON} ${WORD} ${QALIM}.`,
        '',
        `${WORD} ${ZENON_SLIP} ${QALIM}.`,
        '',
        '---',
        '',
        `*${FOOTNOTE}*`,
        '',
    ].join('\n');
    const WRITTEN = OLD_TEXT.replace(
        `${WORD} ${ZENON_SLIP} ${QALIM}.`,
        `${WORD} ${ZENON} ${QALIM}.`,
    );
    const SAID =
        `It writes “${ZENON}” for “${ZENON_SLIP}” (1 place); nothing else ` +
        'changes.';

    test('writes a pair asked in the verse’s spelling as the right call does, and says so', async () => {
        putStudyFile(NAME, OLD_TEXT);
        const asked = { from: ZENON, to: ZENON };
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            replace: [asked],
        });
        expect(result).toEqual({
            drafted: true,
            isChange: true,
            name: NAME,
            file: FILE,
            hash: toStudyTextHash(OLD_TEXT),
            change:
                'The app put pair 1 right: a word its check of this study ' +
                'found written otherwise than its verse, a vowel sign ' +
                `apart, is written from the file's spelling to the verse's. ${SAID}`,
            replaced: [{ from: ZENON_SLIP, to: ZENON, count: 1 }],
            repaired: [
                {
                    pair: 1,
                    asked,
                    written: { from: ZENON_SLIP, to: ZENON },
                },
            ],
            diagramsChanged: [],
            diagramCount: 0,
            warnings: [],
            content: WRITTEN,
        });
        expect(state.files.get(joinPath(studyDir(), NAME))).toBe(OLD_TEXT);
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('says nothing was put right of a right call', async () => {
        putStudyFile(NAME, OLD_TEXT);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            replace: [{ from: ZENON_SLIP, to: ZENON }],
        });
        expect(result.change).toBe(SAID);
        expect(result.repaired).toBeUndefined();
        expect(result.content).toBe(WRITTEN);
    });

    test('refuses as before a pair naming no word the check names', async () => {
        putStudyFile(NAME, OLD_TEXT);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            replace: [{ from: 'Bethany', to: 'Bethel' }],
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('Pair 1: “Bethany” is not in the file');
    });
});

describe('save: the person’s press', () => {
    const CONTENT = genStudyText('The Voice', '## Notes\n\nA few words.');

    test('makes Default when missing, writes the file behind a backup, lists the folder and tells the panel', async () => {
        const result = await handleAgentStudyRequest({
            action: 'save',
            name: 'MAT.3.3-7 The Voice.md',
            content: CONTENT,
        });
        const filePath = joinPath(studyDir(), 'MAT.3.3-7 The Voice.md');
        expect(result).toEqual({
            created: 'MAT.3.3-7 The Voice.md',
            file: 'Default/MAT.3.3-7 The Voice.md',
            filePath,
            folderAdded: 'Default',
            undoId: 'backup-1',
            undo: 'owa_undo with id "backup-1" puts this back.',
        });
        expect(mocks.createDir).toHaveBeenCalledWith(studyDir());
        expect(state.files.get(filePath)).toBe(CONTENT);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Made the study file “MAT.3.3-7 The Voice.md”',
            [{ type: 'file', filePath, text: null, isResource: true }],
            expect.any(Function),
        );
        expect(mocks.filterUnlisted).toHaveBeenCalledWith(
            [studyDir()],
            ['/elsewhere'],
            2,
        );
        expect(mocks.addFolders).toHaveBeenCalledWith([studyDir()]);
        expect(mocks.invalidateResourcesScanCache).toHaveBeenCalledWith(
            studyDir(),
        );
        expect(mocks.announceResourcesChanged).toHaveBeenCalledOnce();
    });

    test('never writes over a file: a name taken since the draft takes the next free one', async () => {
        const takenPath = putStudyFile('MAT.3.3-7 The Voice.md', 'theirs');
        // Default is already shown by a listed folder.
        mocks.filterUnlisted.mockImplementation(() => []);
        const result: any = await handleAgentStudyRequest({
            action: 'save',
            name: 'MAT.3.3-7 The Voice.md',
            content: CONTENT,
        });
        expect(result.created).toBe('MAT.3.3-7 The Voice (1).md');
        expect(result.nameTaken).toBe('MAT.3.3-7 The Voice.md');
        expect(result.folderAdded).toBeUndefined();
        expect(state.files.get(takenPath)).toBe('theirs');
        expect(mocks.createDir).not.toHaveBeenCalled();
        expect(mocks.addFolders).not.toHaveBeenCalled();

        // Listed by the panel's own add as nothing new: not said either.
        mocks.filterUnlisted.mockImplementation((paths: string[]) => paths);
        mocks.addFolders.mockImplementation(() => []);
        const again: any = await handleAgentStudyRequest({
            action: 'save',
            name: 'MAT.3.3-7 The Voice.md',
            content: CONTENT,
        });
        expect(again.created).toBe('MAT.3.3-7 The Voice (2).md');
        expect(again.folderAdded).toBeUndefined();
    });

    test('refuses content it would not write and a name the draft did not answer', async () => {
        const cases: [Record<string, unknown>, string][] = [
            [
                { name: 'MAT.3.3-7 The Voice.md' },
                'Give the drafted file in `content`.',
            ],
            [
                { name: 'MAT.3.3-7 The Voice.md', content: '   ' },
                'Give the drafted file in `content`.',
            ],
            [
                {
                    name: 'MAT.3.3-7 The Voice.md',
                    content: 'x'.repeat(STUDY_FILE_MAX_CHARS + 1),
                },
                'The file is longer than 65536 characters.',
            ],
            [
                { name: 'MAT.3.3-7 The Voice.md', content: '```js\nx' },
                'A ``` block is not closed.',
            ],
            [{ content: CONTENT }, 'Give the `name` the draft answered'],
            [{ name: 'notes.md', content: CONTENT }, 'Give the `name`'],
            [
                { name: 'MAT.3.3-7 The: Voice.md', content: CONTENT },
                'Give the `name`',
            ],
        ];
        for (const [request, reason] of cases) {
            const result: any = await handleAgentStudyRequest({
                action: 'save',
                ...request,
            });
            expect(result.isError).toBe(true);
            expect(result.reason).toContain(reason);
        }
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('with no backup there is no change, and a failed write says what can be put back', async () => {
        mocks.runWithAgentBackup.mockImplementation(async () => {
            throw new NoBackupErrorMock('The backup could not be saved.');
        });
        await expect(
            handleAgentStudyRequest({
                action: 'save',
                name: 'MAT.3.3-7 The Voice.md',
                content: CONTENT,
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The backup could not be saved.',
        });
        expect(state.files.size).toBe(0);
        expect(mocks.handleError).not.toHaveBeenCalled();
        expect(mocks.announceResourcesChanged).not.toHaveBeenCalled();

        mocks.runWithAgentBackup.mockImplementation(
            async (_s: string, _r: unknown[], change: () => Promise<void>) => {
                await change();
                return { meta: { id: 'b' } };
            },
        );
        mocks.writeFile.mockImplementation(async () => {
            throw new Error('Disk full.');
        });
        await expect(
            handleAgentStudyRequest({
                action: 'save',
                name: 'MAT.3.3-7 The Voice.md',
                content: CONTENT,
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making “MAT.3.3-7 The Voice.md” could not be finished: Disk ' +
                'full. Anything it did get to do can be put back with ' +
                'owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();

        // A write that "worked" and left no file is a failure too.
        mocks.writeFile.mockImplementation(async () => {});
        const vanished: any = await handleAgentStudyRequest({
            action: 'save',
            name: 'MAT.3.3-7 The Voice.md',
            content: CONTENT,
        });
        expect(vanished.reason).toContain(
            'could not be finished: The file is not there after writing it.',
        );

        mocks.runWithAgentBackup.mockImplementation(async () => {
            throw 'refused';
        });
        const thrown: any = await handleAgentStudyRequest({
            action: 'save',
            name: 'MAT.3.3-7 The Voice.md',
            content: CONTENT,
        });
        expect(thrown.reason).toContain('could not be finished: refused ');
    });

    test('writes a change only while the file still reads as it did at the draft', async () => {
        const oldText = genStudyText('The Voice', '## Notes\n\nOld words.');
        const filePath = putStudyFile('MAT.3.3-7 The Voice.md', oldText);
        const newText = genStudyText('The Voice', '## Notes\n\nNew words.');

        const stale: any = await handleAgentStudyRequest({
            action: 'save',
            file: 'Default/MAT.3.3-7 The Voice.md',
            hash: toStudyTextHash('what it was before'),
            content: newText,
        });
        expect(stale.reason).toBe(
            'MAT.3.3-7 The Voice.md has changed since this was drafted, so ' +
                'it is not written over. Read it again and draft the change ' +
                'again.',
        );
        expect(state.files.get(filePath)).toBe(oldText);

        const saved = await handleAgentStudyRequest({
            action: 'save',
            file: 'Default/MAT.3.3-7 The Voice.md',
            hash: toStudyTextHash(oldText),
            content: newText,
        });
        expect(saved).toEqual({
            changed: 'MAT.3.3-7 The Voice.md',
            file: 'Default/MAT.3.3-7 The Voice.md',
            filePath,
            undoId: 'backup-1',
            undo: 'owa_undo with id "backup-1" puts this back.',
        });
        expect(state.files.get(filePath)).toBe(newText);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Changed the study file “MAT.3.3-7 The Voice.md”',
            [{ type: 'file', filePath, text: oldText, isResource: true }],
            expect.any(Function),
        );
        // A change is to a file already listed: no folder added.
        expect(mocks.filterUnlisted).not.toHaveBeenCalled();
        expect(mocks.invalidateResourcesScanCache).toHaveBeenCalledWith(
            studyDir(),
        );
        expect(mocks.announceResourcesChanged).toHaveBeenCalledOnce();
    });

    test('a change to a file outside Default, or one the backup refuses, is not written', async () => {
        const oldText = genStudyText('The Voice', '## Notes\n\nOld words.');
        const filePath = putStudyFile('MAT.3.3-7 The Voice.md', oldText);
        const outside: any = await handleAgentStudyRequest({
            action: 'save',
            file: 'Other/MAT.3.3-7 The Voice.md',
            hash: toStudyTextHash(oldText),
            content: 'New words.',
        });
        expect(outside.reason).toMatch(/^Only a Markdown study file/);

        mocks.runWithAgentBackup.mockImplementation(async () => {
            throw new Error('The data folder is read-only.');
        });
        const failed: any = await handleAgentStudyRequest({
            action: 'save',
            file: 'Default/MAT.3.3-7 The Voice.md',
            hash: toStudyTextHash(oldText),
            content: 'New words.',
        });
        expect(failed.reason).toBe(
            'Changing “MAT.3.3-7 The Voice.md” could not be finished: The ' +
                'data folder is read-only. Anything it did get to do can be ' +
                'put back with owa_undo.',
        );
        expect(state.files.get(filePath)).toBe(oldText);
        expect(mocks.announceResourcesChanged).not.toHaveBeenCalled();
    });
});

// 2026-11-12, EC-509, the user: _when create markdown file for user make sure
// ask user into resource or bible-note area_. The card asks; the press says
// where with `to`, and a study kept in Bible Notes stays the chat's to change.
describe('Bible Notes: where the person chose to keep it', () => {
    const NOTES_DIR = '/data/notes';
    const NAME = 'MAT.3.3-7 The Voice.md';
    const CONTENT = genStudyText('The Voice', '## Notes\n\nA few words.');

    test('a new study goes into the Bible Notes folder, no Resources list touched', async () => {
        state.bibleNotesDir = NOTES_DIR;
        const request = {
            action: 'save',
            name: NAME,
            content: CONTENT,
            to: 'bible-notes',
        };
        const result = await handleAgentStudyRequest(request);
        const filePath = joinPath(NOTES_DIR, NAME);
        expect(result).toEqual({
            created: NAME,
            file: `Bible Notes/${NAME}`,
            filePath,
            place: 'bible-notes',
            undoId: 'backup-1',
            undo: 'owa_undo with id "backup-1" puts this back.',
        });
        expect(mocks.createDir).toHaveBeenCalledWith(NOTES_DIR);
        expect(state.files.get(filePath)).toBe(CONTENT);
        // The list watches its own folder: a plain file's backup, and no
        // Resources folder listed or told.
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            `Made the study file “${NAME}”`,
            [{ type: 'file', filePath, text: null }],
            expect.any(Function),
        );
        expect(mocks.filterUnlisted).not.toHaveBeenCalled();
        expect(mocks.addFolders).not.toHaveBeenCalled();
        expect(mocks.invalidateResourcesScanCache).not.toHaveBeenCalled();
        expect(mocks.announceResourcesChanged).not.toHaveBeenCalled();

        // Never over a note of that name.
        const again: any = await handleAgentStudyRequest(request);
        expect(again.created).toBe('MAT.3.3-7 The Voice (1).md');
        expect(again.nameTaken).toBe(NAME);
        expect(again.file).toBe('Bible Notes/MAT.3.3-7 The Voice (1).md');
        expect(state.files.get(filePath)).toBe(CONTENT);
    });

    test('`to` resources is Default, and an unknown place or no folder is refused', async () => {
        const resources: any = await handleAgentStudyRequest({
            action: 'save',
            name: NAME,
            content: CONTENT,
            to: 'resources',
        });
        expect(resources.file).toBe(`Default/${NAME}`);
        expect(resources.place).toBeUndefined();
        expect(mocks.writeFile).toHaveBeenCalledTimes(1);

        const unknown: any = await handleAgentStudyRequest({
            action: 'save',
            name: NAME,
            content: CONTENT,
            to: 'desktop',
        });
        expect(unknown.reason).toBe(
            'Give `to` "resources" (Resources → Default) or "bible-notes" ' +
                '(the Bible Notes list), or leave it out for Resources.',
        );
        // No Bible Notes folder chosen in Path Settings.
        const unset: any = await handleAgentStudyRequest({
            action: 'save',
            name: NAME,
            content: CONTENT,
            to: 'bible-notes',
        });
        expect(unset.reason).toBe(
            'No Bible Notes folder is set up yet. The person chooses one in ' +
                'Settings under Path Settings.',
        );
        expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    });

    test('a study kept there is changed by its name or its whole path, and previewed', async () => {
        state.bibleNotesDir = NOTES_DIR;
        state.dirs.add(NOTES_DIR);
        const oldText = genStudyText('The Voice', '## Notes\n\nOld words.');
        const filePath = joinPath(NOTES_DIR, NAME);
        state.files.set(filePath, oldText);
        for (const file of [
            `Bible Notes/${NAME}`,
            `bible notes/${NAME}`,
            `\\data\\notes\\${NAME}`,
        ]) {
            const drafted: any = await handleAgentStudyRequest({
                action: 'draft',
                file,
                section: 'notes',
                content: 'New words.',
            });
            expect(drafted.file).toBe(`Bible Notes/${NAME}`);
            expect(drafted.hash).toBe(toStudyTextHash(oldText));
        }
        const newText = oldText.replace('Old words.', 'New words.');
        const saved = await handleAgentStudyRequest({
            action: 'save',
            file: `Bible Notes/${NAME}`,
            hash: toStudyTextHash(oldText),
            content: newText,
        });
        expect(saved).toEqual({
            changed: NAME,
            file: `Bible Notes/${NAME}`,
            filePath,
            undoId: 'backup-1',
            undo: 'owa_undo with id "backup-1" puts this back.',
        });
        expect(state.files.get(filePath)).toBe(newText);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            `Changed the study file “${NAME}”`,
            [{ type: 'file', filePath, text: oldText }],
            expect.any(Function),
        );
        expect(mocks.announceResourcesChanged).not.toHaveBeenCalled();

        await expect(
            handleAgentStudyRequest({
                action: 'preview',
                file: `Bible Notes/${NAME}`,
            }),
        ).resolves.toMatchObject({ previewed: NAME });
        expect(mocks.openMarkdownPreview).toHaveBeenCalledWith(filePath);
    });

    // EC-706: a bare name had always meant Default's, so a study kept in
    // Bible Notes was missed by it, and a copy in Default changed instead.
    test('a file name alone is the folder that has it, and refused when both do', async () => {
        state.bibleNotesDir = NOTES_DIR;
        const notesText = genStudyText('The Voice', '## Notes\n\nIn notes.');
        state.files.set(joinPath(NOTES_DIR, NAME), notesText);
        const onlyNotes: any = await handleAgentStudyRequest({
            action: 'translate',
            file: NAME,
        });
        expect(onlyNotes.file).toBe(`Bible Notes/${NAME}`);
        expect(onlyNotes.hash).toBe(toStudyTextHash(notesText));

        putStudyFile(
            NAME,
            genStudyText('The Voice', '## Notes\n\nIn Default.'),
        );
        for (const action of ['translate', 'draft']) {
            const both: any = await handleAgentStudyRequest({
                action,
                file: NAME,
                append: 'More.',
            });
            expect(both).toEqual({
                isError: true,
                reason:
                    `"Default/${NAME}" and "Bible Notes/${NAME}" are both ` +
                    `called "${NAME}". Name the one you mean with its folder.`,
            });
        }
        // Named with its folder, each is its own.
        const inDefault: any = await handleAgentStudyRequest({
            action: 'translate',
            file: `Default/${NAME}`,
        });
        expect(inDefault.file).toBe(`Default/${NAME}`);

        // With no Bible Notes folder, a file name alone is Default's.
        state.bibleNotesDir = null;
        const noNotes: any = await handleAgentStudyRequest({
            action: 'translate',
            file: NAME,
        });
        expect(noNotes.file).toBe(`Default/${NAME}`);
    });

    test('nothing deeper in the folder, and none of it while no folder is set', async () => {
        state.bibleNotesDir = NOTES_DIR;
        state.files.set(joinPath(NOTES_DIR, 'old', 'Deep.md'), 'x');
        state.files.set(joinPath(NOTES_DIR, NAME), 'x');
        const deep: any = await handleAgentStudyRequest({
            action: 'draft',
            file: 'Bible Notes/old/Deep.md',
            append: 'More.',
        });
        expect(deep.reason).toMatch(
            /^Only a Markdown study file in Resources → Default or in Bible Notes/,
        );
        state.bibleNotesDir = null;
        const unset: any = await handleAgentStudyRequest({
            action: 'draft',
            file: `Bible Notes/${NAME}`,
            append: 'More.',
        });
        expect(unset.reason).toMatch(/^Only a Markdown study file/);
    });
});

describe('preview', () => {
    const PREVIEW_DIR = '/temp/open-worship-app-study-preview';

    test('writes the draft into a folder of its own and opens it, saving nothing', async () => {
        const result = await handleAgentStudyRequest({
            action: 'preview',
            name: 'MAT.3.3-7 The Voice.md',
            content: '# The Voice\n',
        });
        const filePath = `${PREVIEW_DIR}/MAT.3.3-7 The Voice.md`;
        expect(result).toEqual({
            previewed: 'MAT.3.3-7 The Voice.md',
            note: 'The Markdown Preview window is open with it. Nothing is saved.',
        });
        expect(mocks.createDir).toHaveBeenCalledWith(PREVIEW_DIR);
        expect(state.files.get(filePath)).toBe('# The Voice\n');
        expect(mocks.openMarkdownPreview).toHaveBeenCalledWith(filePath);
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(mocks.announceResourcesChanged).not.toHaveBeenCalled();
    });

    test('names a preview with no usable name `study.md`', async () => {
        state.dirs.add(PREVIEW_DIR);
        for (const name of [undefined, '', 'a/b.md']) {
            const result: any = await handleAgentStudyRequest({
                action: 'preview',
                name,
                content: 'Words.',
            });
            expect(result.previewed).toBe('study.md');
        }
        expect(mocks.createDir).not.toHaveBeenCalled();
        expect(mocks.openMarkdownPreview).toHaveBeenLastCalledWith(
            `${PREVIEW_DIR}/study.md`,
        );
    });

    test('keeps the newest three previews and lets the rest go', async () => {
        state.dirs.add(PREVIEW_DIR);
        state.dirs.add(`${PREVIEW_DIR}/a folder`);
        const old = (name: string, stamp: number | null) => {
            const filePath = `${PREVIEW_DIR}/${name}`;
            state.files.set(filePath, name);
            state.stamps.set(filePath, stamp);
            return filePath;
        };
        const unstamped = old('unstamped.md', null);
        const oldest = old('oldest.md', 10);
        const older = old('older.md', 20);
        const newer = old('newer.md', 30);
        await handleAgentStudyRequest({
            action: 'preview',
            name: 'newest.md',
            content: 'Newest.',
        });
        expect([...state.files.keys()].sort()).toEqual(
            [newer, older, `${PREVIEW_DIR}/newest.md`].sort(),
        );
        expect(mocks.deleteFile).toHaveBeenCalledWith(unstamped);
        expect(mocks.deleteFile).toHaveBeenCalledWith(oldest);
        expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
        // A folder in there is no preview.
        expect(state.dirs.has(`${PREVIEW_DIR}/a folder`)).toBe(true);
    });

    test('a preview that cannot be swept still opens', async () => {
        state.dirs.add(PREVIEW_DIR);
        for (const [index, name] of [
            'a.md',
            'b.md',
            'c.md',
            'd.md',
        ].entries()) {
            state.files.set(`${PREVIEW_DIR}/${name}`, name);
            state.stamps.set(`${PREVIEW_DIR}/${name}`, index + 1);
        }
        mocks.deleteFile.mockImplementation(async () => {
            throw new Error('in use');
        });
        await expect(
            handleAgentStudyRequest({
                action: 'preview',
                name: 'e.md',
                content: 'E.',
            }),
        ).resolves.toMatchObject({ previewed: 'e.md' });
        expect(mocks.deleteFile).toHaveBeenCalledTimes(2);

        mocks.listDirents.mockImplementation(async () => {
            throw new Error('gone');
        });
        mocks.deleteFile.mockClear();
        await expect(
            handleAgentStudyRequest({
                action: 'preview',
                name: 'f.md',
                content: 'F.',
            }),
        ).resolves.toMatchObject({ previewed: 'f.md' });
        expect(mocks.deleteFile).not.toHaveBeenCalled();
        expect(mocks.openMarkdownPreview).toHaveBeenLastCalledWith(
            `${PREVIEW_DIR}/f.md`,
        );
    });

    test('opens a study already in Default as it is, and refuses an empty or oversized draft', async () => {
        const filePath = putStudyFile('MAT.3.3-7 The Voice.md', 'Saved words.');
        const saved = await handleAgentStudyRequest({
            action: 'preview',
            file: 'Default/MAT.3.3-7 The Voice.md',
        });
        expect(saved).toEqual({
            previewed: 'MAT.3.3-7 The Voice.md',
            note: 'The Markdown Preview window is open with it. Nothing is saved.',
        });
        expect(mocks.openMarkdownPreview).toHaveBeenCalledWith(filePath);
        expect(mocks.writeFile).not.toHaveBeenCalled();

        const refused: any = await handleAgentStudyRequest({
            action: 'preview',
            file: 'Other/x.md',
        });
        expect(refused.reason).toMatch(/^Only a Markdown study file/);

        // With `content` beside `file`, the draft is what is previewed.
        const drafted: any = await handleAgentStudyRequest({
            action: 'preview',
            file: 'Default/MAT.3.3-7 The Voice.md',
            name: 'MAT.3.3-7 The Voice.md',
            content: 'Drafted words.',
        });
        expect(drafted.previewed).toBe('MAT.3.3-7 The Voice.md');
        expect(state.files.get(filePath)).toBe('Saved words.');
        expect(state.files.get(`${PREVIEW_DIR}/MAT.3.3-7 The Voice.md`)).toBe(
            'Drafted words.',
        );

        for (const content of [
            undefined,
            '  ',
            'x'.repeat(STUDY_FILE_MAX_CHARS + 1),
        ]) {
            await expect(
                handleAgentStudyRequest({ action: 'preview', content }),
            ).resolves.toEqual({
                isError: true,
                reason: 'Give the drafted file in `content`.',
            });
        }
    });
});

describe('translate: the plan, writing nothing', () => {
    const STUDY = [
        '# The New Birth',
        '',
        '> **John 3** (KJV)',
        '>',
        '> **1** There was a man of the Pharisees.',
        '',
        '## Meaning',
        '',
        'Words to translate.',
        '',
        '> **Psalms 119:1-40** (KJV)',
        '>',
        '> **1** Blessed are the undefiled.',
        '',
        '> **Romans 5:8** (KJV)',
        '>',
        '> **8** But God commendeth his love.',
        '',
        '> **John 3:16-4:2** (KJV)',
        '>',
        '> **3:16** For God so loved the world.',
        '',
        '```mermaid',
        'flowchart LR',
        '  A[Sin] --> B[Grace]',
        '```',
        '',
        '---',
        '',
        '# Xx title',
        '',
        'Xx words already added.',
        '',
        '---',
        '',
        `*${FOOTNOTE}*`,
        '',
    ].join('\n');

    function addSources() {
        const source = (ref: string, target: TargetType) => {
            addItem(ref, { bibleKey: 'KJV', title: ref, target, verses: [] });
        };
        source('John 3', {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 1,
            verseEnd: 36,
        });
        source('Psalms 119:1-40', {
            bookKey: 'PSA',
            chapter: 119,
            verseStart: 1,
            verseEnd: 40,
        });
        source('Romans 5:8', {
            bookKey: 'ROM',
            chapter: 5,
            verseStart: 8,
            verseEnd: 8,
        });
        source('John 3:16-4:2', {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 2,
            chapterEnd: 4,
        });
    }

    test('splits the study into its parts, the translations already added kept apart', async () => {
        const filePath = putStudyFile('JHN.3.16-4.2 The New Birth.md', STUDY);
        const result: any = await handleAgentStudyRequest({
            action: 'translate',
            file: 'Default/JHN.3.16-4.2 The New Birth.md',
        });
        expect(result).toMatchObject({
            translating: true,
            file: 'Default/JHN.3.16-4.2 The New Birth.md',
            name: 'JHN.3.16-4.2 The New Birth.md',
            hash: toStudyTextHash(STUDY),
            title: 'The New Birth',
            ref: 'JHN 3:16-4:2',
            bible: null,
            passageCount: 4,
            quotedCount: 0,
            translations: '---\n\n# Xx title\n\nXx words already added.\n',
            footer: `\n---\n\n*${FOOTNOTE}*\n`,
        });
        expect(
            result.parts.map((part: { kind: string }) => {
                return part.kind;
            }),
        ).toEqual([
            'text',
            'passage',
            'text',
            'passage',
            'text',
            'passage',
            'text',
            'passage',
            'text',
            'diagram',
            'text',
        ]);
        // With no Bible asked for, every passage keeps its text.
        expect(
            result.parts
                .filter((part: { kind: string }) => part.kind === 'passage')
                .every((part: { quoted: unknown }) => part.quoted === null),
        ).toBe(true);
        expect(result.note).toContain('never translate them again');
        expect(state.files.get(filePath)).toBe(STUDY);
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.resolveBibleItem).not.toHaveBeenCalled();
    });

    test('quotes each passage again from the Bible asked for, by the verse key every Bible reads', async () => {
        state.installed = ['KJV', 'XXB'];
        addSources();
        const keyItem = (verseKey: string, verses: VerseSpecType[]) => {
            state.keyItems.set(`XXB|${verseKey}`, {
                bibleKey: 'XXB',
                title: `Xx ${verseKey}`,
                target: {
                    bookKey: 'X',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 1,
                },
                verses,
            });
        };
        keyItem('JHN 3:1-36', genVerses(3, 1, 36));
        keyItem('PSA 119:1-40', genVerses(119, 1, 40));
        // Not by its key: read the way a reference is.
        addItem('ROM 5:8', {
            bibleKey: 'XXB',
            title: 'Xx ROM 5:8',
            target: { bookKey: 'ROM', chapter: 5, verseStart: 8, verseEnd: 8 },
            verses: genVerses(5, 8, 8),
        });
        putStudyFile('JHN.3.The New Birth.md', STUDY);
        const result: any = await handleAgentStudyRequest({
            action: 'translate',
            file: 'Default/JHN.3.The New Birth.md',
            bible: 'XXB',
        });
        expect(result.ref).toBe('JHN 3');
        expect(result.bible).toBe('XXB');
        expect(result.quotedCount).toBe(3);
        const quoted = result.parts
            .filter((part: { kind: string }) => part.kind === 'passage')
            .map((part: { quoted: string | null }) => part.quoted);
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('XXB', 'JHN 3:1-36');
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('XXB', 'PSA 119:1-40');
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('XXB', 'ROM 5:8');
        expect(mocks.fromVerseKey).toHaveBeenCalledWith('XXB', 'JHN 3:16-4:2');
        // The file's own passage, under its title, quoted as far as a new
        // study quotes one: all 36 verses.
        expect(
            quoted[0].startsWith('> **Xx JHN 3:1-36** (XXB)\n>\n> **1** '),
        ).toBe(true);
        expect(quoted[0]).toContain('> **36** Words of verse 36.');
        expect(quoted[0]).not.toContain('…');
        // Any other passage: thirty verses, and said to go on.
        expect(quoted[1]).toContain('> **30** Words of verse 30.');
        expect(quoted[1]).not.toContain('> **31**');
        expect(quoted[1].endsWith('\n>\n> …')).toBe(true);
        expect(quoted[2]).toBe(
            '> **Xx ROM 5:8** (XXB)\n>\n> **8** Words of verse 8.',
        );
        // Neither way of reading it found the passage: kept as it is.
        expect(quoted[3]).toBeNull();
    });

    test('leaves a passage as it is when its own Bible cannot read it or the new one holds no verse', async () => {
        state.installed = ['KJV', 'XXB'];
        addSources();
        mocks.resolveBibleItem.mockImplementation(
            async (ref: string, order: string[]) => {
                // A resolver that fails is a passage left as it is, read
                // by its own Bible (John 3) or by the new one (Romans 5:8).
                if (ref === 'John 3' || ref === 'ROM 5:8') {
                    throw new Error('Bible data unreadable');
                }
                const spec = state.items.get(`${order[0]}|${ref}`);
                return spec === undefined ? null : toFakeItem(spec);
            },
        );
        mocks.fromVerseKey.mockImplementation(async () => {
            throw new Error('no verse key');
        });
        addItem('PSA 119:1-40', {
            bibleKey: 'XXB',
            title: 'Xx',
            target: {
                bookKey: 'PSA',
                chapter: 119,
                verseStart: 1,
                verseEnd: 40,
            },
            verses: [],
        });
        putStudyFile('Notes.md', STUDY);
        const result: any = await handleAgentStudyRequest({
            action: 'translate',
            file: 'Default/Notes.md',
            bible: 'XXB',
        });
        expect(result.quotedCount).toBe(0);
        expect(
            result.parts
                .filter((part: { kind: string }) => part.kind === 'passage')
                .map((part: { quoted: unknown }) => part.quoted),
        ).toEqual([null, null, null, null]);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('ROM 5:8', ['XXB']);
        // A file named as no study is has no passage of its own.
        expect(result.ref).toBeNull();
    });

    test('refuses a file it cannot plan, and a Bible that is not installed', async () => {
        await expect(
            handleAgentStudyRequest({
                action: 'translate',
                file: 'Other/x.md',
            }),
        ).resolves.toMatchObject({ isError: true });
        putStudyFile('JHN.3.16 Long.md', 'x'.repeat(STUDY_FILE_MAX_CHARS + 1));
        await expect(
            handleAgentStudyRequest({
                action: 'translate',
                file: 'Default/JHN.3.16 Long.md',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'JHN.3.16 Long.md is longer than 65536 characters: it ' +
                'cannot be translated here.',
        });
        putStudyFile('JHN.3.16 Notes.md', STUDY);
        await expect(
            handleAgentStudyRequest({
                action: 'translate',
                file: 'Default/JHN.3.16 Notes.md',
                bible: 'NOPE',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Bible version called "NOPE" is installed.',
        });
    });

    // EC-609: a new study the help window holds, not saved yet, is planned
    // from the words its draft wrote.
    test('plans a new study not saved yet from its words, reading and writing no file', async () => {
        const name = 'JHN.3.16-4.2 The New Birth.md';
        // No file of that name is there while it is planned.
        const held: any = await handleAgentStudyRequest({
            action: 'translate',
            name,
            content: STUDY,
        });
        putStudyFile(name, STUDY);
        const saved: any = await handleAgentStudyRequest({
            action: 'translate',
            file: `Default/${name}`,
        });
        expect(held).toEqual({
            ...saved,
            file: '',
            note: expect.stringContaining('draft it as a new study'),
        });
        expect(held.note).not.toContain('draft with `file`');
        expect(held.translations).toBe(
            '---\n\n# Xx title\n\nXx words already added.\n',
        );
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    test('refuses a new study’s words with no name its draft could have given, or too long', async () => {
        const reason =
            'Name the new study its words are in `name`, as its draft ' +
            'named it (e.g. "MAT.3.3-7 The Voice.md"), or a saved study in ' +
            '`file`.';
        for (const name of [
            undefined,
            '',
            'The New Birth',
            'a/b.md',
            'x.txt',
        ]) {
            await expect(
                handleAgentStudyRequest({
                    action: 'translate',
                    name,
                    content: STUDY,
                }),
            ).resolves.toEqual({ isError: true, reason });
        }
        await expect(
            handleAgentStudyRequest({
                action: 'translate',
                name: 'JHN.3.16 Long.md',
                content: 'x'.repeat(STUDY_FILE_MAX_CHARS + 1),
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'JHN.3.16 Long.md is longer than 65536 characters: it ' +
                'cannot be translated here.',
        });
        // A saved study named beside words is the one planned.
        putStudyFile('JHN.3.16 Notes.md', STUDY);
        const result: any = await handleAgentStudyRequest({
            action: 'translate',
            file: 'Default/JHN.3.16 Notes.md',
            name: 'JHN.3.16 Other.md',
            content: 'Other words.',
        });
        expect(result).toMatchObject({
            file: 'Default/JHN.3.16 Notes.md',
            hash: toStudyTextHash(STUDY),
        });
    });
});

// EC-565: a passage new words quote by themselves in the app's form, under
// an installed Bible's name, is that Bible's words -- quoted again from it,
// every line holding its words kept as sent.
describe('draft: a passage new to the study, quoted under a Bible’s name', () => {
    const BODY = ['## The Setting', '', 'At night.'].join('\n');
    const NAME = 'JHN.3.16 The Night Visit.md';
    const FILE = `Default/${NAME}`;
    const ROMANS_WORDS = 'But God commendeth his love toward us.';
    const SAID =
        'The passage “Romans 5:8” (KJV) was quoted from that Bible as it ' +
        'reads there: the words sent had 1 of its line(s) otherwise';

    function addRomans(ref = 'Romans 5:8') {
        addItem(ref, {
            bibleKey: 'KJV',
            title: 'Romans 5:8',
            target: { bookKey: 'ROM', chapter: 5, verseStart: 8, verseEnd: 8 },
            verses: genVerses(5, 8, 8, () => ROMANS_WORDS),
        });
    }

    function draftSetting(words: string) {
        return handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'The Setting',
            content: `At night.\n\n${words}`,
        });
    }

    test('quotes a quote written from memory again from the Bible it names, and says so', async () => {
        addRomans();
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
        const result: any = await draftSetting(
            '> **Romans 5:8** (KJV)\n>\n> **8** But God showed his love to us.',
        );
        expect(result.content).toContain(
            `> **Romans 5:8** (KJV)\n>\n> **8** ${ROMANS_WORDS}\n`,
        );
        expect(result.content).not.toContain('showed');
        expect(result.change).toContain(SAID);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Romans 5:8', [
            'KJV',
        ]);
    });

    test('keeps a quote holding the Bible’s words, a phrase put in bold', async () => {
        addRomans();
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
        const sent =
            '> **Romans 5:8** (KJV)\n>\n> **8** But God **commendeth his ' +
            'love** toward us.';
        const result: any = await draftSetting(sent);
        expect(result.content).toContain(sent);
        expect(result.change).not.toContain('was quoted from');
    });

    test('leaves a Bible not installed, a heading no Bible reads and other verses than the reference as written', async () => {
        addRomans();
        addRomans('Rom 5:8');
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
        const quotes = [
            '> **Romans 5:8** (NIV)\n>\n> **8** But God shows his love.',
            '> **A Note** (KJV)\n>\n> Words of my own.',
            '> **Rom 5:8** (KJV)\n>\n> **9** Much more then, being now ' +
                'justified.',
        ];
        const result: any = await draftSetting(quotes.join('\n\n'));
        for (const quoted of quotes) {
            expect(result.content).toContain(quoted);
        }
        expect(result.change).not.toContain('was quoted from');
    });

    test('reads a passage the app quoted and cut to the verses it holds', async () => {
        addItem('John 3:1-3', {
            bibleKey: 'KJV',
            title: 'John 3:1-3',
            target: { bookKey: 'JHN', chapter: 3, verseStart: 1, verseEnd: 3 },
            verses: genVerses(3, 1, 3),
        });
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
        const cut = [
            '> **John 3:1-3** (KJV)',
            '>',
            '> **1** Words of verse 1.',
            '>',
            '> **2** Words of verse 2.',
            '>',
            '> …',
        ].join('\n');
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            append: cut,
        });
        expect(result.content).toContain(cut);
        expect(result.change).not.toContain('was quoted from');
        const changed: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            append: cut.replace('verse 2.', 'the second verse.'),
        });
        expect(changed.content).toContain(cut);
        expect(changed.change).toContain(
            'The passage “John 3:1-3” (KJV) was quoted from that Bible',
        );
    });

    test('quotes a new study’s own quote from the Bible it names, and warns', async () => {
        addMatthew3();
        addRomans();
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content:
                '## Love\n\n> **Romans 5:8** (KJV)\n>\n> **8** But God ' +
                'showed his love to us.',
        });
        expect(result.content).toContain(`> **8** ${ROMANS_WORDS}`);
        expect(result.content).not.toContain('showed');
        expect(result.warnings).toEqual([expect.stringContaining(SAID)]);
    });
});

// EC-570: a verse a change adds is quoted from the Bible of the half it
// stands in -- the study as written, or a translation added after it --
// never from the Lookup's, which is the other language's as often as not.
describe('draft: a verse added to one half of a study, from that half’s Bible', () => {
    const NAME = 'JHN.3.16 The Night Visit.md';
    const FILE = `Default/${NAME}`;
    // A translation added after the study, in made-up words, quoted from a
    // Bible of its own (TRB); LKP is the Bible the Lookup is on.
    const BODY = [
        '## The Setting',
        '',
        'At night.',
        '',
        '## The Talk',
        '',
        'They spoke.',
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
    const WORDS_MAP: Record<string, [string, string]> = {
        LKP: ['Romans 5:8', 'Words the Lookup reads.'],
        KJV: ['Romans 5:8', 'But God commendeth his love toward us.'],
        TRB: ['Ruma 5:8', 'Zor tabbit mun velun.'],
    };

    function addRomansIn(bibleKeys: string[]) {
        for (const bibleKey of bibleKeys) {
            const [title, words] = WORDS_MAP[bibleKey];
            addItem('Romans 5:8', {
                bibleKey,
                title,
                target: {
                    bookKey: 'ROM',
                    chapter: 5,
                    verseStart: 8,
                    verseEnd: 8,
                },
                verses: genVerses(5, 8, 8, () => words),
            });
        }
    }

    function toQuote(bibleKey: string) {
        const [title, words] = WORDS_MAP[bibleKey];
        return `> **${title}** (${bibleKey})\n>\n> **8** ${words}`;
    }

    function readHalves(content: string) {
        const at = content.indexOf('# Quellon Tabbit');
        return [content.slice(0, at), content.slice(at)];
    }

    beforeEach(() => {
        state.installed = ['LKP', 'KJV', 'TRB'];
        addRomansIn(['LKP', 'KJV', 'TRB']);
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
    });

    test('quotes a verse added to a part from the Bible its half quotes, not the Lookup’s', async () => {
        const english: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'The Setting',
            append: 'As [^Romans 5:8] says:\n\n[^Romans 5:8]',
        });
        expect(english.content).toContain(
            `As Romans 5:8 says:\n\n${toQuote('KJV')}\n`,
        );
        const other: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'Vorrin',
            append: 'As [^Romans 5:8] says:\n\n[^Romans 5:8]',
        });
        expect(other.content).toContain(
            `As Ruma 5:8 says:\n\n${toQuote('TRB')}\n`,
        );
        for (const result of [english, other]) {
            expect(result.content).not.toContain('Lookup');
        }
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Romans 5:8', [
            'KJV',
            'LKP',
            'TRB',
        ]);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Romans 5:8', [
            'TRB',
            'LKP',
            'KJV',
        ]);
    });

    test('quotes the same token in both halves of a whole new text from each half’s Bible, once a Bible', async () => {
        const study = genStudyText('The Night Visit', BODY);
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            content: study
                .replace('At night.', 'At night.\n\n[^Romans 5:8]')
                .replace('Tella mun.', 'Tella [^Romans 5:8] mun.'),
        });
        const [first, second] = readHalves(result.content);
        expect(first).toContain(toQuote('KJV'));
        expect(second).toContain('Tella Ruma 5:8 mun.');
        expect(second).not.toContain('Romans');
        expect(mocks.resolveBibleItem).toHaveBeenCalledTimes(2);
    });

    test('reads a half whose Bible is not installed from the Lookup’s, as before', async () => {
        putStudyFile(
            NAME,
            genStudyText('The Night Visit', BODY.replace('(TRB)', '(XYZ)')),
        );
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'Vorrin',
            append: '[^Romans 5:8]',
        });
        expect(result.content).toContain(toQuote('LKP'));
    });

    test('reads every verse from a Bible asked for, and a token naming its own installed Bible from that one', async () => {
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'Vorrin',
            append: '[^Romans 5:8]',
            bible: 'kjv',
        });
        expect(readHalves(result.content)[1]).toContain(toQuote('KJV'));
        const named: any = await handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section: 'The Setting',
            append: '[^(TRB) Romans 5:8]',
            bible: 'KJV',
        });
        expect(readHalves(named.content)[0]).toContain(toQuote('TRB'));
        expect(mocks.resolveBibleItem).toHaveBeenLastCalledWith('Romans 5:8', [
            'TRB',
            'KJV',
        ]);
    });

    // EC-609: a new study the help window drafts translated holds the
    // study and its translation after it, each half quoting its own Bible.
    test('quotes a verse in a NEW study’s translation from the Bible that half quotes', async () => {
        addItem('John 3:16', {
            bibleKey: 'KJV',
            title: 'John 3:16',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 16,
            },
            verses: genVerses(3, 16, 16, () => 'For God so loved the world.'),
        });
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'John 3:16',
            title: 'Born Again',
            content: BODY.replace(
                'At night.',
                'At night, as [^Romans 5:8] says.\n\n[^Romans 5:8]',
            ).replace(
                'Tella mun.',
                'Tella [^Romans 5:8] mun.\n\n[^Romans 5:8]',
            ),
        });
        expect(result).toMatchObject({
            drafted: true,
            isChange: false,
            name: 'JHN.3.16 Born Again.md',
            bible: 'KJV',
        });
        const [first, second] = readHalves(result.content);
        expect(first).toContain('> **John 3:16** (KJV)');
        expect(first).toContain(
            `At night, as Romans 5:8 says.\n\n${toQuote('KJV')}\n`,
        );
        expect(second).toContain(`Tella Ruma 5:8 mun.\n\n${toQuote('TRB')}\n`);
        expect(second).not.toContain('Romans');
        expect(result.content).not.toContain('Lookup');
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Romans 5:8', [
            'TRB',
            'LKP',
            'KJV',
        ]);
    });
});

// EC-575: a verse a model quoted in a form of its own -- `> "…" (John
// 3:16)`, no Bible named -- is written as the Bible of the half it stands
// in reads it, in the app's form; one naming an installed Bible, from that.
describe('draft: a verse quoted in a form of the model’s own', () => {
    const NAME = 'JHN.3.16 The Night Visit.md';
    const FILE = `Default/${NAME}`;
    const KJV_WORDS =
        'For God so loved the world, that he gave his only begotten Son.';
    const MEMORY_WORDS =
        'For God so loved the world, he gave his one and only Son.';
    // A translation added after the study, in made-up words, quoted from a
    // Bible of its own.
    const TRB_WORDS = 'Zor velun tabbit karro mun sel dorrin.';
    const BODY = [
        '## The Setting',
        '',
        'At night.',
        '',
        '## The Talk',
        '',
        'They spoke.',
        '',
        '---',
        '',
        '# Quellon Tabbit',
        '',
        '> **Jon 3:16** (TRB)',
        '>',
        `> **16** ${TRB_WORDS}`,
        '',
        '## Vorrin',
        '',
        'Tella mun.',
    ].join('\n');
    const WRITTEN = 'was written as that Bible reads it';

    function addJohnIn(
        bibleKey: string,
        title: string,
        words: string,
        ref = 'John 3:16',
    ) {
        addItem(ref, {
            bibleKey,
            title,
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 16,
            },
            verses: genVerses(3, 16, 16, () => words),
        });
    }

    function toQuote(title: string, bibleKey: string, words: string) {
        return `> **${title}** (${bibleKey})\n>\n> **16** ${words}`;
    }

    function readHalves(content: string) {
        const at = content.indexOf('# Quellon Tabbit');
        return [content.slice(0, at), content.slice(at)];
    }

    function appendTo(section: string, append: string) {
        return handleAgentStudyRequest({
            action: 'draft',
            file: FILE,
            section,
            append,
        });
    }

    beforeEach(() => {
        state.installed = ['KJV', 'TRB'];
        addJohnIn('KJV', 'John 3:16', KJV_WORDS);
        addJohnIn('TRB', 'Jon 3:16', TRB_WORDS);
        putStudyFile(NAME, genStudyText('The Night Visit', BODY));
    });

    test('writes a quote from memory as the Bible of its half reads it, and says so', async () => {
        const english: any = await appendTo(
            'The Setting',
            `> "${MEMORY_WORDS}" (John 3:16)`,
        );
        expect(readHalves(english.content)[0]).toContain(
            `At night.\n\n${toQuote('John 3:16', 'KJV', KJV_WORDS)}\n`,
        );
        expect(english.content).not.toContain('one and only');
        expect(english.change).toContain(
            `The quote “John 3:16” (KJV) ${WRITTEN}`,
        );
        const other: any = await appendTo(
            'Vorrin',
            '> "Zor velun tabbit karro mun sel dorin." (John 3:16)',
        );
        expect(readHalves(other.content)[1]).toContain(
            `Tella mun.\n\n${toQuote('Jon 3:16', 'TRB', TRB_WORDS)}\n`,
        );
        expect(other.content).not.toContain('dorin.');
        expect(other.change).toContain(`The quote “Jon 3:16” (TRB) ${WRITTEN}`);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 3:16', [
            'KJV',
            'TRB',
        ]);
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 3:16', [
            'TRB',
            'KJV',
        ]);
    });

    test('reads a quote naming an installed Bible from that Bible, and keeps its lead above it', async () => {
        const result: any = await appendTo(
            'The Setting',
            '> **Key Verse:** "Zor velun tabbit karro mun sel dorin." ' +
                '(John 3:16, TRB)',
        );
        expect(readHalves(result.content)[0]).toContain(
            `At night.\n\n**Key Verse:**\n\n${toQuote('Jon 3:16', 'TRB', TRB_WORDS)}\n`,
        );
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('John 3:16', [
            'TRB',
            'KJV',
        ]);
    });

    test('leaves the Bible’s own words and a sentence about the verse as written, saying nothing', async () => {
        const sent = [
            `> "${KJV_WORDS}" (John 3:16)`,
            '',
            '> "For God so loved the world … his only begotten Son." ' +
                '(John 3:16)',
            '',
            "> God's love is shown in the gift of His Son (John 3:16).",
        ].join('\n');
        const result: any = await appendTo('The Setting', sent);
        expect(result.content).toContain(`At night.\n\n${sent}\n`);
        expect(result.change).not.toContain('Bible reads it');
        expect(result.change).not.toContain('do not read');
    });

    test('names a quote whose words do not read as its verse, and leaves it as sent', async () => {
        const sent =
            '> "In the beginning God created the heaven and the earth." ' +
            '(John 3:16)';
        const result: any = await appendTo('The Setting', sent);
        expect(result.content).toContain(sent);
        expect(result.change).toContain(
            'The words quoted as “John 3:16” (KJV) do not read as that ' +
                'verse in that Bible, so they were left as sent',
        );
    });

    test('leaves a quote the file already held, and reads no Bible for it', async () => {
        const held = `> "${MEMORY_WORDS}" (John 3:16)`;
        putStudyFile(
            NAME,
            genStudyText(
                'The Night Visit',
                BODY.replace('They spoke.', `They spoke.\n\n${held}`),
            ),
        );
        const result: any = await appendTo('The Setting', 'More words.');
        expect(result.content).toContain(held);
        expect(mocks.resolveBibleItem).not.toHaveBeenCalledWith(
            'John 3:16',
            expect.anything(),
        );
    });

    test('writes a new study’s quote as the passage’s Bible reads it, and warns', async () => {
        addMatthew3();
        const result: any = await handleAgentStudyRequest({
            action: 'draft',
            ref: 'Matthew 3:3-7',
            title: 'The Voice',
            content: `## Love\n\n> "${MEMORY_WORDS}" (John 3:16)`,
        });
        expect(result.content).toContain(
            `## Love\n\n${toQuote('John 3:16', 'KJV', KJV_WORDS)}\n`,
        );
        expect(result.warnings).toEqual([
            expect.stringContaining(`The quote “John 3:16” (KJV) ${WRITTEN}`),
        ]);
    });

    test('quotes a passage in the app’s form under a short book name, by its words', async () => {
        // A short name the app's parser reads: three letters at least, the
        // start of one book's name.
        addJohnIn('KJV', 'John 3:16', KJV_WORDS, 'Joh 3:16');
        const result: any = await appendTo(
            'The Setting',
            `> **Joh 3:16** (KJV)\n> ${MEMORY_WORDS}`,
        );
        expect(readHalves(result.content)[0]).toContain(
            `At night.\n\n${toQuote('John 3:16', 'KJV', KJV_WORDS)}\n`,
        );
        expect(result.change).toContain(
            'The passage “John 3:16” (KJV) was quoted from that Bible',
        );
    });
});
