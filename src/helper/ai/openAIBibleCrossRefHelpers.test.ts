import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getOpenAIInstance: vi.fn(),
    createCompletion: vi.fn(),
    useGetBibleCrossRef: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('./openAIHelpers', () => ({
    DATA_DIR_NAME: 'ai-openai-data',
    getOpenAIInstance: h.getOpenAIInstance,
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
vi.mock('../helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../loggerHelpers', () => ({ appError: h.logError }));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import {
    getCrossRefs,
    useGetBibleCrossRefOpenAI,
} from './openAIBibleCrossRefHelpers';

const CROSS_REFS = [
    { title: 'God as creator', verses: ['John 1:1-3', 'Hebrews 11:3'] },
];

function answerContent(content: string | null) {
    h.createCompletion.mockResolvedValue({
        choices: [{ message: { content } }],
    });
}

beforeEach(() => {
    h.getOpenAIInstance.mockReturnValue({
        chat: { completions: { create: h.createCompletion } },
    });
});

describe('getCrossRefs (OpenAI)', () => {
    test('asks for the verse under the strict schema and reads `result`', async () => {
        answerContent(JSON.stringify({ result: CROSS_REFS }));
        expect(await getCrossRefs('Genesis 1:1')).toEqual(CROSS_REFS);

        const [request] = h.createCompletion.mock.calls[0];
        expect(request.model).toBe('gpt-5');
        expect(request.messages).toHaveLength(1);
        expect(request.messages[0].role).toBe('user');
        expect(request.messages[0].content).toContain(
            'Now, return cross-references for: Genesis 1:1',
        );
        expect(request.response_format).toMatchObject({
            type: 'json_schema',
            json_schema: { name: 'BibleCrossReference', strict: true },
        });
        expect(request.response_format.json_schema.schema.required).toEqual([
            'result',
        ]);
    });

    test('strips a code fence around the JSON', async () => {
        answerContent(
            '```json\n' + JSON.stringify({ result: CROSS_REFS }) + '\n```',
        );
        expect(await getCrossRefs('Genesis 1:1')).toEqual(CROSS_REFS);
    });

    test('puts known cross references in the prompt as context', async () => {
        answerContent(JSON.stringify({ result: [] }));
        await getCrossRefs('Genesis 1:1', [
            { title: 'Light', verses: ['John 1:5'] },
        ]);
        const [request] = h.createCompletion.mock.calls[0];
        expect(request.messages[0].content).toContain(
            'Consider these existing cross-references for additional context',
        );
        expect(request.messages[0].content).toContain('"John 1:5"');
    });

    test('is null with no OpenAI client, asking nothing', async () => {
        h.getOpenAIInstance.mockReturnValue(null);
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.createCompletion).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('is null, quietly, for an empty answer', async () => {
        answerContent('');
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        h.createCompletion.mockResolvedValue({ choices: [] });
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a failed request is logged, said and reported, and is null', async () => {
        const error = new Error('401 Incorrect API key');
        h.createCompletion.mockRejectedValue(error);
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.logError).toHaveBeenCalledWith(
            'Error in getCrossRefs:',
            error,
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Cross References',
            expect.stringContaining('check your OpenAI API Key'),
        );
        expect(h.handleError).toHaveBeenCalledWith(error);
    });

    test('an answer that is not JSON is handled the same way', async () => {
        answerContent('Genesis 1:1 relates to John 1:1');
        expect(await getCrossRefs('Genesis 1:1')).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(expect.any(SyntaxError));
    });
});

describe('useGetBibleCrossRefOpenAI', () => {
    test('asks the shared hook for the verse in the OpenAI data folder', () => {
        const answer = { bibleCrossRef: null, refresh: vi.fn() };
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
