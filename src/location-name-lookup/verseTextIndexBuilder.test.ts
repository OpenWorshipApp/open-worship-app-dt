import { beforeEach, describe, expect, test, vi } from 'vitest';

// Two tiny stand-ins for the shipped ~35MB packages: the English one is what the
// index is always built from, the Khmer one only ever relabels it.
const h = vi.hoisted(() => ({
    lookupDataMap: {} as { [langCode: string]: any },
    readLangCodes: [] as string[],
}));

vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getLangDataByCodeAsync: async (langCode: string) => {
        const lookupData = h.lookupDataMap[langCode];
        if (lookupData === undefined) {
            return null;
        }
        return {
            langCode,
            packageDir: `/lang/${langCode}`,
            getLookupData: async () => {
                h.readLangCodes.push(langCode);
                return lookupData;
            },
        };
    },
}));
vi.mock('../lang/lookupDataVersionHelpers', () => ({
    readJsonFile: async () => ({}),
}));

import {
    buildLookupTextIndex,
    buildLookupTextNeedles,
} from './verseTextIndexBuilder';
import { NEEDLE_SEPARATOR } from './verseTextIndexTypes';

function genEnglishData() {
    return {
        namesMap: {
            namesMap: {
                'id-abram': {
                    id: 'id-abram',
                    name: 'Abram',
                    title: 'Father of many nations',
                    type: 'person',
                },
                // Attested by a verse but never spelled out in it, so it is
                // reachable only through the verse map.
                'id-satan': {
                    id: 'id-satan',
                    name: 'Satan',
                    title: 'The adversary',
                    type: 'supernatural',
                },
            },
            versePersonsMap: { 'GEN 11:26': ['id-abram'] },
        },
        locationsMap: {
            locationsMap: [
                {
                    id: 'id-haran',
                    name: 'Haran',
                    title: 'A city in Mesopotamia',
                    type: 'city',
                },
            ],
            verseLocationsMap: { 'GEN 11:31': ['id-haran'] },
        },
    };
}

beforeEach(() => {
    h.readLangCodes = [];
    h.lookupDataMap = { en: genEnglishData() };
});

describe('building the derived lookup files', () => {
    test('labels every record from English when English is selected', async () => {
        const built = await buildLookupTextIndex('en');

        expect(h.readLangCodes).toStrictEqual(['en']);
        // Nothing to gloss: an English label already IS the English name.
        expect(built!.recordLabels.kjvNames).toStrictEqual(
            built!.index.ids.map(() => ''),
        );
        const labelByIdMap = new Map(
            built!.index.ids.map((id, idIndex) => {
                return [id, built!.recordLabels.labels[idIndex]];
            }),
        );
        expect(labelByIdMap.get('id-abram')).toBe('Abram');
        expect(labelByIdMap.get('id-haran')).toBe('Haran');
    });

    test('gives up when the English package has no dataset', async () => {
        h.lookupDataMap = { km: genEnglishData() };

        expect(await buildLookupTextIndex('km')).toBeNull();
    });

    describe('with a translated language selected', () => {
        beforeEach(() => {
            h.lookupDataMap.km = {
                namesMap: {
                    namesMap: {
                        'id-abram': {
                            id: 'id-abram',
                            name: '✝✝✝✝',
                            title: '✝✝✝♪',
                            type: 'person',
                        },
                        // Present here, unknown to English: nothing can ever
                        // reference it, so it must not reach the sidecar.
                        'id-only-khmer': {
                            id: 'id-only-khmer',
                            name: '✝✝✝☀',
                            title: '',
                            type: 'person',
                        },
                    },
                },
                locationsMap: {
                    locationsMap: [
                        {
                            id: 'id-haran',
                            name: '✝✝✝♥',
                            title: '✝✝✝★',
                        },
                    ],
                },
            };
        });

        test('relabels the records the translation covers', async () => {
            const built = await buildLookupTextIndex('km');

            expect(h.readLangCodes).toStrictEqual(['en', 'km']);
            const { ids } = built!.index;
            expect(built!.recordLabels.labels[ids.indexOf('id-abram')]).toBe(
                '✝✝✝✝',
            );
            expect(built!.recordLabels.labels[ids.indexOf('id-haran')]).toBe(
                '✝✝✝♥',
            );
            expect(built!.recordLabels.titles[ids.indexOf('id-abram')]).toBe(
                '✝✝✝♪',
            );
        });

        // An empty label makes `toVerseRecord` drop the row entirely, so a
        // partial translation would silently shorten the list.
        test('keeps the English text for records it does not cover', async () => {
            const built = await buildLookupTextIndex('km');

            const { ids } = built!.index;
            expect(built!.recordLabels.labels[ids.indexOf('id-satan')]).toBe(
                'Satan',
            );
        });

        test('never lets a translation-only record into the sidecar', async () => {
            const built = await buildLookupTextIndex('km');

            expect(built!.index.ids).not.toContain('id-only-khmer');
            expect(built!.recordLabels.labels).not.toContain('✝✝✝☀');
            expect(built!.recordLabels.labels).toHaveLength(
                built!.index.ids.length,
            );
        });

        // Shown beside the translated label the way a bible book reads
        // `<its own name> (Genesis)`.
        test('keeps the English name of every relabelled record', async () => {
            const built = await buildLookupTextIndex('km');

            const { ids } = built!.index;
            expect(built!.recordLabels.kjvNames[ids.indexOf('id-abram')]).toBe(
                'Abram',
            );
            expect(built!.recordLabels.kjvNames[ids.indexOf('id-haran')]).toBe(
                'Haran',
            );
            // Untranslated: its label already IS the English name, and
            // repeating it would print `Satan (Satan)`.
            expect(built!.recordLabels.kjvNames[ids.indexOf('id-satan')]).toBe(
                '',
            );
            expect(built!.recordLabels.kjvNames).toHaveLength(ids.length);
        });

        // The index matches KJV wording in rendered verse text, so its surface
        // forms have to stay the KJV's whatever language the labels are in.
        test('leaves the index itself English', async () => {
            const built = await buildLookupTextIndex('km');

            expect(Object.keys(built!.index.names)).toContain('abram');
            expect(Object.keys(built!.index.locations)).toContain('haran');
            expect(built!.index.verseNames['GEN 11:26']).toHaveLength(1);
        });

        // `type` is an enum the icon map is keyed on, not prose: a translated
        // package spelling it differently would cost those rows their icon.
        test('keeps the English record type', async () => {
            const built = await buildLookupTextIndex('km');

            const { ids } = built!.index;
            expect(built!.recordLabels.types[ids.indexOf('id-satan')]).toBe(
                'supernatural',
            );
        });
    });
});

describe('building the needles file for a translated bible', () => {
    beforeEach(() => {
        h.lookupDataMap.km = {
            namesMap: {
                namesMap: {
                    'id-abram': {
                        id: 'id-abram',
                        name: '✝✝✝☼',
                        // A second spelling the text may use instead.
                        oldName: '✝✝✝☘',
                    },
                    // Unknown to the English pass, so no id was ever minted for
                    // it and nothing could reference it.
                    'id-only-khmer': { id: 'id-only-khmer', name: '✝✝✝☀' },
                },
            },
            locationsMap: {
                locationsMap: [
                    {
                        id: 'id-haran',
                        // A translated package leaves the disambiguator in
                        // English around the translated name.
                        name: '✝✝✝♥ in ✝✝✝⚑',
                    },
                ],
            },
        };
    });

    test('writes one entry per record, aligned to the English ids', async () => {
        const built = await buildLookupTextIndex('en');
        const { ids } = built!.index;

        const needles = await buildLookupTextNeedles('km', ids);

        expect(needles!.needles).toHaveLength(ids.length);
        // Covered by the translation.
        expect(needles!.needles[ids.indexOf('id-abram')]).toBe(
            ['✝✝✝☼', '✝✝✝☘'].join(NEEDLE_SEPARATOR),
        );
        // Not covered, and still written so the array cannot mis-index.
        expect(needles!.needles[ids.indexOf('id-satan')]).toBe('');
    });

    test('a name carrying an English disambiguator also yields the bare name', async () => {
        const built = await buildLookupTextIndex('en');
        const { ids } = built!.index;

        const needles = await buildLookupTextNeedles('km', ids);

        expect(
            needles!.needles[ids.indexOf('id-haran')].split(NEEDLE_SEPARATOR),
        ).toStrictEqual(['✝✝✝♥ in ✝✝✝⚑', '✝✝✝♥']);
    });

    test('reads exactly one package and never the English one', async () => {
        const built = await buildLookupTextIndex('en');
        h.readLangCodes = [];

        await buildLookupTextNeedles('km', built!.index.ids);

        expect(h.readLangCodes).toStrictEqual(['km']);
    });

    test('gives up when that language ships no dataset', async () => {
        expect(await buildLookupTextNeedles('fr', ['id-abram'])).toBeNull();
    });
});

describe('records the builder skips or reshapes', () => {
    const longTitle = 'word '.repeat(30);

    function genOddEnglishData() {
        return {
            namesMap: {
                namesMap: {
                    // A label carrying a disambiguator scripture never spells.
                    'id-elhanan': {
                        id: 'id-elhanan',
                        name: 'Elhanan son of Dodo',
                        title: '   ',
                        type: 'person',
                    },
                    // A blank name still has its old one; neither title nor
                    // type is a string.
                    'id-blank': {
                        id: 'id-blank',
                        name: '   ',
                        oldName: 'Joshua',
                        title: 42,
                        type: 7,
                    },
                    // No id at all: nothing can be interned for it.
                    'no-id': { name: 'Nameless', title: 'Lost' },
                    'id-long': {
                        id: 'id-long',
                        name: 'Long',
                        title: longTitle,
                    },
                },
                versePersonsMap: {
                    'GEN 1:1': [],
                    'GEN 1:2': 'id-elhanan',
                    'GEN 1:3': ['id-long'],
                },
            },
            // A dataset version with no verse map for places.
            locationsMap: { locationsMap: [] },
        };
    }

    test('the English pass interns only usable records and trims long titles', async () => {
        h.lookupDataMap = { en: genOddEnglishData() };

        const built = await buildLookupTextIndex('en');

        expect(built!.index).toMatchObject({
            ids: ['id-elhanan', 'id-blank', 'id-long'],
            names: {
                'elhanan son of dodo': [0],
                elhanan: [0],
                joshua: [1],
                long: [2],
            },
            locations: {},
            // The empty and the malformed verse entries are dropped.
            verseNames: { 'GEN 1:3': [2] },
            verseLocations: {},
        });
        expect(built!.recordLabels).toMatchObject({
            labels: ['Elhanan son of Dodo', '   ', 'Long'],
            types: ['person', '', ''],
            titles: ['', '', Array(24).fill('word').join(' ') + '...'],
            kjvNames: ['', '', ''],
        });
    });

    test('a selected language with no dataset leaves the English labels', async () => {
        const built = await buildLookupTextIndex('fr');

        expect(h.readLangCodes).toStrictEqual(['en']);
        expect(built!.index.ids).toStrictEqual([
            'id-abram',
            'id-satan',
            'id-haran',
        ]);
        expect(built!.recordLabels.labels).toStrictEqual([
            'Abram',
            'Satan',
            'Haran',
        ]);
        expect(built!.recordLabels.kjvNames).toStrictEqual(['', '', '']);
    });

    test('a translated record without an id relabels nothing', async () => {
        h.lookupDataMap.km = {
            namesMap: {
                namesMap: {
                    'no-id': { name: '✝✝✝☁', title: '✝✝✝☁' },
                    'id-abram': { id: 'id-abram', name: '✝✝✝✝', title: '' },
                },
            },
            locationsMap: { locationsMap: [{ name: '✝✝✝♥' }] },
        };

        const built = await buildLookupTextIndex('km');
        const { ids } = built!.index;

        expect(built!.recordLabels.labels[ids.indexOf('id-abram')]).toBe(
            '✝✝✝✝',
        );
        expect(built!.recordLabels.kjvNames[ids.indexOf('id-abram')]).toBe(
            'Abram',
        );
        // The untitled translation keeps the English title.
        expect(built!.recordLabels.titles[ids.indexOf('id-abram')]).toBe(
            'Father of many nations',
        );
        expect(built!.recordLabels.labels[ids.indexOf('id-haran')]).toBe(
            'Haran',
        );
    });

    test('the needles skip a record without an id and a name of only invisible marks', async () => {
        h.lookupDataMap.km = {
            namesMap: {
                namesMap: {
                    ghost: { name: '✝✝✝☠' },
                    'id-abram': {
                        id: 'id-abram',
                        name: '​‌',
                        oldName: '✝✝✝✝',
                    },
                },
            },
            locationsMap: { locationsMap: [] },
        };

        const needles = await buildLookupTextNeedles('km', [
            'id-abram',
            'id-haran',
        ]);

        expect(needles!.needles).toStrictEqual(['✝✝✝✝', '']);
    });
});
