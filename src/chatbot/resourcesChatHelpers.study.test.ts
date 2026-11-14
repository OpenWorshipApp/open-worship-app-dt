import { afterEach, describe, expect, test } from 'vitest';

import {
    getAssistantLanguage,
    type AssistantLanguageType,
} from './chatLangHelpers';
import { setChatTranslator } from './chatTranHelpers';
import { checkIsNoteVerseCheckAsk } from './noteChatHelpers';
import {
    genResourceOpeningAnswer,
    genStudyOpeningAnswer,
    genStudyTranslateReplies,
    toStudyLanguageSample,
} from './resourcesChatHelpers';
import { findWindowDoneCardAsk } from './slideChatHelpers';

// EC-595 (2026-11-13): a study the assistant can change opened on the
// Resources card, whose buttons were all questions to read it by -- nothing
// on it said it could be translated, its verses checked or a diagram added,
// the jobs a study is opened in the chat for.

const ENGLISH = getAssistantLanguage('en');
// A window in another language: only its names matter here.
const WINDOW = {
    code: 'xx',
    name: 'Xxish',
    nativeName: 'Native Xxish',
} as AssistantLanguageType;
const STUDY_NAME = 'Default/JHN.3.Love.md';
const ENGLISH_STUDY =
    '# Love\n\nGod so loved the world that he gave his only Son, so that ' +
    'everyone who believes in him may have eternal life.\n\n## Prayer\n\n' +
    'Thank you for your love, and help us to love one another.\n';

// Words in a script of its own, built from its code points: what a study
// written in another language is to the card.
const SCRIPT_START = 0x10d0;
function genScriptWords(count: number) {
    return Array.from({ length: count }, (_, index) => {
        return Array.from({ length: 5 }, (_, at) => {
            return String.fromCodePoint(
                SCRIPT_START + ((index * 7 + at * 3) % 30),
            );
        }).join('');
    }).join(' ');
}

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('the card a study opens its tab with', () => {
    test('offers the jobs a study is opened for, then a question to read it by', () => {
        const opening = genStudyOpeningAnswer(
            STUDY_NAME,
            ENGLISH_STUDY,
            null,
            ENGLISH,
        );
        expect(opening.text).toBe(
            '“JHN.3.Love.md” is attached below. I can change this study ' +
                'for you: translate it, check its Bible verses and its ' +
                'spelling, or add a diagram. I can also sum it up and ' +
                'answer questions about it. Press one, or say what you want.',
        );
        // An English study in an English window: the assistant asks which.
        expect(opening.replies).toEqual([
            'Replace the words with another language',
            'Add another language after it',
            'Check the Bible verses',
            'Add a diagram',
            'Sum up the main points',
        ]);
        expect(opening.reading).toBeNull();
        // The Resources card for the same file was questions only.
        expect(genResourceOpeningAnswer(STUDY_NAME, null).replies).toEqual([
            'What is this file about?',
            'Sum up the main points',
            'Explain it in simple words',
        ]);
    });

    test("a study in English offers the window's language, by its own name", () => {
        expect(
            genStudyOpeningAnswer(STUDY_NAME, ENGLISH_STUDY, null, WINDOW)
                .replies,
        ).toEqual([
            'Replace the words with Native Xxish',
            'Add Native Xxish after it',
            'Check the Bible verses',
            'Add a diagram',
            'Sum up the main points',
        ]);
    });

    test('a study written in another language offers English, read off its own words', () => {
        const words = genScriptWords(40);
        const study =
            `# ${genScriptWords(3)}\n\n` +
            // The passage the app quoted, and a diagram: neither is the
            // study's own words.
            '> **John 3:16** (KJV)\n> 16 For God so loved the world, ' +
            'that he gave his only begotten Son, that whosoever believeth ' +
            'in him should not perish, but have everlasting life.\n\n' +
            '```mermaid\nflowchart TD\n  A[God loves the world] --> ' +
            'B[He gave His Son] --> C[Everyone who believes lives]\n```\n\n' +
            `${words}\n`;
        expect(
            genStudyOpeningAnswer(
                STUDY_NAME,
                study,
                null,
                ENGLISH,
            ).replies.slice(0, 2),
        ).toEqual(['Replace the words with English', 'Add English after it']);
        // An English study quoting a passage in that script stays English.
        const quoting = `> ${words}\n\n${ENGLISH_STUDY}`;
        expect(
            genStudyOpeningAnswer(STUDY_NAME, quoting, null, ENGLISH)
                .replies[0],
        ).toBe('Replace the words with another language');
    });

    test('the passage being read is asked about first, as on the Resources card', () => {
        const reading = {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
            title: 'John 3:16',
        };
        const opening = genStudyOpeningAnswer(
            STUDY_NAME,
            ENGLISH_STUDY,
            reading,
            ENGLISH,
        );
        expect(opening.text).toMatch(
            /Press one, or say what you want\.\n\nYou are reading John 3:16 in the Bible Reader\.$/,
        );
        expect(opening.replies[0]).toBe('What does it say about John 3:16?');
        expect(opening.replies).toHaveLength(6);
        expect(opening.reading).toBe(reading);
        // A reading of another book is no reading of this study.
        const other = genStudyOpeningAnswer(
            STUDY_NAME,
            ENGLISH_STUDY,
            { ...reading, bookKey: 'MAT', title: 'Matthew 3:16' },
            ENGLISH,
        );
        expect(other.reading).toBeNull();
        expect(other.text).not.toContain('You are reading');
        expect(other.replies).toHaveLength(5);
    });

    test('its verse check is asked in its English in any language, which the window reads as one', () => {
        const shown: Record<string, string> = {
            'Check the Bible verses': 'Xx verses',
            'Add a diagram': 'Xx diagram',
        };
        setChatTranslator(
            (text) => shown[text] ?? text,
            (text) => shown[text] ?? text,
        );
        const { replies } = genStudyOpeningAnswer(
            STUDY_NAME,
            ENGLISH_STUDY,
            null,
            ENGLISH,
        );
        expect(replies).toContain('Xx verses');
        expect(findWindowDoneCardAsk('Xx verses')).toBe(
            'Check the Bible verses',
        );
        expect(checkIsNoteVerseCheckAsk('Check the Bible verses')).toBe(true);
        // The other buttons are the assistant's, asked as they are shown.
        expect(findWindowDoneCardAsk('Xx diagram')).toBeNull();
        expect(checkIsNoteVerseCheckAsk('Add a diagram')).toBe(false);
        expect(checkIsNoteVerseCheckAsk('Sum up the main points')).toBe(false);
    });

    test('the two translate buttons say the two places a translation goes', () => {
        expect(genStudyTranslateReplies(null)).toEqual([
            'Replace the words with another language',
            'Add another language after it',
        ]);
        expect(genStudyTranslateReplies('Xxish')).toEqual([
            'Replace the words with Xxish',
            'Add Xxish after it',
        ]);
    });
});

describe("a study's own words, to tell their language", () => {
    test('leave out its diagrams, its code and its quoted passages', () => {
        expect(
            toStudyLanguageSample(
                [
                    '# Title',
                    '```mermaid',
                    'flowchart TD',
                    '```',
                    'Own words.',
                    '> **John 3:16** (KJV)',
                    '  > 16 For God so loved',
                    '~~~~',
                    '```',
                    'still code inside the longer fence',
                    '~~~~',
                    'More words.',
                ].join('\n'),
            ),
        ).toBe('# Title\nOwn words.\nMore words.');
        // A fence left open runs to the end.
        expect(toStudyLanguageSample('Words.\n```\ncode\nmore code')).toBe(
            'Words.',
        );
    });

    test('are its first lines, never the whole of a long study', () => {
        const line = 'A line of the study words.';
        const sample = toStudyLanguageSample(
            Array.from({ length: 400 }, () => line).join('\n'),
        );
        expect(sample.length).toBeLessThanOrEqual(1500);
        expect(sample.startsWith(line)).toBe(true);
        expect(toStudyLanguageSample('')).toBe('');
    });
});
