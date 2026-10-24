import { describe, expect, test } from 'vitest';

import {
    applyAnswerRating,
    ASK_SMARTER_TOOL_NAME,
    checkIsLastAnswer,
    DISLIKE_REPLY_LIST,
    findAnsweredQuestion,
    findComplainedQuestion,
    findSmarterModel,
    genComplaintAdvice,
    genDislikeFollowUp,
    genSmarterModelAdvice,
    readSmarterAsk,
    type AnswererType,
} from './answerRatingHelpers';
import type { ChatMessageType } from './chatSessionHelpers';
import { checkIsDisputingAnswer, findDisputedPage } from './disputeHelpers';

const RANKED = [
    { id: 'big', label: 'Big' },
    { id: 'mid', label: 'Mid' },
    { id: 'small', label: 'Small' },
];

function genAnswerer(extra: Partial<AnswererType> = {}): AnswererType {
    return {
        hasAssistant: true,
        isAuto: false,
        assistantLabel: 'Cloud',
        modelId: 'small',
        rankedModels: RANKED,
        ...extra,
    };
}

const TALK: ChatMessageType[] = [
    { id: 1, author: 'you', text: 'How do I add a slide?' },
    {
        id: 2,
        author: 'bot',
        text: 'Right-click the slide list.',
        actions: [
            {
                label: 'Show me step by step',
                toolName: 'owa_guide_start',
                args: { manualId: 'W-15', find: 'New Slide' },
            },
        ],
    },
];

describe('the next model up', () => {
    test('is one step, not the top', () => {
        expect(findSmarterModel(genAnswerer())?.id).toBe('mid');
        expect(findSmarterModel(genAnswerer({ modelId: 'mid' }))?.id).toBe(
            'big',
        );
    });

    test('is nobody for the best one, an unranked one, Auto, or no assistant', () => {
        expect(findSmarterModel(genAnswerer({ modelId: 'big' }))).toBeNull();
        expect(findSmarterModel(genAnswerer({ modelId: 'other' }))).toBeNull();
        expect(findSmarterModel(genAnswerer({ rankedModels: [] }))).toBeNull();
        expect(findSmarterModel(genAnswerer({ isAuto: true }))).toBeNull();
        expect(
            findSmarterModel(genAnswerer({ hasAssistant: false })),
        ).toBeNull();
    });
});

describe('the advice', () => {
    test('names the model in use and the next one up, with a button that asks again', () => {
        const advice = genSmarterModelAdvice(
            genAnswerer(),
            '  How do I add a slide? ',
        );
        expect(advice.text).toContain('Cloud · Small');
        expect(advice.text).toContain('Mid is the next one up');
        expect(advice.action).toEqual({
            label: 'Ask again with Mid',
            toolName: ASK_SMARTER_TOOL_NAME,
            args: { model: 'mid', question: 'How do I add a slide?' },
        });
        // Nothing to ask again: the sentence still, no button.
        expect(genSmarterModelAdvice(genAnswerer(), null).action).toBeNull();
        expect(genSmarterModelAdvice(genAnswerer(), '  ').action).toBeNull();
    });

    test('points at the lists when there is no next one to name', () => {
        const top = genSmarterModelAdvice(
            genAnswerer({ modelId: 'big' }),
            'How do I add a slide?',
        );
        expect(top.action).toBeNull();
        // On the best one already (seen live, on the top model: "try a
        // larger model in the MODEL list" pointed at a model that is not
        // there): another assistant is the only way up.
        expect(top.text).toContain('the best model Cloud has (Big)');
        expect(top.text).not.toContain('MODEL list');
        expect(top.text).toContain('ASSISTANT list');
        // A server of the user's own: no order to go by, so no button and
        // no model is called the better one.
        const own = genSmarterModelAdvice(
            genAnswerer({ assistantLabel: 'My server', rankedModels: [] }),
            'How do I add a slide?',
        );
        expect(own.action).toBeNull();
        expect(own.text).toContain('This tab is asking My server:');
        expect(own.text).toContain('a larger model');
        const auto = genSmarterModelAdvice(
            genAnswerer({ isAuto: true }),
            'How do I add a slide?',
        );
        expect(auto.action).toBeNull();
        expect(auto.text).toContain('on Auto');
    });

    test('says an assistant answers better when none is answering', () => {
        const advice = genSmarterModelAdvice(
            genAnswerer({ hasAssistant: false }),
            'How do I add a slide?',
        );
        expect(advice.action).toBeNull();
        expect(advice.text).toContain('the guide alone');
        expect(advice.text).not.toContain('smarter model');
    });
});

describe('the question an answer was given to', () => {
    test('is the nearest thing the person said above it', () => {
        expect(findAnsweredQuestion(TALK, 2)).toBe('How do I add a slide?');
        expect(findAnsweredQuestion(TALK, 1)).toBeNull();
        expect(findAnsweredQuestion(TALK, 99)).toBeNull();
    });

    test('for a complaint, is the one above the last real answer', () => {
        const withFollowUp: ChatMessageType[] = [
            ...TALK,
            { id: 3, author: 'bot', text: 'Sorry...', isFollowUp: true },
        ];
        expect(findComplainedQuestion(withFollowUp)).toBe(
            'How do I add a slide?',
        );
        expect(findComplainedQuestion([])).toBeNull();
        expect(
            findComplainedQuestion([{ id: 1, author: 'you', text: 'Hi' }]),
        ).toBeNull();
    });

    test('is never one of the three sentences, nor an earlier complaint', () => {
        // A thumb down, "The steps did not work" pressed, and the answer to
        // THAT disliked too: what is asked again is still the question.
        const talk: ChatMessageType[] = [
            ...TALK,
            { id: 3, author: 'bot', text: 'Sorry...', isFollowUp: true },
            { id: 4, author: 'you', text: DISLIKE_REPLY_LIST[1] },
            { id: 5, author: 'bot', text: 'Try the menu instead.' },
        ];
        expect(findAnsweredQuestion(talk, 5)).toBe('How do I add a slide?');
        // A complaint typed under a complaint is about the question above
        // both -- told apart by the reader the window hands in.
        const typed: ChatMessageType[] = [
            ...TALK,
            { id: 3, author: 'you', text: 'That is wrong' },
            { id: 4, author: 'bot', text: 'Try the menu instead.' },
        ];
        expect(findComplainedQuestion(typed, checkIsDisputingAnswer)).toBe(
            'How do I add a slide?',
        );
        // With nothing but complaints above, the nearest one will have to do.
        expect(
            findComplainedQuestion(
                [
                    { id: 1, author: 'you', text: 'That is wrong' },
                    { id: 2, author: 'bot', text: 'Sorry?' },
                ],
                checkIsDisputingAnswer,
            ),
        ).toBe('That is wrong');
    });

    test('says which answer is the one at the bottom', () => {
        const talk: ChatMessageType[] = [
            ...TALK,
            { id: 3, author: 'you', text: 'And a second one?' },
            { id: 4, author: 'bot', text: 'The same way.' },
            { id: 5, author: 'bot', text: 'Sorry...', isFollowUp: true },
        ];
        expect(checkIsLastAnswer(talk, 4)).toBe(true);
        expect(checkIsLastAnswer(talk, 2)).toBe(false);
        expect(checkIsLastAnswer(talk, 5)).toBe(false);
        expect(checkIsLastAnswer([], 1)).toBe(false);
    });
});

describe('the press of Ask again with', () => {
    const ARGS = { model: 'mid', question: ' How do I add a slide? ' };

    test('is read against who is answering now', () => {
        expect(readSmarterAsk(ARGS, genAnswerer())).toEqual({
            model: 'mid',
            label: 'Mid',
            question: 'How do I add a slide?',
        });
    });

    test('is nothing once the tab has moved on, or for a button with no question', () => {
        // Another assistant since: its list has no such model.
        expect(
            readSmarterAsk(
                ARGS,
                genAnswerer({ rankedModels: [{ id: 'x', label: 'X' }] }),
            ),
        ).toBeNull();
        expect(readSmarterAsk(ARGS, genAnswerer({ isAuto: true }))).toBeNull();
        expect(
            readSmarterAsk(ARGS, genAnswerer({ hasAssistant: false })),
        ).toBeNull();
        expect(readSmarterAsk({ model: 'mid' }, genAnswerer())).toBeNull();
        expect(
            readSmarterAsk({ model: 'mid', question: 7 }, genAnswerer()),
        ).toBeNull();
        expect(readSmarterAsk(undefined, genAnswerer())).toBeNull();
    });
});

describe('the advice under the answer to a typed complaint', () => {
    test('names the next model up and asks the question the complaint is about', () => {
        const advice = genComplaintAdvice(
            genAnswerer(),
            TALK,
            checkIsDisputingAnswer,
        );
        expect(advice?.text).toContain('Mid is the next one up');
        expect(advice?.action?.args).toEqual({
            model: 'mid',
            question: 'How do I add a slide?',
        });
    });

    test('is not owed with no answer above, or right under the follow-up that said it', () => {
        expect(
            genComplaintAdvice(genAnswerer(), [], checkIsDisputingAnswer),
        ).toBeNull();
        expect(
            genComplaintAdvice(
                genAnswerer(),
                [TALK[0]],
                checkIsDisputingAnswer,
            ),
        ).toBeNull();
        expect(
            genComplaintAdvice(
                genAnswerer(),
                [
                    ...TALK,
                    {
                        id: 3,
                        author: 'bot',
                        text: 'Sorry...',
                        isFollowUp: true,
                    },
                ],
                checkIsDisputingAnswer,
            ),
        ).toBeNull();
    });
});

describe('a thumb', () => {
    test('down owes the follow-up once, however often it is toggled', () => {
        const first = applyAnswerRating(TALK, 2, 'dislike');
        expect(first.isNewDislike).toBe(true);
        expect(first.messages[1].rating).toBe('dislike');
        expect(first.messages[1].isFollowedUp).toBe(true);
        // Pressed again: off, and nothing is owed.
        const off = applyAnswerRating(first.messages, 2, 'dislike');
        expect(off.isNewDislike).toBe(false);
        expect(off.messages[1].rating).toBeUndefined();
        // Down a second time: marked, not followed up twice.
        const again = applyAnswerRating(off.messages, 2, 'dislike');
        expect(again.isNewDislike).toBe(false);
        expect(again.messages[1].rating).toBe('dislike');
    });

    test('up is kept and changes to down', () => {
        const liked = applyAnswerRating(TALK, 2, 'like');
        expect(liked.isNewDislike).toBe(false);
        expect(liked.messages[1].rating).toBe('like');
        const changed = applyAnswerRating(liked.messages, 2, 'dislike');
        expect(changed.isNewDislike).toBe(true);
        expect(changed.messages[1].rating).toBe('dislike');
    });

    test('is never put on a question or on the follow-up itself', () => {
        const talk: ChatMessageType[] = [
            ...TALK,
            { id: 3, author: 'bot', text: 'Sorry...', isFollowUp: true },
        ];
        expect(applyAnswerRating(talk, 1, 'dislike').isNewDislike).toBe(false);
        expect(
            applyAnswerRating(talk, 1, 'dislike').messages[0].rating,
        ).toBeUndefined();
        expect(applyAnswerRating(talk, 3, 'dislike').isNewDislike).toBe(false);
        expect(
            applyAnswerRating(talk, 3, 'like').messages[2].rating,
        ).toBeUndefined();
    });
});

describe('the follow-up to a thumb down', () => {
    test('asks what was wrong, gives the advice and its button', () => {
        const followUp = genDislikeFollowUp(
            genAnswerer(),
            'How do I add a slide?',
        );
        expect(followUp.author).toBe('bot');
        expect(followUp.isFollowUp).toBe(true);
        expect(followUp.text).toContain('Tell me what was wrong');
        expect(followUp.text).toContain('Mid is the next one up');
        expect(followUp.replies).toEqual([...DISLIKE_REPLY_LIST]);
        expect(followUp.actions).toEqual([
            {
                label: 'Ask again with Mid',
                toolName: ASK_SMARTER_TOOL_NAME,
                args: { model: 'mid', question: 'How do I add a slide?' },
            },
        ]);
        // No button to offer: no empty row of buttons either.
        expect(
            genDislikeFollowUp(genAnswerer({ modelId: 'big' }), 'Q').actions,
        ).toBeUndefined();
    });

    test('under an answer further up, names its question and offers no sentences', () => {
        // Pressed, a sentence is read as being about the LAST answer.
        const followUp = genDislikeFollowUp(
            genAnswerer(),
            'How do I add a slide?',
            false,
        );
        expect(followUp.text).toContain(
            'the answer to “How do I add a slide?”',
        );
        expect(followUp.replies).toBeUndefined();
        // The button still asks THAT question of the next model up.
        expect(followUp.actions?.[0].args?.question).toBe(
            'How do I add a slide?',
        );
        // A long question is quoted on one line.
        const long = genDislikeFollowUp(
            genAnswerer(),
            `How do I ${'really '.repeat(30)}add a slide?`,
            false,
        );
        expect(long.text).toContain('…”');
    });

    test('under what a command printed, blames no model', () => {
        const followUp = genDislikeFollowUp(genAnswerer(), '/screen');
        expect(followUp.isFollowUp).toBe(true);
        expect(followUp.text).not.toContain('smarter model');
        expect(followUp.actions).toBeUndefined();
        expect(followUp.replies).toBeUndefined();
        // `/btw` is the one slash line a model answers.
        expect(
            genDislikeFollowUp(genAnswerer(), '/btw what is a psalm').text,
        ).toContain('smarter model');
    });

    test('offers only sentences the dispute reader takes', () => {
        for (const reply of DISLIKE_REPLY_LIST) {
            expect(checkIsDisputingAnswer(reply), reply).toBe(true);
        }
    });

    test('does not hide the answer it follows from a complaint', () => {
        const talk: ChatMessageType[] = [
            ...TALK,
            {
                id: 3,
                ...genDislikeFollowUp(genAnswerer(), 'How do I add a slide?'),
            },
        ];
        // The page under the disliked answer is still the one in dispute.
        expect(findDisputedPage(talk)).toEqual({
            manualId: 'W-15',
            find: 'New Slide',
        });
    });
});
