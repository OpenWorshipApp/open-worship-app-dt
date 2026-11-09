import { describe, expect, it } from 'vitest';
import {
    MAX_LOOKUP_FACTS_CHARS,
    checkLineageNamesSubject,
    fitLookupFacts,
    genLookupOfflineText,
    genLookupOpeningAnswer,
    readLookupVerseAsk,
    toLookupStudyFilesArgs,
    toLookupSubject,
    toValidLookupSubject,
    withLookupStudyFiles,
    type LookupSubjectType,
} from './lookupChatHelpers';
import { listAssistantLanguages } from './chatLangHelpers';

const VERSE_EN: LookupSubjectType = {
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
                ref: 'Matthew 18:1-14',
                text:
                    'At the same time came the disciples unto Jesus, ' +
                    'saying, Who is the greatest in the kingdom of heaven? ' +
                    'And Jesus called a little child unto him, and set him ' +
                    'in the midst of them.',
            },
        ],
    }),
};

describe('the record a conversation is about', () => {
    it('keeps what the tool read, bounded', () => {
        const subject = toLookupSubject(
            { kind: 'verse', target: 'JHN 3:16', title: 'John 3:16' },
            `  ${'x'.repeat(MAX_LOOKUP_FACTS_CHARS + 50)}  `,
        );
        expect(subject.facts).toHaveLength(MAX_LOOKUP_FACTS_CHARS);
        expect(
            toLookupSubject(
                { kind: 'verse', target: 'JHN 3:16', title: 'John 3:16' },
                null,
            ).facts,
        ).toBe('');
    });
});

describe('what the card itself can do', () => {
    it('tells English from every other language by its own words', () => {
        expect(
            readLookupVerseAsk('show this passage in English', VERSE_EN),
        ).toEqual({ kind: 'sameBible' });
        for (const { code, name } of listAssistantLanguages()) {
            if (code === 'en') {
                continue;
            }
            expect(
                readLookupVerseAsk(`show this passage in ${name}`, VERSE_EN),
            ).toEqual({ kind: 'anotherBible', language: code });
        }
    });

    // 2026-11-09, the user: _save to a bible note_ and _save the preaching
    // lesson to a file_ under Matthew 3:1-17 were both answered "Press Save
    // to my Bibles list under the passage above", and _bible note referring
    // to bible-note document_.
    it('leaves a line about a note, a file or the lesson to the conversation', () => {
        for (const line of [
            'save to a bible note',
            'save the preaching lesson to a file',
            'Save this as a note',
            'copy the passage into my notes',
            'put the next chapter in a note',
            'save your answer',
            'show the explanation in French',
        ]) {
            expect(readLookupVerseAsk(line, VERSE_EN)).toBeNull();
        }
        // The card's own Save is still the card's.
        expect(readLookupVerseAsk('save to my list', VERSE_EN)).toEqual({
            kind: 'action',
            step: 'save',
        });
        // "notes" inside another word is no note.
        expect(readLookupVerseAsk('save it, notably', VERSE_EN)).toEqual({
            kind: 'action',
            step: 'save',
        });
    });
});

describe('a record within what a card keeps', () => {
    const passage = 'In the beginning '.repeat(400);
    const big = {
        kind: 'verse',
        bible: 'KJV',
        passages: [{ key: 'GEN 1:1-31', text: passage }],
        crossRefs: {
            referenceCount: 900,
            mostCited: [{ key: 'JHN 1:1', from: ['1', '2'] }],
            byVerse: [{ verse: '1', themes: [{ theme: 'x'.repeat(9000) }] }],
        },
    };

    it('leaves a record that fits as it is', () => {
        const text = JSON.stringify({ kind: 'verse', passages: [] });
        expect(fitLookupFacts(text)).toBe(text);
    });

    it('sheds the cross references by verse first, and stays a record', () => {
        const fitted = fitLookupFacts(JSON.stringify(big));
        expect(fitted.length).toBeLessThanOrEqual(MAX_LOOKUP_FACTS_CHARS);
        const facts = JSON.parse(fitted);
        expect(facts.passages[0].text).toBe(passage);
        expect(facts.crossRefs.byVerse).toBeUndefined();
        expect(facts.crossRefs.mostCited).toEqual(big.crossRefs.mostCited);
    });

    it('drops them whole when that is not enough', () => {
        const fitted = fitLookupFacts(
            JSON.stringify({
                ...big,
                crossRefs: { ...big.crossRefs, mostCited: 'y'.repeat(12000) },
            }),
        );
        expect(JSON.parse(fitted).crossRefs).toBeUndefined();
    });

    it('a subject kept from a saved conversation is fitted the same way', () => {
        const subject = toValidLookupSubject({
            kind: 'verse',
            target: 'GEN 1:1-31',
            title: 'Genesis 1',
            facts: JSON.stringify(big),
        });
        expect(JSON.parse(subject?.facts ?? '').crossRefs.byVerse).toBe(
            undefined,
        );
    });
});

describe('the study files of a passage', () => {
    it('lists by the chapter its key names', () => {
        expect(
            toLookupStudyFilesArgs({
                kind: 'verse',
                target: 'GEN 8:1-22',
                title: 'x',
            }),
        ).toEqual({ action: 'list', book: 'GEN', chapter: 8 });
        expect(
            toLookupStudyFilesArgs({
                kind: 'verse',
                target: 'JHN 3',
                title: 'x',
            }),
        ).toEqual({ action: 'list', book: 'JHN', chapter: 3 });
        expect(
            toLookupStudyFilesArgs({ kind: 'name', target: 'id', title: 'x' }),
        ).toBeNull();
    });

    it('keeps the files the list named, each once', () => {
        const facts = JSON.stringify({ kind: 'verse', passages: [] });
        const kept = JSON.parse(
            withLookupStudyFiles(facts, {
                files: [
                    { file: 'pdf/GEN.8.pdf', kind: 'pdf' },
                    { file: 'pdf/GEN.0.pdf', kind: 'pdf' },
                    { file: 'pdf/GEN.8.pdf', kind: 'pdf' },
                    { kind: 'pdf' },
                ],
            }),
        );
        expect(kept.studyFiles).toEqual(['pdf/GEN.8.pdf', 'pdf/GEN.0.pdf']);
        // Nothing listed, or not a list: the record as it was.
        expect(withLookupStudyFiles(facts, { files: [] })).toBe(facts);
        expect(withLookupStudyFiles(facts, null)).toBe(facts);
    });
});

describe('the card it opens on', () => {
    it('asks a passage what a passage is asked', () => {
        const opening = genLookupOpeningAnswer({
            kind: 'verse',
            target: 'GEN 2:19-21',
            title: 'Genesis 2:19-21',
            facts: '{"passages":[]}',
        });
        expect(opening.text).not.toContain('King James');
        expect(opening.text).not.toContain('in the Bible');
        // What is related first: the user's goal of 2026-10-23.
        expect(opening.replies).toHaveLength(4);
        expect(opening.replies[0]).toBe(
            'Which other verses are related to this passage?',
        );
    });

    // 2026-10-23: a reader is told what else the card gathered.
    it('says what the card gathered for a passage', () => {
        const opening = genLookupOpeningAnswer({
            kind: 'verse',
            target: 'GEN 8:1-22',
            title: 'Genesis 8:1-22',
            facts: JSON.stringify({
                kind: 'verse',
                passages: [],
                crossRefs: { referenceCount: 1180 },
                studyFiles: ['pdf/GEN.8.pdf', 'pdf/GEN.0.pdf'],
            }),
        });
        expect(opening.text).toContain(
            "The app's cross references lead from it to 1180 other verses.",
        );
        expect(opening.text).toContain(
            'Resources has 2 study files for its chapter.',
        );
        // No notes of the person's own: no line and no question about them.
        expect(opening.text).not.toContain('of your own');
        expect(opening.replies[0]).toBe(
            'Which other verses are related to this passage?',
        );
    });

    // 2026-10-23: the person's own notes and marks on the passage.
    it('says when the person has notes on the passage, and asks first', () => {
        const opening = genLookupOpeningAnswer({
            kind: 'verse',
            target: 'GEN 8:1-22',
            title: 'Genesis 8:1-22',
            facts: JSON.stringify({
                kind: 'verse',
                passages: [],
                yourNotes: { verseCount: 3, noteCount: 1, notes: [] },
            }),
        });
        expect(opening.text).toContain(
            'You have notes or marks of your own on 3 of its verses.',
        );
        expect(opening.replies.slice(0, 2)).toEqual([
            'What did I note on these verses?',
            'Which other verses are related to this passage?',
        ]);
    });
});

describe('the family line to Jesus', () => {
    it('finds the person in a genealogy under any of its names', () => {
        // Luke 3:36 in the KJV: Noah is Noe there.
        const passage = {
            key: 'LUK 3:23-38',
            ref: 'Luke 3:23-38',
            title: null,
            text: 'Which was the son of Sem, which was the son of Noe',
        };
        const noah = {
            title: 'Noah',
            facts: JSON.stringify({
                name: 'Noah',
                otherForms: [{ id: 'noe', name: 'Noe' }],
            }),
        };
        expect(checkLineageNamesSubject(passage, noah)).toBe(true);
        expect(
            checkLineageNamesSubject(passage, {
                title: 'Noah',
                facts: '{"name":"Noah"}',
            }),
        ).toBe(false);
    });
});

describe('with no assistant to ask', () => {
    it('quotes a passage', () => {
        const text = genLookupOfflineText({
            kind: 'verse',
            target: 'JHN 3:16',
            title: 'John 3:16',
            facts: JSON.stringify({
                passages: [{ ref: 'John 3:16', text: 'For God so loved' }],
            }),
        });
        expect(text).toContain('**John 3:16**\nFor God so loved');
    });
});
