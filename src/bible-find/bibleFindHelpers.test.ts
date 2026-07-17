import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    handleErrorMock,
    appErrorMock,
    bibleItemFromJsonMock,
    genCopyingMenuMock,
    sanitizeFindingTextMock,
    sanitizePreviewTextMock,
    tranMock,
    showAppContextMenuMock,
    saveBibleItemMock,
    genContextMenuItemIconMock,
    toVerseFullKeyFormatMock,
    setSettingMock,
} = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    handleErrorMock: vi.fn(),
    appErrorMock: vi.fn(),
    bibleItemFromJsonMock: vi.fn((json: any) => ({
        __bibleItem: true,
        ...json,
    })),
    genCopyingMenuMock: vi.fn(() => [{ menuElement: 'copy' }]),
    sanitizeFindingTextMock: vi.fn(
        async (_locale: string, text: string) => text,
    ),
    sanitizePreviewTextMock: vi.fn(
        async (_locale: string, text: string) => text,
    ),
    tranMock: vi.fn((key: string) => key),
    showAppContextMenuMock: vi.fn(),
    saveBibleItemMock: vi.fn(),
    genContextMenuItemIconMock: vi.fn(() => null),
    toVerseFullKeyFormatMock: vi.fn(() => 'KJV-KEY'),
    setSettingMock: vi.fn(),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: handleErrorMock }));
vi.mock('../helper/loggerHelpers', () => ({ appError: appErrorMock }));
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromJson: bibleItemFromJsonMock },
}));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: genCopyingMenuMock,
}));
vi.mock('../lang/langHelpers', () => ({
    sanitizeFindingText: sanitizeFindingTextMock,
    sanitizePreviewText: sanitizePreviewTextMock,
    tran: tranMock,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    saveBibleItem: saveBibleItemMock,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    genContextMenuItemIcon: genContextMenuItemIconMock,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    toVerseFullKeyFormat: toVerseFullKeyFormatMock,
}));
vi.mock('../helper/settingHelpers', () => ({ setSetting: setSettingMock }));

import {
    BIBLE_SEARCH_SETTING_NAME,
    breakItem,
    calcPaging,
    calcPerPage,
    checkIsCurrentPage,
    doFinding,
    findOnline,
    findPageNumber,
    openContextMenu,
    openInBibleLookup,
    pageNumberToReqData,
    setBibleSearchingTabType,
    type BibleFindResultType,
    type FindDataType,
} from './bibleFindHelpers';

function genResult(
    overrides: Partial<BibleFindResultType> = {},
): BibleFindResultType {
    return {
        maxLineNumber: 100,
        fromLineNumber: 1,
        toLineNumber: 10,
        content: [{ text: 'a', uniqueKey: 'k' }],
        ...overrides,
    };
}

describe('bible-find bibleFindHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('setBibleSearchingTabType persists the tab type', () => {
        setBibleSearchingTabType('c');
        expect(setSettingMock).toHaveBeenCalledWith(
            BIBLE_SEARCH_SETTING_NAME,
            'c',
        );
    });

    test('checkIsCurrentPage validates line ranges', () => {
        const data = genResult({ fromLineNumber: 1, toLineNumber: 10 });
        // page 1, perPage 10 => maxSize = 9, within [1,10]
        expect(checkIsCurrentPage(data, 1, 10)).toBe(true);
        // page 2 => maxSize 19, out of range => undefined
        expect(checkIsCurrentPage(data, 2, 10)).toBeUndefined();
    });

    test('findPageNumber returns the matching page or 0', () => {
        const data = genResult({ fromLineNumber: 1, toLineNumber: 10 });
        expect(findPageNumber(data, 10, ['1', '2', '3'])).toBe('1');
        const other = genResult({ fromLineNumber: 100, toLineNumber: 110 });
        expect(findPageNumber(other, 10, ['1', '2'])).toBe('0');
    });

    test('calcPerPage computes an inclusive span', () => {
        expect(calcPerPage(10, 1)).toBe(10);
    });

    test('calcPaging returns empty paging for null', () => {
        expect(calcPaging(null)).toEqual({
            pages: [],
            currentPage: '0',
            perPage: 0,
        });
    });

    test('calcPaging computes pages and current page', () => {
        const data = genResult({
            maxLineNumber: 30,
            fromLineNumber: 1,
            toLineNumber: 10,
        });
        const paging = calcPaging(data);
        expect(paging.perPage).toBe(10);
        expect(paging.pages).toEqual(['1', '2', '3']);
        expect(paging.currentPage).toBe('1');
    });

    test('pageNumberToReqData maps a page to line numbers', () => {
        const paging = { pages: ['1', '2'], currentPage: '1', perPage: 10 };
        expect(pageNumberToReqData(paging, '2')).toEqual({
            fromLineNumber: 11,
            toLineNumber: 20,
        });
    });

    test('breakItem builds a highlighted verse and bible item', async () => {
        const result = await breakItem(
            'en' as any,
            'beginning',
            'gen.1:1:In the beginning',
            'KJV',
        );
        expect(result.newItem).toContain('app-found-highlight');
        expect(result.kjvVerseKey).toBe('KJV-KEY');
        expect(bibleItemFromJsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                bibleKey: 'KJV',
                target: expect.objectContaining({
                    bookKey: 'gen',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 1,
                }),
            }),
        );
    });

    test('breakItem handles verse ranges and falsy sanitize result', async () => {
        sanitizeFindingTextMock.mockResolvedValueOnce(null as any);
        const result = await breakItem(
            'en' as any,
            'word',
            'gen.1:1-3:some text',
            'KJV',
        );
        expect(bibleItemFromJsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                target: expect.objectContaining({
                    verseStart: 1,
                    verseEnd: 3,
                }),
            }),
        );
        expect(result.bibleItem).toBeDefined();
    });

    test('findOnline returns mapped content on success', async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => ({ content: ['line one', 'line two'] }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('crypto', { randomUUID: () => 'uuid' });

        const result = await findOnline('http://api', 'key', { text: 'x' });
        expect(result?.content).toEqual([
            { text: 'line one', uniqueKey: 'uuid' },
            { text: 'line two', uniqueKey: 'uuid' },
        ]);
        vi.unstubAllGlobals();
    });

    test('findOnline logs and returns null on invalid results', async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => ({ nope: true }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        const result = await findOnline('http://api', 'key', { text: 'x' });
        expect(result).toBeNull();
        expect(appErrorMock).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    test('findOnline toasts and handles fetch failure', async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error('network down');
        });
        vi.stubGlobal('fetch', fetchMock);
        const result = await findOnline('http://api', 'key', { text: 'x' });
        expect(result).toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalled();
        expect(handleErrorMock).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    test('openInBibleLookup appends or replaces based on modifiers', () => {
        const viewController = {
            appendBibleItem: vi.fn(),
            setLookupContentFromBibleItem: vi.fn(),
        } as any;
        const bibleItem = {} as any;

        openInBibleLookup({ shiftKey: false }, viewController, bibleItem);
        expect(viewController.setLookupContentFromBibleItem).toHaveBeenCalled();

        openInBibleLookup({ shiftKey: true }, viewController, bibleItem);
        expect(viewController.appendBibleItem).toHaveBeenCalledTimes(1);

        openInBibleLookup({ shiftKey: false }, viewController, bibleItem, true);
        expect(viewController.appendBibleItem).toHaveBeenCalledTimes(2);
    });

    test('openContextMenu assembles and shows menu items', () => {
        const viewController = {
            appendBibleItem: vi.fn(),
            setLookupContentFromBibleItem: vi.fn(),
        } as any;
        const bibleItem = {} as any;
        openContextMenu({ shiftKey: false }, { viewController, bibleItem });
        expect(showAppContextMenuMock).toHaveBeenCalled();
        const items = showAppContextMenuMock.mock.calls[0][1];
        // exercise the Open + Save onSelect handlers
        items[0].onSelect();
        expect(viewController.appendBibleItem).toHaveBeenCalled();
        items.at(-1).onSelect();
        expect(saveBibleItemMock).toHaveBeenCalledWith(bibleItem);
    });

    test('doFinding returns early when data is null', async () => {
        const setData = vi.fn();
        await doFinding({} as any, 'text', null, setData);
        expect(setData).not.toHaveBeenCalled();
    });

    test('doFinding performs a fresh search when data is undefined', async () => {
        const controller = {
            doFinding: vi.fn(async () =>
                genResult({
                    maxLineNumber: 20,
                    fromLineNumber: 1,
                    toLineNumber: 10,
                }),
            ),
        } as any;
        const setData = vi.fn();
        await doFinding(controller, 'text', undefined, setData);
        expect(setData).toHaveBeenCalledTimes(1);
        const payload = setData.mock.calls[0][0];
        expect(payload.pagingData.pages).toEqual(['1', '2']);
        expect(payload.foundData['1']).not.toBeNull();
    });

    test('doFinding sets null when the fresh search fails', async () => {
        const controller = { doFinding: vi.fn(async () => null) } as any;
        const setData = vi.fn();
        await doFinding(controller, 'text', undefined, setData);
        expect(setData).toHaveBeenCalledWith(null);
    });

    test('doFinding fills the next missing page from existing data', async () => {
        const controller = {
            doFinding: vi.fn(async () =>
                genResult({ fromLineNumber: 11, toLineNumber: 20 }),
            ),
        } as any;
        const setData = vi.fn();
        const data: FindDataType = {
            pagingData: { pages: ['1', '2'], currentPage: '1', perPage: 10 },
            foundData: { '1': genResult(), '2': undefined },
        };
        await doFinding(controller, 'text', data, setData);
        expect(setData).toHaveBeenCalledTimes(1);
        // apply the updater to confirm it merges the new page
        const updater = setData.mock.calls[0][0];
        const merged = updater(data);
        expect(merged.foundData['2']).not.toBeUndefined();
        // and updater is a no-op when previous data is falsy
        expect(updater(null)).toBeNull();
    });

    test('doFinding sets null when filling a page fails', async () => {
        const controller = { doFinding: vi.fn(async () => null) } as any;
        const setData = vi.fn();
        const data: FindDataType = {
            pagingData: { pages: ['1'], currentPage: '1', perPage: 10 },
            foundData: { '1': undefined },
        };
        await doFinding(controller, 'text', data, setData);
        expect(setData).toHaveBeenCalledWith(null);
    });
});
