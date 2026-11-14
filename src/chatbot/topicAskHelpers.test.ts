import { describe, expect, test } from 'vitest';

import {
    checkIsShortTopicAsk,
    genTopicAskHint,
    toTopicWords,
} from './topicAskHelpers';

// EC-583: "lyric" typed alone had been answered with an apology. A word or
// two that names a subject is asked about first; anything that already says
// what it is goes on as before.
describe('checkIsShortTopicAsk', () => {
    test.each([
        'lyric',
        'Lyric?',
        'background',
        '  bible  ',
        'new song',
        'lyric from powerpoint',
        // A verb alone says no more than a noun does: clear what?
        'clear',
        'Present?',
    ])('%j names a topic, not a job', (text) => {
        expect(checkIsShortTopicAsk(text)).toBe(true);
    });

    test.each([
        ['nothing', ''],
        ['a yes', 'yes'],
        ['a no', 'No.'],
        ['an agreement', 'go ahead'],
        ['a thank-you', 'thanks'],
        ['a longer thank-you', 'thank you'],
        ['a greeting', 'hello'],
        ['a greeting of a time of day', 'good morning'],
        ['two letters, the start of "hide"', 'hi'],
        ['two letters, the end of "book"', 'ok'],
        ['only the little words of a question', 'why'],
        ['little words alone', 'how do I'],
        ['a verse', 'John 3:16'],
        ['a time', '5 minutes'],
        ['a command', '/lyric'],
        ['an address', 'https://example.com'],
        ['a quoted name', '"Amazing Grace"'],
        ['a complaint about the answer above', 'that is wrong'],
        ['a question', 'how do I make a new song for Sunday'],
        ['three words that are not little', 'make new song'],
        ['two lines', 'lyric\nbackground'],
        // A verb and what it acts on is the job itself.
        ['an instruction', 'clear the screen'],
        ['an instruction about a claimed change', 'Fix the cross-references.'],
        ['an instruction of two words', 'make song'],
        ['an instruction, capitalised', 'Open settings'],
    ])('%s is not', (_label, text) => {
        expect(checkIsShortTopicAsk(text)).toBe(false);
    });
});

describe('toTopicWords', () => {
    test('the marks round the words go, the words stay', () => {
        expect(toTopicWords('  lyric?!  ')).toBe('lyric');
        expect(toTopicWords("song's words!")).toBe("song's words");
    });
});

describe('genTopicAskHint', () => {
    test('nothing to choose among is no hint', () => {
        expect(genTopicAskHint('lyric', [])).toBeNull();
    });

    test('says the words, asks before answering, and names the jobs', () => {
        const hint = genTopicAskHint('lyric?', [
            'How do I make a new song?',
            'Can you turn a PowerPoint song into a lyric file?',
        ]);
        expect(hint).toContain('("lyric")');
        expect(hint).toMatch(/do not guess/);
        expect(hint).toMatch(/OPTIONS/);
        expect(hint).toContain(
            'How do I make a new song? | ' +
                'Can you turn a PowerPoint song into a lyric file?',
        );
    });
});
