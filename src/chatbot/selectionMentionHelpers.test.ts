import { describe, expect, it } from 'vitest';

import {
    SELECTION_ACTION_LABEL_LIST,
    SELECTION_STEP_TOOL_NAME,
    appendSelectionMention,
    checkHasSelectionQuote,
    genSelectionOffer,
    pickSelectionSession,
    toSelectionMentionText,
    toSelectionSearchUrl,
    toSelectionStepAsk,
    toValidSelectionStep,
} from './selectionMentionHelpers';

function genMention(fields: {
    text: string;
    before?: string;
    after?: string;
    start?: number | null;
    end?: number | null;
}) {
    return {
        before: '',
        after: '',
        start: null,
        end: null,
        ...fields,
    };
}

// 2026-11-08, the user: _select bible note text then click the agent button
// then writing a qustion about the selected text_, and _should provide
// selection range in the input text for enough context, for bible should
// include selection range among bible verse_.
describe('the quote put in the box', () => {
    it('marks the words in their verse and says where they are', () => {
        expect(
            toSelectionMentionText(
                'John 3:16',
                genMention({
                    text: 'so loved the world',
                    before: 'For God ',
                    after: ', that he gave his only begotten Son',
                    start: 9,
                    end: 26,
                }),
            ),
        ).toBe(
            'Selected text (John 3:16, 9-26):\n' +
                '> For God **so loved the world**, that he gave his only ' +
                'begotten Son',
        );
    });

    it('marks every line of a selection over several lines', () => {
        expect(
            toSelectionMentionText(
                'Sermon notes',
                genMention({
                    text: 'grace\n\n  faith alone',
                    before: 'By ',
                    after: ', not works',
                }),
            ),
        ).toBe(
            'Selected text (Sermon notes):\n' +
                '> By **grace**\n' +
                '> **faith alone**, not works',
        );
    });

    it('quotes the words alone, unmarked, with nothing around them', () => {
        expect(
            toSelectionMentionText(
                '  Sermon   notes ',
                genMention({ text: 'Amen' }),
            ),
        ).toBe('Selected text (Sermon notes):\n> Amen');
        expect(toSelectionMentionText('', genMention({ text: 'Amen' }))).toBe(
            'Selected text:\n> Amen',
        );
        expect(
            toSelectionMentionText('', genMention({ text: ' \n ' })),
        ).toBeNull();
    });

    it('is told apart from a question, so nothing is offered over it', () => {
        expect(
            checkHasSelectionQuote('Selected text (Note):\n> Amen\nWhy?'),
        ).toBe(true);
        expect(checkHasSelectionQuote('> Amen')).toBe(true);
        expect(checkHasSelectionQuote('How do I add > here?')).toBe(false);
        expect(checkHasSelectionQuote('a >\n>')).toBe(false);
    });

    it('goes under what is in the box, once, with a line for the question', () => {
        const quote = 'Selected text (Note):\n> Amen';
        expect(appendSelectionMention('', quote)).toBe(`${quote}\n`);
        expect(appendSelectionMention('What is this?  \n', quote)).toBe(
            `What is this?\n\n${quote}\n`,
        );
        const once = appendSelectionMention('', quote);
        expect(appendSelectionMention(once, quote)).toBe(once);
    });
});

// 2026-11-08, the user: _should reuse existing (attached window) chatbot tab_.
describe('the tab the quote goes to', () => {
    const sessions = [
        { id: 'a', note: false, window: 'w1' },
        { id: 'b', note: true, window: 'w2' },
        { id: 'c', note: false, window: 'w2' },
        { id: 'd', note: true, window: 'w3' },
    ];
    const isOnIt = (session: { note: boolean }) => {
        return session.note;
    };
    const isIn = (windowId: string) => {
        return (session: { window: string }) => {
            return session.window === windowId;
        };
    };

    it('is the tab on that note or passage, the one in front first', () => {
        expect(pickSelectionSession(sessions, 'b', isOnIt, isIn('w1'))).toEqual(
            { sessionId: 'b', isOnIt: true },
        );
        // Else the newest.
        expect(pickSelectionSession(sessions, 'a', isOnIt, isIn('w1'))).toEqual(
            { sessionId: 'd', isOnIt: true },
        );
    });

    it('else the tab working in that window, else none', () => {
        const isNever = () => {
            return false;
        };
        expect(
            pickSelectionSession(sessions, 'a', isNever, isIn('w2')),
        ).toEqual({ sessionId: 'c', isOnIt: false });
        expect(
            pickSelectionSession(sessions, 'b', isNever, isIn('w2')),
        ).toEqual({ sessionId: 'b', isOnIt: false });
        expect(
            pickSelectionSession(sessions, 'a', isNever, isIn('w9')),
        ).toBeNull();
    });
});

// 2026-11-08, the user: _for bible note selected text: if user did not ask
// anything then try to provide options for user, like spell check
// translation change case do google search ..._
describe('what to do with the words', () => {
    it('offers a button a job, each carrying the quote and the words', () => {
        const offer = genSelectionOffer('Selected text:\n> Amen', 'Amen');
        expect(offer.text).toBe('What would you like to do with “Amen”?');
        expect(
            offer.actions.map((action) => {
                return action.label;
            }),
        ).toEqual(SELECTION_ACTION_LABEL_LIST);
        expect(SELECTION_ACTION_LABEL_LIST).toEqual(
            expect.arrayContaining([
                'Check the spelling',
                'Uppercase',
                'Search Selected Text on Google',
                'Replace the words with another language',
            ]),
        );
        for (const action of offer.actions) {
            expect(action.toolName).toBe(SELECTION_STEP_TOOL_NAME);
            expect(action.args.quote).toBe('Selected text:\n> Amen');
            expect(action.args.words).toBe('Amen');
        }
    });

    it('names long words by their start', () => {
        const offer = genSelectionOffer('q', `${'word '.repeat(30)}end`);
        expect(offer.text).toContain('…”?');
        expect(offer.text.length).toBeLessThan(110);
    });

    it('reads a pressed button back, and nothing else', () => {
        const step = toValidSelectionStep({
            job: 'spelling',
            quote: 'Selected text:\n> teh',
            words: 'teh',
        });
        expect(step?.ask).toContain('spelling');
        expect(step?.label).toBe('Check the spelling');
        expect(
            toValidSelectionStep({ job: 'google', quote: 'q', words: 'grace' })
                ?.ask,
        ).toBeNull();
        expect(
            toValidSelectionStep({ job: 'delete', quote: 'q', words: 'x' }),
        ).toBeNull();
        expect(
            toValidSelectionStep({ job: 'copy', quote: 'q', words: '  ' }),
        ).toBeNull();
        expect(toValidSelectionStep(null)).toBeNull();
    });

    it('asks with the quote above the job', () => {
        expect(toSelectionStepAsk('Selected text:\n> teh\n', 'Fix it.')).toBe(
            'Selected text:\n> teh\nFix it.',
        );
    });

    it('searches Google for the words alone', () => {
        const url = new URL(toSelectionSearchUrl('  so   loved\nthe world '));
        expect(url.origin).toBe('https://www.google.com');
        expect(url.searchParams.get('q')).toBe('so loved the world');
        expect(
            new URL(toSelectionSearchUrl('x'.repeat(500))).searchParams.get('q')
                ?.length,
        ).toBe(200);
    });
});
