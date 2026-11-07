import { describe, expect, test } from 'vitest';

import {
    readWaitingInputReply,
    readKnownBibleLanguage,
    type WaitingInputContextType,
} from '../../../../../../chatbot/waitingInputHelpers';

const question: WaitingInputContextType = {
    question: 'Which language?',
    valueKind: 'language',
    choices: [
        { id: 1, label: 'Khmer' },
        { id: 2, label: 'Install it', requiresPress: true },
    ],
};

describe('interpreting a waiting reply without executing model-written actions', () => {
    test.each([['français', 'fr']])(
        'recognizes only an explicit language: %s',
        (text, expected) => {
            expect(readKnownBibleLanguage(text)).toBe(expected);
        },
    );
});

test.each(['peut-être thaï ou français'])(
    'an uncertain reply never advances even if the model guesses: %s',
    (typed) => {
        expect(
            readWaitingInputReply(
                '{"kind":"choice","choice":1}',
                question,
                typed,
            ),
        ).toBeNull();
        expect(
            readWaitingInputReply(
                '{"kind":"value","value":"th"}',
                question,
                typed,
            ),
        ).toBeNull();
        expect(
            readWaitingInputReply(
                '{"kind":"help","reply":"Which language?"}',
                question,
                typed,
            )?.kind,
        ).toBe('help');
    },
);
