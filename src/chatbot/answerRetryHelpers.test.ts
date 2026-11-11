import { describe, expect, it } from 'vitest';

import {
    RETRY_APPROACH_LIST,
    countRetryAttempt,
    findRetryQuestion,
    genRetryAskHint,
    listRetryableAnswerIds,
    pickRetryModel,
    toAnthropicRetryEffort,
    toRetryMaxTokens,
    toRetryPicks,
    toRetryReasoningEffort,
    toRetryTemperature,
} from './answerRetryHelpers';
import type { ChatMessageType } from './chatSessionHelpers';

function genMessage(
    id: number,
    author: 'you' | 'bot',
    text: string,
    extra: Partial<ChatMessageType> = {},
): ChatMessageType {
    return { id, author, text, ...extra };
}

// 2026-11-10, the user: _as user I'd like to ask chatbot to retry again on
// the answer, so I can get different result_, and the goal _try with
// different approach and different effort get different result_.
describe('the question a Retry asks again', () => {
    it('is the question right above the answer', () => {
        const messages = [
            genMessage(1, 'you', 'How do I add a song?'),
            genMessage(2, 'bot', 'Press **Add**.'),
        ];
        expect(findRetryQuestion(messages, 2)?.id).toBe(1);
    });

    it("steps over the window's own follow-up, never another answer", () => {
        const messages = [
            genMessage(1, 'you', 'How do I add a song?'),
            genMessage(2, 'bot', 'Press **Add**.'),
            genMessage(3, 'bot', 'Sorry — that did not help.', {
                isFollowUp: true,
            }),
            genMessage(4, 'bot', 'Undone.'),
        ];
        // An answer under another answer is a card a button opened.
        expect(findRetryQuestion(messages, 4)).toBeNull();
        // The follow-up itself is no answer to retry.
        expect(findRetryQuestion(messages, 3)).toBeNull();
        expect(findRetryQuestion(messages, 2)?.id).toBe(1);
    });

    it('is never a command the window ran, but is a /btw question', () => {
        const command = [
            genMessage(1, 'you', '/clear'),
            genMessage(2, 'bot', 'The screens are clear.'),
        ];
        expect(findRetryQuestion(command, 2)).toBeNull();
        const general = [
            genMessage(1, 'you', '/btw what is a psalm?'),
            genMessage(2, 'bot', 'A song of praise.'),
        ];
        expect(findRetryQuestion(general, 2)?.id).toBe(1);
    });

    it('is never one the window asked on their behalf', () => {
        const messages = [
            genMessage(1, 'you', 'Help with step 3', {
                note: 'Asked by the walkthrough card',
            }),
            genMessage(2, 'bot', 'Press the gear.'),
        ];
        expect(findRetryQuestion(messages, 2)).toBeNull();
    });

    it('may be a picture with no words, never nothing at all', () => {
        const picture = [
            genMessage(1, 'you', '', {
                attachments: [{ id: 1, kind: 'image', label: 'Screen' } as any],
            }),
            genMessage(2, 'bot', 'That is the Presenter.'),
        ];
        expect(findRetryQuestion(picture, 2)?.id).toBe(1);
        const empty = [genMessage(1, 'you', '  '), genMessage(2, 'bot', 'Hi')];
        expect(findRetryQuestion(empty, 2)).toBeNull();
        // Nothing above at all, and an id the tab does not hold.
        expect(findRetryQuestion([genMessage(1, 'bot', 'Hi')], 1)).toBeNull();
        expect(findRetryQuestion(empty, 99)).toBeNull();
    });

    it('lists in one pass the same answers it finds a question for', () => {
        const messages = [
            genMessage(1, 'you', 'How do I add a song?'),
            genMessage(2, 'bot', 'Press **Add**.'),
            genMessage(3, 'bot', 'Sorry.', { isFollowUp: true }),
            genMessage(4, 'bot', 'Undone.'),
            genMessage(5, 'you', '/clear'),
            genMessage(6, 'bot', 'Cleared.'),
            genMessage(7, 'you', 'Step 3?', { note: 'Asked by the card' }),
            genMessage(8, 'bot', 'Press it.'),
            genMessage(9, 'you', 'What is a psalm?'),
            genMessage(10, 'bot', 'Sorry.', { isFollowUp: true }),
            genMessage(11, 'bot', 'A song of praise.'),
        ];
        const listed = listRetryableAnswerIds(messages);
        expect([...listed]).toEqual([2, 11]);
        for (const message of messages) {
            expect(findRetryQuestion(messages, message.id) !== null).toBe(
                listed.has(message.id),
            );
        }
    });

    it('counts the tries off the transcript', () => {
        const messages = [
            genMessage(1, 'you', 'How do I add a song?'),
            genMessage(2, 'bot', 'Press **Add**.'),
            genMessage(3, 'you', ' How do I add a song? '),
            genMessage(4, 'bot', 'Open the Documents list.'),
        ];
        expect(countRetryAttempt(messages, 'How do I add a song?')).toBe(2);
        expect(countRetryAttempt([], 'anything')).toBe(1);
    });
});

describe('what a retry tells the model', () => {
    it('takes another way in at each try, in turn', () => {
        const hints = [1, 2, 3, 4].map((attempt) => {
            return genRetryAskHint('Press Add.', attempt, true);
        });
        expect(hints[0]).toContain(RETRY_APPROACH_LIST[0]);
        expect(hints[1]).toContain(RETRY_APPROACH_LIST[1]);
        expect(hints[2]).toContain(RETRY_APPROACH_LIST[2]);
        expect(hints[3]).toContain(RETRY_APPROACH_LIST[0]);
        for (const hint of hints) {
            expect(hint).toContain('DIFFERENT answer');
            // Rewording is not a different answer.
            expect(hint).toContain('the same steps reworded');
            // Different, never wrong; and an edit already made stays made.
            expect(hint).toContain('never a wrong one');
            expect(hint).toContain('that change is still made');
            // The guide page's "copy its sentences as they stand" is set
            // aside, its names are not.
            expect(hint).toContain('as they stand does not hold');
            expect(hint).toContain('exactly as the page gives them');
        }
    });

    it('quotes the earlier answer only when the history does not carry it', () => {
        expect(genRetryAskHint('Press Add.', 1, true)).not.toContain(
            'Your earlier answer was',
        );
        expect(
            genRetryAskHint('Press   Add.\n\nThen Save.', 1, false),
        ).toContain('Your earlier answer was: «Press Add. Then Save.»');
        // Cut on a space with a mark where it stops: it rides every round.
        const long = genRetryAskHint('word '.repeat(400), 1, false);
        const quoted = /«(.*)»/.exec(long)?.[1] ?? '';
        expect(quoted.length).toBeLessThanOrEqual(601);
        expect(quoted.endsWith('word…')).toBe(true);
    });
});

describe('the effort a retry is asked at', () => {
    it('steps reasoning effort up a level a try, to high at most', () => {
        expect(toRetryReasoningEffort('low')).toBe('low');
        expect(toRetryReasoningEffort('low', 1)).toBe('medium');
        expect(toRetryReasoningEffort('low', 2)).toBe('high');
        expect(toRetryReasoningEffort('low', 5)).toBe('high');
        expect(toRetryReasoningEffort('high', 1)).toBe('high');
    });

    it('raises Claude 5 effort from its own default, never to max', () => {
        // Haiku 5.5 and Opus 5.5 default to medium.
        expect(toAnthropicRetryEffort('claude-haiku-5-5', 1)).toBe('high');
        expect(
            toAnthropicRetryEffort('global.anthropic.claude-haiku-5-5', 2),
        ).toBe('xhigh');
        // The rest of the 5 family defaults to high.
        expect(toAnthropicRetryEffort('claude-sonnet-5', 1)).toBe('xhigh');
        expect(toAnthropicRetryEffort('claude-opus-5', 4)).toBe('xhigh');
        // Not a retry, and a model that refuses the setting.
        expect(toAnthropicRetryEffort('claude-sonnet-5', 0)).toBeNull();
        expect(toAnthropicRetryEffort('claude-haiku-4-5', 1)).toBeNull();
    });

    it('gives more room to think, and samples a local program', () => {
        expect(toRetryMaxTokens(6000)).toBe(6000);
        expect(toRetryMaxTokens(6000, 1)).toBe(12000);
        expect(toRetryTemperature()).toBeNull();
        expect(toRetryTemperature(1)).toBe(0.7);
        expect(toRetryTemperature(3)).toBe(1);
    });
});

// 2026-11-10, the user: _make the retrying pick different assistant for
// temparary, e.g. user didn't like result from gemma4 then try with another
// model (but keep the gemma4 for the next asking)_.
describe('who answers a retry', () => {
    it('puts whoever wrote the answer last in the line, never out of it', () => {
        const picks = ['gemma4:cloud', 'nemotron', 'gemma-4-12b'];
        expect(
            toRetryPicks(picks, (pick) => {
                return pick === 'gemma4:cloud';
            }),
        ).toEqual(['nemotron', 'gemma-4-12b', 'gemma4:cloud']);
        // Nobody else: the one there is still answers.
        expect(
            toRetryPicks(['gemma4:cloud'], (pick) => {
                return pick === 'gemma4:cloud';
            }),
        ).toEqual(['gemma4:cloud']);
        // Not in the line at all: the line as Auto ranked it.
        expect(
            toRetryPicks(picks, () => {
                return false;
            }),
        ).toEqual(picks);
    });

    const ranked = [
        { id: 'opus', label: 'Opus 5' },
        { id: 'sonnet', label: 'Sonnet 5' },
        { id: 'haiku', label: 'Haiku 4.5' },
    ];
    const genAnswerer = (modelId: string, extra = {}) => {
        return {
            hasAssistant: true,
            isAuto: false,
            assistantLabel: 'Claude',
            modelId,
            rankedModels: ranked,
            ...extra,
        };
    };

    it('asks a paid key the next model up, else the nearest down', () => {
        expect(pickRetryModel(genAnswerer('sonnet'))?.id).toBe('opus');
        expect(pickRetryModel(genAnswerer('haiku'))?.id).toBe('sonnet');
        expect(pickRetryModel(genAnswerer('opus'))?.id).toBe('sonnet');
        // One that cannot take the question is stepped over.
        expect(
            pickRetryModel(genAnswerer('sonnet'), (id) => {
                return id !== 'opus';
            })?.id,
        ).toBe('haiku');
    });

    it('picks no model on Auto, with no assistant or a list in no order', () => {
        expect(pickRetryModel(genAnswerer('sonnet', { isAuto: true }))).toBe(
            null,
        );
        expect(
            pickRetryModel(genAnswerer('sonnet', { hasAssistant: false })),
        ).toBeNull();
        expect(
            pickRetryModel(genAnswerer('sonnet', { rankedModels: [] })),
        ).toBeNull();
        expect(
            pickRetryModel(genAnswerer('sonnet'), () => {
                return false;
            }),
        ).toBeNull();
    });
});
