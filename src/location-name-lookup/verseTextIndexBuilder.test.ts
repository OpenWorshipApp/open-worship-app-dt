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
                            name: 'អ័ប្រាម',
                            title: 'ឪពុករបស់ជាតិសាសន៍ជាច្រើន',
                            type: 'person',
                        },
                        // Present here, unknown to English: nothing can ever
                        // reference it, so it must not reach the sidecar.
                        'id-only-khmer': {
                            id: 'id-only-khmer',
                            name: 'តែខ្មែរ',
                            title: '',
                            type: 'person',
                        },
                    },
                },
                locationsMap: {
                    locationsMap: [
                        {
                            id: 'id-haran',
                            name: 'ហារ៉ាន',
                            title: 'ក្រុងមួយក្នុងស្រុកមេសូប៉ូតាមា',
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
                'អ័ប្រាម',
            );
            expect(built!.recordLabels.labels[ids.indexOf('id-haran')]).toBe(
                'ហារ៉ាន',
            );
            expect(built!.recordLabels.titles[ids.indexOf('id-abram')]).toBe(
                'ឪពុករបស់ជាតិសាសន៍ជាច្រើន',
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
            expect(built!.recordLabels.labels).not.toContain('តែខ្មែរ');
            expect(built!.recordLabels.labels).toHaveLength(
                built!.index.ids.length,
            );
        });

        // Shown beside the translated label the way a bible book reads
        // `លោកុប្បត្តិ (Genesis)`.
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
                        name: 'អឰប្រាម',
                        // A second spelling the text may use instead.
                        oldName: 'អឰប្រហា្ម',
                    },
                    // Unknown to the English pass, so no id was ever minted for
                    // it and nothing could reference it.
                    'id-only-khmer': { id: 'id-only-khmer', name: 'តែខ្មែរ' },
                },
            },
            locationsMap: {
                locationsMap: [
                    {
                        id: 'id-haran',
                        // A translated package leaves the disambiguator in
                        // English around the translated name.
                        name: 'ហារ៉ាន in មេសូប៉ូតាមា',
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
            ['អឰប្រាម', 'អឰប្រហា្ម'].join(NEEDLE_SEPARATOR),
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
        ).toStrictEqual(['ហារ៉ាន in មេសូប៉ូតាមា', 'ហារ៉ាន']);
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
