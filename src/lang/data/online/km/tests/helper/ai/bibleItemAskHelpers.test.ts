import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    fromVerseKey: vi.fn(),
    openChatbotWithLookup: vi.fn(),
}));

vi.mock('../../../../../../../bible-list/BibleItem', () => ({
    default: { fromVerseKey: h.fromVerseKey },
}));
vi.mock('../../../../../../../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithLookup: h.openChatbotWithLookup,
}));

import { openChatbotWithVerseKey } from '../../../../../../../helper/ai/bibleItemAskHelpers';

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
});
