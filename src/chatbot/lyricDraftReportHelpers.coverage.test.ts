import { afterEach, describe, expect, test } from 'vitest';

import { setChatTranslator } from './chatTranHelpers';
import { translateDraftGuess } from './lyricDraftReportHelpers';

// Defensive: today's drafter names only the key, the tempo and the time as
// missing, so this is a line from a drafter that names one more. A field
// the window has no word for is data, kept as the drafter wrote it.

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('a missing field the window has no word for', () => {
    test('is kept as written beside the ones it translates', () => {
        // Symbols stand in for the window's language: whatever it is, a
        // word it has is used and one it lacks is left as written.
        const words: Record<string, string> = {
            'Musical key': '♪ key ♪',
            'The text did not specify {fields}; add them if needed.':
                '✝ not given: {fields} ✝',
        };
        setChatTranslator(
            (text) => words[text] ?? text,
            (text) => words[text] ?? text,
        );
        expect(
            translateDraftGuess(
                'the text gave no key, capo, so the song has none set -- ' +
                    'worth adding by hand if the band needs it',
            ),
        ).toBe('✝ not given: ♪ key ♪, capo ✝');
    });
});
