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

describe('a Latin-letter Bible whose root tag names a locale', () => {
    // To the stop-word count this reads English first (the, lord, shall,
    // unto, his: 6 of its 15 words) and French second (qui, vous, dans, les).
    const ENGLISH_THEN_FRENCH =
        'the lord shall go unto his people qui vous dans les';
    const BY_WORDS = 'the words of the verses read like this language';
    const toLocaleWhy = (result: any) => {
        return result.locales.map((one: { locale: string; why: string }) => {
            return [one.locale, one.why];
        });
    };

    test.each([
        {
            attribute: 'fr-FR',
            expected: [
                ['fr-FR', `the file says so and ${BY_WORDS}`],
                ['en-US', BY_WORDS],
            ],
        },
        {
            attribute: 'pt-BR',
            expected: [
                ['en-US', BY_WORDS],
                ['fr-FR', BY_WORDS],
                ['pt-BR', 'the file says so'],
            ],
        },
    ])(
        'ranks the root tag locale $attribute first only when the verses agree with it',
        async ({ attribute, expected }) => {
            addDraft(
                bible(ENGLISH_THEN_FRENCH),
                `<bible key="LSG" locale="${attribute}"><book>x</book></bible>`,
            );
            const result: any = await handleAgentBibleXMLRequest({
                action: 'analyze',
                xmlPath: DRAFT,
                sourceName: 'bible.xml',
            });
            expect(result.script).toBe('Latin');
            expect(toLocaleWhy(result)).toEqual(expected);
            expect(result.recommendedLocale).toBe(expected[0][0]);
        },
    );
});
