// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
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
            // `node:sqlite` is there: the search database, not the plain index.
            checkIsSupported: () => true,
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

import BibleFindController, {
    BibleFindControllerContext,
    useBibleFindController,
} from './BibleFindController';

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

function genVerses(count: number) {
    return Object.fromEntries(
        Array.from({ length: count }, (_, index) => {
            return [`${index + 1}`, `Verse number ${index + 1}`];
        }),
    );
}

function flushMacrotask() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('Bible Find controller: failure paths and caching', () => {
    it('answers no online lookup when the API list is not an object', async () => {
        fixture.appApiFetch.mockResolvedValue({
            json: async () => ({ mapper: 'not-a-map' }),
        });
        const instance = new BibleFindController('NOAPI', 'en-US');
        expect(await BibleFindController.getOnlineInstant(instance)).toBeNull();
        expect(fixture.handleError).toHaveBeenCalledTimes(1);
        const [error] = fixture.handleError.mock.calls[0];
        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toBe('Cannot get bible list');
        expect(instance.onlineFindHandler).toBeNull();
    });

    it('answers no online lookup when the API does not list this Bible', async () => {
        fixture.appApiFetch.mockResolvedValue({
            json: async () => ({
                mapper: { OTHER: { apiUrl: 'https://x.test', apiKey: 'k' } },
            }),
        });
        const instance = new BibleFindController('NOMAP', 'en-US');
        expect(await BibleFindController.getOnlineInstant(instance)).toBeNull();
        expect(fixture.handleError).not.toHaveBeenCalled();
        expect(instance.onlineFindHandler).toBeNull();
    });

    it('gives no database path for an unreadable, unparsable or uncached XML Bible', async () => {
        fixture.readFileData.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/A.xml'),
        ).toBeNull();
        fixture.xmlTextToJson.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/B.xml'),
        ).toBeNull();
        fixture.ensureBibleXMLCachedBasePath.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/C.xml'),
        ).toBeNull();
        expect(fixture.xmlTextToJson).toHaveBeenCalledTimes(2);
        expect(fixture.ensureBibleXMLCachedBasePath).toHaveBeenCalledTimes(1);
        expect(fixture.ensureBibleXMLCachedBasePath).toHaveBeenCalledWith(
            'KJV',
        );
    });

    it('resolves the searching database path of an installed XML Bible', async () => {
        expect(await BibleFindController.getXMLFilePath('KJV')).toBe(
            'bibles/KJV.xml',
        );
        expect(
            await BibleFindController.getSearchingDatabaseFilePath('KJV'),
        ).toBe('cache/KJV2.db');
    });

    it('builds no XML instance when the database path or the Bible data is missing', async () => {
        fixture.readFileData.mockResolvedValueOnce(null);
        const noPath = new BibleFindController('NOPATH', 'en-US');
        expect(
            await BibleFindController.getXMLInstant(
                noPath,
                'bibles/NOPATH.xml',
            ),
        ).toBeNull();
        expect(noPath.databaseFindHandler).toBeNull();
        expect(fixture.getSQLiteDatabaseInstance).not.toHaveBeenCalled();

        fixture.fsCheckFileExist.mockResolvedValue(false);
        fixture.getBibleXMLDataFromKey.mockResolvedValue(null);
        const noData = new BibleFindController('NODATA', 'en-US');
        expect(
            await BibleFindController.getXMLInstant(
                noData,
                'bibles/NODATA.xml',
            ),
        ).toBeNull();
        expect(noData.databaseFindHandler).toBeNull();
        expect(fixture.getBibleXMLDataFromKey).toHaveBeenCalledWith('NODATA');
        expect(fixture.fsWriteFile).not.toHaveBeenCalled();
    });

    it('flushes the verse inserts in buckets of a little over a hundred rows', async () => {
        fixture.fsCheckFileExist.mockResolvedValue(false);
        fixture.getBibleXMLDataFromKey.mockResolvedValue({
            books: { John: { '1': genVerses(150) } },
        });
        const controller = new BibleFindController('BIG', 'en-US');
        expect(
            await BibleFindController.getXMLInstant(
                controller,
                'bibles/BIG.xml',
            ),
        ).toBe(controller);
        const verseInserts = fixture.exec.mock.calls
            .map(([sql]) => String(sql))
            .filter((sql) => sql.startsWith('INSERT INTO verses'));
        expect(verseInserts.map((sql) => sql.split('=>').length - 1)).toEqual([
            101, 49,
        ]);
        expect(verseInserts[0]).toContain(
            "('John.1:1=>Verse number 1','versenumber1')",
        );
        expect(verseInserts[1]).toContain(
            "('John.1:150=>Verse number 150','versenumber150')",
        );
    });

    it('caches the XML instance it builds for a Bible key', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            XMLK: 'bibles/XMLK.xml',
        });
        const first = await BibleFindController.getInstant('XMLK');
        expect(first).toBeInstanceOf(BibleFindController);
        expect(first.bibleKey).toBe('XMLK');
        expect(first.databaseFindHandler).not.toBeNull();
        expect(fixture.getSQLiteDatabaseInstance).toHaveBeenCalledWith(
            'cache/XMLK2.db',
        );
        const second = await BibleFindController.getInstant('XMLK');
        expect(second).toBe(first);
        expect(fixture.getAllXMLFileKeys).toHaveBeenCalledTimes(1);
    });

    it('resets a cached searching database and drops the instance', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            RESETK: 'bibles/RESETK.xml',
        });
        const cached = await BibleFindController.getInstant('RESETK');
        expect(await BibleFindController.resetSearchingDatabase('RESETK')).toBe(
            true,
        );
        expect(fixture.fsDeleteFile).toHaveBeenCalledWith(
            'cache/RESETK2.db-success',
        );
        expect(fixture.close).toHaveBeenCalledTimes(1);
        expect(cached.databaseFindHandler).toBeNull();
        const rebuilt = await BibleFindController.getInstant('RESETK');
        expect(rebuilt).not.toBe(cached);
        expect(rebuilt.databaseFindHandler).not.toBeNull();
    });

    it('reports a reset that cannot delete the marker and survives a failing close', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            FAILK: 'bibles/FAILK.xml',
            CLOSEK: 'bibles/CLOSEK.xml',
        });
        const deleteError = new Error('locked');
        fixture.fsDeleteFile.mockRejectedValueOnce(deleteError);
        expect(await BibleFindController.resetSearchingDatabase('FAILK')).toBe(
            false,
        );
        expect(fixture.handleError).toHaveBeenCalledWith(deleteError);

        const cached = await BibleFindController.getInstant('CLOSEK');
        const closeError = new Error('busy');
        fixture.close.mockImplementationOnce(() => {
            throw closeError;
        });
        expect(await BibleFindController.resetSearchingDatabase('CLOSEK')).toBe(
            true,
        );
        expect(fixture.handleError).toHaveBeenCalledWith(closeError);
        expect(cached.databaseFindHandler).toBeNull();
    });

    it('cannot reset a Bible with no installed XML', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({});
        expect(await BibleFindController.resetSearchingDatabase('NOXML')).toBe(
            false,
        );
        expect(fixture.fsDeleteFile).not.toHaveBeenCalled();
    });

    it('drops the selected books it cannot name and keeps the key of an unnamed one', async () => {
        fixture.selectedBooks = ['John', 'GEN'];
        const controller = new BibleFindController('KJV', 'en-US');
        expect(await controller.getSelectedBooks()).toEqual([
            { bookKey: 'John', book: 'John' },
            { bookKey: 'GEN', book: 'GEN' },
        ]);
        fixture.getBibleInfo.mockResolvedValue(null);
        expect(await controller.getSelectedBooks()).toEqual([]);
        expect(fixture.getBibleInfo).toHaveBeenCalledWith('KJV');
    });

    it('finds and suggests nothing without a database or an online handler', async () => {
        const controller = new BibleFindController('NONE', 'en-US');
        expect(await controller.doFinding({ text: 'God' })).toBeNull();
        expect(await controller.loadSuggestionWords('God')).toEqual([]);
        expect(fixture.getAll).not.toHaveBeenCalled();
        expect(fixture.findOnline).not.toHaveBeenCalled();
    });

    it('opens no suggestion menu when no word is suggested', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        controller.loadSuggestionWords = vi.fn(async () => []);
        const input = document.createElement('input');
        input.value = 'God lov';
        await controller.handleNewValue({ target: input });
        expect(controller.loadSuggestionWords).toHaveBeenCalledWith('lov', 100);
        await flushMacrotask();
        expect(fixture.showAppContextMenu).not.toHaveBeenCalled();
        expect(controller.menuControllerSession).toBeNull();
    });

    it('ignores a target that is no input, a value ending in a space and a value with no word', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        controller.loadSuggestionWords = vi.fn(async () => ['loved']);
        const closeMenu = vi.fn();
        controller.menuControllerSession = { closeMenu } as any;
        await controller.handleNewValue({
            target: document.createElement('div'),
        });
        expect(closeMenu).not.toHaveBeenCalled();

        const input = document.createElement('input');
        input.value = 'God ';
        await controller.handleNewValue({ target: input });
        expect(closeMenu).toHaveBeenCalledTimes(1);
        expect(controller.menuControllerSession).toBeNull();

        input.value = '!!!';
        await controller.handleNewValue({ target: input });
        await flushMacrotask();
        expect(controller.loadSuggestionWords).not.toHaveBeenCalled();
        expect(fixture.showAppContextMenu).not.toHaveBeenCalled();
    });

    it('reads the controller from its context and refuses to run outside one', () => {
        function ProbeComp() {
            return <span>{useBibleFindController().bibleKey}</span>;
        }
        const controller = new BibleFindController('CTX', 'en-US');
        expect(
            renderToStaticMarkup(
                <BibleFindControllerContext value={controller}>
                    <ProbeComp />
                </BibleFindControllerContext>,
            ),
        ).toBe('<span>CTX</span>');
        expect(() => renderToStaticMarkup(<ProbeComp />)).toThrow(
            'useBibleFindController must be used within ' +
                'BibleFindControllerContext',
        );
    });
});
