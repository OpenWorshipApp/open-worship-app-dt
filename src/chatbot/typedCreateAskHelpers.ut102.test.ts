import { describe, expect, test } from 'vitest';

import {
    type CreateAskWordsType,
    findWordSpans,
    readTypedCreateAsk,
    toLowerAskLine,
    toTypedBackgroundLinkAsk,
    toTypedBibleListAsk,
    toTypedWebBackgroundAsk,
} from './typedCreateAskHelpers';

// Made-up words, a spaced language of ASCII words and an unspaced one of
// signs (the module's own test's), so the rules are tested apart from any
// real language.
const SPACED_WORDS: CreateAskWordsType = {
    make: ['mak', 'makka*'],
    new: ['nuu'],
    flow: ['runorda', 'run orda'],
    slide: ['slyd*'],
    save: ['seiv'],
    list: ['lis'],
    bibleList: ['baibel lis'],
    webPage: ['web peij'],
    background: ['bakgraun'],
    download: ['daunlod'],
    video: ['vidio'],
    audio: ['saund'],
    lyric: ['lirik*'],
    named: ['kold'],
    namedAfter: ['nemd', '*inemd', '*nemd'],
    nameStop: ['wiz', 'fo'],
    days: ['sundei', 'iivnin'],
    filler: ['a', 'an', 'tu', 'mai', 'pliz', 'dis', 'di', 'ov', 'it'],
    howTo: ['hau', 'wer'],
    done: ['yestadei'],
};

const UNSPACED_WORDS: CreateAskWordsType = {
    make: ['◆'],
    flow: ['▲'],
    slide: ['■'],
    save: ['✚'],
    list: ['☰'],
    named: ['●'],
    namedAfter: ['★'],
    days: ['☀'],
    filler: ['○'],
    howTo: ['❓'],
};

function readSpaced(text: string) {
    return readTypedCreateAsk(text, SPACED_WORDS, true);
}

function readUnspaced(text: string) {
    return readTypedCreateAsk(text, UNSPACED_WORDS, false);
}

// A letter beyond the first plane, two units long: a mathematical capital,
// which is no language's.
const WIDE_LETTER = String.fromCodePoint(0x1d400);

describe('findWordSpans: a letter of two units', () => {
    test('a letter of two units glued to a word makes it no whole word', () => {
        // Before it: the unit before the word is the second half.
        expect(findWordSpans(`${WIDE_LETTER}mak it`, ['mak'], true)).toEqual(
            [],
        );
        // After it: the unit after the word is the first half.
        expect(findWordSpans(`mak${WIDE_LETTER} it`, ['mak'], true)).toEqual(
            [],
        );
        // Apart from it, the word is whole.
        expect(findWordSpans(`${WIDE_LETTER} mak it`, ['mak'], true)).toEqual([
            [3, 6],
        ]);
    });

    test('a stem runs on through a letter of two units', () => {
        expect(findWordSpans(`slyd${WIDE_LETTER} x`, ['slyd*'], true)).toEqual([
            [0, 6],
        ]);
    });
});

describe('findWordSpans: entries that are no words', () => {
    test('an entry of no letters, of a star alone or not a string finds nothing', () => {
        expect(findWordSpans('mak a runorda', [''], true)).toEqual([]);
        expect(findWordSpans('mak a runorda', ['...'], true)).toEqual([]);
        expect(findWordSpans('mak a runorda', ['*'], true)).toEqual([]);
        expect(findWordSpans('mak a runorda', ['**'], false)).toEqual([]);
        expect(
            findWordSpans('mak a runorda', [7 as unknown as string], true),
        ).toEqual([]);
        expect(findWordSpans('mak a runorda', undefined, true)).toEqual([]);
        // Beside them, a real entry is still found.
        expect(findWordSpans('mak a runorda', ['', 'mak'], true)).toEqual([
            [0, 3],
        ]);
    });
});

describe('readTypedCreateAsk: the name', () => {
    test("a little word ending the name is the sentence's", () => {
        expect(readSpaced('mak slydshow kold Youth Night pliz')).toMatchObject({
            kind: 'slide',
            name: 'Youth Night',
        });
    });

    test('words past six after the marker are no name', () => {
        expect(
            readSpaced('mak slydshow kold Wan Tuu Tri Foo Faiv Siks Sevn'),
        ).toEqual({
            job: 'document',
            kind: 'slide',
            isNew: false,
            name: null,
            hasContent: true,
        });
        // Six are.
        expect(
            readSpaced('mak slydshow kold Wan Tuu Tri Foo Faiv Siks'),
        ).toMatchObject({ name: 'Wan Tuu Tri Foo Faiv Siks' });
    });

    test('before its marker, the last four words are the name', () => {
        expect(
            readSpaced('Big Grand Old Youth Night nemd slydshow mak'),
        ).toMatchObject({ kind: 'slide', name: 'Grand Old Youth Night' });
    });

    test('run together before its marker, past thirty letters is no name', () => {
        const long = 'Y'.repeat(31);
        expect(readUnspaced(`${long}★■◆`)).toMatchObject({
            kind: 'slide',
            name: null,
        });
        expect(readUnspaced(`${'Y'.repeat(30)}★■◆`)).toMatchObject({
            name: 'Y'.repeat(30),
        });
    });

    test('run together after its marker, past thirty letters is no name', () => {
        expect(readUnspaced(`●${'Y'.repeat(31)}■◆`)).toMatchObject({
            kind: 'slide',
            name: null,
        });
    });
});

describe('readTypedCreateAsk: a Bibles list', () => {
    test('twenty passages at most are read off one line', () => {
        const passages = Array.from({ length: 22 }, (_, index) => {
            return `Jon 1:${index + 1}`;
        });
        const ask = readSpaced(
            `seiv ${passages.join(' an ')} tu mai baibel lis`,
        );
        expect(ask).toMatchObject({ job: 'bibleList', isNewList: false });
        expect(ask?.job === 'bibleList' ? ask.references : []).toEqual(
            passages.slice(0, 20),
        );
    });
});

describe('toLowerAskLine', () => {
    test('reads a line lowered, its spaces one and its apostrophes straight', () => {
        expect(toLowerAskLine('  MAK\u00A0it\u2019s   A  Runorda ')).toBe(
            "mak it's a runorda",
        );
    });

    test('lowers a capital dotted I to the plain letter, one unit for one', () => {
        const dottedCapital = String.fromCharCode(0x130);
        const lowered = toLowerAskLine(`${dottedCapital}iv`);
        expect(lowered).toBe('iiv');
        expect(lowered.length).toBe(3);
    });
});

describe('findWordSpans: an entry in parts, run together', () => {
    test('up to eight signs between its parts where the script has no spaces', () => {
        const entry = '\u25C6 \u2026 \u25B2';
        expect(findWordSpans('\u25C6xxxxxxxx\u25B2', [entry], false)).toEqual([
            [0, 10],
        ]);
        expect(findWordSpans('\u25C6xxxxxxxxx\u25B2', [entry], false)).toEqual(
            [],
        );
    });
});

describe('the English shapes of a typed ask', () => {
    test('each takes only its own job', () => {
        const document = readSpaced('mak a runorda');
        const bibleList = readSpaced('seiv Jon 3:16 tu mai baibel lis');
        const url = 'https://example.com/a';
        const link = readSpaced(`daunlod dis vidio ${url}`);
        const webPage = readSpaced('mak a bakgraun web peij');
        for (const ask of [null, document, link, webPage]) {
            expect(toTypedBibleListAsk(ask)).toBeNull();
        }
        for (const ask of [null, document, bibleList, link]) {
            expect(toTypedWebBackgroundAsk(ask)).toBeNull();
        }
        for (const ask of [null, document, bibleList, webPage]) {
            expect(toTypedBackgroundLinkAsk(ask)).toBeNull();
        }
        expect(toTypedBibleListAsk(bibleList)).toEqual({
            listName: null,
            isNewList: false,
            references: ['Jon 3:16'],
        });
        expect(toTypedBackgroundLinkAsk(link)).toEqual({ kind: 'video', url });
        expect(toTypedWebBackgroundAsk(webPage)).toEqual({
            name: null,
            description: '',
        });
    });
});
