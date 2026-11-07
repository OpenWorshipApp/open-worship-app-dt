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

function genBibleItem(bibleKey = 'KJV', verseKey = 'GEN 4:1-2') {
    return {
        bibleKey,
        toVerseFullKey: () => verseKey,
        toTitle: async () => `Genesis 4:1-2 (${bibleKey})`,
    } as any;
}

beforeEach(() => {
    h.openChatbotWithLookup.mockResolvedValue(true);
    h.fromVerseKey.mockResolvedValue(genBibleItem('KJV', 'GEN 4:1'));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('openChatbotWithBibleItem', () => {
    test('asks about the whole passage, by its key and its own title', async () => {
        expect(await openChatbotWithBibleItem(genBibleItem())).toBe(true);
        expect(h.openChatbotWithLookup).toHaveBeenCalledWith({
            kind: 'verse',
            target: 'GEN 4:1-2',
            title: 'Genesis 4:1-2 (KJV)',
            bibleKey: 'KJV',
            page: '',
        });
    });

    test('names the window it was asked from', async () => {
        vi.stubGlobal('location', {
            href: 'https://localhost:3000/reader.html',
        });
        await openChatbotWithBibleItem(genBibleItem('KHM'));
        expect(h.openChatbotWithLookup.mock.calls[0][0]).toMatchObject({
            bibleKey: 'KHM',
            page: 'https://localhost:3000/reader.html',
        });
    });

    test('passes the opener answer back: false when the person said no', async () => {
        h.openChatbotWithLookup.mockResolvedValue(false);
        expect(await openChatbotWithBibleItem(genBibleItem())).toBe(false);
    });
});

describe('openChatbotWithVerseKey', () => {
    test('reads the verse its element carries and asks about it', async () => {
        expect(await openChatbotWithVerseKey('(KJV) GEN 4:1')).toBe(true);
        expect(h.fromVerseKey).toHaveBeenCalledWith('KJV', 'GEN 4:1');
        expect(h.openChatbotWithLookup).toHaveBeenCalledWith({
            kind: 'verse',
            target: 'GEN 4:1',
            title: 'Genesis 4:1-2 (KJV)',
            bibleKey: 'KJV',
            page: '',
        });
    });

    test('a key that reads as no verse opens nothing', async () => {
        expect(await openChatbotWithVerseKey('GEN 4:1')).toBe(false);
        expect(h.fromVerseKey).not.toHaveBeenCalled();
        expect(h.openChatbotWithLookup).not.toHaveBeenCalled();
    });

    test('a verse its Bible does not have opens nothing', async () => {
        h.fromVerseKey.mockResolvedValue(null);
        expect(await openChatbotWithVerseKey('(KJV) GEN 99:1')).toBe(false);
        expect(h.fromVerseKey).toHaveBeenCalledWith('KJV', 'GEN 99:1');
        expect(h.openChatbotWithLookup).not.toHaveBeenCalled();
    });
});
