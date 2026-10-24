import { describe, expect, it } from 'vitest';

import { parseTextToolCalls } from './textToolCallHelpers';

const TOOLS = [
    {
        name: 'owa_help_search',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                focus: { type: 'string' },
                kind: { type: 'string' },
                limit: { type: 'integer' },
            },
        },
    },
    {
        name: 'owa_list_screens',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'owa_click',
        inputSchema: {
            type: 'object',
            properties: {
                find: { type: ['string', 'array'] },
                clicks: { type: 'integer' },
            },
        },
    },
];

function argsOf(parsed: ReturnType<typeof parseTextToolCalls>, index = 0) {
    return JSON.parse(parsed!.calls[index].function.arguments);
}

describe('parseTextToolCalls', () => {
    it('leaves an ordinary answer alone, cheaply', () => {
        expect(parseTextToolCalls('Press F5 to show the screen.', TOOLS)).toBe(
            null,
        );
        expect(parseTextToolCalls('', TOOLS)).toBe(null);
        expect(parseTextToolCalls(null, TOOLS)).toBe(null);
        expect(parseTextToolCalls(undefined, TOOLS)).toBe(null);
    });

    it('reads the XML parameter form LM Studio handed through as words', () => {
        const content = [
            '<tool_call>',
            '<function=owa_help_search>',
            '<parameter=query>',
            'Bible Lookup button function presenter',
            '</parameter>',
            '<parameter=focus>',
            'reader',
            '</parameter>',
            '<parameter=kind>',
            'manual',
            '</parameter>',
            '</function>',
            '</tool_call>',
        ].join('\n');
        const parsed = parseTextToolCalls(content, TOOLS);
        expect(parsed).not.toBe(null);
        expect(parsed!.calls).toHaveLength(1);
        expect(parsed!.calls[0]).toMatchObject({
            id: 'text_call_1',
            type: 'function',
            function: { name: 'owa_help_search' },
        });
        expect(argsOf(parsed)).toEqual({
            query: 'Bible Lookup button function presenter',
            focus: 'reader',
            kind: 'manual',
        });
        expect(parsed!.text).toBe('');
    });

    it('reads the JSON form inside <tool_call>, and keeps the words around it', () => {
        const content =
            'Let me look at the screens.\n' +
            '<tool_call>\n{"name": "owa_list_screens", "arguments": {}}\n</tool_call>';
        const parsed = parseTextToolCalls(content, TOOLS);
        expect(parsed!.calls[0].function).toEqual({
            name: 'owa_list_screens',
            arguments: '{}',
        });
        expect(parsed!.text).toBe('Let me look at the screens.');
    });

    it('reads a bare <function=…> block with no <tool_call> round it', () => {
        const parsed = parseTextToolCalls(
            '<function=owa_click><parameter=find>Show</parameter><parameter=clicks>2</parameter></function>',
            TOOLS,
        );
        expect(argsOf(parsed)).toEqual({ find: 'Show', clicks: 2 });
    });

    it('reads Mistral’s [TOOL_CALLS] list and a bare JSON object', () => {
        const mistral = parseTextToolCalls(
            '[TOOL_CALLS][{"name": "owa_help_search", "arguments": {"query": "font size"}}]',
            TOOLS,
        );
        expect(argsOf(mistral)).toEqual({ query: 'font size' });
        const bare = parseTextToolCalls(
            '{"name": "owa_help_search", "parameters": {"query": "font size", "limit": "3"}}',
            TOOLS,
        );
        expect(argsOf(bare)).toEqual({ query: 'font size', limit: '3' });
        expect(bare!.text).toBe('');
    });

    it('reads a fenced json block and OpenAI’s own {function: {…}} shape', () => {
        const parsed = parseTextToolCalls(
            'Searching.\n```json\n{"function": {"name": "owa_help_search", "arguments": "{\\"query\\": \\"undo\\"}"}}\n```',
            TOOLS,
        );
        expect(argsOf(parsed)).toEqual({ query: 'undo' });
        expect(parsed!.text).toBe('Searching.');
    });

    it('reads argument values by the tool’s own schema', () => {
        const parsed = parseTextToolCalls(
            '<tool_call><function=owa_help_search>' +
                '<parameter=query>"4"</parameter>' +
                '<parameter=limit>4</parameter>' +
                '</function></tool_call>',
            TOOLS,
        );
        // A string stays words (the quotes a model wraps it in come off);
        // an integer is a number.
        expect(argsOf(parsed)).toEqual({ query: '4', limit: 4 });
    });

    it('takes a leaked channel marker and a functions. prefix off the name', () => {
        const parsed = parseTextToolCalls(
            '<tool_call>{"name": "functions.owa_list_screens<|channel|>commentary", "arguments": {}}</tool_call>',
            TOOLS,
        );
        expect(parsed!.calls[0].function.name).toBe('owa_list_screens');
    });

    it('runs nothing the request did not offer', () => {
        expect(
            parseTextToolCalls(
                '<tool_call><function=evaluate_script><parameter=code>1</parameter></function></tool_call>',
                TOOLS,
            ),
        ).toBe(null);
        expect(
            parseTextToolCalls('{"name": "rm", "arguments": {}}', TOOLS),
        ).toBe(null);
    });

    it('reads several calls in order', () => {
        const parsed = parseTextToolCalls(
            '<tool_call>{"name": "owa_list_screens", "arguments": {}}</tool_call>\n' +
                '<tool_call>{"name": "owa_help_search", "arguments": {"query": "show"}}</tool_call>',
            TOOLS,
        );
        expect(parsed!.calls.map((call) => call.id)).toEqual([
            'text_call_1',
            'text_call_2',
        ]);
        expect(parsed!.calls.map((call) => call.function.name)).toEqual([
            'owa_list_screens',
            'owa_help_search',
        ]);
    });

    it('reads a block the model never closed', () => {
        const parsed = parseTextToolCalls(
            '<tool_call>\n<function=owa_list_screens>\n</function>',
            TOOLS,
        );
        expect(parsed!.calls[0].function.name).toBe('owa_list_screens');
    });
});
