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

vi.mock('../../../../../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { initKJVBible: mocks.initKjv },
}));

vi.mock('../../../../../langHelpers', () => ({
    allLocalesMap: {
        'en-US': {},
        'km-KH': {},
        'fr-FR': {},
        'pt-BR': {},
    },
}));
vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        pathUtils: { basename: (path: string) => path.split('/').at(-1) },
        appInfo: { version: '2026.10.15' },
    },
}));
vi.mock('../../../../../../server/fileHelpers', () => ({
    fsCheckFileExist: async (path: string) => state.texts.has(path),
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
}));
vi.mock('../../../../../../server/unlockingHelpers', () => ({
    unlocking: async (_name: string, action: () => Promise<unknown>) =>
        action(),
}));
vi.mock('../../../../../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../../../../../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: async () => state.downloaded,
}));
vi.mock(
    '../../../../../../setting/bible-setting/bibleXMLJsonDataHelpers',
    () => ({
        bibleKeyToXMLFilePath: async (key: string) =>
            state.destination ?? `/bibles/${key}.xml`,
        getAllXMLFileKeys: async () => state.installed,
        getBibleHeadInfoFromFile: async (path: string) =>
            state.heads.get(path) ?? null,
        jsonToXMLText: (data: unknown) => JSON.stringify(data),
        xmlTextToJson: async (text: string) => state.parsed.get(text) ?? null,
    }),
);
vi.mock('../../../../../../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: mocks.clearCache,
    saveJsonDataToXMLfile: mocks.save,
}));
vi.mock('../../../../../../helper/agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: (error: Error) => `Backup unavailable: ${error.message}`,
    genUndoField: () => ({ undo: 'undo-1' }),
    runWithAgentBackup: mocks.backup,
    snapshotAgentFile: mocks.snapshot,
    trashAgentFile: mocks.trash,
}));
vi.mock('../../../../../../helper/FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            writeFileData: (text: string) => mocks.write(path, text),
        }),
    },
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: mocks.error,
}));

import { BIBLE_BOOK_KEYS } from '../../../../../../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import { handleAgentBibleXMLRequest } from '../../../../../../helper/agentBibleXMLHelpers';

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
});

describe('Bible XML agent installation and lifecycle', () => {
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
});

describe('a Bible whose root tag names nothing', () => {
    test('analyzes a root tag that names nothing from the start of a long Bible, never offering a language the app lacks', async () => {
        const data: any = bible();
        // The sample stops after the verse that crosses 3 000 characters:
        // read whole, the Thai after it would outweigh the Khmer.
        data.books.GEN['1'] = {
            '1': 'ក '.repeat(1501),
            '2': 'ก'.repeat(1000),
            '3': 'ก'.repeat(1000),
            '4': 'ก'.repeat(1000),
        };
        addDraft(data, '<bible><book>no attributes on the root</book></bible>');
        const result: any = await handleAgentBibleXMLRequest({
            action: 'analyze',
            xmlPath: DRAFT,
            // The name says Thai, which this app has no locale for.
            sourceName: 'ThaiBible.xml',
        });
        expect(result).toMatchObject({
            keyAttribute: null,
            script: 'Khmer',
            recommendedLocale: 'km-KH',
            verses: 4,
        });
        expect(
            result.locales.map((one: { locale: string }) => {
                return one.locale;
            }),
        ).toEqual(['km-KH']);
    });
});
