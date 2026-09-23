import { beforeEach, describe, expect, it, test, vi } from 'vitest';

// The corpus is a lazy chunk of JSON the real window imports; the layers above
// it are what is under test here, so it is stubbed and asserted on separately.
const genFollowUpQuestions = vi.fn(async (): Promise<string[]> => {
    return [];
});
vi.mock('./questionHelpers', () => ({
    genFollowUpQuestions: (...args: any[]) => {
        return genFollowUpQuestions(...(args as []));
    },
}));

import {
    checkIsDraftEcho,
    checkIsWalkthroughEcho,
    genMessageReplies,
    genQuickReplies,
    parseAnswerFrames,
    parseAnswerOptions,
    parseAnswerShows,
    parseAttachRequests,
} from './quickReplyHelpers';

beforeEach(() => {
    genFollowUpQuestions.mockReset();
    genFollowUpQuestions.mockResolvedValue([]);
});

describe('parseAnswerOptions', () => {
    test('takes the options off the end and out of the text', () => {
        const parsed = parseAnswerOptions(
            'No screen is showing right now.\n' +
                'OPTIONS: Yes, walk me through it | Just the steps | No thanks',
        );
        expect(parsed.options).toEqual([
            'Yes, walk me through it',
            'Just the steps',
            'No thanks',
        ]);
        expect(parsed.text).toBe('No screen is showing right now.');
    });

    // The whole point of the frame: a model that half complies must not be
    // able to print its own machinery at a volunteer.
    test('a malformed line is still removed from the answer', () => {
        const parsed = parseAnswerOptions('Press **F9**.\nOPTIONS: |  |');
        expect(parsed.options).toEqual([]);
        expect(parsed.text).toBe('Press **F9**.');
    });

    test('an empty options line is removed too', () => {
        const parsed = parseAnswerOptions('Press **F9**.\nOPTIONS:');
        expect(parsed.options).toEqual([]);
        expect(parsed.text).toBe('Press **F9**.');
    });

    // Measured live on the first run: GPT-5 wrote the marker at the end of a
    // SENTENCE rather than on a line of its own, so a line-anchored parser
    // printed the whole frame at the user. The line is cut at the marker now.
    test('a marker written into the last sentence is still taken off', () => {
        const parsed = parseAnswerOptions(
            [
                'Double-click the verse to present it.',
                'Want me to keep stepping you through on screen? ' +
                    'OPTIONS: Yes, walk me through it | Show me the steps here',
            ].join('\n'),
        );
        expect(parsed.options).toEqual([
            'Yes, walk me through it',
            'Show me the steps here',
        ]);
        expect(parsed.text).toBe(
            [
                'Double-click the verse to present it.',
                'Want me to keep stepping you through on screen?',
            ].join('\n'),
        );
    });

    // Measured 2026-09-10 on the free tier: the marker glued straight onto
    // the full stop of the last sentence, no space, and every button printed
    // at the volunteer as prose. A sentence's end counts as a word boundary.
    test('a marker glued to the full stop before it is still taken off', () => {
        const parsed = parseAnswerOptions(
            'No, the projector is not showing anything right now.OPTIONS: ' +
                'Yes, start presenting | How do I start? | No thanks',
        );
        expect(parsed.options).toEqual([
            'Yes, start presenting',
            'How do I start?',
            'No thanks',
        ]);
        expect(parsed.text).toBe(
            'No, the projector is not showing anything right now.',
        );
        expect(parseAnswerOptions('Is it on?OPTIONS: Yes | No').text).toBe(
            'Is it on?',
        );
    });

    // ...but only as its own word. An answer that talks ABOUT options is prose.
    test('a word merely ending in options is not the marker', () => {
        const text =
            'Open the panel and read its DISPLAYOPTIONS: nothing else.';
        expect(parseAnswerOptions(text)).toEqual({ text, options: [] });
    });

    test('a marker the model bulleted or bolded still parses', () => {
        const parsed = parseAnswerOptions('Done.\n- **OPTIONS:** Yes | No');
        expect(parsed.options).toEqual(['Yes', 'No']);
        expect(parsed.text).toBe('Done.');
    });

    test('a blank line between the answer and the marker is fine', () => {
        const parsed = parseAnswerOptions('Done.\n\nOPTIONS: Yes | No\n');
        expect(parsed.options).toEqual(['Yes', 'No']);
        expect(parsed.text).toBe('Done.');
    });

    // Further back than the closing lines it is something else -- a quoted
    // example, a line of a recipe -- and taking it would eat real text.
    test('a marker buried in the middle is left alone', () => {
        const text =
            'OPTIONS: a | b\nline two\nline three\nline four\nline five';
        expect(parseAnswerOptions(text)).toEqual({ text, options: [] });
    });

    test('empty, over-long and duplicate options are dropped, capped at 3', () => {
        const parsed = parseAnswerOptions(
            'Done.\nOPTIONS: Yes |  | yes | ' +
                'A reply far too long to fit on a button in this window | ' +
                'Maybe | Later | Never',
        );
        expect(parsed.options).toEqual(['Yes', 'Maybe', 'Later']);
    });

    test('an answer with no marker is returned untouched', () => {
        expect(parseAnswerOptions('Just an answer.')).toEqual({
            text: 'Just an answer.',
            options: [],
        });
    });
});

// The reported case, and the shapes around it. No model involved: this is what
// the offline bot gets, and the safety net under a model that forgot its frame.
describe('genQuickReplies', () => {
    test('the reported answer offers yes and no', () => {
        expect(
            genQuickReplies(
                'No — no screen is showing right now.\n\nWould you like help ' +
                    'turning one on for the congregation? I can walk you ' +
                    'through it.',
            ),
        ).toEqual(['Yes', 'No thanks']);
    });

    test('an either-or is answered by naming the two things', () => {
        expect(
            genQuickReplies('Are you in the Presenter or the Bible Reader?'),
        ).toEqual(['Presenter', 'Bible Reader']);
    });

    test('an either-or whose halves are not proper nouns still works', () => {
        expect(genQuickReplies('Do you want screen 1 or screen 2?')).toEqual([
            'screen 1',
            'screen 2',
        ]);
    });

    // The "or" here is prose in an earlier sentence, not a choice.
    test('a prose or is not split into a choice', () => {
        expect(
            genQuickReplies(
                'Press **Next** or just do it. Would you like me to show you?',
            ),
        ).toEqual(['Yes', 'No thanks']);
    });

    // A choice whose halves are whole clauses cannot be named on a button, so
    // it falls back to the question's own yes/no shape.
    test('a choice too long to name falls back to yes and no', () => {
        expect(
            genQuickReplies(
                'Would you like me to walk you through it or just tell you ' +
                    'the steps?',
            ),
        ).toEqual(['Yes', 'No thanks']);
    });

    test('an answer with no question offers nothing', () => {
        expect(genQuickReplies('Press **F9** to clear the verse.')).toEqual([]);
    });

    test('an open question is not a yes/no', () => {
        expect(genQuickReplies('What would you like to do?')).toEqual([]);
    });

    // A bare "Yes" would not be answering it any more.
    test('a question buried under a paragraph offers nothing', () => {
        expect(
            genQuickReplies(
                'Would you like help? First open the Background panel on the ' +
                    'left. Then choose the Videos tab. Then pick a file from ' +
                    'the list and double-click it.',
            ),
        ).toEqual([]);
    });

    test('a long question is not a yes/no', () => {
        expect(
            genQuickReplies(
                'Would you like me to explain how the screen preview card, ' +
                    'the clear buttons beside it, the display picker in its ' +
                    'footer and the lock all work together in this app?',
            ),
        ).toEqual([]);
    });

    test('empty text is safe', () => {
        expect(genQuickReplies('')).toEqual([]);
    });
});

describe('genMessageReplies', () => {
    test("the model's own options win", async () => {
        const replies = await genMessageReplies({
            modelOptions: ['Yes, show me', 'No thanks'],
            answerText: 'Would you like help?',
            askedText: 'is any screen showing?',
            focus: 'presenter',
        });
        expect(replies).toEqual(['Yes, show me', 'No thanks']);
        expect(genFollowUpQuestions).not.toHaveBeenCalled();
    });

    test('an option that repeats a button already there is dropped', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['Show me step by step', 'No thanks'],
            answerText: 'Would you like help?',
            askedText: 'how do I present a verse?',
            actionLabels: ['Show me step by step', 'Do it for me'],
            focus: 'presenter',
        });
        expect(replies).toEqual(['No thanks']);
    });

    test('two options at most when the answer already has buttons', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['One', 'Two', 'Three'],
            answerText: 'Done.',
            askedText: 'how do I present a verse?',
            actionLabels: ['Read the whole thing'],
            focus: 'presenter',
        });
        expect(replies).toEqual(['One', 'Two']);
    });

    // Measured live: an offline manual answer carries four buttons of its own,
    // and two more under them made six under one paragraph.
    test('the two rows together never pass five buttons', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['One', 'Two'],
            answerText: 'Done.',
            askedText: 'how do I add a background?',
            actionLabels: [
                'Show me step by step',
                'Do it for me',
                'Read the whole thing',
                'Add a background video from a link',
            ],
            focus: 'presenter',
        });
        expect(replies).toEqual(['One']);
    });

    test('an answer already full of buttons gets none', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['One', 'Two'],
            answerText: 'Done.',
            askedText: 'anything',
            actionLabels: ['a', 'b', 'c', 'd', 'e'],
            focus: 'presenter',
        });
        expect(replies).toEqual([]);
    });

    test('with no model options the answer is read instead', async () => {
        const replies = await genMessageReplies({
            answerText: 'No screen is showing. Would you like help?',
            askedText: 'is any screen showing?',
            focus: 'presenter',
        });
        expect(replies).toEqual(['Yes', 'No thanks']);
        expect(genFollowUpQuestions).not.toHaveBeenCalled();
    });

    // **Show me step by step** and **Do it for me** already ARE the yes; a
    // third, vaguer way to say the same thing is the one the user cannot tell
    // apart from them.
    test('a generic yes is dropped when walkthrough buttons are there', async () => {
        genFollowUpQuestions.mockResolvedValue(['How do I clear it again?']);
        const replies = await genMessageReplies({
            answerText: 'Here are the steps. Would you like me to show you?',
            askedText: 'how do I present a verse?',
            actionLabels: ['Show me step by step', 'Do it for me'],
            focus: 'presenter',
        });
        expect(replies).toEqual(['How do I clear it again?']);
    });

    test('a named choice keeps its buttons even beside actions', async () => {
        const replies = await genMessageReplies({
            answerText: 'Are you in the Presenter or the Bible Reader?',
            askedText: 'where is the clear button?',
            actionLabels: ['Read the whole thing'],
            focus: 'presenter',
        });
        expect(replies).toEqual(['Presenter', 'Bible Reader']);
    });

    test('an answer with nothing to offer falls back to the corpus', async () => {
        genFollowUpQuestions.mockResolvedValue([
            'How do I clear the verse off the screen?',
            'How do I change the background?',
            'How do I add a song?',
        ]);
        const replies = await genMessageReplies({
            answerText: 'Press **F9** to clear the verse.',
            askedText: 'how do I present a verse?',
            focus: 'presenter',
        });
        expect(replies).toEqual([
            'How do I clear the verse off the screen?',
            'How do I change the background?',
        ]);
        expect(genFollowUpQuestions).toHaveBeenCalledWith(
            'how do I present a verse?',
            'presenter',
        );
    });

    test('nothing anywhere is an empty row, not a broken one', async () => {
        const replies = await genMessageReplies({
            answerText: 'Press **F9** to clear the verse.',
            askedText: 'how do I present a verse?',
            focus: 'presenter',
        });
        expect(replies).toEqual([]);
    });
});

// The second frame: what the assistant says it needs to SEE. Same contract as
// the options line -- parsed wherever the model puts it, and stripped whether
// or not it parsed, because the one failure this design can produce is a
// volunteer reading "NEEDS: screenshot".
describe('parseAttachRequests', () => {
    test('takes the line off and names what it asked for', () => {
        const parsed = parseAttachRequests(
            ['I cannot tell from here.', 'NEEDS: screenshot'].join('\n'),
        );
        expect(parsed.text).toBe('I cannot tell from here.');
        expect(parsed.requests).toEqual(['screenshot']);
    });

    test('reads it inline at the end of a sentence', () => {
        // Measured on the options frame first: a model writes the marker where
        // the sentence ends, not on a line of its own, and a line-anchored
        // parser prints the machinery at the user.
        const parsed = parseAttachRequests(
            'Can you show me what you see? NEEDS: screenshot',
        );
        expect(parsed.text).toBe('Can you show me what you see?');
        expect(parsed.requests).toEqual(['screenshot']);
    });

    test('understands the words a model actually reaches for', () => {
        expect(
            parseAttachRequests('x\nNEEDS: picture | control | file').requests,
        ).toEqual(['screenshot', 'element', 'file']);
    });

    test('strips a frame it could not read at all', () => {
        const parsed = parseAttachRequests('Try F5.\nNEEDS: the thing');
        expect(parsed.text).toBe('Try F5.');
        expect(parsed.requests).toEqual([]);
    });

    test('leaves an answer that merely says needs alone', () => {
        const text = 'It needs a screen to be showing first.';
        expect(parseAttachRequests(text)).toEqual({ text, requests: [] });
    });

    test('an answer carrying both frames comes out clean', () => {
        const options = parseAnswerOptions(
            [
                'I cannot see which screen you mean.',
                'NEEDS: screenshot',
                'OPTIONS: Show you | No thanks',
            ].join('\n'),
        );
        const needed = parseAttachRequests(options.text);
        expect(options.options).toEqual(['Show you', 'No thanks']);
        expect(needed.requests).toEqual(['screenshot']);
        expect(needed.text).toBe('I cannot see which screen you mean.');
    });
});

// The mirror of an attachment: what the ANSWER offers to show. Same contract as
// the other two frames — parsed wherever the model puts it, stripped whether or
// not it parsed, and never showing a volunteer the machinery.
describe('parseAnswerShows', () => {
    test('a bare name is a control, and the chip says its name', () => {
        const parsed = parseAnswerShows(
            ['Press it in the header.', 'SHOWS: Bible Lookup'].join('\n'),
        );
        expect(parsed.text).toBe('Press it in the header.');
        expect(parsed.shows).toEqual([
            { kind: 'control', value: 'Bible Lookup', name: 'Bible Lookup' },
        ]);
    });

    test('a file is named by its file name, not its path', () => {
        const parsed = parseAnswerShows(
            'x\nSHOWS: file:C:\\Users\\me\\Pictures\\slide.png',
        );
        expect(parsed.shows[0]).toEqual({
            kind: 'file',
            value: 'C:\\Users\\me\\Pictures\\slide.png',
            name: 'slide.png',
        });
    });

    // The one thing this frame must never do: a volunteer reading
    // `button[aria-label="Setting"]` is exactly the internals leak the whole
    // window is written to prevent.
    test('a selector never becomes the words on the chip', () => {
        const parsed = parseAnswerShows(
            'x\nSHOWS: selector:button[aria-label="Setting"]',
        );
        expect(parsed.shows[0].value).toBe('button[aria-label="Setting"]');
        expect(parsed.shows[0].name).not.toContain('aria-label');
    });

    test('strips a frame it could not read, and leaves prose alone', () => {
        expect(parseAnswerShows('Try F5.\nSHOWS:   ').text).toBe('Try F5.');
        const prose = 'It shows the verse on the screen.';
        expect(parseAnswerShows(prose)).toEqual({ text: prose, shows: [] });
    });

    test('caps how many it will draw, and drops repeats', () => {
        const parsed = parseAnswerShows(
            'x\nSHOWS: One | One | Two | Three | Four',
        );
        expect(parsed.shows.map((one) => one.value)).toEqual([
            'One',
            'Two',
            'Three',
        ]);
    });

    test('drops placeholders and conditional prose instead of drawing dead chips', () => {
        const parsed = parseAnswerShows(
            'x\nSHOWS: none | Bible Version buttons | Split view button (if shown) | ' +
                'NIV button on screen | Font Size',
        );
        expect(parsed.text).toBe('x');
        expect(parsed.shows).toEqual([
            { kind: 'control', value: 'Font Size', name: 'Font Size' },
        ]);
    });

    test('removes all three closing frames even when options comes first', () => {
        expect(
            parseAnswerFrames(
                [
                    'Click Add Extra Bible.',
                    'OPTIONS: Continue | No thanks',
                    'NEEDS: screenshot',
                    'SHOWS: none',
                ].join('\n'),
            ),
        ).toEqual({
            text: 'Click Add Extra Bible.',
            options: ['Continue', 'No thanks'],
            requests: ['screenshot'],
            shows: [],
        });
    });
});

// The keyless provider is nothing but weaker models, and they honour "answer in
// English" in the prose and then change language in the frame. Both of these
// were measured against the live free tier before the guard was written.
describe('parseAnswerOptions, a model that changed language', () => {
    test('drops an option with no Latin letter in it at all', () => {
        const { text, options } = parseAnswerOptions(
            [
                'Press **Ctrl+B** to open the lookup.',
                'OPTIONS: Yes, walk me through it | 请确认显示这个按钮 |' +
                    ' No thanks',
            ].join('\n'),
        );
        expect(text).toBe('Press **Ctrl+B** to open the lookup.');
        expect(options).toEqual(['Yes, walk me through it', 'No thanks']);
    });

    test('keeps an English option carrying a translated button name', () => {
        // The one thing that is deliberately NOT in English. Button names come
        // back in the language the app is displaying, so an option that names
        // one is correct and must survive.
        const { options } = parseAnswerOptions(
            [
                'Use the clear button.',
                'OPTIONS: Show me លុបព្រះគម្ពីរ | No thanks',
            ].join('\n'),
        );
        expect(options).toEqual(['Show me លុបព្រះគម្ពីរ', 'No thanks']);
    });
});

describe('checkIsWalkthroughEcho', () => {
    // The seven, verbatim, from the 2026-09-08 corpus run on Claude.
    it.each([
        'Yes, walk me through it',
        'Yes, show me how',
        'Yes, show me',
        'Show me the demo instead',
        'Yes',
        'OK, do it for me',
        'Walk me through it',
        // The button's own words behind a yes, seen 2026-09-08 under the
        // running-order answer beside the button itself.
        'Yes, show me step by step',
        'Show me it step by step',
    ])('reads %j as the walkthrough button in other words', (reply) => {
        expect(checkIsWalkthroughEcho(reply)).toBe(true);
    });
    it.each([
        'No thanks',
        'How do I style the verse text?',
        'I have song text to add',
        'Show me the button',
        "It's already on, something else is wrong",
        'Yes, turn it on',
    ])('keeps %j, which is a different reply', (reply) => {
        expect(checkIsWalkthroughEcho(reply)).toBe(false);
    });
});

describe('genMessageReplies beside the walkthrough buttons', () => {
    const ACTIONS = ['Show me step by step', 'Do it for me'];
    it('drops the model option that accepts the walkthrough', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['Yes, walk me through it', 'How do I style it?'],
            answerText: 'Would you like me to walk you through it?',
            askedText: 'How do I put a Bible verse on the screen?',
            actionLabels: ACTIONS,
            focus: 'presenter',
        });
        expect(replies).toEqual(['How do I style it?']);
    });
    it('keeps "Show me the button" when nothing offers a walkthrough', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['Yes, turn it on', 'Show me the button'],
            answerText: 'Want me to press it for you?',
            askedText: 'Nothing is showing on the projector',
            actionLabels: [],
            focus: 'presenter',
        });
        expect(replies).toEqual(['Yes, turn it on', 'Show me the button']);
    });
});

describe('checkIsDraftEcho', () => {
    // Verbatim from the 2026-09-08 starter-chip run on Kimi K2.6: the paste
    // and the page chips both ended with these under the real buttons.
    it.each([
        'Create the file',
        'Copy the text',
        'Copy to clipboard',
        'Yes, create the song file',
        'Save it as a song',
        'Copy song text',
    ])('reads %j as the draft button in other words', (reply) => {
        expect(checkIsDraftEcho(reply)).toBe(true);
    });
    it.each([
        'Change the key',
        'Add a chorus',
        'Save as Amazing Grace 2',
        'No thanks',
        'Create a new song',
    ])('keeps %j, which is a different reply', (reply) => {
        expect(checkIsDraftEcho(reply)).toBe(false);
    });
});

describe('genMessageReplies beside the drafted-song buttons', () => {
    const ACTIONS = ['Create "Amazing Grace"', 'Copy song text'];
    it('drops the model options that repeat the two buttons', async () => {
        const replies = await genMessageReplies({
            modelOptions: [
                'Create the file',
                'Copy the text',
                'Change the key',
            ],
            answerText: 'The song is ready. Press the buttons below.',
            askedText: 'Amazing grace, how sweet the sound',
            actionLabels: ACTIONS,
            focus: 'presenter',
        });
        expect(replies).toEqual(['Change the key']);
    });
    it('keeps "Create the file" when no song is on offer', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['Create the file', 'Not now'],
            answerText: 'Shall I write it out as a song file?',
            askedText: 'I have some words',
            actionLabels: [],
            focus: 'presenter',
        });
        expect(replies).toEqual(['Create the file', 'Not now']);
    });
});
