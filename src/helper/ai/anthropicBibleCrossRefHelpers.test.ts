import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getAnthropicInstance: vi.fn(),
    createMessage: vi.fn(),
    useGetBibleCrossRef: vi.fn(),
}));

vi.mock('./anthropicHelpers', () => ({
    DATA_DIR_NAME: 'ai-anthropic-data',
    getAnthropicInstance: h.getAnthropicInstance,
}));
vi.mock('./bibleCrossRefHelpers', () => ({
    useGetBibleCrossRef: h.useGetBibleCrossRef,
}));

import {
    AnthropicBibleCrossReference,
    getCrossRefs,
    useGetBibleCrossRefAnthropic,
} from './anthropicBibleCrossRefHelpers';

const CROSS_REFS = [
    { title: 'God as Creator', verses: ['Isaiah 44:24', 'Psalm 33:6'] },
];

function answerText(text: string) {
    h.createMessage.mockResolvedValue({ content: [{ type: 'text', text }] });
}

beforeEach(() => {
    h.getAnthropicInstance.mockReturnValue({
        messages: { create: h.createMessage },
    });
});

describe('getCrossRefs (Anthropic)', () => {
    test('asks Claude for the verse and reads the JSON out of a fence', async () => {
        answerText('```json\n' + JSON.stringify(CROSS_REFS) + '\n```');
        expect(await getCrossRefs('John 3:16')).toEqual(CROSS_REFS);

        const [request] = h.createMessage.mock.calls[0];
        expect(request).toMatchObject({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            temperature: 0.3,
            messages: [
                {
                    role: 'user',
                    content: 'Generate cross-references for: John 3:16',
                },
            ],
        });
        expect(request.system).toContain('King James Version (KJV)');
        expect(request.system).toContain('Return ONLY a valid JSON array');
    });

    test('is null with no Anthropic client, asking nothing', async () => {
        h.getAnthropicInstance.mockReturnValue(null);
        expect(await getCrossRefs('John 3:16')).toBeNull();
        expect(h.createMessage).not.toHaveBeenCalled();
    });

    test('is null when the answer is not JSON', async () => {
        answerText('Here are some verses: John 1:1');
        expect(await getCrossRefs('John 3:16')).toBeNull();
    });

    test('is null when the request fails', async () => {
        h.createMessage.mockRejectedValue(new TypeError('fetch failed'));
        expect(await getCrossRefs('John 3:16')).toBeNull();
    });
});

describe('AnthropicBibleCrossReference.getBibleCrossResponse', () => {
    const crossReference = new AnthropicBibleCrossReference();

    test('says why when no client is available', async () => {
        h.getAnthropicInstance.mockReturnValue(null);
        expect(
            await crossReference.getBibleCrossResponse('Genesis 1:1'),
        ).toEqual({
            success: false,
            error: 'Anthropic instance is not available',
        });
    });

    test('keeps the verse and the raw answer with the parsed list', async () => {
        answerText(`  ${JSON.stringify(CROSS_REFS)}  `);
        expect(
            await crossReference.getBibleCrossResponse('Genesis 1:1'),
        ).toEqual({
            success: true,
            verse: 'Genesis 1:1',
            crossReferences: CROSS_REFS,
            rawResponse: JSON.stringify(CROSS_REFS),
        });
    });

    test('refuses an answer that is not text', async () => {
        h.createMessage.mockResolvedValue({
            content: [{ type: 'tool_use', id: 'x' }],
        });
        const result =
            await crossReference.getBibleCrossResponse('Genesis 1:1');
        expect(result).toMatchObject({ success: false, type: 'tool_use' });
        expect(result.error).toMatch(
            /^Unexpected response format from Anthropic, /,
        );
    });

    test('keeps the text it could not parse, and why', async () => {
        answerText('[{"title": "unfinished"');
        const result =
            await crossReference.getBibleCrossResponse('Genesis 1:1');
        expect(result).toMatchObject({
            success: false,
            error: 'Failed to parse JSON response',
            rawResponse: '[{"title": "unfinished"',
        });
        expect(typeof result.parseError).toBe('string');
    });

    test('names the error a failed request threw', async () => {
        h.createMessage.mockRejectedValue(new RangeError('rate limited'));
        expect(
            await crossReference.getBibleCrossResponse('Genesis 1:1'),
        ).toEqual({
            success: false,
            error: 'rate limited',
            type: 'RangeError',
        });
    });

    test('puts known cross references in the prompt as extra context', () => {
        const prompt = crossReference.generateSystemPrompt([
            { title: 'Light', verses: ['John 1:5'] },
        ]);
        expect(prompt).toContain(
            'Consider these existing cross-references for additional context',
        );
        expect(prompt).toContain('"John 1:5"');
        const withoutContext = crossReference.generateSystemPrompt(null as any);
        expect(withoutContext).not.toContain('existing cross-references');
    });
});

describe('useGetBibleCrossRefAnthropic', () => {
    test('asks the shared hook for the verse in the Anthropic data folder', () => {
        const answer = { bibleCrossRef: undefined, refresh: vi.fn() };
        h.useGetBibleCrossRef.mockReturnValue(answer);
        expect(useGetBibleCrossRefAnthropic('JHN', 3, 16)).toBe(answer);
        expect(h.useGetBibleCrossRef).toHaveBeenCalledWith(
            {
                bookKey: 'JHN',
                chapter: 3,
                verseNum: 16,
                dataDir: 'ai-anthropic-data',
            },
            getCrossRefs,
        );
    });
});
