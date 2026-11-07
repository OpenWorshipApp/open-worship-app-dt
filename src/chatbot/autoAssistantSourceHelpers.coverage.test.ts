import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Who a question goes to when the tab's own assistant could not answer it,
// and how long a server that said nothing is left alone. The setting store
// and the relay are hand-held answers; the ranking and the hand-on order
// are the real ones.
const { h } = vi.hoisted(() => ({
    h: {
        servers: [] as any[],
        answeringMap: new Map<string, boolean>(),
        answeringCalls: [] as string[],
    },
}));

vi.mock('../helper/ai/customServerHelpers', () => ({
    getUsableCustomServers: () => h.servers,
    checkIsCustomServerAnswering: async (server: any) => {
        h.answeringCalls.push(server.id);
        return h.answeringMap.get(server.id) ?? true;
    },
    readCustomServerModelInfo: async () => null,
    findCustomModelInfo: () => null,
}));
vi.mock('./llmBotHelpers', () => ({
    // A server is free when it says so or sits on this computer or the
    // church's network.
    checkIsNoCostCustomServer: (server: any) => {
        return server.isFree === true || !server.baseUrl.startsWith('https');
    },
    checkCanSeeImages: () => false,
    getLlmProviderLabel: () => 'Free',
    getLlmModelList: (provider: string) => {
        if (provider === 'free') {
            return [{ id: 'first:free', label: 'First' }];
        }
        return h.servers.flatMap((server) => {
            return server.models.map((row: any) => {
                return {
                    id: `${server.id}/${row.id}`,
                    label: row.model,
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
    probeAutoCandidates,
    resolveHandOnPicks,
} from './autoAssistantSourceHelpers';

// In the building: a machine on the church's network, and this computer.
const OFFICE = {
    id: 'office',
    name: 'Office PC',
    baseUrl: 'http://office-pc:1234/v1',
    models: [{ id: 'row-12', model: 'gemma-4-12b' }],
};
const LAPTOP = {
    id: 'laptop',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: [{ id: 'row-4', model: 'qwen3.5-4b' }],
};
// A shared server: free, but on the internet.
const SHARED = {
    id: 'registry-kind',
    name: 'Kind Church Server',
    baseUrl: 'https://llm.example.org/v1',
    isFree: true,
    models: [{ id: 'row-27', model: 'gemma-3-27b' }],
};

function toLabels(candidates: { label: string }[] | undefined) {
    return (candidates ?? []).map((one) => {
        return one.label;
    });
}

beforeEach(() => {
    h.servers = [OFFICE, LAPTOP, SHARED];
    h.answeringMap.clear();
    h.answeringCalls = [];
    clearAutoAwayServers();
    clearAutoSetbacks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('a question the tab’s own assistant could not answer', () => {
    test('from a server in the building, goes to the others in the building first', async () => {
        const handOn = await resolveHandOnPicks({
            provider: 'custom',
            model: 'laptop/row-4',
        });
        expect(handOn?.failed.label).toBe('Ollama · qwen3.5-4b');
        expect(toLabels(handOn?.picks)).toEqual([
            'Office PC · gemma-4-12b',
            'Kind Church Server · gemma-3-27b',
            'Free · First',
        ]);
    });

    test('from the free service, goes down the ranking as it stands', async () => {
        const handOn = await resolveHandOnPicks({
            provider: 'free',
            model: 'first:free',
        });
        expect(toLabels(handOn?.picks)).toEqual([
            'Kind Church Server · gemma-3-27b',
            'Office PC · gemma-4-12b',
            'Ollama · qwen3.5-4b',
        ]);
    });

    test('from an assistant Auto could not have picked, stays where it was put', async () => {
        expect(
            await resolveHandOnPicks({ provider: 'claude', model: 'opus' }),
        ).toBeNull();
        // Nothing was asked of any server for it.
        expect(h.answeringCalls).toEqual([]);
    });
});

describe('a server that answered nothing', () => {
    test('is asked again once its five minutes are up', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-01T09:00:00.000Z'));
        h.servers = [OFFICE];
        h.answeringMap.set('office', false);
        await probeAutoCandidates(genAutoCandidates());
        expect(h.answeringCalls).toEqual(['office']);

        h.answeringMap.set('office', true);
        vi.setSystemTime(new Date('2026-11-01T09:04:59.000Z'));
        const early = await probeAutoCandidates(genAutoCandidates());
        expect(h.answeringCalls).toEqual(['office']);
        expect(early.get('custom/office/row-12')?.isReachable).toBe(false);

        vi.setSystemTime(new Date('2026-11-01T09:05:00.000Z'));
        const later = await probeAutoCandidates(genAutoCandidates());
        expect(h.answeringCalls).toEqual(['office', 'office']);
        expect(later.get('custom/office/row-12')?.isReachable).toBe(true);
    });
});
