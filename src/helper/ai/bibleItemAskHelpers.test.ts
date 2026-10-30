import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    fromVerseKey: vi.fn(),
    openChatbotWithLookup: vi.fn(),
}));

vi.mock('../../bible-list/BibleItem', () => ({
    default: { fromVerseKey: h.fromVerseKey },
}));
vi.mock('./chatbotHandoffHelpers', () => ({
    openChatbotWithLookup: h.openChatbotWithLookup,
}));

import {
    openChatbotWithBibleItem,
    openChatbotWithVerseKey,
} from './bibleItemAskHelpers';

function genBibleItem(bibleKey: string, verseFullKey: string, title: string) {
    return {
        bibleKey,
        toVerseFullKey: () => verseFullKey,
        toTitle: async () => title,
    };
}

beforeEach(() => {
    h.openChatbotWithLookup.mockResolvedValue(true);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('asking the assistant about what a Bible view shows', () => {
    test('a whole passage goes over as a verse ask in its Bible', async () => {
        vi.stubGlobal('location', {
            href: 'https://localhost:3000/reader.html',
        });
        const bibleItem = genBibleItem('KJV', 'JHN 3:16-18', 'John 3:16-18');
        expect(await openChatbotWithBibleItem(bibleItem as any)).toBe(true);
        expect(h.openChatbotWithLookup).toHaveBeenCalledWith({
            kind: 'verse',
            target: 'JHN 3:16-18',
            title: 'John 3:16-18',
            bibleKey: 'KJV',
            page: 'https://localhost:3000/reader.html',
        });
    });

    test('a window with no address sends an empty page', async () => {
        vi.stubGlobal('location', undefined);
        const bibleItem = genBibleItem('KJV', 'GEN 1:1', 'Genesis 1:1');
        await openChatbotWithBibleItem(bibleItem as any);
        expect(h.openChatbotWithLookup.mock.calls[0][0].page).toBe('');
    });

    test('says what the assistant answered: a refused caution is false', async () => {
        h.openChatbotWithLookup.mockResolvedValue(false);
        const bibleItem = genBibleItem('KJV', 'GEN 1:1', 'Genesis 1:1');
        expect(await openChatbotWithBibleItem(bibleItem as any)).toBe(false);
    });

    test('one verse is read off the key its element carries', async () => {
        const bibleItem = genBibleItem('ពគប', 'GEN 4:6', 'លោកុប្បត្តិ ៤:៦');
        h.fromVerseKey.mockResolvedValue(bibleItem);
        expect(await openChatbotWithVerseKey(' (ពគប) GEN 4:6 ')).toBe(true);
        expect(h.fromVerseKey).toHaveBeenCalledWith('ពគប', 'GEN 4:6');
        expect(h.openChatbotWithLookup).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'verse',
                target: 'GEN 4:6',
                title: 'លោកុប្បត្តិ ៤:៦',
                bibleKey: 'ពគប',
            }),
        );
    });

    test('a key that names no verse opens nothing', async () => {
        expect(await openChatbotWithVerseKey('GEN 4:6')).toBe(false);
        expect(h.fromVerseKey).not.toHaveBeenCalled();

        h.fromVerseKey.mockResolvedValue(null);
        expect(await openChatbotWithVerseKey('(KJV) XYZ 99:99')).toBe(false);
        expect(h.openChatbotWithLookup).not.toHaveBeenCalled();
    });
});
