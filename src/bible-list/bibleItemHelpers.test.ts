import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    genContextMenuItemIcon: vi.fn(() => null),
}));

import {
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
        expect(menu).toHaveLength(5);
        menu.forEach((item) => item.onSelect!({} as any));
        expect(bibleItem.copyTitleToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyTextToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyVerseFullKeyToClipboard).toHaveBeenCalled();
        expect(bibleItem.copyChapterFullKeyToClipboard).toHaveBeenCalled();
    });

    test('genDuplicatedMessage flags a duplicate target', () => {
        const target = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 1,
        };
        const list = [{ target } as any, { target: { ...target } } as any];
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
