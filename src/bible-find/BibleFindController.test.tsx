// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    selectedBooks: [] as string[],
    exec: vi.fn(),
    getAll: vi.fn(),
    close: vi.fn(),
    getSQLiteDatabaseInstance: vi.fn(),
    readFileData: vi.fn(),
    appApiFetch: vi.fn(),
    fsCheckFileExist: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsWriteFile: vi.fn(),
    ensureBibleXMLCachedBasePath: vi.fn(),
    getBibleXMLDataFromKey: vi.fn(),
    getAllXMLFileKeys: vi.fn(),
    xmlTextToJson: vi.fn(),
    getBibleInfo: vi.fn(),
    getBibleLocale: vi.fn(),
    findOnline: vi.fn(),
    showAppContextMenu: vi.fn(),
    pasteTextToInput: vi.fn(),
    handleError: vi.fn(),
    appLog: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        databaseUtils: {
            getSQLiteDatabaseInstance: fixture.getSQLiteDatabaseInstance,
        },
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        readFileData: fixture.readFileData,
        getInstance: (path: string) => ({
            name: path.replace(/^.*\//, '').replace(/\.xml$/i, ''),
        }),
    },
}));
vi.mock('../helper/networkHelpers', () => ({
    appApiFetch: fixture.appApiFetch,
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: fixture.fsCheckFileExist,
    fsDeleteFile: fixture.fsDeleteFile,
    fsWriteFile: fixture.fsWriteFile,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../setting/bible-setting/bibleXMLHelpers', () => ({
    ensureBibleXMLCachedBasePath: fixture.ensureBibleXMLCachedBasePath,
    getBibleXMLDataFromKey: fixture.getBibleXMLDataFromKey,
}));
vi.mock('../setting/bible-setting/bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: fixture.getAllXMLFileKeys,
    xmlTextToJson: fixture.xmlTextToJson,
}));
vi.mock('../lang/langHelpers', () => ({
    checkIsStopWord: (_locale: string, word: string) =>
        ['the', 'and'].includes(word),
    quickEndWord: (_locale: string, text: string) => `${text.trimEnd()} `,
    quickTrimText: (_locale: string, text: string) => text.trim(),
    sanitizeFindingText: async (_locale: string, text: string) =>
        text
            .toLowerCase()
            .replaceAll(/[^a-z0-9 ]/g, ' ')
            .replaceAll(/\s+/g, ' ')
            .trim(),
}));
vi.mock('./bibleFindHelpers', () => ({
    calcPerPage: (to: number, from: number) => to - from + 1,
    findOnline: fixture.findOnline,
    rankSuggestionWords: (words: string[]) => words.sort(),
    toFindWildCardText: (_locale: string, text: string) =>
        text.trim() === '' ? null : `%${text.trim().replaceAll(' ', '%')}%`,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: fixture.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/helpers', () => ({
    cumulativeOffset: () => ({ top: 20, left: 30 }),
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, work: () => Promise<unknown>) => work(),
}));
vi.mock('../server/appHelpers', () => ({
    pasteTextToInput: fixture.pasteTextToInput,
}));
vi.mock('../helper/SettingManager', () => ({
    genStringListSettingManager: () => ({
        getSetting: () => fixture.selectedBooks,
        setSetting: (books: string[]) => {
            fixture.selectedBooks = books;
        },
    }),
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: fixture.getBibleInfo,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: fixture.getBibleLocale,
}));
vi.mock('../helper/loggerHelpers', () => ({ appLog: fixture.appLog }));
vi.mock('../helper/errorHelpers', () => ({ handleError: fixture.handleError }));

import BibleFindController from './BibleFindController';

const db = {
    exec: fixture.exec,
    getAll: fixture.getAll,
    close: fixture.close,
};

beforeEach(() => {
    vi.clearAllMocks();
    fixture.selectedBooks = [];
    fixture.getSQLiteDatabaseInstance.mockResolvedValue(db);
    fixture.readFileData.mockResolvedValue('<XMLBIBLE/>');
    fixture.xmlTextToJson.mockResolvedValue({ info: { key: 'KJV' } });
    fixture.ensureBibleXMLCachedBasePath.mockResolvedValue('cache');
    fixture.getBibleXMLDataFromKey.mockResolvedValue({
        books: {
            John: {
                '3': {
                    '16': 'For God so loved the world',
                    '17': 'For God sent not',
                },
            },
        },
    });
    fixture.getAllXMLFileKeys.mockResolvedValue({ KJV: 'bibles/KJV.xml' });
    fixture.getBibleLocale.mockResolvedValue('en-US');
    fixture.getBibleInfo.mockResolvedValue({ keyBookMap: { John: 'John' } });
    fixture.fsCheckFileExist.mockResolvedValue(true);
    fixture.fsDeleteFile.mockResolvedValue(undefined);
    fixture.fsWriteFile.mockResolvedValue(undefined);
    fixture.getAll.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) return [{ count: 2 }];
        if (sql.includes('FROM spell'))
            return [
                { text: 'l o v e', bookKeys: 'John' },
                { text: 'l o r d', bookKeys: 'Psalms' },
            ];
        return [{ text: 'John.3:16=>For God so loved the world' }];
    });
    fixture.pasteTextToInput.mockImplementation(
        (input: HTMLInputElement, text: string) => {
            input.value = text;
        },
    );
});

async function makeDatabaseController(key = 'KJV') {
    const controller = new BibleFindController(key, 'en-US');
    const result = await BibleFindController.getXMLInstant(
        controller,
        `bibles/${key}.xml`,
    );
    expect(result).toBe(controller);
    return controller;
}

describe('Bible Find controller', () => {
    it('resolves the cached database path from the XML Bible key', async () => {
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/KJV.xml'),
        ).toBe('cache/KJV2.db');
        expect(fixture.readFileData).toHaveBeenCalledWith('bibles/KJV.xml');
        expect(
            await BibleFindController.getSearchingDatabaseFilePath('missing'),
        ).toBeNull();
    });

    it('deletes partial database files when the success marker is missing', async () => {
        fixture.fsCheckFileExist.mockImplementation(
            async (path: string) => !path.endsWith('-success'),
        );
        expect(
            await BibleFindController.checkSearchingDatabaseValid(
                'cache/KJV2.db',
            ),
        ).toBe(false);
        expect(fixture.fsDeleteFile).toHaveBeenCalledWith('cache/KJV2.db');
        expect(fixture.fsDeleteFile).toHaveBeenCalledWith(
            'cache/KJV2.db-success',
        );
        fixture.fsCheckFileExist.mockResolvedValue(true);
        expect(
            await BibleFindController.checkSearchingDatabaseValid(
                'cache/KJV2.db',
            ),
        ).toBe(true);
    });

    it('uses an existing search database for paged verse queries', async () => {
        const controller = await makeDatabaseController();
        controller.selectedBookKeys = ['John'];
        const result = await controller.doFinding({
            text: 'God loved',
            fromLineNumber: 20,
            toLineNumber: 39,
        });
        expect(result).toMatchObject({
            maxLineNumber: 2,
            fromLineNumber: 20,
            toLineNumber: 39,
            content: [{ text: 'John.3:16:For God so loved the world' }],
        });
        expect(fixture.getAll.mock.calls[0][0]).toContain(
            "sText LIKE '%%god%loved%%'",
        );
        expect(fixture.getAll.mock.calls[0][0]).toContain("text LIKE 'John%'");
        expect(fixture.getAll.mock.calls[0][0]).toContain('LIMIT 20, 20');
    });

    it('does not query every verse for an empty or unmatched word', async () => {
        const controller = await makeDatabaseController();
        expect(await controller.doFinding({ text: '' })).toBeNull();
        expect(await controller.doFinding({ text: '   ' })).toBeNull();
        expect(fixture.getAll).not.toHaveBeenCalled();
    });

    it('rejects an inverted page range before querying SQLite', async () => {
        const controller = await makeDatabaseController();
        await expect(
            controller.doFinding({
                text: 'God',
                fromLineNumber: 4,
                toLineNumber: 2,
            }),
        ).rejects.toThrow('Invalid line number');
        expect(fixture.getAll).not.toHaveBeenCalled();
    });

    it('filters spelling suggestions to selected books and keeps an exact match first', async () => {
        const controller = await makeDatabaseController();
        controller.selectedBookKeys = ['John'];
        expect(await controller.loadSuggestionWords('love', 5)).toEqual([
            'love',
        ]);
        expect(fixture.getAll.mock.calls[0][0]).toContain(
            "text MATCH 'l o v e'",
        );
        expect(await controller.loadSuggestionWords('', 5)).toEqual([]);
    });

    it('builds a new search index from XML and writes its success marker last', async () => {
        fixture.fsCheckFileExist.mockResolvedValue(false);
        const controller = await makeDatabaseController();
        expect(controller.databaseFindHandler).not.toBeNull();
        expect(fixture.exec.mock.calls[0][0]).toContain('CREATE TABLE verses');
        expect(
            fixture.exec.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO verses'),
            ),
        ).toBe(true);
        expect(
            fixture.exec.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO spell'),
            ),
        ).toBe(true);
        expect(fixture.fsWriteFile).toHaveBeenCalledWith(
            'cache/KJV2.db-success',
            'success',
        );
    });

    it('uses the online lookup when no XML Bible is installed', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({});
        fixture.appApiFetch.mockResolvedValue({
            json: async () => ({
                mapper: {
                    ONLINE: { apiUrl: 'https://example.org', apiKey: 'token' },
                },
            }),
        });
        fixture.findOnline.mockResolvedValue({
            content: [{ text: 'John.3:16:For God' }],
        });
        const controller = await BibleFindController.getInstant('ONLINE');
        expect(await controller.doFinding({ text: 'God' })).toMatchObject({
            content: [{ text: 'John.3:16:For God' }],
        });
        expect(fixture.findOnline).toHaveBeenCalledWith(
            'https://example.org',
            'token',
            expect.objectContaining({ text: 'God' }),
        );
        expect(await controller.loadSuggestionWords('God')).toEqual([]);
    });

    it('lets a suggestion replace the current word in the input', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        controller.loadSuggestionWords = vi.fn(async () => ['loved']);
        const closeMenu = vi.fn();
        fixture.showAppContextMenu.mockReturnValue({
            closeMenu,
            promiseDone: Promise.resolve(),
        });
        const input = document.createElement('input');
        input.value = 'God lov';
        await controller.handleNewValue({ target: input });
        await vi.waitFor(() =>
            expect(fixture.showAppContextMenu).toHaveBeenCalled(),
        );
        const items = fixture.showAppContextMenu.mock.calls[0][1];
        items[0].onSelect();
        expect(input.value).toBe('God loved ');
        controller.closeSuggestionMenu();
        expect(closeMenu).toHaveBeenCalledTimes(1);
    });
});
