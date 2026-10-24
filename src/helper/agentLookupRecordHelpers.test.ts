import { describe, expect, it } from 'vitest';

import type {
    LookupLocationRecordType,
    LookupNameRecordType,
    LookupRecordResolverType,
} from './agentLookupRecordHelpers';
import {
    LOOKUP_SOURCE_TEXT,
    MAX_LISTED_VERSES,
    MAX_NEARBY_PLACES,
    listNearbyPlaces,
    listPlacePeople,
    listSameNameRecords,
    mergeVerseKeyLists,
    toEnglishVerseRef,
    toLocationRecordResult,
    toNameRecordResult,
    toPlaceDistance,
    toPlainRecordText,
    toQuotedText,
} from './agentLookupRecordHelpers';

const EVE_ID = 'f168f2a8-9db8-4db7-8230-20ba4023dee0';
const EDEN_ID = '00000000-0000-4000-8000-000000000081';

// Adam as the Khmer dataset stores him, cut to what is read here.
const ADAM: LookupNameRecordType = {
    id: '42bd6be4-e60a-4744-9eb8-42a111646073',
    name: 'អ័ដាម',
    kjvName: 'Adam',
    oldName: null,
    title:
        'ជាមនុស្សប្រុសដំបូងគេក្នុងកណ្ឌ [Genesis](book-key://GEN) និងជាស្វាមីរបស់ ' +
        `[អេវ៉ា](name-id://${EVE_ID})`,
    description: 'អ័ដាម ត្រូវបានបង្ហាញក្នុងកណ្ឌ [Genesis](book-key://GEN)។',
    gender: 'male',
    age: '930 years',
    years: [],
    locations: [EDEN_ID],
    spouses: [EVE_ID],
    children: ['cain', 'unknown-id'],
    parents: [],
    siblings: [],
    cousin: [],
    type: 'person',
    verses: ['GEN 2:19-21', 'GEN 2:23'],
    links: [
        { type: 'easton', url: 'https://www.biblestudytools.com/adam.html' },
    ],
    wikipedia: 'https://en.wikipedia.org/wiki/Adam',
};

const resolver: LookupRecordResolverType = {
    findName: (id) => {
        if (id === EVE_ID) {
            return { id: EVE_ID, name: 'អេវ៉ា', kjvName: 'Eve' };
        }
        if (id === 'cain') {
            return { id: 'cain', name: 'កាអ៊ីន', kjvName: 'Cain' };
        }
        return null;
    },
    findLocation: (idOrName) => {
        return idOrName === EDEN_ID
            ? { id: EDEN_ID, name: 'សួនច្បារអេដែន', kjvName: 'Garden of Eden' }
            : null;
    },
};

describe('what owa_lookup_record says of a person', () => {
    it('names every relation with its id, and its source', () => {
        const result = toNameRecordResult(ADAM, resolver, [
            { key: 'GEN 2:23', ref: 'Genesis 2:23', text: '(23): …' },
        ]);
        expect(result).toMatchObject({
            kind: 'name',
            source: LOOKUP_SOURCE_TEXT,
            name: 'អ័ដាម',
            kjvName: 'Adam',
            type: 'person',
            gender: 'male',
            age: '930 years',
            summary:
                'ជាមនុស្សប្រុសដំបូងគេក្នុងកណ្ឌ Genesis និងជាស្វាមីរបស់ អេវ៉ា',
            description: 'អ័ដាម ត្រូវបានបង្ហាញក្នុងកណ្ឌ Genesis។',
            places: [
                {
                    id: EDEN_ID,
                    name: 'សួនច្បារអេដែន',
                    kjvName: 'Garden of Eden',
                },
            ],
            spouses: [{ id: EVE_ID, name: 'អេវ៉ា', kjvName: 'Eve' }],
            // A relation the dataset cannot resolve keeps what it carries.
            children: [
                { id: 'cain', name: 'កាអ៊ីន', kjvName: 'Cain' },
                { name: 'unknown-id' },
            ],
            verseCount: 2,
            verses: ['GEN 2:19-21', 'GEN 2:23'],
            quoted: [{ key: 'GEN 2:23', ref: 'Genesis 2:23', text: '(23): …' }],
        });
        expect(result).toHaveProperty('links', [
            {
                type: 'easton',
                url: 'https://www.biblestudytools.com/adam.html',
            },
            { type: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Adam' },
        ]);
    });

    // An empty list reads as "has none", which the dataset does not say.
    it('leaves out what the record does not fill', () => {
        const result = toNameRecordResult(
            { ...ADAM, gender: 'unknown', age: '', kjvName: 'អ័ដាម' },
            resolver,
            [],
        );
        expect(result).not.toHaveProperty('parents');
        expect(result).not.toHaveProperty('gender');
        expect(result).not.toHaveProperty('age');
        expect(result).not.toHaveProperty('quoted');
        // The KJV's spelling only when it is not the name already.
        expect(result).not.toHaveProperty('kjvName');
    });

    it('lists the verses up to a ceiling, and counts them all', () => {
        const verses = Array.from(
            { length: MAX_LISTED_VERSES + 20 },
            (_, i) => {
                return `EXO ${i + 1}:1`;
            },
        );
        const result = toNameRecordResult({ ...ADAM, verses }, resolver, []);
        expect(result.verseCount).toBe(MAX_LISTED_VERSES + 20);
        expect(result.verses).toHaveLength(MAX_LISTED_VERSES);
    });
});

describe('what owa_lookup_record says of a place', () => {
    const EDEN: LookupLocationRecordType = {
        id: EDEN_ID,
        name: 'សួនច្បារអេដែន',
        kjvName: 'Garden of Eden',
        oldName: null,
        title: 'ជាសួនច្បារដើមដំបូង',
        description:
            'សួនច្បារអេដែន គឺជាសួនច្បារក្នុងកណ្ឌ [Genesis](book-key://GEN)',
        type: 'place',
        relatedLocations: [EDEN_ID, 'Nowhere'],
        modernIdentification: null,
        coordinates: null,
        verses: ['GEN 3:23-24'],
        links: [],
        wikipedia: null,
        uncertainty: true,
    };

    it('says where it is as far as the record knows, and that it is unsure', () => {
        expect(toLocationRecordResult(EDEN, resolver, [])).toEqual({
            kind: 'location',
            source: LOOKUP_SOURCE_TEXT,
            id: EDEN_ID,
            name: 'សួនច្បារអេដែន',
            kjvName: 'Garden of Eden',
            type: 'place',
            summary: 'ជាសួនច្បារដើមដំបូង',
            description: 'សួនច្បារអេដែន គឺជាសួនច្បារក្នុងកណ្ឌ Genesis',
            isPlaceUncertain: true,
            relatedPlaces: [
                {
                    id: EDEN_ID,
                    name: 'សួនច្បារអេដែន',
                    kjvName: 'Garden of Eden',
                },
                { name: 'Nowhere' },
            ],
            verseCount: 1,
            verses: ['GEN 3:23-24'],
        });
        expect(
            toLocationRecordResult(
                {
                    ...EDEN,
                    coordinates: { latitude: 31.7, longitude: 35.2 },
                    modernIdentification: 'Jerusalem',
                },
                resolver,
                [],
            ),
        ).toMatchObject({
            coordinates: { latitude: 31.7, longitude: 35.2 },
            modernIdentification: 'Jerusalem',
        });
    });
});

describe('the words around a record', () => {
    it('says the KJV is where the names come from', () => {
        expect(LOOKUP_SOURCE_TEXT).toContain('King James Version (KJV)');
    });

    it('reads a reference token as its label', () => {
        expect(
            toPlainRecordText(
                'in [Acts](book-key://ACT) and [John 3:16](verse-key://JHN 3:16)',
            ),
        ).toBe('in Acts and John 3:16');
        expect(toPlainRecordText(null)).toBe('');
    });

    it('writes a key with its English book', () => {
        expect(toEnglishVerseRef('GEN 2:19-21', { GEN: 'Genesis' })).toBe(
            'Genesis 2:19-21',
        );
        expect(toEnglishVerseRef('XYZ 1:1', {})).toBe('XYZ 1:1');
    });

    it('cuts a long passage at its limit, and says so', () => {
        expect(toQuotedText('one two three', 7)).toBe('one two…');
        expect(toQuotedText('  short  ')).toBe('short');
    });
});

describe('one person under several names (2026-10-22)', () => {
    // Noah's children as the dataset lists them: Sem (Luke 3:36) is Shem.
    const NOAH: LookupNameRecordType = {
        ...ADAM,
        id: 'noah',
        name: 'Noah',
        kjvName: null,
        title: 'righteous patriarch who built the ark',
        description: '',
        children: ['japheth', 'sem', 'shem', 'ham'],
        parents: ['lamech'],
        spouses: [],
        locations: [],
        verses: ['GEN 5:29-30', 'HEB 11:7'],
    };
    const NAME_MAP: Record<string, string> = {
        japheth: 'Japheth',
        sem: 'Sem',
        shem: 'Shem',
        ham: 'Ham',
        lamech: 'Lamech',
        noe: 'Noe',
    };
    const ALIAS_MAP: Record<string, string> = { sem: 'shem', noe: 'noah' };
    const aliasResolver: LookupRecordResolverType = {
        findName: (id) => {
            return NAME_MAP[id] === undefined
                ? null
                : { id, name: NAME_MAP[id], kjvName: null };
        },
        findLocation: () => {
            return null;
        },
        toMainNameId: (id) => {
            return ALIAS_MAP[id] ?? id;
        },
    };

    it('names each child once, by the record that is that person', () => {
        const result = toNameRecordResult(NOAH, aliasResolver, []);
        expect(result).toHaveProperty('children', [
            { id: 'japheth', name: 'Japheth' },
            { id: 'shem', name: 'Shem' },
            { id: 'ham', name: 'Ham' },
        ]);
        // Without the alias map every record is itself, as before.
        const plainResolver = { ...aliasResolver, toMainNameId: undefined };
        expect(toNameRecordResult(NOAH, plainResolver, [])).toHaveProperty(
            'children.length',
            4,
        );
    });

    it('lists its other names with their verses, and every verse in order', () => {
        const result = toNameRecordResult(NOAH, aliasResolver, [], {
            otherForms: [
                {
                    id: 'noe',
                    name: 'Noe',
                    summary: 'Greek KJV form of Noah',
                    verses: ['MAT 24:37-38', 'LUK 17:26-27'],
                },
            ],
            sameName: [
                {
                    id: 'noah-2',
                    name: 'Noah',
                    summary: 'daughter of Zelophehad',
                },
            ],
            verses: ['GEN 5:29-30', 'MAT 24:37-38', 'LUK 17:26-27', 'HEB 11:7'],
        });
        expect(result).toMatchObject({
            otherForms: [{ id: 'noe', name: 'Noe' }],
            sameName: [{ id: 'noah-2', summary: 'daughter of Zelophehad' }],
            verseCount: 4,
            verses: ['GEN 5:29-30', 'MAT 24:37-38', 'LUK 17:26-27', 'HEB 11:7'],
        });
        // A person is never its own parent, under any of its names.
        const sem = toNameRecordResult(
            { ...NOAH, id: 'sem', name: 'Sem', parents: ['noah', 'noe'] },
            aliasResolver,
            [],
            {
                otherForms: [{ id: 'shem', name: 'Shem', verses: [] }],
                sameName: [],
                verses: [],
            },
        );
        expect(sem).toHaveProperty('parents', [{ name: 'noah' }]);
    });

    it('merges verse lists in the Bible order, each once', () => {
        expect(
            mergeVerseKeyLists(
                [
                    ['HEB 11:7', 'GEN 5:29-30', 'GEN 5:32'],
                    ['LUK 17:26-27', 'MAT 24:37-38', 'GEN 5:32'],
                ],
                ['GEN', 'MAT', 'LUK', 'HEB'],
            ),
        ).toEqual([
            'GEN 5:29-30',
            'GEN 5:32',
            'MAT 24:37-38',
            'LUK 17:26-27',
            'HEB 11:7',
        ]);
    });

    it('names the other people of the name, not its own other names', () => {
        const noah = {
            id: 'noah',
            name: 'Noah',
            kjvName: null,
            title: 'the ark',
        };
        const daughter = {
            id: 'noah-2',
            name: 'Noah',
            kjvName: null,
            title: 'daughter of [Zelophehad](name-id://z)',
        };
        const noe = { id: 'noe', name: 'Noe', kjvName: null, title: 'form' };
        expect(
            listSameNameRecords(
                [noah, daughter, daughter, noe],
                new Set(['noah', 'noe']),
            ),
        ).toEqual([
            { id: 'noah-2', name: 'Noah', summary: 'daughter of Zelophehad' },
        ]);
    });
});

describe('where a place is (2026-10-22)', () => {
    const JERUSALEM = { latitude: 31.777769, longitude: 35.236004 };
    const BETHLEHEM = { latitude: 31.704928, longitude: 35.201605 };

    it('measures how far and which way, from the dataset’s own points', () => {
        expect(toPlaceDistance(JERUSALEM, BETHLEHEM)).toEqual({
            km: 8.7,
            miles: 5.4,
            direction: 'south',
        });
        expect(toPlaceDistance(BETHLEHEM, JERUSALEM)?.direction).toBe('north');
        // Past 100 km, whole kilometres.
        expect(
            toPlaceDistance(JERUSALEM, {
                latitude: 33.5138,
                longitude: 36.2765,
            }),
        ).toMatchObject({ km: 216, direction: 'north-east' });
        expect(toPlaceDistance(JERUSALEM, null)).toBeNull();
        expect(toPlaceDistance({ latitude: 'x' }, BETHLEHEM)).toBeNull();
    });

    it('names the nearest places, nearest first, not the far ones', () => {
        const place = (id: string, latitude: number, longitude: number) => {
            return {
                id,
                name: id,
                kjvName: null,
                title: '',
                coordinates: { latitude, longitude } as unknown,
            };
        };
        const bethlehem = place(
            'Bethlehem',
            BETHLEHEM.latitude,
            BETHLEHEM.longitude,
        );
        const list = listNearbyPlaces(bethlehem, [
            bethlehem,
            place('Jerusalem', JERUSALEM.latitude, JERUSALEM.longitude),
            place('Ephrath', 31.7049, 35.21),
            place('Damascus', 33.5138, 36.2765),
            { ...place('Nowhere', 0, 0), coordinates: null },
        ]);
        expect(
            list.map((one) => {
                return one.name;
            }),
        ).toEqual(['Ephrath', 'Jerusalem']);
        expect(list[1]).toMatchObject({ km: 8.7, direction: 'north' });
        expect(
            listNearbyPlaces({ ...bethlehem, coordinates: null }, [bethlehem]),
        ).toEqual([]);
        expect(MAX_NEARBY_PLACES).toBeGreaterThan(2);
    });

    it('names the people who list it, each once, the most written about first', () => {
        const person = (
            id: string,
            locations: string[],
            verseCount: number,
        ) => {
            return {
                id,
                name: id,
                kjvName: null,
                title: '',
                locations,
                verses: Array.from({ length: verseCount }, () => {
                    return 'RUT 1:1';
                }),
            };
        };
        const result = listPlacePeople(
            { id: 'bethlehem', name: 'Bethlehem' },
            [
                person('Boaz', ['bethlehem'], 3),
                person('Ruth', ['moab', 'bethlehem'], 12),
                person('Moses', ['egypt'], 90),
                person('Sem', ['bethlehem'], 1),
                person('Shem', ['bethlehem'], 13),
            ],
            (id) => {
                return id === 'Sem' ? 'Shem' : id;
            },
        );
        expect(
            result.people.map((one) => {
                return one.name;
            }),
        ).toEqual(['Shem', 'Ruth', 'Boaz']);
        expect(result.peopleCount).toBe(3);
    });

    it('says how far from Jerusalem, what is near and who lived there', () => {
        const result = toLocationRecordResult(
            {
                id: 'bethlehem',
                name: 'Bethlehem',
                kjvName: null,
                oldName: null,
                title: 'city of David',
                description: '',
                type: 'city',
                relatedLocations: [],
                modernIdentification: null,
                coordinates: BETHLEHEM,
                verses: [],
                links: [],
                wikipedia: null,
                uncertainty: false,
            },
            resolver,
            [],
            {
                fromJerusalem: { km: 8.7, miles: 5.4, direction: 'south' },
                nearby: [
                    {
                        id: 'ephrath',
                        name: 'Ephrath',
                        km: 0.9,
                        miles: 0.6,
                        direction: 'east',
                    },
                ],
                people: [{ id: 'ruth', name: 'Ruth' }],
                peopleCount: 23,
                sameName: [],
            },
        );
        expect(result).toMatchObject({
            fromJerusalem: { km: 8.7, direction: 'south' },
            nearby: [{ name: 'Ephrath', km: 0.9 }],
            people: [{ name: 'Ruth' }],
            peopleCount: 23,
        });
        expect(result).not.toHaveProperty('sameName');
    });
});
