import { describe, expect, test } from 'vitest';

import { findSteppedProvider } from './providerPickHelpers';

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
