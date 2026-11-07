import { beforeEach, describe, expect, test, vi } from 'vitest';

// The SDK client is faked at the module that hands it out; the cache and
// the hook that read it back are another module's job.
const h = vi.hoisted(() => ({
    client: null as any,
    create: vi.fn(),
    useGetBibleCrossRef: vi.fn(),
}));

vi.mock('./anthropicHelpers', () => ({
    DATA_DIR_NAME: 'ai-anthropic-data',
    getAnthropicInstance: () => h.client,
}));
vi.mock('./bibleCrossRefHelpers', () => ({
    useGetBibleCrossRef: h.useGetBibleCrossRef,
}));

import {
    AnthropicBibleCrossReference,
    getCrossRefs,
    useGetBibleCrossRefAnthropic,
} from './anthropicBibleCrossRefHelpers';

const REFERENCES = [
    { title: 'God so loved', verses: ['Romans 5:8', '1 John 4:9'] },
];

function genTextMessage(text: string) {
    return { content: [{ type: 'text', text }] };
}

beforeEach(() => {
    h.client = { messages: { create: h.create } };
    h.create.mockResolvedValue(
        genTextMessage('```json\n' + JSON.stringify(REFERENCES) + '\n```'),
    );
});

describe('the Anthropic cross-reference request', () => {
    test('asks Sonnet 4.5 for the verse under the KJV system prompt', async () => {
        expect(await getCrossRefs('John 3:16')).toEqual(REFERENCES);
        expect(h.create).toHaveBeenCalledTimes(1);
        const request = h.create.mock.calls[0][0];
        expect(request).toMatchObject({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            messages: [
                {
                    role: 'user',
                    content: 'Generate cross-references for: John 3:16',
                },
            ],
        });
        expect(request.system).toContain(
            'You are a Biblical cross-reference assistant',
        );
        expect(request.system).toContain(
            'Respond ONLY with the JSON array, no additional text or explanation.',
        );
        // Found by UT-75a (2026-11-03): asked with no references of its own,
        // as every caller asks, the prompt told the model to "consider these
        // existing cross-references ...: undefined".
        expect(request.system).not.toContain('existing cross-references');
        expect(request.system).not.toContain('undefined');
    });

    test('reads the fenced JSON back as the references, with the cleaned text', async () => {
        const helper = new AnthropicBibleCrossReference();
        expect(await helper.getBibleCrossResponse('John 3:16')).toEqual({
            success: true,
            verse: 'John 3:16',
            crossReferences: REFERENCES,
            rawResponse: JSON.stringify(REFERENCES),
        });
    });

    test('asks nothing without a client', async () => {
        h.client = null;
        const helper = new AnthropicBibleCrossReference();
        expect(await helper.getBibleCrossResponse('John 3:16')).toEqual({
            success: false,
            error: 'Anthropic instance is not available',
        });
        expect(await helper.generateCrossReferences('John 3:16')).toBeNull();
        expect(h.create).not.toHaveBeenCalled();
    });

    test('says what came back when the answer is not text', async () => {
        const message = { content: [{ type: 'tool_use', id: 'tool-1' }] };
        h.create.mockResolvedValue(message);
        const helper = new AnthropicBibleCrossReference();
        expect(await helper.getBibleCrossResponse('John 3:16')).toEqual({
            success: false,
            error:
                'Unexpected response format from Anthropic, ' +
                JSON.stringify(message),
            type: 'tool_use',
        });
        expect(await getCrossRefs('John 3:16')).toBeNull();
    });

    test('keeps the raw words of an answer that is not JSON', async () => {
        h.create.mockResolvedValue(genTextMessage('  Sorry, no list.  '));
        const result: any =
            await new AnthropicBibleCrossReference().getBibleCrossResponse(
                'John 3:16',
            );
        expect(result).toMatchObject({
            success: false,
            error: 'Failed to parse JSON response',
            rawResponse: 'Sorry, no list.',
        });
        expect(typeof result.parseError).toBe('string');
        expect(result.parseError.length).toBeGreaterThan(0);
    });

    test('reports a failed request by its message and its kind', async () => {
        h.create.mockRejectedValue(new TypeError('network down'));
        expect(
            await new AnthropicBibleCrossReference().getBibleCrossResponse(
                'John 3:16',
            ),
        ).toEqual({ success: false, error: 'network down', type: 'TypeError' });
        expect(await getCrossRefs('John 3:16')).toBeNull();
    });
});

describe('the system prompt', () => {
    const helper = new AnthropicBibleCrossReference();

    test('carries references it was given as more context', () => {
        const prompt = helper.generateSystemPrompt(REFERENCES);
        expect(prompt).toContain(
            '8. Consider these existing cross-references for additional context:',
        );
        expect(prompt).toContain(JSON.stringify(REFERENCES, null, 2));
        expect(prompt.startsWith('You are a Biblical')).toBe(true);
    });

    test('carries no context line when it is told there is none', () => {
        const prompt = helper.generateSystemPrompt(null as any);
        expect(prompt).not.toContain('existing cross-references');
        expect(prompt).toContain('7. Prioritize verses');
    });
});

describe('useGetBibleCrossRefAnthropic', () => {
    test('reads the cache of the Anthropic data folder with its own request', () => {
        const answer = { bibleCrossRef: undefined, refresh: () => {} };
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
