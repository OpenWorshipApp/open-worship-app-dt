import { describe, expect, test } from 'vitest';

import { parseTextToolCalls } from './textToolCallHelpers';

// A schema with every kind of value a parameter written between XML tags is
// read by -- and one with no type at all.
const TOOLS = [
    {
        name: 'owa_find_ui',
        inputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
                highlight: { type: 'boolean' },
                anyPage: { type: 'boolean' },
                exact: { type: 'boolean' },
                where: { type: 'object' },
                steps: { type: 'array' },
                note: {},
            },
        },
    },
];

function argsOf(parsed: ReturnType<typeof parseTextToolCalls>, index = 0) {
    return JSON.parse(parsed!.calls[index].function.arguments);
}

describe('values written between XML tags, read by the tool’s schema', () => {
    test('a yes/no, an object, a list, and words with no type to go by', () => {
        const parsed = parseTextToolCalls(
            [
                '<function=owa_find_ui>',
                '<parameter=text>Clear All</parameter>',
                '<parameter=highlight> TRUE </parameter>',
                '<parameter=anyPage>false</parameter>',
                // Neither: the words, for the tool to refuse.
                '<parameter=exact>maybe</parameter>',
                '<parameter=where>{"page": "reader.html"}</parameter>',
                '<parameter=steps>[1, 2]</parameter>',
                '<parameter=note>just some words</parameter>',
                '</function>',
            ].join('\n'),
            TOOLS,
        );
        expect(parsed?.calls).toHaveLength(1);
        expect(argsOf(parsed)).toEqual({
            text: 'Clear All',
            highlight: true,
            anyPage: false,
            exact: 'maybe',
            where: { page: 'reader.html' },
            steps: [1, 2],
            note: 'just some words',
        });
    });

    test('an object that does not parse is kept as the words written', () => {
        const parsed = parseTextToolCalls(
            '<function=owa_find_ui><parameter=where>{page: reader' +
                '</parameter></function>',
            TOOLS,
        );
        expect(argsOf(parsed)).toEqual({ where: '{page: reader' });
    });
});

describe('a JSON list of calls with some that are no call', () => {
    test('a value that is no object, or has no name, is skipped; odd arguments are none', () => {
        const parsed = parseTextToolCalls(
            'Let me look.\n[TOOL_CALLS] [' +
                '{"name": "owa_find_ui", "arguments": "5"}, ' +
                '42, ' +
                '{"name": "", "arguments": {"text": "x"}}, ' +
                // No `]` inside: see the report on a nested list.
                '{"function": {"name": "functions.owa_find_ui", ' +
                '"arguments": "true"}}' +
                ']',
            TOOLS,
        );
        expect(
            parsed?.calls.map((call) => {
                return [call.function.name, call.function.arguments];
            }),
        ).toEqual([
            ['owa_find_ui', '{}'],
            ['owa_find_ui', '{}'],
        ]);
        expect(parsed?.calls.map((call) => call.id)).toEqual([
            'text_call_1',
            'text_call_2',
        ]);
        expect(parsed?.text).toBe('Let me look.');
    });
});

describe('a fenced JSON block that is not a call', () => {
    test('stays in the words, beside the call that is one', () => {
        const fence = '```json\n{"theme": "dark"}\n```';
        const parsed = parseTextToolCalls(
            `Your setting reads:\n${fence}\n` +
                '<function=owa_find_ui><parameter=text>Theme</parameter>' +
                '</function>',
            TOOLS,
        );
        expect(parsed?.calls).toHaveLength(1);
        expect(argsOf(parsed)).toEqual({ text: 'Theme' });
        expect(parsed?.text).toBe(`Your setting reads:\n${fence}`);
        // On its own it is an answer, not a call.
        expect(
            parseTextToolCalls(`Your setting reads:\n${fence}`, TOOLS),
        ).toBeNull();
    });
});
