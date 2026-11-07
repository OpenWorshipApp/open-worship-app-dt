import { describe, expect, test } from 'vitest';

import {
    genWaitingInputAsk,
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
    test.each([
        ['ខ្មែរ', 'km'],
        ['ភាសាថៃ?', 'th'],
    ])('recognizes only an explicit language: %s', (text, expected) => {
        expect(readKnownBibleLanguage(text)).toBe(expected);
    });
    test('a model cannot replace explicit Khmer with a suggested Spanish choice or bypass validation', () => {
        expect(
            readWaitingInputReply(
                '{"kind":"choice","choice":1}',
                question,
                'ខ្មែរ',
            ),
        ).toEqual({ kind: 'value', value: 'km' });
        expect(
            readWaitingInputReply(
                '{"kind":"value","value":"es-ES"}',
                question,
                'ខ្មែរ',
            ),
        ).toEqual({ kind: 'value', value: 'km' });
        for (const raw of [
            '{"kind":"choice","choice":1,"tool":"install"}',
            '{"kind":"choice","choice":2}',
            '{"kind":"value","value":{}}',
        ]) {
            expect(readWaitingInputReply(raw, question, 'ខ្មែរ')).toBeNull();
        }
    });

    test('the helper sees the exact reply and previous passage without classifying punctuation', () => {
        const prompt = genWaitingInputAsk(
            { ...question, valueKind: 'passage', previous: 'John 3:16' },
            'next chapter please?',
            'Khmer',
        );
        const data = JSON.parse(prompt.split('\n').at(-1)!);
        expect(data).toMatchObject({
            previous: 'John 3:16',
            typed: 'next chapter please?',
            valueKind: 'passage',
        });
        expect(prompt).toContain('in Khmer');
        expect(prompt).toContain('requiresPress');
        const languagePrompt = genWaitingInputAsk(question, 'ភាសាថៃ?', 'Khmer');
        expect(languagePrompt).toContain('ភាសាថៃ?');
    });
});

test.each(['ថៃឬបារាំង', 'មិនច្បាស់'])(
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
