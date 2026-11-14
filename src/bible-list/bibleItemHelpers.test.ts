import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(() => null),
}));
const { showBibleItemCopyFormatMenuMock } = vi.hoisted(() => ({
    showBibleItemCopyFormatMenuMock: vi.fn(async () => {}),
}));
vi.mock('./bibleItemCopyFormatHelpers', () => ({
    showBibleItemCopyFormatMenu: showBibleItemCopyFormatMenuMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
const { showAppContextMenuMock } = vi.hoisted(() => ({
    showAppContextMenuMock: vi.fn(),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));
// No `MouseEvent` in this environment: the point the menu opens at.
vi.mock('../context-menu/contextMenuEventHelpers', async () => ({
    ...(await vi.importActual<any>('../context-menu/contextMenuEventHelpers')),
    createMouseEvent: (clientX: number, clientY: number) => ({
        clientX,
        clientY,
    }),
}));

import {
    genBibleItemCopyContextMenuItem,
    genBibleItemCopyingContextMenu,
    genDuplicatedMessage,
} from './bibleItemHelpers';

describe('bible-list bibleItemHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('genBibleItemCopyingContextMenu wires all copy handlers', () => {
        const bibleItem = {
            copyTitleToClipboard: vi.fn(),
            copyTextToClipboard: vi.fn(),
            copyToClipboard: vi.fn(),
            copyVerseFullKeyToClipboard: vi.fn(),
            copyChapterFullKeyToClipboard: vi.fn(),
        } as any;
        const menu = genBibleItemCopyingContextMenu(bibleItem);
        expect(menu).toHaveLength(6);
        menu.slice(0, 5).forEach((item) => item.onSelect!({} as any));
        expect(bibleItem.copyTitleToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyTextToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyVerseFullKeyToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyChapterFullKeyToClipboard).toHaveBeenCalled();
    });

    test('More… opens every copy format where it was pressed', async () => {
        const bibleItem = {} as any;
        const more = genBibleItemCopyingContextMenu(bibleItem).at(-1)!;
        expect(more.menuElement).toBe('More…');
        more.onSelect!({ clientX: 40, clientY: 70 } as any);
        await vi.waitFor(() => {
            expect(showBibleItemCopyFormatMenuMock).toHaveBeenCalledWith(
                bibleItem,
                { x: 40, y: 70 },
            );
        });
        // A key has no pointer, and an item no longer on the page no place.
        more.onSelect!({ key: 'Enter' } as any);
        await vi.waitFor(() => {
            expect(showBibleItemCopyFormatMenuMock).toHaveBeenLastCalledWith(
                bibleItem,
                null,
            );
        });
    });

    // Asked for by the user: every menu of a passage offers one `Copy`, which
    // opens the copying menu where it was chosen.
    test('Copy opens the copying menu where it was chosen', async () => {
        const bibleItem = { copyTitleToClipboard: vi.fn() } as any;
        const copy = genBibleItemCopyContextMenuItem(bibleItem);
        expect(copy.menuElement).toBe('Copy');
        copy.onSelect!({ clientX: 40, clientY: 70 } as any);
        await vi.waitFor(() => {
            expect(showAppContextMenuMock).toHaveBeenCalledOnce();
        });
        const [openedAt, copyItems] = showAppContextMenuMock.mock.calls[0];
        expect(openedAt).toEqual({ clientX: 40, clientY: 70 });
        expect(copyItems.map((item: any) => item.menuElement)).toEqual([
            'Copy Title',
            'Copy Text',
            'Copy All',
            'Copy Verse Full Key',
            'Copy Chapter Full Key',
            'More…',
        ]);
        // The copying menu acts on the passage the `Copy` was offered for.
        copyItems[0].onSelect();
        expect(bibleItem.copyTitleToClipboard).toHaveBeenCalledOnce();
    });

    test('Copy chosen by a key opens the copying menu in the window', async () => {
        vi.stubGlobal('window', { innerWidth: 800, innerHeight: 400 });
        try {
            genBibleItemCopyContextMenuItem({} as any).onSelect!({
                key: 'Enter',
            } as any);
            await vi.waitFor(() => {
                expect(showAppContextMenuMock).toHaveBeenCalledOnce();
            });
            expect(showAppContextMenuMock.mock.calls[0][0]).toEqual({
                clientX: 400,
                clientY: 100,
            });
        } finally {
            vi.unstubAllGlobals();
        }
    });

    test('genDuplicatedMessage flags a duplicate target', () => {
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 1,
        };
        const list = [
            { bibleKey: 'KJV', target } as any,
            { bibleKey: 'KJV', target: { ...target } } as any,
        ];
        expect(genDuplicatedMessage(list, list[1], 1)).toBe(
            'Duplicated with item number 1',
        );
    });

    test('genDuplicatedMessage allows the same passage in another translation', () => {
        const target = {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 1,
            verseEnd: 36,
        };
        const list = [
            { bibleKey: 'KJV', target } as any,
            { bibleKey: 'TQLS', target: { ...target } } as any,
        ];
        expect(genDuplicatedMessage(list, list[0], 0)).toBeUndefined();
        expect(genDuplicatedMessage(list, list[1], 1)).toBeUndefined();
    });

    test('genDuplicatedMessage tells cross-chapter passages apart by their end chapter', () => {
        const target = {
            bookKey: 'JHN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 4,
        };
        const list = [
            { bibleKey: 'KJV', target: { ...target, chapterEnd: 3 } } as any,
            { bibleKey: 'KJV', target: { ...target, chapterEnd: 2 } } as any,
            { bibleKey: 'KJV', target } as any,
        ];
        // JHN 1:2-3:4, JHN 1:2-2:4 and JHN 1:2-4 are three passages.
        expect(genDuplicatedMessage(list, list[0], 0)).toBeUndefined();
        expect(genDuplicatedMessage(list, list[1], 1)).toBeUndefined();
        expect(genDuplicatedMessage(list, list[2], 2)).toBeUndefined();
    });

    test('genDuplicatedMessage flags the same cross-chapter passage', () => {
        const list = [
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'JHN',
                    chapter: 1,
                    verseStart: 2,
                    verseEnd: 4,
                    chapterEnd: 3,
                },
            } as any,
            {
                bibleKey: 'KJV',
                target: {
                    chapterEnd: 3,
                    verseEnd: 4,
                    verseStart: 2,
                    chapter: 1,
                    bookKey: 'JHN',
                },
            } as any,
        ];
        expect(genDuplicatedMessage(list, list[1], 1)).toBe(
            'Duplicated with item number 1',
        );
    });

    test('genDuplicatedMessage reads a same-chapter chapterEnd as no end chapter', () => {
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        };
        const list = [
            { bibleKey: 'KJV', target } as any,
            { bibleKey: 'KJV', target: { ...target, chapterEnd: 1 } } as any,
        ];
        expect(genDuplicatedMessage(list, list[1], 1)).toBe(
            'Duplicated with item number 1',
        );
    });

    test('genDuplicatedMessage returns undefined without duplicates', () => {
        const list = [
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 1,
                },
            } as any,
            {
                target: {
                    bookKey: 'EXO',
                    chapter: 2,
                    verseStart: 3,
                    verseEnd: 4,
                },
            } as any,
        ];
        expect(genDuplicatedMessage(list, list[0], 0)).toBeUndefined();
    });
});
