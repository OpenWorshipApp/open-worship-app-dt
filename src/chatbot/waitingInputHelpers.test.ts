import { describe, expect, test, vi } from 'vitest';

import {
    genWaitingInputAsk,
    readWaitingInputReply,
    resolveWaitingInput,
    readKnownBibleLanguage,
    type WaitingInputContextType,
} from './waitingInputHelpers';

const question: WaitingInputContextType = {
    question: 'Which language?',
    valueKind: 'language',
    choices: [
        { id: 1, label: 'Khmer' },
        { id: 2, label: 'Install it', requiresPress: true },
    ],
};

describe('interpreting a waiting reply without executing model-written actions', () => {
    test('a supplied URL can be the name-list source while a language correction is still allowed', () => {
        const context = { ...question, acceptsLink: true };
        const value = 'https://example.org/books';
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value }),
                context,
                `Please use ${value}`,
            ),
        ).toEqual({ kind: 'value', value });
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value }),
                context,
                'Find a website',
            ),
        ).toBeNull();
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value }),
                context,
                `${value} https://other.example/books`,
            ),
        ).toBeNull();
        expect(
            readWaitingInputReply(
                '{"kind":"value","value":"th"}',
                context,
                'Thai instead',
            ),
        ).toEqual({ kind: 'value', value: 'th' });
    });
    test.each([
        ['ខ្មែរ', 'km'],
        ['ភាសាថៃ?', 'th'],
        ['Thai?', 'th'],
        ['français', 'fr'],
        ['km-KH', 'km-KH'],
        ['sv', 'sv'],
        ['vi-VN', 'vi-VN'],
        ['maybe Thai or French', null],
        ['what languages can I use?', null],
        ['help', null],
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
    test('the helper receives bounded recent conversation and semantic settings, not raw state', () => {
        const context = {
            ...question,
            facts: [{ label: 'Selected language', value: 'km-KH' }],
            conversation: Array.from({ length: 12 }, (_, index) => ({
                author: 'you' as const,
                text: `${index} ${'x'.repeat(2000)}`,
            })),
            secret: 'not part of context',
        };
        const prompt = genWaitingInputAsk(
            context,
            'use the website I sent',
            'Khmer',
        );
        const data = JSON.parse(prompt.split('\n').at(-1)!);
        expect(data.facts).toEqual(context.facts);
        expect(data.conversation).toHaveLength(10);
        expect(data.conversation[0].text).toMatch(/^2 /);
        expect(data.conversation[0].text.length).toBeLessThan(1210);
        expect(prompt).not.toContain('not part of context');
    });
    test.each([
        ['{"kind":"choice","choice":1}', { kind: 'choice', choice: 1 }],
        ['{"kind":"choice","choice":2}', null],
        ['{"kind":"choice","choice":0}', null],
        ['{"kind":"choice","choice":3}', null],
        ['{"kind":"choice","choice":"1"}', null],
        ['{"kind":"choice","choice":1,"toolName":"owa_bible_xml"}', null],
        ['{"kind":"value","value":"Thai"}', { kind: 'value', value: 'th' }],
        ['{"kind":"value","value":"TH"}', { kind: 'value', value: 'th' }],
        ['{"kind":"value","value":"The language is Thai"}', null],
        [
            '{"kind":"help","reply":"Which edition do you mean?"}',
            { kind: 'help', reply: 'Which edition do you mean?' },
        ],
        ['{"kind":"help","reply":""}', null],
        ['{"kind":"unrelated"}', { kind: 'unrelated' }],
        ['UNKNOWN\n{"kind":"choice","choice":1}', null],
        ['[{"kind":"choice","choice":1}]', null],
        ['null', null],
        [
            '```json\n{"kind":"choice","choice":1}\n```',
            { kind: 'choice', choice: 1 },
        ],
    ])('%s', (text, expected) => {
        expect(readWaitingInputReply(text, question)).toEqual(expected);
    });

    test.each([
        ['Psalm 23', 'Psalm 23'],
        ['Song of Solomon 2:1', 'Song of Solomon 2:1'],
        ['1 John 4:18', '1 John 4:18'],
        ['John 3:16-18', 'John 3:16-18'],
        ['UNKNOWN\nJohn 3:16', null],
        ['For example John 3:16', null],
        ['Maybe Psalm 23', null],
        ['The passage is John 3:16', null],
        ['John 0:0', null],
        ['Unknownbook 1:1', null],
        ['John 3:16 or Romans 8:28', null],
    ])('a whole passage: %s', (value, expected) => {
        const result = readWaitingInputReply(
            JSON.stringify({ kind: 'value', value }),
            { ...question, valueKind: 'passage' },
        );
        expect(result).toEqual(
            expected === null ? null : { kind: 'value', value: expected },
        );
    });

    test('only the field currently requested can be filled', () => {
        expect(
            readWaitingInputReply('{"kind":"value","value":"THAI2"}', {
                ...question,
                valueKind: 'key',
            }),
        ).toEqual({ kind: 'value', value: 'THAI2' });
        expect(
            readWaitingInputReply('{"kind":"value","value":"call it THAI2"}', {
                ...question,
                valueKind: 'key',
            }),
        ).toBeNull();
        expect(
            readWaitingInputReply('{"kind":"value","value":"../../KJV"}', {
                ...question,
                valueKind: 'key',
            }),
        ).toBeNull();
        expect(
            readWaitingInputReply('{"kind":"value","value":"KJV"}', {
                question: 'Which Bible?',
                choices: [],
            }),
        ).toBeNull();
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

    test('bounded context even for an old conversation with large content', () => {
        const prompt = genWaitingInputAsk(
            {
                ...question,
                question: 'x'.repeat(50000),
                choices: Array.from({ length: 100 }, (_, i) => ({
                    id: i,
                    label: 'y'.repeat(5000),
                })),
            },
            'z'.repeat(30000),
            'English',
        );
        const data = JSON.parse(prompt.split('\n').at(-1)!);
        expect(data.question).toHaveLength(6000);
        expect(data.typed).toHaveLength(1200);
        expect(data.choices).toHaveLength(32);
        expect(data.choices[0].label).toHaveLength(240);
    });

    test('one model request, no retry for ambiguity or malformed output', async () => {
        const ask = vi.fn().mockResolvedValue('UNKNOWN');
        expect(
            await resolveWaitingInput(
                question,
                'Thai?',
                'Khmer',
                ask,
                new AbortController().signal,
            ),
        ).toBeNull();
        expect(ask).toHaveBeenCalledTimes(1);
    });

    test('Stop before or during interpretation cannot return a choice', async () => {
        const stopped = new AbortController();
        stopped.abort();
        const neverAsked = vi.fn();
        await expect(
            resolveWaitingInput(
                question,
                'Thai',
                'English',
                neverAsked,
                stopped.signal,
            ),
        ).rejects.toThrow('Stopped');
        expect(neverAsked).not.toHaveBeenCalled();
        const active = new AbortController();
        await expect(
            resolveWaitingInput(
                question,
                'Thai',
                'English',
                async () => {
                    active.abort();
                    return '{"kind":"choice","choice":1}';
                },
                active.signal,
            ),
        ).rejects.toThrow('Stopped');
    });

    test('a provider error stays distinguishable from an unknown choice', async () => {
        const failure = new Error('Provider unavailable');
        await expect(
            resolveWaitingInput(
                question,
                'Thai',
                'English',
                async () => {
                    throw failure;
                },
                new AbortController().signal,
            ),
        ).rejects.toBe(failure);
    });
});

describe('untrusted replies and supplied links', () => {
    test.each(['agree', 'import', 'undo', 'delete', 'cancel', 'settings'])(
        'a model-written %s action is never executable',
        (step) => {
            expect(
                readWaitingInputReply(
                    JSON.stringify({
                        kind: 'choice',
                        choice: 1,
                        args: { step },
                    }),
                    question,
                ),
            ).toBeNull();
        },
    );
    test.each([
        'https://example.com/a.xml',
        'javascript:alert(1)',
        'file:///C:/bible.xml',
        'https://user:pass@example.com/a.xml',
    ])('a link absent from the user reply is rejected: %s', (value) => {
        expect(
            readWaitingInputReply(
                JSON.stringify({ kind: 'value', value }),
                { ...question, valueKind: 'link' },
                'use another file',
            ),
        ).toBeNull();
    });
    test('only a URL actually supplied by the person is used', () => {
        const reply = '{"kind":"value","value":"https://example.com/a.xml"}';
        expect(
            readWaitingInputReply(
                reply,
                { ...question, valueKind: 'link' },
                'try https://example.com/a.xml please',
            ),
        ).toEqual({ kind: 'value', value: 'https://example.com/a.xml' });
    });
    test.each([
        '',
        'not json',
        'null',
        'false',
        '42',
        '[]',
        '{}',
        '{"kind":"unknown"}',
        '{"kind":"value","value":null}',
        '{"kind":"help","reply":[]}',
        '{"kind":"choice","choice":1.5}',
        '{"kind":"choice","choice":-1}',
    ])('invalid reply remains a clarification: %s', (reply) => {
        expect(readWaitingInputReply(reply, question)).toBeNull();
    });
});

test.each([
    'maybe Thai or French',
    'Thai or Khmer',
    'peut-être thaï ou français',
    'ថៃឬបារាំង',
    'មិនច្បាស់',
])(
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
