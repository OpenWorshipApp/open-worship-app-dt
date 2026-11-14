import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { toAnswerShownInLanguage } from '../../../../chatbot/answerLanguageHelpers';
import { getAssistantLanguage } from '../../../../chatbot/chatLangHelpers';
import { checkHasLangPackage } from '../../../../test-setup/langPackageDirs';

// EC-496 (2026-11-12): an answer on an ENGLISH screen, in a language with a
// script of its own that the person typed in, loses a third script's letters
// as it would in an app shown in that language. The cleaner reads the
// language the answer was ASKED in (`toShownAnswerLanguage`), not the
// window's. The Thai word EC-495 saw kept in a Khmer answer on an English
// screen was in an answer to an ENGLISH ask, written in a language nobody
// asked for -- which EC-495 and EC-510 now keep from being written. Each
// language's answer is made of its own sample lines
// (`typedStudyKeepAsks.json`, EC-508).
type SampleType = {
    folder: string;
    more: string;
    polite: string;
};

const SAMPLE_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'typedStudyKeepAsks.json'),
        'utf8',
    ),
) as Record<string, SampleType>;

// A word of a script other than the language's own: Thai's "said", the
// word EC-495 saw, or a Korean word where Thai is the language's own.
const THIRD_WORD_LIST = [
    { word: 'กล่าวว่า', pattern: /\p{Script=Thai}/u },
    { word: '말씀하셨다', pattern: /\p{Script=Hangul}/u },
];

const SCRIPT_SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(
    ([code, sample]) => {
        if (!checkHasLangPackage(sample.folder)) {
            return false;
        }
        const language = getAssistantLanguage(code);
        return language.code === code && !language.isLatinScript;
    },
);

function countMatching(text: string, pattern: RegExp) {
    return [...text].filter((character) => {
        return pattern.test(character);
    }).length;
}

describe('an answer in a script of its own on an English screen', () => {
    test('the languages with a script of their own are many', () => {
        expect(SCRIPT_SAMPLE_LIST.length).toBeGreaterThanOrEqual(20);
    });

    test.each(SCRIPT_SAMPLE_LIST)('%s', (code, sample) => {
        const language = getAssistantLanguage(code);
        const third = THIRD_WORD_LIST.find((one) => {
            return countMatching(one.word, language.scriptPattern) === 0;
        });
        if (third === undefined) {
            throw new Error(`no third script for ${code}`);
        }
        // Glued to the language's own words, as a model slips.
        const text = `${sample.more}${third.word} ${sample.polite}`;
        const shown = toAnswerShownInLanguage(
            text,
            code,
            (label) => {
                return label;
            },
            undefined,
            'en',
        );
        expect(countMatching(shown, third.pattern), code).toBe(0);
        expect(countMatching(shown, language.scriptPattern), code).toBe(
            countMatching(text, language.scriptPattern),
        );
    });
});
