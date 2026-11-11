import { describe, expect, test } from 'vitest';

import {
    LESSON_MAKE_HINT,
    LESSON_OUTLINE,
    NOTE_CREATE_PROMPT,
    PREACHING_LESSON_SHAPE,
    checkIsLessonFinishAsk,
    checkIsLessonReviewAsk,
    checkIsLessonWriteAsk,
    genLessonLengthLine,
} from './noteCreatePromptHelpers';
import { BIBLE_READER_SYSTEM_PROMPT } from './bibleReaderChatHelpers';
import { RESOURCES_SYSTEM_PROMPT } from './resourcesChatHelpers';

// 2026-11-08, the user's goal: _chatbot can put a lesson to a new bible note
// for user_. Every conversation that teaches is told to MAKE the note --
// a Reader chat had handed over words to copy and paste.
describe('the conversations that teach make a note when asked', () => {
    test('one sentence, the tool and its action, never words to copy', () => {
        expect(NOTE_CREATE_PROMPT).toContain('owa_bible_note action "add"');
        expect(NOTE_CREATE_PROMPT).toContain('a lesson given whole');
        expect(NOTE_CREATE_PROMPT).toContain('never hand them words to copy');
        // Seen live: told only that it could, the model asked what to write.
        expect(NOTE_CREATE_PROMPT).toContain('Never ask what to write');
    });

    test('the Bible Reader and the Resources prompts carry it', () => {
        expect(BIBLE_READER_SYSTEM_PROMPT).toContain(NOTE_CREATE_PROMPT);
        expect(RESOURCES_SYSTEM_PROMPT).toContain(NOTE_CREATE_PROMPT);
    });
});

// 2026-11-10, the goal _chatbot completely smart enough to help prepare a
// best preaching lesson_: a lesson asked for where no note is attached
// carries what a lesson holds, and only then.
describe('a lesson to preach, asked anywhere', () => {
    test('what a lesson holds, in the order it is preached', () => {
        const order = [
            '[^John 10:11-18]',
            'Big idea',
            'Background',
            'Introduction',
            'three points',
            'Pointing to Jesus',
            'Response',
            'Closing prayer',
            'Questions for discussion',
            'Memory verse',
        ].map((part) => PREACHING_LESSON_SHAPE.indexOf(part));
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(PREACHING_LESSON_SHAPE).toContain('never typed out');
        // Not in a system prompt: it would ride every question.
        expect(NOTE_CREATE_PROMPT).not.toContain('WHAT A LESSON HOLDS');
        expect(LESSON_MAKE_HINT).toContain(PREACHING_LESSON_SHAPE);
        expect(LESSON_MAKE_HINT).toContain('owa_bible_note action "add"');
    });

    // BN-93 (2026-11-11, the BN-91 blind read): a point defined one word
    // and left the hard phrase, asked a question the passage leaves open,
    // and reached Jesus by a shared word ("the Word made flesh" from the
    // sower's word).
    test('a point explains its hard phrase and asks what the verses answer', () => {
        for (const line of [
            'first the phrase of these verses a hearer would find hardest',
            'that these verses themselves answer',
            'with the words of the verse that gives it',
            'ONE plain sentence that names the need in us',
            'a last one that turns them to the passage',
            'never a word it only shares with a name of his',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-95 (2026-11-11): "Sarah, Mark, Elena" in example after example, and
    // a weekday task under every point plus one more in the Response.
    test('an example names no one, and a lesson asks one step', () => {
        for (const line of [
            'never by name',
            'one deed that answers what God gives in THIS point',
            'never a weekday or hour picked for no reason',
            // BN-98: told only to take a deed already given, the Response
            // was "one line: 'Go and show mercy'" with no clear call.
            'a clear call to the ONE step',
            'what, with whom and when in their week',
            'never one more task',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
        expect(PREACHING_LESSON_SHAPE).not.toContain('a real name');
        // An example phrase in the shape is copied into lesson after
        // lesson: given "a nurse after a night shift" and "at the meal
        // table", the first lessons opened their examples and deeds on them.
        for (const phrase of ['night shift', 'pew behind', 'meal table']) {
            expect(PREACHING_LESSON_SHAPE).not.toContain(phrase);
        }
    });

    // BN-104 (2026-11-11): Pointing to Jesus "tacked on or allegorised", a
    // verse it quoted from memory under the wrong reference, and examples
    // that did not mirror their point.
    test('Christ by the New Testament, an example by its own verses', () => {
        for (const line of [
            'where the New Testament itself takes THIS passage to Christ',
            'read with owa_find_verse and written as its token, never quoted',
            "where what THIS point's verses tell happens again",
            'never ending on "This shows"',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-107 (2026-11-11): "someone named by role and place" was filled with
    // a workplace in lesson after lesson -- "a manager at a warehouse".
    test('an example is a scene to see, never a manager at an office', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'three or four sentences a listener can see: the place',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            'never a manager, a clerk or an office',
        );
        expect(PREACHING_LESSON_SHAPE).not.toContain('named by role and place');
    });

    // BN-102 (2026-11-11): backgrounds missed the occasion a passage
    // answers; Jonah "said he was sorry"; "why is the father upset?".
    test('a background gives the occasion, a retelling adds no words', () => {
        for (const line of [
            'the OCCASION it answers',
            'who was speaking to whom and why',
            'word anyone said or detail it does not give',
            'nor one that takes for granted what they do not say',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-98 (2026-11-11): a devotion of "every part in a sentence or two"
    // was read as thin in every part (15 and 16 of 24), its one change
    // "divide the psalm into its movements".
    test("a devotion's one point walks the passage movement by movement", () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'ONE point that walks its whole passage movement by movement',
        );
        expect(PREACHING_LESSON_SHAPE).toContain('about 450 words');
        expect(PREACHING_LESSON_SHAPE).not.toContain('about 300 words');
    });

    // BN-73 (2026-11-10): "a 15 minute sermon" came back five minutes
    // long from a rate; a number of words is what a model follows.
    test('a length they give is a number of words', () => {
        expect(
            genLessonLengthLine('a 15 minute sermon on John 3:16'),
        ).toContain('about 1800');
        expect(genLessonLengthLine('a 20-minute devotion')).toContain(
            'about 2400',
        );
        // A cut has its own hint; no length, or a silly one, says nothing.
        expect(
            genLessonLengthLine('it is too long, make it fit 15 minutes'),
        ).toBe(null);
        expect(genLessonLengthLine('a sermon on Psalm 23')).toBe(null);
        expect(genLessonLengthLine('a 90 minute sermon')).toBe(null);
    });

    // A Gemma 4 is asked in the person's own words, where no English
    // reader sees a lesson asked for: the outline rides the prompt itself,
    // in every language, short enough to.
    test('the outline rides the prompt, in the order it is preached', () => {
        expect(NOTE_CREATE_PROMPT).toContain(LESSON_OUTLINE);
        const order = [
            'main passage',
            'Big idea',
            'Background',
            'Introduction',
            'three numbered points',
            'Pointing to Jesus',
            'Response',
            'Closing prayer',
            'Questions for discussion',
            'Memory verse',
        ].map((part) => LESSON_OUTLINE.indexOf(part));
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // ~70 tokens: it is paid on every round of every Reader question.
        expect(LESSON_OUTLINE.length).toBeLessThan(400);
    });

    test('read off the words a preacher types', () => {
        for (const text of [
            'make a best preaching lesson about the good shepherd',
            'help me prepare my sermon on John 10',
            "I'm preaching from Psalm 23 on Sunday",
            'I need to preach about forgiveness next week',
            'sermon on the prodigal son',
            'write a devotion for the youth about patience',
            'Can you make me a bible study on Romans 8',
            // BN-85: a preaching message, and a funeral's talk.
            'a message of hope for a funeral, from Revelation 21:1-7',
            'help me prepare a short message on Psalm 23 for prayer night',
            'I need a funeral message from John 14',
            "a talk for my mother's funeral",
        ]) {
            expect(checkIsLessonWriteAsk(text), text).toBe(true);
        }
    });

    // BN-85: "a message" alone is no lesson.
    test('a message to someone is not one', () => {
        for (const text of [
            'paste the message from my pastor',
            'write a message to my wife',
            'send a message to the group',
            'how do I write a funeral message?',
        ]) {
            expect(checkIsLessonWriteAsk(text), text).toBe(false);
        }
    });

    test('a question, or another job, is not one', () => {
        for (const text of [
            'how do I write a sermon in a note?',
            'what should I preach on?',
            'Where are my sermon notes?',
            'make the words bigger',
            'show John 3:16 on the screen',
            'summarize this chapter',
            'Can you write a lesson plan with times?',
            '',
        ]) {
            expect(checkIsLessonWriteAsk(text), text).toBe(false);
        }
    });

    test('their own lesson made whole, or judged', () => {
        expect(checkIsLessonFinishAsk('finish my sermon')).toBe(true);
        expect(checkIsLessonFinishAsk('make this a full lesson')).toBe(true);
        expect(checkIsLessonFinishAsk('improve the drawing')).toBe(false);
        expect(checkIsLessonReviewAsk('review my lesson')).toBe(true);
        expect(checkIsLessonReviewAsk('is my sermon good enough')).toBe(true);
        expect(checkIsLessonReviewAsk('is it ok to bold the title?')).toBe(
            false,
        );
    });
});
