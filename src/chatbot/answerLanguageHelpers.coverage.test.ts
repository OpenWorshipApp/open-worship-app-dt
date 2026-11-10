import { describe, expect, test } from 'vitest';

import { toAnswerShownInLanguage } from './answerLanguageHelpers';

// A code nothing here knows -- no package, not a language a person may type
// -- so nothing in the answer is the window's to rewrite. (The cases about an
// answer in one language's own words are in that language's package tests.)

const LABEL_MAP: Record<string, string> = {
    'Its verses': '[its verses, translated]',
};
const translateLabel = (label: string) => {
    return LABEL_MAP[label] ?? label;
};

describe('a language the app has no pack for', () => {
    test('leaves the answer exactly as the model wrote it', () => {
        const answer = '✝ "Its verses" (Its verses)';
        expect(toAnswerShownInLanguage(answer, 'xx', translateLabel)).toBe(
            answer,
        );
    });
});
