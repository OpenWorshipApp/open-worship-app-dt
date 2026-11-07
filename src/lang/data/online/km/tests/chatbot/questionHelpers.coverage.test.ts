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
} from '../../../../../../chatbot/questionHelpers';

const KHMER_LETTER_PATTERN = /[ក-៿]/;

afterEach(() => {
    vi.doUnmock(
        '../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs',
    );
    vi.doUnmock('../../questions.json');
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
        vi.doMock(
            '../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs',
            () => {
                throw new Error('the chunk did not load');
            },
        );
        const fresh = await import('../../../../../../chatbot/questionHelpers');

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

describe('a translation that cannot be loaded', () => {
    test('a translation that fails to load leaves the English questions, never an empty window', async () => {
        // This package's own words for the corpus fail to arrive.
        vi.resetModules();
        vi.doMock('../../questions.json', () => {
            throw new Error('the translation failed to load');
        });
        const questions =
            await import('../../../../../../chatbot/questionHelpers');
        const chips = await questions.getStarterQuestions('presenter');
        expect(chips[3]).toEqual({
            text: 'Create a lyric file for song "Amazing Grace"',
            isTemplate: true,
        });
        const rows = await questions.suggestQuestions('song', 'presenter');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => !KHMER_LETTER_PATTERN.test(row.text))).toBe(
            true,
        );
    });
});
