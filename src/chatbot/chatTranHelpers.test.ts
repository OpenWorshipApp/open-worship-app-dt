import { afterEach, describe, expect, test } from 'vitest';

import {
    fillWords,
    setChatTranslator,
    tran,
    tranLabel,
} from './chatTranHelpers';

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('the help window’s own words', () => {
    // A node test, and the AI Chat window that shares the tab strip, never
    // plug a translator in: English, and nothing to throw.
    test('are English until a translator is plugged in', () => {
        expect(tran('New chat')).toBe('New chat');
        expect(tranLabel('Show me step by step')).toBe('Show me step by step');
    });
});

describe('fillWords', () => {
    test('fills every gap the sentence has', () => {
        expect(
            fillWords('Step {n} of {m}: “{words}”', {
                n: 1,
                m: 8,
                words: 'Clear',
            }),
        ).toBe('Step 1 of 8: “Clear”');
    });

    test('leaves a gap it was not given a value for', () => {
        expect(fillWords('Searching for “{words}”', {})).toBe(
            'Searching for “{words}”',
        );
    });
});
