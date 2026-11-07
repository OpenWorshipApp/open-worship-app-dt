import { describe, expect, test } from 'vitest';

import {
    MAX_LOOKUP_FACTS_CHARS,
    fitLookupFacts,
    readLookupVerseAsk,
    toLookupStudyFilesArgs,
    withLookupBibleSearch,
    type LookupSubjectType,
} from './lookupChatHelpers';

// The corners of a lookup conversation its sibling suite leaves: a record
// with nothing of a passage's to shed, one too big whatever it sheds, a
// search that would push a full record over, and a passage card asked for
// its neighbour. (One asked in a language when its own words could not be
// read is in the Khmer package's own tests.)

const VERSE: LookupSubjectType = {
    kind: 'verse',
    target: 'MAT 18:1-14',
    title: 'Matthew 18:1-14',
    bibleKey: 'KJV',
    facts: JSON.stringify({
        kind: 'verse',
        bible: 'KJV',
        passages: [
            {
                key: 'MAT 18:1-14',
                title: 'Matthew 18:1-14',
                text: 'At the same time came the disciples unto Jesus',
            },
        ],
    }),
};

describe('a record past what a card keeps', () => {
    test('a name record has no cross references to shed, and gives up its search', () => {
        const record = {
            kind: 'name',
            name: 'Noah',
            bible: 'KJV',
            people: [{ id: 'shem', name: 'Shem' }],
            bibleSearch: { total: 47, verses: ['x'.repeat(17000)] },
        };
        const fitted = fitLookupFacts(JSON.stringify(record));
        expect(fitted.length).toBeLessThanOrEqual(MAX_LOOKUP_FACTS_CHARS);
        const facts = JSON.parse(fitted);
        expect(facts.bibleSearch).toBeUndefined();
        // What is left is the record, people and all.
        expect(facts).toEqual({
            kind: 'name',
            name: 'Noah',
            bible: 'KJV',
            people: record.people,
        });
    });

    test('a record too big whatever it sheds is cut to the bound, its parts shed first', () => {
        const passage = 'And God remembered Noah. '.repeat(800);
        const fitted = fitLookupFacts(
            JSON.stringify({
                kind: 'verse',
                bible: 'KJV',
                passages: [{ key: 'GEN 8', text: passage }],
                crossRefs: { referenceCount: 3, byVerse: [] },
                places: [{ id: 'ararat' }],
            }),
        );
        expect(fitted).toHaveLength(MAX_LOOKUP_FACTS_CHARS);
        expect(
            fitted.startsWith(
                '{"kind":"verse","bible":"KJV","passages":[{"key":"GEN 8"',
            ),
        ).toBe(true);
        // Never the parts a read can bring back again.
        expect(fitted).not.toContain('crossRefs');
        expect(fitted).not.toContain('ararat');
    });
});

describe('the study files of a passage with no chapter in its key', () => {
    test('a key naming a book alone lists nothing', () => {
        expect(
            toLookupStudyFilesArgs({
                kind: 'verse',
                target: 'JUD',
                title: 'Jude',
            }),
        ).toBeNull();
        expect(
            toLookupStudyFilesArgs({
                kind: 'verse',
                target: 'Song of Solomon',
                title: 'Song of Solomon',
            }),
        ).toBeNull();
    });
});

describe('a search that would push a record past the bound', () => {
    // A name whose record already fills nearly all of what a card keeps.
    const FULL = {
        kind: 'name',
        name: 'Aaron',
        bible: 'KJV',
        description: 'd'.repeat(MAX_LOOKUP_FACTS_CHARS - 900),
    };

    test('a few verses are kept as keys when their words would not fit', () => {
        const text = JSON.stringify(FULL);
        const kept = JSON.parse(
            withLookupBibleSearch(text, {
                bible: 'KJV',
                words: 'Aaron',
                total: 2,
                verses: [
                    { key: 'EXO 4:14', text: 'w'.repeat(220) },
                    { key: 'EXO 28:1', text: 'w'.repeat(220) },
                    { key: 'NUM 20:28', text: 'w'.repeat(220) },
                ],
            }),
        );
        expect(kept.bibleSearch.verses).toEqual([
            'EXO 4:14',
            'EXO 28:1',
            'NUM 20:28',
        ]);
        expect(kept.bibleSearch.total).toBe(2);
    });

    test('a search that does not fit even as keys leaves the record as it was', () => {
        const text = JSON.stringify(FULL);
        const found = {
            bible: 'KJV',
            words: 'Aaron',
            total: 349,
            byBook: Array.from({ length: 12 }, (_, index) => {
                return { book: `Book ${index} `.repeat(6), verses: index };
            }),
            verses: Array.from({ length: 30 }, (_, index) => {
                return { key: `EXO ${index + 1}:1` };
            }),
        };
        expect(withLookupBibleSearch(text, found)).toBe(text);
    });
});

describe('a line under a passage card', () => {
    test('a command or nothing at all asks the card for nothing', () => {
        expect(readLookupVerseAsk('/screen', VERSE)).toBeNull();
        expect(readLookupVerseAsk('   ', VERSE)).toBeNull();
    });

    test('the chapter before is the card’s Previous', () => {
        expect(readLookupVerseAsk('previous chapter please', VERSE)).toEqual({
            kind: 'action',
            step: 'near',
            near: 'previous',
        });
        expect(readLookupVerseAsk('the verse before', VERSE)).toEqual({
            kind: 'action',
            step: 'near',
            near: 'previous',
        });
    });
});
