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

import { renderToStaticMarkup } from 'react-dom/server';

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
    const verses: Record<string, string> = {};
    for (let i = 1; i <= count; i++) {
        verses[`${i}`] = `Verse ${i} of the Lord's word`;
    }
    return verses;
}

function flushMacrotask() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Bible Find controller edge paths', () => {
    it('gives up on the online lookup when the API list is malformed or lacks the Bible', async () => {
        fixture.appApiFetch.mockResolvedValue({
            json: async () => ({ mapper: 'not a map' }),
        });
        const controller = new BibleFindController('NOMAP', 'en-US');
        expect(
            await BibleFindController.getOnlineInstant(controller),
        ).toBeNull();
        expect(fixture.handleError).toHaveBeenCalledTimes(1);
        expect(fixture.handleError.mock.calls[0][0]).toBeInstanceOf(TypeError);
        expect(fixture.handleError.mock.calls[0][0].message).toBe(
            'Cannot get bible list',
        );

        fixture.appApiFetch.mockResolvedValue({
            json: async () => ({
                mapper: { OTHER: { apiUrl: 'https://x', apiKey: 'k' } },
            }),
        });
        expect(
            await BibleFindController.getOnlineInstant(controller),
        ).toBeNull();
        expect(controller.onlineFindHandler).toBeNull();
    });

    it('has no search database path when the XML cannot be read, parsed or cached', async () => {
        fixture.readFileData.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/KJV.xml'),
        ).toBeNull();
        expect(fixture.xmlTextToJson).not.toHaveBeenCalled();

        fixture.xmlTextToJson.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/KJV.xml'),
        ).toBeNull();
        expect(fixture.ensureBibleXMLCachedBasePath).not.toHaveBeenCalled();

        fixture.ensureBibleXMLCachedBasePath.mockResolvedValueOnce(null);
        expect(
            await BibleFindController.getDatabaseFilePath('bibles/KJV.xml'),
        ).toBeNull();

        // ...and an XML Bible with nowhere to keep its index is no instance.
        fixture.readFileData.mockResolvedValueOnce(null);
        const controller = new BibleFindController('KJV', 'en-US');
        expect(
            await BibleFindController.getXMLInstant(
                controller,
                'bibles/KJV.xml',
            ),
        ).toBeNull();
        expect(controller.databaseFindHandler).toBeNull();
        expect(fixture.getSQLiteDatabaseInstance).not.toHaveBeenCalled();
    });

    it('resolves the search database of an installed XML Bible by its key', async () => {
        expect(
            await BibleFindController.getSearchingDatabaseFilePath('KJV'),
        ).toBe('cache/KJV2.db');
        expect(fixture.readFileData).toHaveBeenCalledWith('bibles/KJV.xml');
    });

    it('builds no index, and writes no success marker, for a Bible with no data', async () => {
        fixture.fsCheckFileExist.mockResolvedValue(false);
        fixture.getBibleXMLDataFromKey.mockResolvedValue(null);
        const controller = new BibleFindController('KJV', 'en-US');
        expect(
            await BibleFindController.getXMLInstant(
                controller,
                'bibles/KJV.xml',
            ),
        ).toBeNull();
        expect(controller.databaseFindHandler).toBeNull();
        expect(fixture.fsWriteFile).not.toHaveBeenCalled();
    });

    it('writes a long book in batches of rows and escapes its quote marks', async () => {
        fixture.fsCheckFileExist.mockResolvedValue(false);
        fixture.getBibleXMLDataFromKey.mockResolvedValue({
            books: { PSA: { '119': genVerses(150) } },
        });
        await makeDatabaseController();
        const inserts = fixture.exec.mock.calls
            .map(([sql]) => String(sql))
            .filter((sql) => sql.includes('INSERT INTO verses'));
        expect(inserts).toHaveLength(2);
        expect(inserts[0].match(/\('PSA\./g)).toHaveLength(101);
        expect(inserts[1].match(/\('PSA\./g)).toHaveLength(49);
        expect(inserts[0]).toContain("PSA.119:1=>Verse 1 of the Lord''s word");
    });

    it('reads the selected books through the Bible info', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        controller.selectedBookKeys = ['John', 'TOB'];
        // A key the Bible has no name for keeps the key as its name.
        expect(await controller.getSelectedBooks()).toEqual([
            { bookKey: 'John', book: 'John' },
            { bookKey: 'TOB', book: 'TOB' },
        ]);
        fixture.getBibleInfo.mockResolvedValue(null);
        expect(await controller.getSelectedBooks()).toEqual([]);
    });

    it('finds and suggests nothing without a search handler', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        expect(await controller.doFinding({ text: 'God' })).toBeNull();
        expect(await controller.loadSuggestionWords('God')).toEqual([]);
        expect(fixture.findOnline).not.toHaveBeenCalled();
        expect(fixture.getAll).not.toHaveBeenCalled();
    });

    it('keeps one instance per Bible key, backed by its XML search database', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            CACHED: 'bibles/CACHED.xml',
        });
        const first = await BibleFindController.getInstant('CACHED');
        const second = await BibleFindController.getInstant('CACHED');
        expect(second).toBe(first);
        expect(first.bibleKey).toBe('CACHED');
        expect(first.locale).toBe('en-US');
        expect(first.databaseFindHandler).not.toBeNull();
        expect(first.onlineFindHandler).toBeNull();
        expect(fixture.getSQLiteDatabaseInstance).toHaveBeenCalledTimes(1);
        expect(fixture.getSQLiteDatabaseInstance).toHaveBeenCalledWith(
            'cache/CACHED2.db',
        );
    });

    it('resets a search database: drops its marker, closes it and forgets the instance', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            RESET: 'bibles/RESET.xml',
        });
        const instance = await BibleFindController.getInstant('RESET');
        expect(await BibleFindController.resetSearchingDatabase('RESET')).toBe(
            true,
        );
        expect(fixture.fsDeleteFile).toHaveBeenCalledWith(
            'cache/RESET2.db-success',
        );
        expect(fixture.close).toHaveBeenCalledTimes(1);
        expect(instance.databaseFindHandler).toBeNull();
        expect(await BibleFindController.getInstant('RESET')).not.toBe(
            instance,
        );
    });

    it('resets a Bible that was never opened without closing anything', async () => {
        fixture.getAllXMLFileKeys.mockResolvedValue({
            NEVER: 'bibles/NEVER.xml',
        });
        expect(await BibleFindController.resetSearchingDatabase('NEVER')).toBe(
            true,
        );
        expect(fixture.fsDeleteFile).toHaveBeenCalledWith(
            'cache/NEVER2.db-success',
        );
        expect(fixture.close).not.toHaveBeenCalled();
    });

    it('reports a reset that cannot delete its marker, and survives a close that throws', async () => {
        expect(
            await BibleFindController.resetSearchingDatabase('missing'),
        ).toBe(false);
        expect(fixture.fsDeleteFile).not.toHaveBeenCalled();

        fixture.getAllXMLFileKeys.mockResolvedValue({
            LOCKED: 'bibles/LOCKED.xml',
        });
        const instance = await BibleFindController.getInstant('LOCKED');
        const deleteError = new Error('EBUSY');
        fixture.fsDeleteFile.mockRejectedValueOnce(deleteError);
        expect(await BibleFindController.resetSearchingDatabase('LOCKED')).toBe(
            false,
        );
        expect(fixture.handleError).toHaveBeenCalledWith(deleteError);
        // Nothing was reset, so the open database is kept.
        expect(instance.databaseFindHandler).not.toBeNull();
        expect(await BibleFindController.getInstant('LOCKED')).toBe(instance);

        const closeError = new Error('close failed');
        fixture.close.mockImplementationOnce(() => {
            throw closeError;
        });
        expect(await BibleFindController.resetSearchingDatabase('LOCKED')).toBe(
            true,
        );
        expect(fixture.handleError).toHaveBeenCalledWith(closeError);
        expect(instance.databaseFindHandler).toBeNull();
    });

    it('opens no suggestion menu when nothing is suggested', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        const loadSuggestionWords = vi.fn(async () => [] as string[]);
        controller.loadSuggestionWords = loadSuggestionWords;
        const input = document.createElement('input');
        input.value = 'God lov';
        await controller.handleNewValue({ target: input });
        await flushMacrotask();
        expect(loadSuggestionWords).toHaveBeenCalledWith('lov', 100);
        expect(fixture.showAppContextMenu).not.toHaveBeenCalled();
        expect(controller.menuControllerSession).toBeNull();
    });

    it('looks nothing up for a non-input, a finished word, or no word at all', async () => {
        const controller = new BibleFindController('KJV', 'en-US');
        const loadSuggestionWords = vi.fn(async () => ['loved']);
        controller.loadSuggestionWords = loadSuggestionWords;
        const closeMenu = vi.fn();
        controller.menuControllerSession = { closeMenu } as any;

        await controller.handleNewValue({
            target: document.createElement('div'),
        });
        // Not an input: even the open menu is left alone.
        expect(closeMenu).not.toHaveBeenCalled();

        const input = document.createElement('input');
        input.value = 'God ';
        await controller.handleNewValue({ target: input });
        expect(closeMenu).toHaveBeenCalledTimes(1);
        expect(controller.menuControllerSession).toBeNull();

        input.value = '!!!';
        await controller.handleNewValue({ target: input });
        input.value = '';
        await controller.handleNewValue({ target: input });
        await flushMacrotask();
        expect(loadSuggestionWords).not.toHaveBeenCalled();
        expect(fixture.showAppContextMenu).not.toHaveBeenCalled();
    });

    it('hands the controller only to components inside its context', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        function ProbeComp() {
            return <span>{useBibleFindController().bibleKey}</span>;
        }
        expect(() => renderToStaticMarkup(<ProbeComp />)).toThrow(
            'useBibleFindController must be used within BibleFindControllerContext',
        );
        const controller = new BibleFindController('KJV', 'en-US');
        expect(
            renderToStaticMarkup(
                <BibleFindControllerContext value={controller}>
                    <ProbeComp />
                </BibleFindControllerContext>,
            ),
        ).toBe('<span>KJV</span>');
    });
});
