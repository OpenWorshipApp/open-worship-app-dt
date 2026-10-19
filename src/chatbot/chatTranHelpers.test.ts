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

    test('come from the translators the window plugs in', () => {
        const dictionary: Record<string, string> = {
            'new chat': 'ការសន្ទនាថ្មី',
        };
        setChatTranslator(
            (text) => {
                const value = dictionary[text.toLowerCase()];
                if (value === undefined) {
                    throw new Error(`no "${text}"`);
                }
                return value;
            },
            (text) => dictionary[text.toLowerCase()] ?? text,
        );
        expect(tran('New chat')).toBe('ការសន្ទនាថ្មី');
        expect(() => tran('Not a key')).toThrow('no "Not a key"');
        // A label that may not be one is never a reason to throw.
        expect(tranLabel('Not a key')).toBe('Not a key');
        expect(tranLabel('new chat')).toBe('ការសន្ទនាថ្មី');
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
