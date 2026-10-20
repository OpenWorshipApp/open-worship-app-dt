// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        texts: new Map<string, string>(),
        parsed: new Map<string, any>(),
        installed: {} as Record<string, string>,
        heads: new Map<string, { title: string; locale: string }>(),
        downloaded: [] as { key: string; title: string; locale: string }[],
        destination: null as string | null,
        backupError: null as Error | null,
        saved: true,
    },
    mocks: {
        save: vi.fn(),
        backup: vi.fn(),
        snapshot: vi.fn(),
        trash: vi.fn(),
        clearCache: vi.fn(),
        write: vi.fn(),
        error: vi.fn(),
        initKjv: vi.fn(),
    },
}));

vi.mock('./bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { initKJVBible: mocks.initKjv },
}));

vi.mock('../lang/langHelpers', () => ({
    allLocalesMap: {
        'en-US': {},
        'km-KH': {},
        'fr-FR': {},
        'pt-BR': {},
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        pathUtils: { basename: (path: string) => path.split('/').at(-1) },
        appInfo: { version: '2026.10.15' },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (path: string) => state.texts.has(path),
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_name: string, action: () => Promise<unknown>) =>
        action(),
}));
vi.mock('./bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: async () => state.downloaded,
}));
vi.mock('../setting/bible-setting/bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: async (key: string) =>
        state.destination ?? `/bibles/${key}.xml`,
    getAllXMLFileKeys: async () => state.installed,
    getBibleHeadInfoFromFile: async (path: string) =>
        state.heads.get(path) ?? null,
    jsonToXMLText: (data: unknown) => JSON.stringify(data),
    xmlTextToJson: async (text: string) => state.parsed.get(text) ?? null,
}));
vi.mock('../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: mocks.clearCache,
    saveJsonDataToXMLfile: mocks.save,
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: (error: Error) => `Backup unavailable: ${error.message}`,
    genUndoField: () => ({ undo: 'undo-1' }),
    runWithAgentBackup: mocks.backup,
    snapshotAgentFile: mocks.snapshot,
    trashAgentFile: mocks.trash,
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            writeFileData: (text: string) => mocks.write(path, text),
        }),
    },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.error }));

import { BIBLE_BOOK_KEYS } from '../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import {
    handleAgentBibleXMLRequest,
    toAppLocale,
} from './agentBibleXMLHelpers';

const DRAFT = '/tmp/open-worship-app-bible-import/abcdefghijkl.xml';
const DIGITS = Array.from({ length: 10 }, (_, index) => String(index));

function bible(verse = 'In the beginning') {
    return {
        info: {
            key: 'KJV',
            title: 'King James Version',
            locale: 'en-US',
            keyBookMap: { GEN: 'Genesis' },
            numbersMap: Object.fromEntries(DIGITS.map((one) => [one, one])),
        },
        books: { GEN: { '1': { '1': verse, '2': 'The earth was formless' } } },
    };
}

function addDraft(
    data: ReturnType<typeof bible> | null = bible(),
    text?: string,
) {
    const xmlText =
        text ?? '<bible key="KJV" title="King James Version" locale="en-US" />';
    state.texts.set(DRAFT, xmlText);
    if (data !== null) state.parsed.set(xmlText, data);
}

function addInstalled(key = 'KJV', path = '/bibles/custom-name.xml') {
    state.installed[key] = path;
    state.texts.set(path, `installed-${key}`);
    state.parsed.set(`installed-${key}`, bible());
    state.heads.set(path, { title: 'King James Version', locale: 'en-US' });
}

beforeEach(() => {
    state.texts.clear();
    state.parsed.clear();
    state.installed = {};
    state.heads.clear();
    state.downloaded = [];
    state.destination = null;
    state.backupError = null;
    state.saved = true;
    mocks.save.mockImplementation(async () => state.saved);
    mocks.snapshot.mockImplementation(async (path: string) => ({
        type: 'file',
        filePath: path,
        text: state.texts.get(path),
    }));
    mocks.backup.mockImplementation(
        async (
            _label: string,
            _files: unknown[],
            action: () => Promise<void>,
        ) => {
            if (state.backupError !== null) throw state.backupError;
            await action();
            return { meta: { id: 'undo-1' } };
        },
    );
    mocks.write.mockResolvedValue(true);
    mocks.trash.mockResolvedValue(undefined);
    mocks.clearCache.mockResolvedValue(undefined);
    mocks.initKjv.mockReset();
});

describe('Bible XML agent request validation and analysis', () => {
    test('maps a language to an app locale, including another region', () => {
        expect(toAppLocale('en-US')).toBe('en-US');
        expect(toAppLocale('pt-PT')).toBe('pt-BR');
        expect(toAppLocale('xx-XX')).toBeNull();
    });

    test.each(['analyze', 'score', 'import'])(
        '%s refuses a path outside the server draft folder',
        async (action) => {
            expect(
                await handleAgentBibleXMLRequest({
                    action,
                    xmlPath: '/home/user/own-bible.xml',
                    lists: [],
                }),
            ).toMatchObject({
                isError: true,
                reason: expect.stringContaining('draft'),
            });
            expect(mocks.save).not.toHaveBeenCalled();
        },
    );

    test('says why an unreadable draft cannot be imported', async () => {
        expect(
            await handleAgentBibleXMLRequest({
                action: 'analyze',
                xmlPath: DRAFT,
            }),
        ).toMatchObject({
            isError: true,
            problem: 'not-bible',
        });
        addDraft(null);
        expect(
            await handleAgentBibleXMLRequest({
                action: 'analyze',
                xmlPath: DRAFT,
            }),
        ).toMatchObject({
            isError: true,
            problem: 'not-bible',
        });
    });

    test('analyzes counts, language, digits, installed keys and file names', async () => {
        const data = bible('កំណើតដំបូង '.repeat(10));
        data.info.numbersMap['1'] = '១';
        addDraft(
            data,
            '<bible key="KJV" locale="en-US"><book>កំណើតដំបូង</book></bible>',
        );
        addInstalled();
        state.downloaded = [
            { key: 'WEB', title: 'World English Bible', locale: 'en-US' },
        ];
        const result: any = await handleAgentBibleXMLRequest({
            action: 'analyze',
            xmlPath: DRAFT,
            sourceName: 'KhmerBible.xml',
        });
        expect(result).toMatchObject({
            books: 1,
            chapters: 1,
            verses: 2,
            keyAttribute: 'KJV',
            script: 'Khmer',
            recommendedLocale: 'km-KH',
        });
        expect(result.missingBooks).toHaveLength(BIBLE_BOOK_KEYS.length - 1);
        expect(result.takenKeys).toEqual(['KJV', 'WEB']);
        expect(result.keys).toContain('KJV2');
        expect(result.fileDigits[1]).toBe('១');
        expect(result.nameLists.at(-1)).toMatchObject({ source: 'file' });
    });

    test('scores only valid candidate name lists against the downloaded draft', async () => {
        addDraft(bible(), '<bible>Genesis and Exodus are mentioned</bible>');
        const result: any = await handleAgentBibleXMLRequest({
            action: 'score',
            xmlPath: DRAFT,
            lists: [
                { names: ['Genesis'] },
                { names: ['Zephaniah'] },
                { bogus: true },
            ],
        });
        expect(result.matches).toHaveLength(2);
        expect(result.matches[0]).toBeGreaterThan(result.matches[1]);
    });
});

describe('Bible XML agent installation and lifecycle', () => {
    test.each([
        [{ locale: 'unknown' }, 'not a language'],
        [{ numbers: ['1'] }, 'ten'],
        [{ bookNames: ['Genesis'] }, '66'],
    ])('refuses invalid import choices %j', async (changes, reason) => {
        const result = await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            key: 'TEST',
            locale: 'en-US',
            numbers: DIGITS,
            ...changes,
        });
        expect(result).toMatchObject({
            isError: true,
            reason: expect.stringContaining(reason),
        });
        expect(mocks.backup).not.toHaveBeenCalled();
    });

    test('rejects an installed key, even when it differs only in case', async () => {
        addDraft();
        addInstalled('KJV');
        const result = await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            key: 'kjv',
            locale: 'en-US',
            numbers: DIGITS,
        });
        expect(result).toMatchObject({ isError: true, problem: 'key' });
        expect(mocks.save).not.toHaveBeenCalled();
    });

    test('imports a chosen title, locale, digits and 66 book names behind a backup', async () => {
        addDraft();
        const names = BIBLE_BOOK_KEYS.map((key) => `New ${key}`);
        const digits = [...DIGITS];
        digits[1] = '១';
        const result = await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            key: 'NEW',
            locale: 'fr-FR',
            title: ' Nouvelle Bible ',
            numbers: digits,
            bookNames: names,
        });
        expect(result).toMatchObject({
            installed: 'NEW',
            title: 'Nouvelle Bible',
            locale: 'fr-FR',
            undo: 'undo-1',
        });
        expect(mocks.backup).toHaveBeenCalledWith(
            expect.stringContaining('NEW'),
            [
                {
                    type: 'file',
                    filePath: '/bibles/NEW.xml',
                    text: null,
                    bibleKey: 'NEW',
                },
            ],
            expect.any(Function),
        );
        expect(mocks.save.mock.calls[0][0].info).toMatchObject({
            key: 'NEW',
            title: 'Nouvelle Bible',
            locale: 'fr-FR',
            keyBookMap: { GEN: 'New GEN' },
            numbersMap: { '1': '១' },
        });
        expect(mocks.save).toHaveBeenCalledWith(expect.any(Object), 'NEW');
    });

    test('writes where the Bible came from into its note, keeping an earlier one', async () => {
        const data: any = bible();
        data.info.note = 'Exported from the church laptop.';
        addDraft(data);
        await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            sourceName: 'KhmerBible.xml',
            key: 'KSV',
            locale: 'km-KH',
            numbers: DIGITS,
            origin: {
                by: 'chatbot',
                url: 'https://github.com/o/r/blob/main/KhmerBible.xml',
                downloadUrl:
                    'https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
                bytes: 1048576,
                bookNames: { label: 'Khmer names', source: 'built in' },
                unknownField: 'dropped',
            },
        });
        const note: string = mocks.save.mock.calls[0][0].info.note;
        expect(note).toMatch(
            /^Imported on .+ UTC by the assistant \(Chatbot\) in Open Worship app 2026\.10\.15\.$/m,
        );
        expect(note).toContain(
            'Downloaded from: https://github.com/o/r/blob/main/KhmerBible.xml',
        );
        expect(note).toContain(
            'File link used: https://raw.githubusercontent.com/o/r/main/KhmerBible.xml',
        );
        expect(note).toContain('File: KhmerBible.xml, 1.0 MB');
        expect(note).toContain('Contents: 1 books, 1 chapters, 2 verses.');
        expect(note).toContain('Key in the file: KJV');
        expect(note).toContain(
            'Chosen: key KSV, language km-KH, book names "Khmer names".',
        );
        expect(note).toMatch(
            /\nEarlier note: Exported from the church laptop\.$/,
        );
        expect(note).not.toContain('dropped');
    });

    test('reads the link off the draft record when the server sent no origin', async () => {
        // A dev app's MCP host started before `origin` existed: the chatbot's
        // Thai Bible came in with "From the file: ThaiBible.xml" and no link.
        addDraft();
        state.texts.set(
            DRAFT.replace(/\.xml$/, '.json'),
            JSON.stringify({
                source: 'https://raw.githubusercontent.com/o/r/master/ThaiBible.xml',
                fileName: 'ThaiBible.xml',
                recommended: { locale: 'th-TH' },
            }),
        );
        await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            sourceName: 'ThaiBible.xml',
            key: 'TK',
            locale: 'en-US',
            numbers: DIGITS,
        });
        const note: string = mocks.save.mock.calls[0][0].info.note;
        expect(note).toContain(
            'Downloaded from: https://raw.githubusercontent.com/o/r/master/ThaiBible.xml',
        );
        expect(note).toContain('File: ThaiBible.xml');
        expect(note).not.toContain('From the file');
    });

    test('what the server sent wins over the record, and the record fills the rest', async () => {
        addDraft();
        state.texts.set(
            DRAFT.replace(/\.xml$/, '.json'),
            JSON.stringify({
                url: 'https://example.org/record-page',
                source: 'https://example.org/record.xml',
                finalUrl: 'https://cdn.example.org/record.xml',
                bytes: 2097152,
            }),
        );
        await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            sourceName: 'bible.xml',
            key: 'NEW',
            locale: 'en-US',
            numbers: DIGITS,
            origin: { by: 'chatbot', url: 'https://example.org/given' },
        });
        const note: string = mocks.save.mock.calls[0][0].info.note;
        expect(note).toContain('Downloaded from: https://example.org/given');
        expect(note).toContain(
            'File link used: https://example.org/record.xml',
        );
        expect(note).toContain(
            'Served from: https://cdn.example.org/record.xml',
        );
        expect(note).toContain('File: bible.xml, 2.0 MB');
        expect(note).not.toContain('record-page');
    });

    test('an import with no record of its source, or a made-up importer, says an agent did it', async () => {
        addDraft();
        await handleAgentBibleXMLRequest({
            action: 'import',
            xmlPath: DRAFT,
            sourceName: 'bible.xml',
            key: 'NEW',
            locale: 'en-US',
            numbers: DIGITS,
            origin: { by: 'the-pastor', url: 'file:///C:/secret.xml' },
        });
        const note: string = mocks.save.mock.calls[0][0].info.note;
        expect(note).toContain('by an AI agent connected to the app (MCP)');
        expect(note).toContain('From the file: bible.xml');
        expect(note).not.toContain('secret');
    });

    test('does not write when the draft disappeared or the backup failed', async () => {
        const request = {
            action: 'import',
            xmlPath: DRAFT,
            key: 'NEW',
            locale: 'en-US',
            numbers: DIGITS,
        };
        expect(await handleAgentBibleXMLRequest(request)).toMatchObject({
            isError: true,
            problem: 'draft-gone',
        });
        addDraft();
        state.backupError = new Error('No backup disk');
        expect(await handleAgentBibleXMLRequest(request)).toMatchObject({
            isError: true,
            reason: 'No backup disk',
        });
        expect(mocks.save).not.toHaveBeenCalled();
    });

    test('lists local and downloaded Bibles without parsing their whole text', async () => {
        addInstalled();
        state.downloaded = [
            { key: 'WEB', title: 'World English Bible', locale: 'en-US' },
        ];
        expect(
            await handleAgentBibleXMLRequest({ action: 'list' }),
        ).toMatchObject({
            bibles: [
                {
                    key: 'KJV',
                    title: 'King James Version',
                    file: 'custom-name.xml',
                },
            ],
            downloaded: [{ key: 'WEB', title: 'World English Bible' }],
        });
    });

    test('creates the provided KJV only when there is none', async () => {
        addInstalled();
        expect(
            await handleAgentBibleXMLRequest({ action: 'create-kjv' }),
        ).toMatchObject({
            created: false,
            installed: true,
            key: 'KJV',
            title: 'King James Version',
        });
        expect(mocks.initKjv).not.toHaveBeenCalled();

        state.installed = {};
        state.heads.clear();
        state.downloaded = [
            { key: 'KJV', title: 'King James', locale: 'en-US' },
        ];
        expect(
            await handleAgentBibleXMLRequest({ action: 'create-kjv' }),
        ).toMatchObject({ created: false, installed: true, key: 'KJV' });
        expect(mocks.initKjv).not.toHaveBeenCalled();
    });

    test('generates the provided KJV and says whether it worked', async () => {
        state.installed = {};
        state.heads.set('/bibles/KJV.xml', {
            title: 'King James Version',
            locale: 'en-US',
        });
        mocks.initKjv.mockImplementation(async () => {
            state.installed['KJV'] = '/bibles/KJV.xml';
        });
        expect(
            await handleAgentBibleXMLRequest({ action: 'create-kjv' }),
        ).toMatchObject({
            created: true,
            installed: true,
            key: 'KJV',
            title: 'King James Version',
        });
        expect(mocks.initKjv).toHaveBeenCalledTimes(1);

        // A write that did not happen is a failure, not a quiet success.
        state.installed = {};
        mocks.initKjv.mockResolvedValue(undefined);
        expect(
            await handleAgentBibleXMLRequest({ action: 'create-kjv' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('could not be created'),
        });
    });

    test('reads installed metadata and explains a missing key', async () => {
        addInstalled();
        expect(
            await handleAgentBibleXMLRequest({ action: 'info', key: 'kjv' }),
        ).toMatchObject({
            key: 'KJV',
            title: 'King James Version',
            books: 1,
            file: 'custom-name.xml',
            bookNames: { GEN: 'Genesis' },
        });
        expect(
            await handleAgentBibleXMLRequest({ action: 'info', key: 'kjv' }),
        ).not.toHaveProperty('note');
        (state.parsed.get('installed-KJV').info as any).note =
            'Downloaded from: https://example.org/kjv.xml';
        expect(
            await handleAgentBibleXMLRequest({ action: 'info', key: 'kjv' }),
        ).toMatchObject({
            note: 'Downloaded from: https://example.org/kjv.xml',
        });
        expect(
            await handleAgentBibleXMLRequest({ action: 'info', key: 'BAD' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('KJV'),
        });
    });

    test('updates the file that actually holds the Bible and clears its cache', async () => {
        addInstalled();
        const result = await handleAgentBibleXMLRequest({
            action: 'update',
            key: 'KJV',
            title: ' Revised ',
            locale: 'fr-FR',
            bookNames: { GEN: 'Genèse' },
        });
        expect(result).toMatchObject({
            changed: ['title', 'language', 'book names'],
            key: 'KJV',
            undo: 'undo-1',
        });
        expect(mocks.write.mock.calls[0][0]).toBe('/bibles/custom-name.xml');
        expect(JSON.parse(mocks.write.mock.calls[0][1]).info).toMatchObject({
            title: 'Revised',
            locale: 'fr-FR',
            keyBookMap: { GEN: 'Genèse' },
        });
        expect(mocks.clearCache).toHaveBeenCalledWith('KJV');
        expect(mocks.snapshot).toHaveBeenCalledWith('/bibles/custom-name.xml');
    });

    test('refuses invalid updates and a no-op before taking a backup', async () => {
        addInstalled();
        for (const request of [
            { bookNames: { WRONG: 'Name' } },
            { numbers: ['1'] },
            { locale: 'unknown' },
            {},
        ]) {
            expect(
                await handleAgentBibleXMLRequest({
                    action: 'update',
                    key: 'KJV',
                    ...request,
                }),
            ).toMatchObject({
                isError: true,
            });
        }
        expect(mocks.snapshot).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
    });

    test('deletes by moving to trash only after a snapshot, then clears the cache', async () => {
        addInstalled();
        expect(
            await handleAgentBibleXMLRequest({ action: 'delete', key: 'kjv' }),
        ).toMatchObject({
            removed: 'KJV',
            undo: 'undo-1',
        });
        expect(mocks.snapshot).toHaveBeenCalledWith('/bibles/custom-name.xml');
        expect(mocks.trash).toHaveBeenCalledWith('/bibles/custom-name.xml');
        expect(mocks.clearCache).toHaveBeenCalledWith('KJV');
    });

    test('a failed delete snapshot leaves the installed file alone', async () => {
        addInstalled();
        mocks.snapshot.mockRejectedValue(new Error('disk unavailable'));
        expect(
            await handleAgentBibleXMLRequest({ action: 'delete', key: 'KJV' }),
        ).toMatchObject({
            isError: true,
            reason: 'Backup unavailable: disk unavailable',
        });
        expect(mocks.trash).not.toHaveBeenCalled();
    });

    test('unknown actions and unexpected errors always return a result', async () => {
        expect(
            await handleAgentBibleXMLRequest({ action: 'unknown' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Unknown action'),
        });
        mocks.snapshot.mockRejectedValue(new Error('read failed'));
        addInstalled();
        expect(
            await handleAgentBibleXMLRequest({
                action: 'update',
                key: 'KJV',
                title: 'New',
            }),
        ).toMatchObject({
            isError: true,
            reason: 'read failed',
        });
        expect(mocks.error).toHaveBeenCalledOnce();
    });
});
