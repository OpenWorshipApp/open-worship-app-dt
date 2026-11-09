import { describe, expect, it } from 'vitest';

import {
    MAX_ANSWER_QUOTE_CHARS,
    toAnswerQuoteText,
} from './answerQuoteHelpers';
import { checkHasSelectionQuote } from './selectionMentionHelpers';

// 2026-11-09, the user: _right next to the copy icon add reply icon, click
// reply to mention it in input text_, and _as a user I want to be able to
// follow up a section_.
describe('an answer quoted in the box', () => {
    it('quotes the whole answer under a line saying what it is', () => {
        expect(
            toAnswerQuoteText('Saved John 3:16 to your Bibles list.', null),
        ).toBe(
            'Replying to your answer:\n' +
                '> Saved John 3:16 to your Bibles list.',
        );
    });

    it('quotes only the words selected in it, and says it is a part', () => {
        const answer =
            '**Summary**\nJesus is baptized.\n\n**Conclusion**\nFaith shows.';
        expect(toAnswerQuoteText(answer, '  Conclusion\nFaith shows. ')).toBe(
            'Replying to this part of your answer:\n' +
                '> Conclusion\n' +
                '> Faith shows.',
        );
        // A selection of nothing but spaces is no selection.
        expect(toAnswerQuoteText('Amen', ' \n ')).toBe(
            'Replying to your answer:\n> Amen',
        );
    });

    it('keeps every line a quote line, blank lines left out', () => {
        const quote = toAnswerQuoteText('One\r\n\r\n  Two  \n\nThree', null);
        expect(quote).toBe('Replying to your answer:\n> One\n> Two\n> Three');
        // ...which the box reads as a quote, so no app question is offered
        // over it.
        expect(checkHasSelectionQuote(quote!)).toBe(true);
    });

    it('quotes the words, not their mark-up', () => {
        expect(
            toAnswerQuoteText(
                '# Lesson\n### 1. Repent (v 1-6)\n- **Turn back:** now.\n**',
                null,
            ),
        ).toBe(
            'Replying to your answer:\n' +
                '> Lesson\n' +
                '> 1. Repent (v 1-6)\n' +
                '> - Turn back: now.',
        );
    });

    it('is nothing for an answer with no words', () => {
        expect(toAnswerQuoteText('', null)).toBeNull();
        expect(toAnswerQuoteText(' \n\n ', null)).toBeNull();
    });

    it('cuts a long answer at a whole word and says so', () => {
        const words = 'grace and peace '.repeat(80).trim();
        const quote = toAnswerQuoteText(words, null)!;
        const quoted = quote.split('\n').slice(1).join('\n');
        expect(quoted.endsWith('…')).toBe(true);
        expect(quoted.length).toBeLessThanOrEqual(
            MAX_ANSWER_QUOTE_CHARS + '> …'.length,
        );
        // Ends on a whole word, never inside one.
        expect(quoted).toMatch(/(?:grace|and|peace)…$/);
    });

    it('stops at the line that does not fit, marking the cut', () => {
        const longLine = 'x'.repeat(MAX_ANSWER_QUOTE_CHARS - 10);
        const quote = toAnswerQuoteText(
            `${longLine}\nsecond line that will not fit\nthird`,
            null,
        )!;
        const lineList = quote.split('\n');
        expect(lineList).toHaveLength(3);
        expect(lineList[1]).toBe(`> ${longLine}`);
        expect(lineList[2].startsWith('> second')).toBe(true);
        expect(lineList[2].endsWith('…')).toBe(true);
        // A line filling the room to the letter leaves no room for the next,
        // and the cut is marked on it.
        const fullLine = 'y'.repeat(MAX_ANSWER_QUOTE_CHARS);
        expect(toAnswerQuoteText(`${fullLine}\nmore`, null)).toBe(
            `Replying to your answer:\n> ${fullLine}…`,
        );
    });

    it('never cuts a letter apart from its marks', () => {
        // A letter with two combining marks, over and over, and no space: the
        // cut must fall between clusters.
        const cluster = 'ạ́';
        const quote = toAnswerQuoteText(cluster.repeat(400), null)!;
        const quoted = quote.split('\n')[1].slice(2, -1);
        expect(quoted.length % cluster.length).toBe(0);
        expect(quoted.length).toBeLessThanOrEqual(MAX_ANSWER_QUOTE_CHARS);
    });
});
