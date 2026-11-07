import { describe, expect, it } from 'vitest';
import {
    readLookupAskContext,
    readLookupCountAsk,
    readLookupWordStudyAsk,
    toLookupQuestion,
    toLookupRecordTurn,
    toLookupAsk,
    type LookupSubjectType,
} from '../../../../../../chatbot/lookupChatHelpers';

describe('the record at the head of the conversation', () => {
    // Noah's card read on the KJV, asked in French (2026-10-29): its verses
    // go to the Louis Segond, said under the QUESTION -- the record turn a
    // server keeps is left as it was.
    it('sends a person’s verses to a Bible in the answer’s language', () => {
        const noah: LookupSubjectType = {
            kind: 'name',
            target: 'noah',
            title: 'Noé',
            facts: JSON.stringify({ kind: 'name', bible: 'KJV', name: 'Noah' }),
        };
        const turn = toLookupRecordTurn(noah);
        const question = toLookupQuestion('taille ?', noah, '', 'LSG');
        expect(question).toContain('Quote verses from the Bible "LSG"');
        expect(question).toContain('the record\'s own words are "KJV"\'s.');
        expect(toLookupRecordTurn(noah)).toBe(turn);
        expect(toLookupAsk('taille ?', noah, '', 'LSG')).toContain(
            'Quote verses from the Bible "LSG"',
        );
        expect(toLookupQuestion('taille ?', noah)).not.toContain('Quote');
    });
});

// A passage card and a person's card, in French.
const GEN_8: LookupSubjectType = {
    kind: 'verse',
    target: 'GEN 8:1-22',
    title: 'Genèse 8:1-22',
    bibleKey: 'LSG',
    facts: JSON.stringify({
        kind: 'verse',
        around: {
            before: { key: 'GEN 7:1-24', title: 'Genèse 7:1-24' },
            after: { key: 'GEN 9:1-29', title: 'Genèse 9:1-29' },
        },
    }),
};
const DAVID_FR: LookupSubjectType = {
    kind: 'name',
    target: 'david',
    title: 'David',
    langCode: 'fr',
    facts: JSON.stringify({ kind: 'name', kjvName: 'David' }),
};

describe('a line under a card, asked in French', () => {
    it('reads who and which places are in it', () => {
        expect(
            readLookupAskContext('Quels lieux sont nommés ici ?', GEN_8)
                ?.isNames,
        ).toBe(true);
    });

    it('counts from the record in the words French uses', () => {
        expect(
            readLookupCountAsk('combien d’enfants avait-il ?', DAVID_FR),
        ).toBe('children');
        expect(
            readLookupCountAsk('combien de frères et sœurs ?', DAVID_FR),
        ).toBe('siblings');
    });

    it('reads a study of the words, and the verse named', () => {
        expect(
            readLookupWordStudyAsk('Explique chaque mot du verset 3', GEN_8),
        ).toEqual({ verseKey: 'GEN 8:3' });
    });
});
