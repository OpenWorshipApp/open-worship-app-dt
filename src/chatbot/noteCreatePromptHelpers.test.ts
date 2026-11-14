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
            // BN-247 (ab78..ab83): "Will we recognize our loved ones? Yes",
            // "To what extent ...? Yes," -- an answer past the verses.
            'never a bare "Yes" or "No" it does not settle',
            'ONE plain sentence that names the need in us',
            'a last one that turns them to the passage',
            'never a word it only shares with a name of his',
            // BN-139: "He is the 'right spirit' who dwells in us".
            'never that he IS what a phrase of the passage names',
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
            // BN-112: its words quoted, then its token -- a token alone in
            // a sentence was a chip read out with no words.
            'read with owa_find_verse, its words quoted as they read and then',
            "where what THIS point's verses tell happens again",
            'never ending on "This shows"',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-284 (ab104..ab106, both readers): hearer questions that only asked
    // what happened ("What did Paul and Silas do when the earthquake
    // opened the doors?") -- 39 of 291 in the fifth held-out set -- marked
    // the points' explanation down.
    test("a hearer's question is a doubt, not a quiz", () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'a doubt or difficulty a listener feels about them',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            'never a quiz on what happened',
        );
    });

    // BN-281 (ab102..ab104, Sonnet): once the communion message read the
    // verses before 1 Corinthians 11:23-26 (the divisions of 11:17-22),
    // its big idea turned to unity in three batches running -- which the
    // four verses do not state.
    test('the big idea is from the passage, not the verses before it', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'from its own verses, never the verses before it, which are its ' +
                'Background',
        );
    });

    // BN-149 (2026-11-11, ab30): told to go first to a New Testament verse,
    // the model took one that only shares a theme -- Revelation 7:9 under
    // David and Goliath, 2 Corinthians 5:20 under the unforgiving servant.
    test("Christ from the passage's own big-idea phrase", () => {
        for (const line of [
            'from the phrase of THIS passage that carries its big idea',
            'in a Gospel, what Jesus himself says or does in it',
            'a verse from elsewhere only where the New Testament itself',
            'never one that only shares a theme or a word with it',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
        // Still the passage's own first: the phrase comes before any other
        // verse.
        expect(
            PREACHING_LESSON_SHAPE.indexOf('that carries its big idea'),
        ).toBeLessThan(
            PREACHING_LESSON_SHAPE.indexOf('a verse from elsewhere only'),
        );
    });

    // BN-204 (ab58, Sonnet: the Sower Good, the one lesson under Best):
    // four grounds squeezed into three points, the third printing 13:10-23
    // to reach the passage's end.
    test('a parable told and explained gives each part its point', () => {
        for (const line of [
            'a parable told and then explained gives a point to each part',
            '(four grounds, four points)',
            'the verse that tells it and the verse that explains it',
            'the verses between that do neither in the Background',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-220 (ab66, Opus: Goliath and the Sower at 19, both readers in
    // most reads): 1 Samuel 17 printed whole at the top and again across
    // the points, Matthew 13:8-23 reprinted under point 4.
    test('a point prints six verses at most, naming its others', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'six at most, the passage at the top already prints them all',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            "the point's other verses named in its lines",
        );
    });

    // BN-210 (ab61, Opus: both children's Jonahs at 19): points on 1:3,
    // 2:1-9 and 3:1-3, the big idea -- God's mercy even to Nineveh -- told
    // in chapter 4, which no point reached.
    test("a children's lesson's two points carry its big idea", () => {
        for (const line of [
            'that together carry its big idea',
            'where the story tells its lesson at its end',
            'the second point rests on that end and the story is told to it',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-207 (shape62): Proverbs 3:5-6 written in two points, and before
    // it in three with 3:6 printed twice -- a short passage's points come
    // from its clauses.
    test("a short passage's three points come from its clauses", () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'a passage of one or two verses still gives three points, one ' +
                'for each of its clauses',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            'never a verse printed for two points',
        );
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

    // BN-184 (ab45..ab48, both readers): the Psalm 23 devotion's
    // background was "This is a Psalm of David" and one sentence in every
    // batch -- C 1 by each reader, and 19 (Good) once. A psalm whose title
    // names no occasion takes what the Bible tells of its writer that its
    // pictures come from.
    test("a psalm with no occasion is set in its writer's own story", () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'when its title names no occasion, what the Bible tells of the ' +
                "writer it names that the psalm's own pictures come from",
        );
        expect(PREACHING_LESSON_SHAPE).toContain('1 Samuel 16:11');
        // Still never the psalm before it.
        expect(PREACHING_LESSON_SHAPE).toContain('never the psalm before it');
    });

    // BN-119 (2026-11-11, the BN-116/117 read): told to walk its passage
    // "movement by movement", a devotion still printed the whole psalm
    // under its one point and explained three phrases -- "one point holds
    // all six verses", "divide the psalm by its refrains (vv.1-3, 4-7,
    // 8-11)". The movements are lines now, each named by its verses.
    test("a devotion's movements are lines, each opening with its verses", () => {
        for (const line of [
            'under its heading no passage printed again',
            'a line for each movement in order',
            "opening with that movement's verses as a token",
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(line);
        }
    });

    // BN-124 (2026-11-11, the BN-116/117 read, Opus): children's memory
    // verses a child cannot learn (Luke 15:7, Jonah 3:10, 28 and 37 words).
    test("a child's memory verse is short", () => {
        // BN-174 (ab36..ab42, both readers): Psalm 103:8, Nehemiah 9:31 and
        // 2 Chronicles 7:14 for a Jonah lesson -- the story's own verse
        // first, and each point under its verses (a point with none).
        expect(PREACHING_LESSON_SHAPE).toContain(
            'ONE verse of twenty words at most, from the story itself when ' +
                'one of its verses says the big idea, else from elsewhere',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            "each under the token of the story's own verses it rests on",
        );
        expect(PREACHING_LESSON_SHAPE).not.toContain(
            'memory verse of one short line',
        );
    });

    // BN-127 (2026-11-11, the BN-118..124 read): told "no questions for
    // discussion", a funeral message dropped its memory verse too -- both
    // readers asked for one the mourners could carry home.
    test('a funeral message keeps a memory verse', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'and still a memory verse to carry home',
        );
    });

    // BN-170 (2026-11-12, ab36..ab40, both readers): a funeral message with
    // no questions and a This week that is only a comfort to hold was the
    // lesson both marked down most (L 1, G 1); BN-90's "never a task" had
    // been read as nothing to do at all.
    test('a funeral message has reflection questions and one gentle step', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'two or three quiet Questions for reflection',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            'one gentle thing to do with that comfort',
        );
        expect(PREACHING_LESSON_SHAPE).toContain('never a duty or a fix');
        expect(PREACHING_LESSON_SHAPE).not.toContain(
            'no questions for discussion',
        );
    });

    // BN-225 (2026-11-13, the held-out read): a John 14 funeral told the
    // mourners "They are in the Father's house" (both readers: what the
    // passage promises its hearers, said of the dead), and a Christmas
    // sermon on Luke 1 never named Christmas.
    // BN-232 (ab75, both batches): a Matthew 14 lesson asked children how
    // the boy felt giving his lunch -- John 6:9's detail, not Matthew's.
    test('an event told in another book too is told as this book tells it', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'an event told in another book too is told as THIS book tells it',
        );
    });

    test('a funeral says no more than its promises; a day asked for is named', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'each said of those the passage gives it to, never where the one ' +
                'who died now is',
        );
        expect(PREACHING_LESSON_SHAPE).toContain(
            'names that day in its Introduction and its Response',
        );
    });

    // BN-125 (2026-11-11): named among the stock pictures, the hospital room
    // came back in 6 lessons of 16 (4 before it was named) -- a scene named
    // to avoid is a scene put in mind. The list keeps its first three.
    test('a stock picture is not named into the shape', () => {
        for (const picture of ['a hospital room', 'a canyon bridge']) {
            expect(PREACHING_LESSON_SHAPE).not.toContain(picture);
        }
    });

    // BN-118 (2026-11-11, the BN-116/117 read): six backgrounds of sixteen
    // were "generic", each opening on a line true of its whole book.
    test('a background changes how THIS passage is heard', () => {
        expect(PREACHING_LESSON_SHAPE).toContain(
            'change how THIS passage is heard',
        );
        for (const phrase of [
            '"part of the historical books"',
            '"wrote for a Jewish audience"',
            '"a song of trust"',
        ]) {
            expect(PREACHING_LESSON_SHAPE).toContain(phrase);
        }
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
            // BN-231: any occasion's message.
            'a short message for a wedding, from Ruth 1:16-17',
            'a baptism homily on Romans 6',
            'I need a wedding sermon',
            'a talk for our 50th anniversary service',
            // BN-274: the Lord's Supper is one.
            'a short message for a communion service, from 1 Corinthians 11:23-26',
            'a communion meditation on Luke 22:14-20',
            "a short talk before the Lord's Supper",
            'a message for the Lord’s Table this Sunday',
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
            'send the wedding photos to the group',
            'send the communion schedule to the group',
            "show the Lord's Supper verses on the screen",
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
