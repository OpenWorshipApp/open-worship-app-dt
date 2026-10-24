import { describe, expect, it } from 'vitest';

import {
    BIBLE_FIND_MANUAL_ID,
    genBibleFindAdvice,
    genBibleFindLead,
    genBibleKnowledgeText,
    readBibleContentAsk,
} from './bibleContentAskHelpers';

// The supported questions, read the way the help window reads them.
const QUESTION_PAGE_MAP = import.meta.glob(
    [
        '../../tools/owa-devtools-mcp/questions/*.json',
        '!../../tools/owa-devtools-mcp/questions/schema.json',
    ],
    { eager: true, import: 'default' },
) as Record<string, { sections: { questions: { text: string }[] }[] }>;

const SUPPORTED_QUESTION_LIST = Object.values(QUESTION_PAGE_MAP).flatMap(
    (page) => {
        return page.sections.flatMap((section) => {
            return section.questions.map((question) => {
                return question.text;
            });
        });
    },
);

// "what bible verse talk about lover your enemy?" was answered with the page
// about keeping files beside a verse, and "what are names of 7 churches
// mentioned in the book of revelation in holy bible" with the one about adding
// a Bible from the internet (EC-199).
describe('a question about what the Bible says', () => {
    it('reads a verse asked for by what it says, and keeps the words', () => {
        for (const [asked, words] of [
            [
                'what bible verse talk about lover your enemy?',
                'lover your enemy',
            ],
            [
                'which verse says do not worry about tomorrow',
                'do not worry about tomorrow',
            ],
            ['where in the bible does it say god is love', 'god is love'],
            ['What does the Bible say about forgiveness?', 'forgiveness'],
            ['verses about hope', 'hope'],
            ['Is there a verse about anger?', 'anger'],
            ['Find me a verse about patience', 'patience'],
            // A story by its name (EC-389): it went to the general
            // assistant, and in Khmer named a book the Bible lacks.
            [
                'where in the bible is the story of the flood?',
                'story of the flood',
            ],
            [
                'Where can I find the parable of the sower in the Bible?',
                'parable of the sower',
            ],
            ['show me the story of Jonah', 'story of Jonah'],
        ]) {
            expect(readBibleContentAsk(asked), asked).toEqual({
                kind: 'verse',
                words,
            });
        }
    });

    it('reads knowledge about the Bible that nothing in the app answers', () => {
        for (const asked of [
            'what are names of 7 churches mentioned in the book of revelation in holy bible',
            'who wrote the book of psalms',
            'how many books are in the bible',
            'what is the shortest verse in the bible',
            'what is the holy bible',
            'when was jesus born',
        ]) {
            expect(readBibleContentAsk(asked), asked).toEqual({
                kind: 'knowledge',
            });
        }
    });

    // The people and places lookup answers a name; the screen is the
    // Presenter's; a reference is the verse readers'; and what is open is the
    // app's own state.
    it('leaves what the app answers alone', () => {
        for (const asked of [
            'who was moses',
            'where is bethlehem',
            'who was the father of king david',
            'show me a verse about love on the screen',
            'What does John 3:16 say?',
            'How do I find a verse about love?',
            'What verse is this?',
            'what verses are in my list',
            'what verse is on the screen',
            'which bible version is best',
            'Who and where is named in the passage I am reading?',
            '',
        ]) {
            expect(readBibleContentAsk(asked), asked).toBeNull();
        }
    });

    // The reading must never turn a supported question into a refusal.
    it('takes none of the questions the app is prepared to be asked', () => {
        // The whole list, not an empty one read wrong.
        expect(SUPPORTED_QUESTION_LIST.length).toBeGreaterThan(400);
        const taken = SUPPORTED_QUESTION_LIST.filter((text) => {
            return readBibleContentAsk(text) !== null;
        });
        expect(taken).toEqual([]);
    });

    it('says what to search for, and how to ask an assistant', () => {
        expect(genBibleFindLead('god is love')).toContain(
            'Search for “god is love”',
        );
        expect(genBibleFindLead('god is love')).toContain('**Bible Find**');
        const knowledge = genBibleKnowledgeText(
            'who wrote the book of psalms? ',
        );
        expect(knowledge).toContain('/btw who wrote the book of psalms? —');
        // Under `/help` an assistant may be answering: it is not said that
        // none is.
        expect(knowledge).not.toMatch(/none could/);
    });
});

describe('the line under an assistant’s answer', () => {
    it('names Bible Find under a verse asked for by what it says', () => {
        const advice = genBibleFindAdvice(
            'what bible verse talk about lover your enemy?',
            'Type /btw before your question and I will answer it.',
            [],
        );
        expect(advice).toContain('**Bible Find**');
        expect(advice).toContain('try “lover your enemy”');
    });

    it('says nothing twice, and nothing under another question', () => {
        expect(
            genBibleFindAdvice(
                'which verse says do not worry',
                'Open Bible Find and type the words.',
                [],
            ),
        ).toBeNull();
        expect(
            genBibleFindAdvice(
                'which verse says do not worry',
                'Here is how.',
                [BIBLE_FIND_MANUAL_ID],
            ),
        ).toBeNull();
        expect(
            genBibleFindAdvice('who wrote the book of psalms', 'Use /btw.', []),
        ).toBeNull();
        expect(
            genBibleFindAdvice('How do I look up a verse?', 'Click it.', []),
        ).toBeNull();
    });
});
