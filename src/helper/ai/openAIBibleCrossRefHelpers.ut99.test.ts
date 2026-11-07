import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    client: null as any,
    create: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
    logError: vi.fn(),
    useGetBibleCrossRef: vi.fn(),
}));

vi.mock('./openAIHelpers', () => ({
    DATA_DIR_NAME: 'ai-openai-data',
    getOpenAIInstance: () => h.client,
}));
vi.mock('./aiHelpers', () => ({
    bibleCrossRefSchemaJson: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'array',
    },
}));
vi.mock('./bibleCrossRefHelpers', () => ({
    useGetBibleCrossRef: h.useGetBibleCrossRef,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../loggerHelpers', () => ({ appError: h.logError }));

import {
    getCrossRefs,
    useGetBibleCrossRefOpenAI,
} from './openAIBibleCrossRefHelpers';

const REFERENCES = [
    { title: 'God as creator', verses: ['John 1:1-3', 'Hebrews 11:3'] },
];

function genCompletion(content: string | null) {
    return { choices: [{ message: { content } }] };
}

beforeEach(() => {
    h.client = { chat: { completions: { create: h.create } } };
    h.create.mockResolvedValue(
        genCompletion(JSON.stringify({ result: REFERENCES })),
    );
});

describe('the OpenAI cross-reference request', () => {
    test('asks gpt-5 for the verse under a strict JSON schema', async () => {
        expect(await getCrossRefs('Genesis 1:1')).toEqual(REFERENCES);
        const request = h.create.mock.calls[0][0];
        expect(request.model).toBe('gpt-5');
        expect(request.messages).toHaveLength(1);
        expect(request.messages[0].role).toBe('user');
        expect(request.messages[0].content).toContain(
            'You are a Bible cross-reference lookup tool.',
        );
        expect(
            request.messages[0].content.endsWith(
                'Now, return cross-references for: Genesis 1:1',
            ),
        ).toBe(true);
        // Found by UT-75a (2026-11-03): asked with no references of its own,
        // as every caller asks, the prompt said "...context: undefined".
        expect(request.messages[0].content).not.toContain(
            'existing cross-references',
        );
        expect(request.messages[0].content).not.toContain('undefined');
        expect(request.response_format).toMatchObject({
            type: 'json_schema',
            json_schema: {
                name: 'BibleCrossReference',
                strict: true,
                schema: {
                    type: 'object',
                    required: ['result'],
                    additionalProperties: false,
                    properties: {
                        result: {
                            type: 'array',
                            items: {
                                required: ['title', 'verses'],
                                additionalProperties: false,
                            },
                        },
                    },
                },
            },
        });
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('carries references it was given as more context, and none when told none', async () => {
        await getCrossRefs('Genesis 1:1', REFERENCES);
        const withContext = h.create.mock.calls[0][0].messages[0].content;
        expect(withContext).toContain(
            '- Consider these existing cross-references for additional context:',
        );
        expect(withContext).toContain(JSON.stringify(REFERENCES, null, 2));

        await getCrossRefs('Genesis 1:1', null as any);
        const withoutContext = h.create.mock.calls[1][0].messages[0].content;
        expect(withoutContext).not.toContain('existing cross-references');
    });

    test('strips a code fence the model wrapped the JSON in', async () => {
        h.create.mockResolvedValue(
            genCompletion(
                '  ```JSON\n' +
                    JSON.stringify({ result: REFERENCES }) +
                    '\n```  ',
            ),
        );
        expect(await getCrossRefs('Genesis 1:1')).toEqual(REFERENCES);
    });

    test('asks nothing without a client, and says nothing', async () => {
        h.client = null;
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.create).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('an empty answer is no references, quietly', async () => {
        h.create.mockResolvedValue(genCompletion(''));
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        h.create.mockResolvedValue({ choices: [] });
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('an answer that is not JSON is logged, reported and null', async () => {
        h.create.mockResolvedValue(genCompletion('no JSON here'));
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.logError).toHaveBeenCalledWith(
            'Error in getCrossRefs:',
            expect.any(SyntaxError),
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Cross References',
            'Failed to get cross references. Please check your OpenAI API ' +
                'Key and network connection.',
        );
        expect(h.handleError).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    test('a failed request is reported the same way', async () => {
        const error = new Error('401 Incorrect API key');
        h.create.mockRejectedValue(error);
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(h.showSimpleToast).toHaveBeenCalledTimes(1);
    });
});

describe('useGetBibleCrossRefOpenAI', () => {
    test('reads the cache of the OpenAI data folder with its own request', () => {
        const answer = { bibleCrossRef: null, refresh: () => {} };
        h.useGetBibleCrossRef.mockReturnValue(answer);
        expect(useGetBibleCrossRefOpenAI('GEN', 1, 1)).toBe(answer);
        expect(h.useGetBibleCrossRef).toHaveBeenCalledWith(
            {
                bookKey: 'GEN',
                chapter: 1,
                verseNum: 1,
                dataDir: 'ai-openai-data',
            },
            getCrossRefs,
        );
    });
});
