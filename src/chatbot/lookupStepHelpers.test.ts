import { describe, expect, it } from 'vitest';

import {
    LOOKUP_STEP_TOOL_NAME,
    checkIsOneVerse,
    genBiblesAnswer,
    genLookupActions,
    genLookupAnswerActions,
    genNamesAnswer,
    genRelatedAnswer,
    genVersesAnswer,
    listLookupRelated,
    readLookupFacts,
    toPassageAsk,
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
