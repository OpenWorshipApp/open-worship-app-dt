import { describe, expect, test } from 'vitest';

import {
    findAnsweredQuestion,
    genDislikeFollowUp,
    type AnswererType,
} from './answerRatingHelpers';
import type { ChatMessageType } from './chatSessionHelpers';

// A thumb down under an answer to a question with no words of its own -- a
// picture sent with an empty box -- and under an old answer nobody asked.

const GUIDE_ONLY: AnswererType = {
    hasAssistant: false,
    isAuto: false,
    assistantLabel: 'Guide',
    modelId: '',
    rankedModels: [],
};

describe('the question an answer was given to', () => {
    test('a picture sent with nothing typed is passed over for the words said before it', () => {
        const messages: ChatMessageType[] = [
            { id: 1, author: 'you', text: 'Why is my screen black?' },
            { id: 2, author: 'bot', text: 'Is a screen showing?' },
            // The 📷 alone: the question had no words.
            { id: 3, author: 'you', text: '   ' },
            { id: 4, author: 'bot', text: 'Screen 1 shows nothing.' },
        ];
        expect(findAnsweredQuestion(messages, 4)).toBe(
            'Why is my screen black?',
        );
    });
});

describe('the follow-up under an older answer', () => {
    test('with no question to name, says sorry and how to say what was wrong, with no reply buttons', () => {
        const followUp = genDislikeFollowUp(GUIDE_ONLY, null, false);
        expect(followUp).toEqual({
            author: 'bot',
            isFollowUp: true,
            text:
                'Sorry — that answer did not help. Tell me what was wrong ' +
                'and I will look again.\n\nNo assistant is answering in this ' +
                'tab — that came from the guide alone. An assistant usually ' +
                'answers better: pick one in the ASSISTANT list at the top ' +
                'of this window.',
        });
    });
});
