import { beforeEach, describe, expect, test, vi } from 'vitest';

// The setting store, the relay and both SDKs are not what is under test: what
// this module makes of what they say is.
const h = vi.hoisted(() => ({
    servers: [] as any[],
    // By server id: whether its model list answers, and what it says of
    // itself (null: nothing, in time).
    answeringMap: new Map<string, boolean>(),
    infoMap: new Map<string, any>(),
    answeringCalls: [] as string[],
}));

vi.mock('../helper/ai/customServerHelpers', () => ({
    getUsableCustomServers: () => h.servers,
    checkIsCustomServerAnswering: async (server: any) => {
        h.answeringCalls.push(server.id);
        return h.answeringMap.get(server.id) ?? true;
    },
    readCustomServerModelInfo: async (server: any) => {
        return h.infoMap.get(server.id) ?? null;
    },
    findCustomModelInfo: (info: any, modelId: string) => {
        return info === null
            ? null
            : (info.infoMap.get(modelId) ?? info.commonInfo ?? null);
    },
}));
vi.mock('./llmBotHelpers', () => ({
    checkIsNoCostCustomServer: (server: any) => {
        return server.isFree === true || /localhost|super/.test(server.baseUrl);
    },
    checkCanSeeImages: (provider: string, model: string) => {
        return provider === 'free'
            ? model === 'see:free'
            : model.endsWith('/row-eyes');
    },
    getLlmProviderLabel: () => 'Free',
    getLlmModelList: (provider: string) => {
        if (provider === 'free') {
            return [
                { id: 'first:free', label: 'First' },
                { id: 'see:free', label: 'Seeing' },
            ];
        }
        return h.servers.flatMap((server) => {
            return server.models.map((row: any) => {
                return {
                    id: `${server.id}/${row.id}`,
                    label: row.name || row.model,
                    wireId: row.model,
                    serverId: server.id,
                };
            });
        });
    },
}));

import { clearAutoSetbacks } from './autoAssistantHelpers';
import {
    clearAutoAwayServers,
    genAutoCandidates,
    guessAutoPick,
    probeAutoCandidates,
    resolveAutoPicks,
} from './autoAssistantSourceHelpers';

const BOX = {
    id: 'box',
    name: 'LM Studio super-computer',
    baseUrl: 'http://super-computer:1234/v1',
    models: [
        { id: 'row-12', model: 'google/gemma-4-12b', name: 'Gemma 4 12B' },
        { id: 'row-eyes', model: 'qwen/qwen3.5-9b', name: '' },
    ],
};
const LAPTOP = {
    id: 'laptop',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: [{ id: 'row-4', model: 'qwen3.5:4b', name: '' }],
};
const METERED = {
    id: 'metered',
    name: 'A paid router',
    baseUrl: 'https://router.example.com/v1',
    models: [{ id: 'row-big', model: 'huge-70b', name: '' }],
};

function toLabels(candidates: { label: string }[]) {
    return candidates.map((one) => {
        return one.label;
    });
}

beforeEach(() => {
    h.servers = [BOX, LAPTOP, METERED];
    h.answeringMap.clear();
    h.infoMap.clear();
    h.answeringCalls = [];
    clearAutoAwayServers();
    clearAutoSetbacks();
});

describe('genAutoCandidates', () => {
    test('offers every model of a server that costs nothing, then the free ones, and never a metered server', () => {
        expect(toLabels(genAutoCandidates())).toEqual([
            'LM Studio super-computer · Gemma 4 12B',
            'LM Studio super-computer · qwen/qwen3.5-9b',
            'Ollama · qwen3.5:4b',
            'Free · First',
            'Free · Seeing',
        ]);
    });

    test('reads the size off the id the server knows, and who can see', () => {
        const [first, second] = genAutoCandidates();
        expect(first.modelName).toContain('google/gemma-4-12b');
        expect(first.canSeeImages).toBe(false);
        expect(second.canSeeImages).toBe(true);
        expect(second.model).toBe('box/row-eyes');
    });
});

describe('guessAutoPick', () => {
    test('is the biggest model with nothing asked of any server', () => {
        expect(guessAutoPick()?.label).toBe(
            'LM Studio super-computer · Gemma 4 12B',
        );
        expect(h.answeringCalls).toEqual([]);
    });

    test('is the free service when no server is big enough', () => {
        h.servers = [LAPTOP];
        expect(guessAutoPick()?.label).toBe('Free · First');
    });
});

describe('probeAutoCandidates', () => {
    test('says of each model what its server said, by the id the server knows it by', async () => {
        h.infoMap.set('box', {
            kind: 'lm-studio',
            infoMap: new Map([
                ['qwen/qwen3.5-9b', { isLoaded: true, loadedContext: 32768 }],
                [
                    'google/gemma-4-12b',
                    { isLoaded: false, loadedContext: null },
                ],
            ]),
            commonInfo: null,
        });
        const stateMap = await probeAutoCandidates(genAutoCandidates());
        expect(stateMap.get('custom/box/row-eyes')).toEqual({
            isReachable: true,
            kind: 'lm-studio',
            isLoaded: true,
            loadedContext: 32768,
        });
        expect(stateMap.get('custom/box/row-12')?.isLoaded).toBe(false);
        // A server that says nothing of itself is still one that answers.
        expect(stateMap.get('custom/laptop/row-4')).toEqual({
            isReachable: true,
            kind: null,
            isLoaded: null,
            loadedContext: null,
        });
        // The keyless service is not asked about itself.
        expect(stateMap.has('free/first:free')).toBe(false);
    });

    test('does not ask a server that answered nothing again for a while', async () => {
        h.answeringMap.set('box', false);
        const first = await probeAutoCandidates(genAutoCandidates());
        expect(first.get('custom/box/row-12')?.isReachable).toBe(false);
        expect(h.answeringCalls).toEqual(['box', 'laptop']);

        h.answeringCalls = [];
        h.answeringMap.set('box', true);
        const second = await probeAutoCandidates(genAutoCandidates());
        expect(h.answeringCalls).toEqual(['laptop']);
        expect(second.get('custom/box/row-12')?.isReachable).toBe(false);

        // The Reload beside the list looks at every server again.
        h.answeringCalls = [];
        clearAutoAwayServers();
        const third = await probeAutoCandidates(genAutoCandidates());
        expect(h.answeringCalls).toEqual(['box', 'laptop']);
        expect(third.get('custom/box/row-12')?.isReachable).toBe(true);
    });
});

describe('resolveAutoPicks', () => {
    test('asks the biggest model of a server that answers', async () => {
        expect(toLabels(await resolveAutoPicks())).toEqual([
            'LM Studio super-computer · Gemma 4 12B',
            'LM Studio super-computer · qwen/qwen3.5-9b',
            'Free · First',
            'Free · Seeing',
            'Ollama · qwen3.5:4b',
        ]);
    });

    test('goes to the free service, then the small local model, when the big server is switched off', async () => {
        h.answeringMap.set('box', false);
        expect(toLabels(await resolveAutoPicks())).toEqual([
            'Free · First',
            'Free · Seeing',
            'Ollama · qwen3.5:4b',
        ]);
    });

    test('asks only a model that can see when a picture rides the question', async () => {
        expect(toLabels(await resolveAutoPicks({ needsImages: true }))).toEqual(
            ['LM Studio super-computer · qwen/qwen3.5-9b', 'Free · Seeing'],
        );
    });
});
