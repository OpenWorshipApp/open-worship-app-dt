import { describe, expect, test } from 'vitest';

import {
    findSteppedProvider,
    genAssistantRows,
    toAssistantRowValue,
} from './providerPickHelpers';

// The head row's order: best-known first, the keyless one last.
const KEYS = ['anthropic', 'openai', 'kimi', 'free'];

describe('findSteppedProvider', () => {
    test('steps over a row with no key, the way the arrow was going', () => {
        const available = ['anthropic', 'openai', 'free'];
        expect(findSteppedProvider(KEYS, available, 'kimi', 1)).toBe('free');
        expect(findSteppedProvider(KEYS, available, 'kimi', -1)).toBe('openai');
    });

    test('steps over several rows with no key in a row', () => {
        const available = ['anthropic', 'free'];
        expect(findSteppedProvider(KEYS, available, 'openai', 1)).toBe('free');
        expect(findSteppedProvider(KEYS, available, 'kimi', -1)).toBe(
            'anthropic',
        );
    });

    test('is null when nothing that can answer lies that way', () => {
        // The list then stays on the provider it had, as it did at a disabled
        // row on the end.
        expect(
            findSteppedProvider(KEYS, ['openai', 'free'], 'anthropic', -1),
        ).toBeNull();
        expect(
            findSteppedProvider(
                ['anthropic', 'kimi'],
                ['anthropic'],
                'kimi',
                1,
            ),
        ).toBeNull();
    });

    test('is null for a row that is not in the list', () => {
        expect(findSteppedProvider(KEYS, KEYS, 'nope', 1)).toBeNull();
    });
});

// The user's own servers are ONE provider and one row EACH in the list.
describe('genAssistantRows', () => {
    const PROVIDER_LIST = [
        { key: 'openai', label: 'ChatGPT' },
        { key: 'custom', label: 'Custom servers' },
        { key: 'free', label: 'Free' },
    ];
    const SERVERS = [
        { id: 'lm', name: 'LM Studio' },
        { id: 'ollama', name: 'Ollama' },
    ];

    test('puts each server in the custom provider’s place, by its own name', () => {
        const rows = genAssistantRows(
            PROVIDER_LIST,
            ['custom', 'free'],
            'custom',
            SERVERS,
        );
        expect(
            rows.map((row) => {
                return [row.value, row.label, row.isAvailable];
            }),
        ).toEqual([
            ['openai', 'ChatGPT', false],
            ['custom/lm', 'LM Studio', true],
            ['custom/ollama', 'Ollama', true],
            ['free', 'Free', true],
        ]);
        expect(rows[1]).toMatchObject({ provider: 'custom', serverId: 'lm' });
    });

    test('shows no custom row at all with no usable server', () => {
        const rows = genAssistantRows(PROVIDER_LIST, ['free'], 'custom', []);
        expect(
            rows.map((row) => {
                return row.value;
            }),
        ).toEqual(['openai', 'free']);
    });

    test('finds the row a tab is on from its provider and model', () => {
        expect(toAssistantRowValue('custom', 'lm/row-1', 'custom')).toBe(
            'custom/lm',
        );
        expect(toAssistantRowValue('openai', 'gpt-5', 'custom')).toBe('openai');
        expect(toAssistantRowValue(null, '', 'custom')).toBeNull();
    });
});
