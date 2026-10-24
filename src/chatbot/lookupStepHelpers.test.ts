import { describe, expect, it } from 'vitest';

import {
    LOOKUP_STEP_TOOL_NAME,
    checkIsOneVerse,
    genBiblesAnswer,
    genCrossRefsAnswer,
    genLookupActions,
    genLookupAnswerActions,
    genNamesAnswer,
    genRelatedAnswer,
    genStudyFilesAnswer,
    genVersesAnswer,
    listLookupRelated,
    readLookupFacts,
    toPassageAsk,
    toLookupMapUrl,
    toPassageCopyText,
    toValidLookupStep,
} from './lookupStepHelpers';

const PASSAGE = {
    kind: 'verse' as const,
    target: 'GEN 4:1-26',
    title: 'Genesis 4:1-26',
    bibleKey: 'KJV',
    page: 'https://localhost:3000/reader.html',
};

const ADAM = {
    kind: 'name' as const,
    target: 'adam',
    title: 'អ័ដាម',
    langCode: 'km',
};

const ADAM_FACTS = {
    verseCount: 17,
    bible: 'ពគប',
    spouses: [{ id: 'eve', name: 'អេវ៉ា', kjvName: 'Eve' }],
    children: [
        { id: 'cain', name: 'កាអ៊ីន', kjvName: 'Cain' },
        { name: 'unknown' },
    ],
    places: [{ id: 'eden', name: 'សួនច្បារអេដែន', kjvName: 'Garden of Eden' }],
    quoted: [
        {
            key: 'GEN 2:19-21',
            ref: 'Genesis 2:19-21',
            title: 'លោកុប្បត្តិ ២:១៩-២១',
        },
        { key: 'GEN 2:23', ref: 'Genesis 2:23' },
    ],
};

function toLabels(actions: { label: string }[]) {
    return actions.map((action) => action.label);
}

describe('what a passage can be asked to do', () => {
    it('offers everything on its card, chapters for a passage', () => {
        const actions = genLookupActions(PASSAGE, null);
        expect(toLabels(actions)).toEqual([
            'Open in bible lookup',
            'Previous chapter',
            'Next chapter',
            'Read it in another Bible',
            'Who and where is in it',
            'Open another passage',
            'Save to my Bibles list',
            'Copy the passage',
        ]);
        expect(actions[2]).toEqual({
            label: 'Next chapter',
            toolName: LOOKUP_STEP_TOOL_NAME,
            args: { step: 'near', ask: PASSAGE, near: 'next' },
        });
    });

    // 2026-10-23: what the card gathered comes first, when there is any.
    it('offers what the card gathered, first', () => {
        const actions = genLookupActions(PASSAGE, {
            crossRefs: { referenceCount: 40 },
            studyFiles: ['pdf/GEN.4.pdf'],
        });
        expect(toLabels(actions).slice(0, 3)).toEqual([
            'Related verses',
            'Study files for this chapter',
            'Open in bible lookup',
        ]);
        expect(actions[0].args).toEqual({ step: 'crossrefs', ask: PASSAGE });
        expect(
            toLabels(
                genLookupActions(PASSAGE, {
                    crossRefs: { referenceCount: 0 },
                    studyFiles: [],
                }),
            )[0],
        ).toBe('Open in bible lookup');
        expect(toValidLookupStep({ step: 'crossrefs', ask: PASSAGE })).toEqual({
            step: 'crossrefs',
            ask: PASSAGE,
        });
    });

    it('steps verse by verse from one verse', () => {
        expect(checkIsOneVerse('GEN 4:6')).toBe(true);
        expect(checkIsOneVerse('GEN 4:1-26')).toBe(false);
        expect(
            toLabels(genLookupAnswerActions({ ...PASSAGE, target: 'GEN 4:6' })),
        ).toEqual(['Previous verse', 'Next verse', 'More things to do']);
    });

    // A button is stored with the conversation: it carries the record's
    // identity and never the words read of it.
    it('carries the record, never its facts', () => {
        const [action] = genLookupAnswerActions({
            ...PASSAGE,
            facts: 'x'.repeat(5000),
        } as any);
        expect(action.args.ask).toEqual(PASSAGE);
    });

    it('becomes the passage a read came back with', () => {
        expect(
            toPassageAsk(PASSAGE, {
                bible: 'ពគប',
                passages: [
                    {
                        key: 'GEN 5:1-32',
                        ref: 'Genesis 5:1-32',
                        title: 'លោកុប្បត្តិ ៥:១-៣២',
                    },
                ],
            }),
        ).toEqual({
            kind: 'verse',
            target: 'GEN 5:1-32',
            title: 'លោកុប្បត្តិ ៥:១-៣២',
            bibleKey: 'ពគប',
            page: PASSAGE.page,
        });
        expect(toPassageAsk(PASSAGE, { passages: [] })).toBeNull();
    });

    it('copies its words with their Bible', () => {
        expect(
            toPassageCopyText({
                bible: 'KJV',
                passages: [{ ref: 'John 3:16', text: 'For God so loved' }],
            }),
        ).toBe('(KJV) John 3:16\nFor God so loved');
        expect(toPassageCopyText(null)).toBeNull();
    });
});

describe('what a person or a place can be asked to do', () => {
    it('offers its verses, its family and places, another Bible', () => {
        expect(toLabels(genLookupActions(ADAM, ADAM_FACTS))).toEqual([
            'Its verses',
            'Family and places',
            'Family line to Jesus',
            'Read it in another Bible',
        ]);
        expect(
            toLabels(
                genLookupActions(
                    { ...ADAM, kind: 'location' },
                    { verseCount: 0, relatedPlaces: [{ id: 'h', name: 'H' }] },
                ),
            ),
        ).toEqual(['Related places']);
        // A place with a point opens on a map; a person never does, and a
        // region with no point has no such button (2026-10-22).
        const bethlehem = { ...ADAM, kind: 'location' as const };
        const mapAction = genLookupActions(bethlehem, {
            verseCount: 0,
            coordinates: { latitude: 31.704928, longitude: 35.201605 },
        }).find((action) => {
            return action.args.step === 'map';
        });
        expect(mapAction?.label).toBe('Show it on a map');
        expect(mapAction?.toolName).toBe(LOOKUP_STEP_TOOL_NAME);
        expect(
            genLookupActions(ADAM, {
                ...ADAM_FACTS,
                coordinates: { latitude: 31.7, longitude: 35.2 },
            }).some((action) => {
                return action.args.step === 'map';
            }),
        ).toBe(false);
        expect(
            toLookupMapUrl({
                coordinates: { latitude: 31.704928, longitude: 35.201605 },
            }),
        ).toBe(
            'https://www.google.com/maps/search/?api=1&query=31.704928%2C35.201605',
        );
        expect(toLookupMapUrl({ coordinates: null })).toBeNull();
        expect(
            toLookupMapUrl({ coordinates: { latitude: 'x', longitude: 1 } }),
        ).toBeNull();
        expect(
            toLookupMapUrl({ coordinates: { latitude: 99, longitude: 1 } }),
        ).toBeNull();
        expect(toValidLookupStep({ step: 'map', ask: bethlehem })?.step).toBe(
            'map',
        );
        expect(genLookupActions(ADAM, null)).toEqual([]);
        expect(toLabels(genLookupAnswerActions(ADAM))).toEqual([
            'More things to do',
        ]);
    });

    it('names its family and places, once each, a button each', () => {
        expect(listLookupRelated(ADAM_FACTS)).toEqual([
            { kind: 'name', id: 'eve', name: 'អេវ៉ា', kjvName: 'Eve' },
            { kind: 'name', id: 'cain', name: 'កាអ៊ីន', kjvName: 'Cain' },
            {
                kind: 'location',
                id: 'eden',
                name: 'សួនច្បារអេដែន',
                kjvName: 'Garden of Eden',
            },
        ]);
        const answer = genRelatedAnswer(ADAM, ADAM_FACTS);
        expect(answer.text).toContain('អ័ដាម');
        expect(answer.actions[0]).toEqual({
            label: 'អេវ៉ា (Eve)',
            toolName: LOOKUP_STEP_TOOL_NAME,
            args: {
                step: 'open',
                ask: {
                    kind: 'name',
                    target: 'eve',
                    title: 'អេវ៉ា',
                    langCode: 'km',
                },
            },
        });
        expect(answer.actions[2].args.ask.kind).toBe('location');
        expect(genRelatedAnswer(ADAM, {}).actions).toEqual([]);
    });

    it('lists the verses it quotes, in the Bible it quoted them from', () => {
        const answer = genVersesAnswer(ADAM, ADAM_FACTS);
        expect(toLabels(answer.actions)).toEqual([
            'លោកុប្បត្តិ ២:១៩-២១',
            'Genesis 2:23',
        ]);
        expect(answer.actions[0].args.ask).toEqual({
            kind: 'verse',
            target: 'GEN 2:19-21',
            title: 'លោកុប្បត្តិ ២:១៩-២១',
            bibleKey: 'ពគប',
        });
        expect(answer.text).toContain('17');
        expect(genVersesAnswer(ADAM, {}).actions).toEqual([]);
    });
});

describe('what the card gathered for a passage', () => {
    const GEN_8 = {
        ...PASSAGE,
        target: 'GEN 8:1-22',
        title: 'លោកុប្បត្តិ ៨:១-២២',
        bibleKey: 'ពគប',
    };
    const FACTS = {
        bible: 'ពគប',
        crossRefs: {
            referenceCount: 1180,
            mostCited: [
                {
                    key: 'GEN 9:15',
                    title: 'លោកុប្បត្តិ ៩:១៥',
                    from: ['1', '21', '22'],
                },
                { key: 'ISA 54:9', from: ['21', '22'] },
                {
                    key: 'GEN 9:1',
                    from: ['1', '5', '11', '12', '13', '14'],
                    fromCount: 11,
                },
                { key: 'HEB 11:7', title: 'ហេព្រើរ ១១:៧', from: ['1'] },
            ],
            otherTestamentName: 'New Testament',
            otherTestament: [
                { key: 'HEB 11:7', title: 'ហេព្រើរ ១១:៧', from: ['1'] },
            ],
            otherTestamentAround: [
                {
                    key: 'MAT 24:37-39',
                    title: 'ម៉ាថាយ ២៤:៣៧-៣៩',
                    from: ['6:5', '7:1'],
                },
            ],
            byVerse: [
                {
                    verse: '1',
                    themes: [
                        { theme: 'ព្រះចងចាំប្រជាជនរបស់ទ្រង់', refs: [] },
                        { theme: 'ការគ្រប់គ្រងលើខ្យល់', refs: [] },
                    ],
                },
            ],
        },
    };

    it('tells the cross references with a button for each verse named', () => {
        const answer = genCrossRefsAnswer(GEN_8, FACTS);
        expect(answer.text).toContain('to 1180 other verses');
        expect(answer.text).toContain(
            '- **លោកុប្បត្តិ ៩:១៥** (verses 1, 21, 22)',
        );
        // A reference with no title is named by its key.
        expect(answer.text).toContain('- **ISA 54:9** (verses 21, 22)');
        // Past three verses, counted.
        // Counted by the record's own count, past the six it names.
        expect(answer.text).toContain('- **GEN 9:1** (11 of its verses)');
        // Told once, in the other Testament's list.
        expect(answer.text.split('ហេព្រើរ ១១:៧')).toHaveLength(2);
        // The rest of the story, named by where around it they come from.
        expect(answer.text).toContain(
            '**In the New Testament, about the chapters around it**\n' +
                '- **ម៉ាថាយ ២៤:៣៧-៣៩** (verses 6:5, 7:1)',
        );
        expect(answer.text).toContain('**In the New Testament**');
        expect(answer.text).toContain(
            '- Verse 1: ព្រះចងចាំប្រជាជនរបស់ទ្រង់; ការគ្រប់គ្រងលើខ្យល់',
        );
        // Each once, opened in the passage's Bible and window.
        expect(toLabels(answer.actions)).toEqual([
            'លោកុប្បត្តិ ៩:១៥',
            'ISA 54:9',
            'GEN 9:1',
            'ហេព្រើរ ១១:៧',
            'ម៉ាថាយ ២៤:៣៧-៣៩',
        ]);
        expect(answer.actions[3].args).toEqual({
            step: 'open',
            ask: {
                kind: 'verse',
                target: 'HEB 11:7',
                title: 'ហេព្រើរ ១១:៧',
                bibleKey: 'ពគប',
                page: PASSAGE.page,
            },
        });
    });

    it('says so when the cross references have nothing', () => {
        const answer = genCrossRefsAnswer(GEN_8, { crossRefs: null });
        expect(answer.text).toContain('have nothing for');
        expect(answer.actions).toEqual([]);
    });

    it('lists the study files with Ask about for each', () => {
        const answer = genStudyFilesAnswer(GEN_8, {
            studyFiles: ['pdf/GEN.8.pdf', 'pdf/GEN.0.pdf'],
        });
        expect(answer.text).toContain('- GEN.8.pdf');
        expect(answer.actions[0]).toEqual({
            label: 'Ask about GEN.8.pdf',
            toolName: 'resource-ask',
            args: { file: 'pdf/GEN.8.pdf' },
        });
        expect(genStudyFilesAnswer(GEN_8, {}).actions).toEqual([]);
    });
});

describe('the lists a step answers with', () => {
    it('names the people and places in a passage, in the lookup language', () => {
        const answer = genNamesAnswer(PASSAGE, {
            lang: 'km',
            people: [
                {
                    id: 'cain',
                    name: 'កាអ៊ីន',
                    kjvName: 'Cain',
                    verses: ['4:1'],
                },
            ],
            places: [{ id: 'nod', name: 'ណូឌ' }],
        });
        expect(toLabels(answer.actions)).toEqual(['កាអ៊ីន (Cain)', 'ណូឌ']);
        expect(answer.actions[0].args.ask.langCode).toBe('km');
        expect(answer.actions[1].args.ask.kind).toBe('location');
        expect(genNamesAnswer(PASSAGE, {}).actions).toEqual([]);
    });

    it('lists every other Bible, and says when there is none', () => {
        const answer = genBiblesAnswer(PASSAGE, {
            bibles: [
                { key: 'KJV', title: 'King James Version' },
                { key: 'ពគប', title: 'ព្រះគម្ពីរបរិសុទ្ធ' },
            ],
        });
        expect(toLabels(answer.actions)).toEqual(['ពគប — ព្រះគម្ពីរបរិសុទ្ធ']);
        expect(answer.actions[0].args).toEqual({
            step: 'open',
            ask: { ...PASSAGE, bibleKey: 'ពគប' },
        });
        expect(genBiblesAnswer(PASSAGE, { bibles: [{ key: 'KJV' }] })).toEqual({
            text: 'This is the only Bible on this computer.',
            actions: [],
        });
    });

    it('keeps the Bibles in a language the person named', () => {
        const listed = {
            bibles: [
                { key: 'KJV', title: 'King James Version' },
                { key: 'NIV', title: 'English NIV' },
                { key: 'GKHB', title: 'Khmer 2019 (ព្រះគម្ពីរខ្មែរសាកល)' },
                { key: 'KCB', title: 'Khmer 2012 (Khmer Christian Bible)' },
                { key: 'BDS', title: 'French (BDS) 2015' },
            ],
        };
        expect(
            toLabels(genBiblesAnswer(PASSAGE, listed, 'km').actions),
        ).toEqual([
            'GKHB — Khmer 2019 (ព្រះគម្ពីរខ្មែរសាកល)',
            'KCB — Khmer 2012 (Khmer Christian Bible)',
        ]);
        expect(
            toLabels(genBiblesAnswer(PASSAGE, listed, 'fr').actions),
        ).toEqual(['BDS — French (BDS) 2015']);
        expect(
            toLabels(genBiblesAnswer(PASSAGE, listed, 'en').actions),
        ).toEqual(['NIV — English NIV']);
    });
});

describe('a step pressed off a saved conversation', () => {
    it('is trusted only as its listed fields', () => {
        expect(
            toValidLookupStep({ step: 'near', near: 'next', ask: PASSAGE }),
        ).toEqual({ step: 'near', near: 'next', ask: PASSAGE });
        expect(toValidLookupStep({ step: 'near', ask: PASSAGE })).toBeNull();
        expect(toValidLookupStep({ step: 'delete', ask: PASSAGE })).toBeNull();
        expect(toValidLookupStep({ step: 'open', ask: {} })).toBeNull();
        expect(readLookupFacts('not json')).toBeNull();
        expect(readLookupFacts('{"a":1}')).toEqual({ a: 1 });
    });
});
