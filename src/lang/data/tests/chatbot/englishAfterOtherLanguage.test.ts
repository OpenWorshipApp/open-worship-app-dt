import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { checkIsEnglishAfterOtherLanguage } from '../../../../chatbot/chatLangHelpers';
import { checkHasLangPackage } from '../../../../test-setup/langPackageDirs';

// EC-510 (2026-11-12): a line typed in English, in an English app, was told
// no language, so under answers in another language the model went by them:
// _Make a short study file on Philippians 4:6-7._ under two Khmer answers
// was written in Khmer. Such a line is now told to be answered in English
// when an answer above is in another language (`genAskLanguageLine`), or
// when the passage it is about is (EC-496: a passage chat keeps its Bible,
// and its first question has no answer above it). Each language's answer,
// and its passage, are made of its own sample lines
// (`typedStudyKeepAsks.json`, EC-508).
type SampleType = {
    folder: string;
    keep: string;
    polite: string;
    more: string;
    topic: string;
    studyAsks: string[];
};

const SAMPLE_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'typedStudyKeepAsks.json'),
        'utf8',
    ),
) as Record<string, SampleType>;
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

const ENGLISH_ASK = 'Make a short study file on Philippians 4:6-7.';

// A question in the language and an answer in it, as the model is shown
// them.
function toTurnList(sample: SampleType) {
    return [
        { author: 'you' as const, text: sample.topic },
        {
            author: 'bot' as const,
            text: [sample.more, sample.polite, ...sample.studyAsks].join(' '),
        },
    ];
}

describe('an English line under answers in another language', () => {
    test('every language has a sample', () => {
        expect(Object.keys(SAMPLE_MAP).length).toBeGreaterThanOrEqual(88);
    });

    test('under answers in English it is no switch', () => {
        expect(
            checkIsEnglishAfterOtherLanguage(ENGLISH_ASK, [
                { author: 'you', text: 'Explain John 3:16 in simple words' },
                {
                    author: 'bot',
                    text:
                        'God loved the whole world so much that He gave His ' +
                        'only Son, so that everyone who believes in Him will ' +
                        'not be lost but will have life that never ends.',
                },
            ]),
        ).toBe(false);
    });

    test('about a passage in English it is no switch', () => {
        expect(
            checkIsEnglishAfterOtherLanguage(
                ENGLISH_ASK,
                [],
                'For God so loved the world, that he gave his only begotten ' +
                    'Son, that whosoever believeth in him should not perish, ' +
                    'but have everlasting life.',
            ),
        ).toBe(false);
        expect(checkIsEnglishAfterOtherLanguage(ENGLISH_ASK, [], '')).toBe(
            false,
        );
    });

    test.each(SAMPLE_LIST)('%s', (code, sample) => {
        const turnList = toTurnList(sample);
        expect(
            checkIsEnglishAfterOtherLanguage(ENGLISH_ASK, turnList),
            code,
        ).toBe(true);
        // The answer's words as a QUESTION are no switch: an option pressed
        // in the answer's own language. Nor is a typed "yes", nor a line in
        // the language under answers in English.
        for (const asked of [sample.keep, sample.polite, 'yes please']) {
            expect(
                checkIsEnglishAfterOtherLanguage(asked, turnList),
                asked,
            ).toBe(false);
        }
        expect(
            checkIsEnglishAfterOtherLanguage(sample.keep, [
                { author: 'you', text: 'Explain John 3:16 in simple words' },
                { author: 'bot', text: 'God so loved the world.' },
            ]),
        ).toBe(false);
        // A passage in the language, asked about before any answer: the
        // English question is a switch, a line in the language is none.
        const passage = turnList[1].text;
        expect(
            checkIsEnglishAfterOtherLanguage(ENGLISH_ASK, [], passage),
            `${code} passage`,
        ).toBe(true);
        expect(
            checkIsEnglishAfterOtherLanguage(sample.keep, [], passage),
            `${code} passage, asked in it`,
        ).toBe(false);
    });
});
