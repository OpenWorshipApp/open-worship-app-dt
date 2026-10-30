// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

// The question corpus as a window shown in Khmer reads it: its rows in
// Khmer with their English kept beside them, and a finished fill-in row asked
// as the row's English. And the window's answer when the corpus cannot load
// at all. The language is the window's own `<html lang>`, read when the
// corpus is first loaded, so it is set before any test asks.
document.documentElement.lang = 'km';

import {
    FALLBACK_STARTERS,
    findTemplateAsk,
    getStarterQuestions,
    toStarterQuestion,
} from './questionHelpers';

const KHMER_LETTER_PATTERN = /[ក-៿]/;

afterEach(() => {
    vi.doUnmock('../../tools/owa-devtools-mcp/questionMatch.mjs');
});

describe('a window shown in Khmer', () => {
    test('the starter chips are in Khmer, their English kept for the ask', async () => {
        const starters = await getStarterQuestions('presenter');
        expect(starters).toHaveLength(4);
        for (const starter of starters) {
            expect(KHMER_LETTER_PATTERN.test(starter.text), starter.text).toBe(
                true,
            );
            expect(starter.textEn, starter.text).toBeDefined();
            expect(KHMER_LETTER_PATTERN.test(starter.textEn ?? '')).toBe(false);
        }
    });

    test('a fill-in row finished in Khmer is asked as the row’s English', async () => {
        expect(await findTemplateAsk('តើប៊ូតុងសម្រាប់ Clear All នៅឯណា?')).toBe(
            'Where is the button for Clear All',
        );
        // Not a finished fill-in row: nothing to put into English.
        expect(await findTemplateAsk('សួស្តី')).toBeNull();
        expect(await findTemplateAsk('   ')).toBeNull();
    });
});

describe('a corpus that cannot be loaded', () => {
    test('leaves no suggestions, the written starters, and no known row', async () => {
        vi.resetModules();
        vi.doMock('../../tools/owa-devtools-mcp/questionMatch.mjs', () => {
            throw new Error('the chunk did not load');
        });
        const fresh = await import('./questionHelpers');

        expect(await fresh.suggestQuestions('screen', 'presenter')).toEqual([]);
        expect(await fresh.getAllQuestions('presenter')).toEqual([]);
        // The window's first screen is never empty: the copy stands in.
        expect(await fresh.getStarterQuestions('reader')).toEqual(
            FALLBACK_STARTERS.reader.map(toStarterQuestion),
        );
        expect(
            await fresh.findKnownQuestion('How do I show a song?', 'presenter'),
        ).toBeNull();
        expect(
            await fresh.findTemplateAsk('តើប៊ូតុងសម្រាប់ Clear All នៅឯណា?'),
        ).toBeNull();
    });
});
