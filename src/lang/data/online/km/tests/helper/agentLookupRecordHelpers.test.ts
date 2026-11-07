import { describe, expect, it } from 'vitest';

import type {
    LookupLocationRecordType,
    LookupNameRecordType,
    LookupRecordResolverType,
} from '../../../../../../helper/agentLookupRecordHelpers';
import {
    LOOKUP_SOURCE_TEXT,
    toLocationRecordResult,
    toNameRecordResult,
} from '../../../../../../helper/agentLookupRecordHelpers';

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
