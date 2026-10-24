// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showAppContextMenuMock: vi.fn(),
    copyToClipboardMock: vi.fn(async () => true),
    handleErrorMock: vi.fn(),
    toVerseTextListMock: vi.fn(),
    toTitleMock: vi.fn(async () => 'John 3:16-18'),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenuMock,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(() => null),
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: h.copyToClipboardMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));
vi.mock('./bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toVerseTextList: h.toVerseTextListMock,
        toTitle: h.toTitleMock,
    },
}));
// jsdom here refuses a `MouseEvent` whose `view` is the test's `window`.
vi.mock('../context-menu/contextMenuEventHelpers', () => ({
    createMouseEvent: (clientX: number, clientY: number) => ({
        clientX,
        clientY,
    }),
}));

import {
    genBibleItemCopyFormatList,
    genBibleItemCopyFormatMenuItems,
    showBibleItemCopyFormatMenu,
    toBibleItemCopyingText,
    toCopyingTitle,
} from './bibleItemCopyFormatHelpers';

const verseList = [
    { verse: 16, localeVerse: '16', chapter: 3, text: 'For God' },
    { verse: 17, localeVerse: '17', chapter: 3, text: 'For God sent' },
    { verse: 18, localeVerse: '18', chapter: 3, text: 'He that' },
];

function genBibleItem(target: any = {}) {
    return {
        bibleKey: 'KJV',
        target: {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 18,
            ...target,
        },
        getCopyingBibleKey: () => '(KJV)',
        toTitle: async () => 'John 3:16-18',
        toText: vi.fn(async (_max: any, style: string) => `text:${style}`),
    } as any;
}

describe('bible-list bibleItemCopyFormatHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.toVerseTextListMock.mockResolvedValue(verseList);
    });

    test('a title carries its version first, last, or not at all', () => {
        const bibleItem = genBibleItem();
        expect(toCopyingTitle(bibleItem, 'John 3:16', 'before')).toBe(
            '(KJV) John 3:16',
        );
        expect(toCopyingTitle(bibleItem, 'John 3:16', 'after')).toBe(
            'John 3:16 (KJV)',
        );
        expect(toCopyingTitle(bibleItem, 'John 3:16', 'none')).toBe(
            'John 3:16',
        );
    });

    test('lists every title and text format once', () => {
        const [bothList, titleList, textList] = genBibleItemCopyFormatList();
        expect(bothList).toHaveLength(9);
        expect(titleList).toHaveLength(3);
        expect(textList).toHaveLength(3);
        const keyList = [...bothList, ...titleList, ...textList].map(
            (format) => `${format.titleStyle}|${format.verseNumberStyle}`,
        );
        expect(new Set(keyList).size).toBe(15);
        expect(keyList).not.toContain('null|null');
    });

    test('copies the title and the whole text in the chosen format', async () => {
        const bibleItem = genBibleItem();
        expect(
            await toBibleItemCopyingText(bibleItem, {
                titleStyle: 'after',
                verseNumberStyle: 'colon',
            }),
        ).toBe('John 3:16-18 (KJV)\ntext:colon');
        expect(bibleItem.toText).toHaveBeenCalledWith(undefined, 'colon');
        expect(
            await toBibleItemCopyingText(bibleItem, {
                titleStyle: null,
                verseNumberStyle: 'none',
            }),
        ).toBe('text:none');
        expect(
            await toBibleItemCopyingText(bibleItem, {
                titleStyle: 'none',
                verseNumberStyle: null,
            }),
        ).toBe('John 3:16-18');
    });

    test('each row hovers what it copies, read from the first verses only', async () => {
        const bibleItem = genBibleItem({ verseEnd: 30 });
        const items = await genBibleItemCopyFormatMenuItems(bibleItem);
        // Three section headers and fifteen formats.
        expect(items).toHaveLength(18);
        expect(items.filter((item) => item.isSectionHeader)).toHaveLength(3);
        // Only three verses of a fifteen-verse passage are read.
        expect(h.toVerseTextListMock).toHaveBeenCalledTimes(1);
        expect(h.toVerseTextListMock.mock.calls[0][1]).toMatchObject({
            verseStart: 16,
            verseEnd: 18,
        });
        const byLabel = new Map(items.map((item) => [item.menuElement, item]));
        expect(byLabel.get('Title (Version) + 1: Text')!.title).toBe(
            'John 3:16-18 (KJV)\n16: For God 17: For God sent 18: He that …',
        );
        expect(
            byLabel.get('Title without Version + Text without Numbers')!.title,
        ).toBe('John 3:16-18\nFor God For God sent He that …');
        expect(byLabel.get('(Version) Title')!.title).toBe(
            '(KJV) John 3:16-18',
        );
        expect(byLabel.get('(1): Text')!.title).toBe(
            '(16): For God (17): For God sent (18): He that …',
        );

        byLabel.get('Title (Version) + 1: Text')!.onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.copyToClipboardMock).toHaveBeenCalledWith(
                'John 3:16-18 (KJV)\ntext:colon',
            );
        });
    });

    test('a passage that fits shows no "…", one across chapters its section title', async () => {
        const items = await genBibleItemCopyFormatMenuItems(genBibleItem());
        const textOnly = items.find((item) => item.menuElement === '1: Text');
        expect(textOnly!.title).toBe(
            '16: For God 17: For God sent 18: He that',
        );

        h.toVerseTextListMock.mockResolvedValue(verseList.slice(1));
        h.toTitleMock.mockResolvedValue('John 3:17-18');
        const crossItems = await genBibleItemCopyFormatMenuItems(
            genBibleItem({ verseStart: 17, verseEnd: 2, chapterEnd: 4 }),
        );
        expect(h.toVerseTextListMock.mock.calls.at(-1)![3]).toEqual({
            start: 0,
            count: 1,
        });
        const crossTextOnly = crossItems.find(
            (item) => item.menuElement === '1: Text',
        );
        expect(crossTextOnly!.title).toBe(
            'John 3:17-18\n17: For God sent 18: He that …',
        );
    });

    test('opens beside where More… was, inside the window', async () => {
        Object.assign(window, { innerWidth: 800, innerHeight: 600 });
        await showBibleItemCopyFormatMenu(genBibleItem(), { x: 700, y: 90 });
        const [event, items, options] = h.showAppContextMenuMock.mock.calls[0];
        expect(event.clientX).toBe(800 - 320 - 8);
        expect(event.clientY).toBe(90);
        expect(items).toHaveLength(18);
        expect(options).toEqual({ style: { maxWidth: '320px' } });

        h.toVerseTextListMock.mockRejectedValueOnce(new Error('no bible'));
        await showBibleItemCopyFormatMenu(genBibleItem(), null);
        expect(h.handleErrorMock).toHaveBeenCalled();
        expect(h.showAppContextMenuMock).toHaveBeenCalledTimes(1);
    });
});
