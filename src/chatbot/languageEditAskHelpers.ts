/**
 * Work the help window does with NO model, asked in a language other than
 * English (2026-11-08, BN-16; the user's goal _work great for all
 * languages_): every word of a slide document or a Bible note larger, smaller
 * or one size (`readSlideSizeAsk`'s job), and one style for a WHOLE note
 * (`readNoteStyleAsk`'s). English is read in code by those two; every other
 * language says its own words in its `assistant.json` (`textSizeAsks`,
 * `noteStyleAsks`, `colorWords`, loaded by `chatLangHelpers.ts`), so a
 * language added later brings its words with it and no code names one. A
 * language that says nothing leaves the request to the assistant, as before.
 *
 * Pure: the patterns of the languages installed.
 */

import {
    listAssistantLanguages,
    listTypedLanguages,
    SENTENCE_END_MARKS,
    toAsciiDigits,
    toCharClassSource,
} from './chatLangHelpers';

export type LanguageSizeAskType =
    { kind: 'larger' } | { kind: 'smaller' } | { kind: 'set'; size: number };

export type LanguageStyleAskType = {
    styles?: string[];
    color?: string;
    font?: string;
    align?: string;
    clear?: true;
};

// A short line and nothing else: a request carrying more than a size or a
// style is the assistant's.
const MAX_ASK_LENGTH = 120;
const STYLE_JOB_LIST = [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'highlight',
    'uppercase',
    'lowercase',
];
const ALIGN_JOB_LIST = ['center', 'left', 'right', 'justify'];

// What a keyboard adds that is no part of the words (a zero-width space
// between Khmer words) goes, a number in the language's own digits is read
// as one, the okina (U+02BB) a Tongan or Samoan keyboard types is the
// apostrophe the patterns write (BN-39), and the line's closing mark is
// dropped.
function toPlainAsk(text: string) {
    const endPattern = new RegExp(
        `[.!?${toCharClassSource(SENTENCE_END_MARKS)}]+$`,
        'u',
    );
    return toAsciiDigits(String(text ?? '').normalize('NFC'))
        .replace(/\p{Cf}/gu, '')
        .replace(/\u02BB/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .replace(endPattern, '')
        .trim();
}

// Every language that may say these: the ones the help window is written
// for (an `assistant.json`) and the ones only typed (a `typed.json`).
function listEditAskLanguages() {
    return [...listAssistantLanguages(), ...listTypedLanguages()];
}

function findMatch(text: string, patternList: RegExp[]) {
    for (const pattern of patternList) {
        const matched = pattern.exec(text);
        if (matched !== null) {
            return matched;
        }
    }
    return null;
}

/** A size for every word, asked in a language's own words, or null. */
export function readLanguageSizeAsk(asked: string): LanguageSizeAskType | null {
    const text = toPlainAsk(asked);
    if (text.length === 0 || text.length > MAX_ASK_LENGTH) {
        return null;
    }
    for (const language of listEditAskLanguages()) {
        const { larger, smaller, set } = language.textSizeAskPatterns;
        if (findMatch(text, larger) !== null) {
            return { kind: 'larger' };
        }
        if (findMatch(text, smaller) !== null) {
            return { kind: 'smaller' };
        }
        const sized = findMatch(text, set);
        const size = Number(sized?.groups?.size);
        if (sized !== null && Number.isInteger(size) && size > 0) {
            return { kind: 'set', size };
        }
    }
    return null;
}

/** A style for a whole note, asked in a language's own words, or null. */
export function readLanguageNoteStyleAsk(
    asked: string,
): LanguageStyleAskType | null {
    const text = toPlainAsk(asked);
    if (text.length === 0 || text.length > MAX_ASK_LENGTH) {
        return null;
    }
    for (const language of listEditAskLanguages()) {
        const patternMap = language.noteStyleAskPatterns;
        for (const job of STYLE_JOB_LIST) {
            if (findMatch(text, patternMap[job] ?? []) !== null) {
                return { styles: [job] };
            }
        }
        for (const job of ALIGN_JOB_LIST) {
            if (findMatch(text, patternMap[job] ?? []) !== null) {
                return { align: job };
            }
        }
        if (findMatch(text, patternMap.clear ?? []) !== null) {
            return { clear: true };
        }
        // A colour the language names; a word it does not is no colour.
        const colored = findMatch(text, patternMap.color ?? []);
        const colorWord = colored?.groups?.color?.trim().toLowerCase();
        if (colorWord !== undefined && language.colorWords[colorWord]) {
            return { color: language.colorWords[colorWord] };
        }
        const fontMatch = findMatch(text, patternMap.font ?? []);
        const font = fontMatch?.groups?.font?.trim();
        if (font !== undefined && font.length > 0) {
            return { font };
        }
    }
    return null;
}
