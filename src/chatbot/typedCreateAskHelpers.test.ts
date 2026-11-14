import { describe, expect, test } from 'vitest';

import {
    type CreateAskWordsType,
    findWordSpans,
    readCreateAskInOwnLanguage,
    readTypedCreateAsk,
    toTypedBackgroundLinkAsk,
    toTypedBibleListAsk,
    toTypedDocumentCreateAsk,
    toTypedWebBackgroundAsk,
} from './typedCreateAskHelpers';

// EC-516: a language's own words for a request to make something. These
// are made up -- a spaced language of ASCII words and an unspaced one of
// signs -- so the rules are tested apart from any real language; each
// package's words are held by `src/lang/data/tests/chatbot/
// typedCreateAsks.test.ts`.
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

describe('findWordSpans', () => {
    test('a word is whole in a spaced script; a stem and a prefix are not', () => {
        expect(findWordSpans('mak a runorda', ['mak'], true)).toEqual([[0, 3]]);
        expect(findWordSpans('maked a runorda', ['mak'], true)).toEqual([]);
        expect(findWordSpans('slydshow', ['slyd*'], true)).toEqual([[0, 8]]);
        expect(findWordSpans('unmak it', ['*mak'], true)).toEqual([[0, 5]]);
    });

    test('an entry in parts, with up to three words between', () => {
        expect(
            findWordSpans('a orda nuu ov di serviss', ['orda … serviss'], true),
        ).toEqual([[2, 24]]);
        expect(
            findWordSpans(
                'orda wan tu tri for serviss',
                ['orda ... serviss'],
                true,
            ),
        ).toEqual([]);
        expect(findWordSpans('serviss orda', ['orda … serviss'], true)).toEqual(
            [],
        );
    });

    test('anywhere in an unspaced script', () => {
        expect(findWordSpans('x◆y', ['◆'], false)).toEqual([[1, 2]]);
    });
});

describe('readTypedCreateAsk: a running order or slide document', () => {
    test('asked for alone, with a day: nothing to put in it', () => {
        expect(readSpaced('Mak a nuu runorda fo Sundei pliz')).toEqual({
            job: 'document',
            kind: 'flow',
            isNew: true,
            name: null,
            hasContent: false,
        });
    });

    test('with something named to put in it', () => {
        expect(
            readSpaced('mak a runorda wiz Amazing Grace an Jon 3:16'),
        ).toMatchObject({ kind: 'flow', isNew: false, hasContent: true });
    });

    test('the name after its marker, up to what goes in it', () => {
        expect(
            readSpaced('Makka slydshow kold Youth Night wiz tri slydz'),
        ).toMatchObject({ kind: 'slide', name: 'Youth Night' });
        expect(readSpaced('mak a runorda kold Iivnin ov Iista')).toMatchObject({
            kind: 'flow',
            name: 'Iivnin ov Iista',
            hasContent: false,
        });
        expect(readSpaced('mak slydshow kold "Youth Night"')).toMatchObject({
            name: 'Youth Night',
        });
        expect(readSpaced('mak slydshow «Youth Night»')).toMatchObject({
            name: 'Youth Night',
        });
    });

    test('a quoted name past the little words after its marker', () => {
        expect(readSpaced('mak slydshow kold it "Youth Night"')).toMatchObject({
            name: 'Youth Night',
            hasContent: false,
        });
    });

    test('a name keeps the apostrophe and the okina it was typed with', () => {
        expect(readSpaced('mak slydshow kold Toetu\u02BBu')).toMatchObject({
            name: 'Toetu\u02BBu',
        });
        expect(readSpaced('mak slydshow kold "God\u2019s Love"')).toMatchObject(
            { name: 'God\u2019s Love' },
        );
    });

    test("a mark between two letters is the name's own", () => {
        expect(
            readSpaced('mak slydshow kold Iista\u00B7Nait wiz tri slydz'),
        ).toMatchObject({ name: 'Iista\u00B7Nait' });
    });

    test('a marker joined to the name it follows leaves the name', () => {
        expect(readSpaced('Iistainemd slydshow mak')).toMatchObject({
            kind: 'slide',
            name: 'Iista',
        });
    });

    test('a name before its marker, where the language puts it there', () => {
        expect(readSpaced('Youth Night nemd slydshow mak')).toMatchObject({
            kind: 'slide',
            name: 'Youth Night',
            hasContent: false,
        });
    });

    test('a running order named over a slide in it', () => {
        expect(readSpaced('mak a runorda wiz a welkam slyd')).toMatchObject({
            kind: 'flow',
        });
    });

    test('a how-to, a past form and a line with no request read nothing', () => {
        expect(readSpaced('hau mak a nuu runorda')).toBeNull();
        expect(readSpaced('maked a runorda yestadei')).toBeNull();
        expect(readSpaced('mak a runorda yestadei')).toBeNull();
        expect(readSpaced('wer iz mai runorda')).toBeNull();
        expect(readSpaced('di runorda iz gon')).toBeNull();
        expect(readSpaced('/mak a runorda')).toBeNull();
        expect(readSpaced('')).toBeNull();
        expect(readTypedCreateAsk('mak a runorda', null, true)).toBeNull();
    });

    test('a kind open in the tab is that file: only a new one is made', () => {
        const open = readSpaced('mak a runorda wiz Amazing Grace');
        expect(toTypedDocumentCreateAsk(open, ['flow'])).toBeNull();
        expect(toTypedDocumentCreateAsk(open, ['slide'])).toEqual({
            kind: 'flow',
            name: null,
            dayName: null,
            hasContent: true,
        });
        const fresh = readSpaced('mak a nuu runorda');
        expect(toTypedDocumentCreateAsk(fresh, ['flow'])).toMatchObject({
            kind: 'flow',
        });
        expect(toTypedDocumentCreateAsk(null)).toBeNull();
        expect(
            toTypedDocumentCreateAsk(readSpaced('mak a web peij')),
        ).toBeNull();
    });
});

describe('readTypedCreateAsk: a Bibles list', () => {
    test('passages saved, each as written, to the default list', () => {
        const ask = readSpaced('Seiv Jon 3:16 an Saam 23 tu mai baibel lis');
        expect(ask).toEqual({
            job: 'bibleList',
            listName: null,
            isNewList: false,
            references: ['Jon 3:16', 'Saam 23'],
        });
        expect(toTypedBibleListAsk(ask)).toEqual({
            listName: null,
            isNewList: false,
            references: ['Jon 3:16', 'Saam 23'],
        });
    });

    test('a numbered book, a range, and a list by its name', () => {
        expect(
            readSpaced('seiv 1 Korin 13:4-7 tu di lis kold Iista'),
        ).toMatchObject({
            listName: 'Iista',
            references: ['1 Korin 13:4-7'],
        });
    });

    test('a book named like a word of the request is still a book', () => {
        expect(readSpaced('seiv Saund 23 tu mai baibel lis')).toMatchObject({
            references: ['Saund 23'],
        });
    });

    test('a list with no passage named is not a save', () => {
        expect(readSpaced('seiv mai lis')).toBeNull();
        expect(readSpaced('seiv Jon 3:16')).toBeNull();
    });

    test('a new list, its name and what goes in it', () => {
        expect(readSpaced('mak a nuu baibel lis kold Iista')).toEqual({
            job: 'bibleList',
            listName: 'Iista',
            isNewList: true,
            references: [],
        });
    });

    test('a new list whose words stand apart, and no list not new', () => {
        expect(readSpaced('mak a lis nuu ov baibel kold Iista')).toMatchObject({
            job: 'bibleList',
            listName: 'Iista',
            isNewList: true,
        });
        expect(readSpaced('mak a lis kold Iista')).toBeNull();
    });
});

describe('readTypedCreateAsk: a web page, a video or a track', () => {
    test('a background web page', () => {
        const ask = readSpaced('mak a bakgraun web peij wiz slou staaz');
        expect(ask).toEqual({
            job: 'webBackground',
            name: null,
            description: '',
        });
        expect(toTypedWebBackgroundAsk(ask)).toEqual({
            name: null,
            description: '',
        });
    });

    test('one link: a video, or its sound, the link as typed', () => {
        const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        const video = readSpaced(`daunlod dis vidio fo di bakgraun: ${url}.`);
        expect(video).toEqual({ job: 'backgroundLink', kind: 'video', url });
        expect(toTypedBackgroundLinkAsk(video)).toEqual({
            kind: 'video',
            url,
        });
        expect(readSpaced(`daunlod dis saund ${url}`)).toEqual({
            job: 'backgroundLink',
            kind: 'audio',
            url,
        });
    });

    test('a song page, two links or no request word read nothing', () => {
        const url = 'https://example.com/a';
        expect(readSpaced(`daunlod di liriks ov dis vidio ${url}`)).toBeNull();
        expect(readSpaced(`daunlod dis vidio ${url} ${url}b`)).toBeNull();
        expect(readSpaced(`luk at dis vidio ${url}`)).toBeNull();
        expect(readSpaced(`mak a runorda ${url}`)).toBeNull();
    });
});

describe('readTypedCreateAsk: a script with no spaces', () => {
    test('a running order, alone or with something in it', () => {
        expect(readUnspaced('◆▲☀○')).toMatchObject({
            kind: 'flow',
            hasContent: false,
        });
        expect(readUnspaced('◆▲Amazing')).toMatchObject({
            kind: 'flow',
            hasContent: true,
        });
    });

    test('a name after or before its marker, up to the next word', () => {
        expect(readUnspaced('●Youth○■◆')).toMatchObject({
            kind: 'slide',
            name: 'Youth',
        });
        expect(readUnspaced('Youth★■◆')).toMatchObject({
            kind: 'slide',
            name: 'Youth',
        });
        expect(readUnspaced('Youth ★■◆')).toMatchObject({ name: 'Youth' });
    });

    test('a book run together with its chapter and verse', () => {
        expect(readUnspaced('✚Jon3:16○☰')).toMatchObject({
            job: 'bibleList',
            references: ['Jon 3:16'],
        });
        expect(readUnspaced('❓◆▲')).toBeNull();
    });
});

describe('readCreateAskInOwnLanguage', () => {
    test('English is read by its own readers, never here', () => {
        expect(
            readCreateAskInOwnLanguage(
                'Make a new running order for Sunday',
                'en',
            ),
        ).toBeNull();
    });
});
