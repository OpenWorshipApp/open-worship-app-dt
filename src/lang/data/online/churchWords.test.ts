import { describe, expect, test } from 'vitest';

import {
    type StudyTranslateLanguageType,
    withStudyChurchWords,
} from '../../../chatbot/studyTranslateHelpers';

// A language's own Bible words for what a Bible study names (EC-491): the
// help window's study translator tells its translator these and asks again
// when one is written another way (`withStudyChurchWords`). Each word was
// read off the verses of the Bible the file's `source` names. This holds
// every package that has one to the shape the translator reads; with no
// package left, it holds nothing.

type ChurchWordsFileType = {
    source?: unknown;
    wordsChangeForm?: unknown;
    words?: unknown;
};

const FILE_MAP = import.meta.glob<ChurchWordsFileType>('./*/churchWords.json', {
    eager: true,
    import: 'default',
});

// Zero-width spaces a Bible puts between words, and the marks that turn a
// direction: never part of a word the translator is told. The zero-width
// joiner and non-joiner stay: some scripts spell a word with them.
const INVISIBLE_PATTERN =
    /[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;
// Marks of Markdown and of the "English = word" list the translator reads.
const MARK_PATTERN = /[[\](){}<>|;=*_#`"]/;

const ENTRY_LIST = Object.entries(FILE_MAP).map(([filePath, file]) => {
    return [filePath.split('/')[1], file] as const;
});

const MADE_UP_LANGUAGE: StudyTranslateLanguageType = {
    code: '',
    name: 'Testish',
    nativeName: 'Testo',
    scriptPattern: null,
    terms: {},
};

describe('churchWords.json', () => {
    test('says which Bible it was read from, and how its words change', () => {
        for (const [code, file] of ENTRY_LIST) {
            expect(typeof file.source, code).toBe('string');
            expect(String(file.source).trim(), code).not.toBe('');
            expect(typeof file.wordsChangeForm, code).toBe('boolean');
        }
    });

    test('maps English words to the words of its Bible, each a plain word', () => {
        for (const [code, file] of ENTRY_LIST) {
            const words = file.words as Record<string, unknown>;
            expect(words !== null && typeof words === 'object', code).toBe(
                true,
            );
            expect(Object.keys(words).length, code).toBeGreaterThan(0);
            for (const [english, word] of Object.entries(words)) {
                const where = `${code}: ${english}`;
                expect(english, where).toMatch(/^[A-Z a-z']+$/);
                expect(typeof word, where).toBe('string');
                const text = String(word);
                expect(text.trim(), where).toBe(text);
                expect(text, where).not.toBe('');
                expect(text.toLowerCase(), where).not.toBe(
                    english.toLowerCase(),
                );
                expect(INVISIBLE_PATTERN.test(text), where).toBe(false);
                expect(MARK_PATTERN.test(text), where).toBe(false);
            }
        }
    });

    test('names the bronze serpent and the bronze snake alike', () => {
        for (const [code, file] of ENTRY_LIST) {
            const words = file.words as Record<string, string>;
            expect(words['bronze snake'], code).toBe(words['bronze serpent']);
        }
    });

    test('is every word the study translator is handed', () => {
        for (const [code, file] of ENTRY_LIST) {
            const language = withStudyChurchWords(MADE_UP_LANGUAGE, file);
            expect(language.terms, code).toEqual(file.words);
            expect(language.isWordFormChanging, code).toBe(
                file.wordsChangeForm,
            );
        }
    });
});
