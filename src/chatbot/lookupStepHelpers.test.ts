import { describe, expect, it } from 'vitest';

import {
    LOOKUP_STEP_TOOL_NAME,
    checkIsOneVerse,
    genLookupActions,
    genLookupAnswerActions,
    readLookupFacts,
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
