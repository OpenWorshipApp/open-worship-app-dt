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
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
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
    toFindChunkRange,
    toFindPageWindow,
    toFoundVerseCount,
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
        expect(result.newItem).toContain('app-found-match');
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

describe('toFindPageWindow', () => {
    function toLabels(items: any[]) {
        return items.map((item) => {
            return item.type === 'gap'
                ? `${item.fromPage}..${item.toPage}`
                : item.page;
        });
    }

    test('draws every number while there are few of them', () => {
        expect(toLabels(toFindPageWindow(5, 1, [1]))).toEqual([1, 2, 3, 4, 5]);
    });

    test('windows a find that pages into the thousands', () => {
        // The shape that made this necessary: 1556 chunks used to be 1556
        // buttons. First, last, the neighbours of the chunk being read, and a
        // gap naming exactly which chunks it is holding.
        expect(toLabels(toFindPageWindow(1556, 800, [800]))).toEqual([
            1,
            '2..797',
            798,
            799,
            800,
            801,
            802,
            '803..1555',
            1556,
        ]);
    });

    test('keeps a jump-back number for every loaded chunk', () => {
        expect(toLabels(toFindPageWindow(1556, 800, [800, 12, 400]))).toEqual([
            1,
            '2..11',
            12,
            '13..399',
            400,
            '401..797',
            798,
            799,
            800,
            801,
            802,
            '803..1555',
            1556,
        ]);
    });

    test('caps the loaded chunks at the eight nearest, so the strip stays bounded', () => {
        const loaded = [800, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        const numbers = toLabels(toFindPageWindow(1556, 800, loaded)).filter(
            (label) => {
                return typeof label === 'number';
            },
        );
        // 8 nearest loaded + first + last + the 5 neighbours, less overlaps.
        expect(numbers.length).toBeLessThanOrEqual(15);
        // The nearest loaded survive and the farthest are dropped.
        expect(numbers).toContain(100);
        expect(numbers).not.toContain(10);
    });

    test('drops numbers outside the range, and an empty find draws nothing', () => {
        expect(toLabels(toFindPageWindow(3, 1, [9, -1]))).toEqual([1, 2, 3]);
        expect(toFindPageWindow(0, 1, [])).toEqual([]);
    });

    test('opening a gap reveals every number it was holding', () => {
        // 140 chunks: the gap covers 4..139 and opens whole, because a number
        // nobody can reach is worse than a number nobody wants to see.
        const items = toFindPageWindow(140, 1, [1], [[4, 139]]);
        const numbers = toLabels(items);
        expect(numbers).not.toContain('4..139');
        expect(numbers).toContain(4);
        expect(numbers).toContain(72);
        expect(numbers).toContain(139);
        expect(numbers.length).toBe(140);
    });

    test('an opened gap too big to draw whole opens as steps that open further', () => {
        const items = toFindPageWindow(1556, 1, [1], [[4, 1555]]);
        const numbers = toLabels(items).filter((label) => {
            return typeof label === 'number';
        });
        // Never back to the thousand-button grid this replaced...
        expect(numbers.length).toBeLessThanOrEqual(210);
        // ...and the steps leave gaps of their own, so a second click reaches
        // anything in between.
        const gaps = toLabels(items).filter((label) => {
            return typeof label === 'string';
        });
        expect(gaps.length).toBeGreaterThan(0);
        expect(numbers).toContain(4);
        expect(numbers).toContain(1556);
    });
});

describe('toFoundVerseCount', () => {
    function genData(foundData: any): FindDataType {
        return {
            pagingData: { pages: ['1', '2'], currentPage: '1', perPage: 20 },
            foundData,
        };
    }

    test('reads the whole result size off the first chunk that landed', () => {
        expect(
            toFoundVerseCount(
                genData({
                    1: undefined,
                    2: { maxLineNumber: 31120 } as any,
                }),
            ),
        ).toBe(31120);
    });

    test('says nothing until a chunk has come back', () => {
        expect(toFoundVerseCount(genData({ 1: undefined, 2: null }))).toBe(
            null,
        );
    });
});

describe('toFindChunkRange', () => {
    test('counts from one, so the label agrees with the footer number', () => {
        // The data comes back zero-based for the first chunk, which would
        // print `Results 0-19` under a footer calling that same chunk `1`.
        expect(toFindChunkRange(1, 20, 74)).toEqual([1, 20]);
        expect(toFindChunkRange(2, 20, 74)).toEqual([21, 40]);
    });

    test('clamps the last chunk to what the find actually returned', () => {
        expect(toFindChunkRange(4, 20, 74)).toEqual([61, 74]);
    });

    test('leaves the range unclamped until the count is known', () => {
        expect(toFindChunkRange(4, 20, null)).toEqual([61, 80]);
    });
});
