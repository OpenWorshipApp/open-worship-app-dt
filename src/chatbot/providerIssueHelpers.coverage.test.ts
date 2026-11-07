import { describe, expect, test } from 'vitest';

import { readLlmIssue } from './providerIssueHelpers';

// What a provider's failure says when its parts arrive in odd shapes: a
// status written as words, and a body behind the status that is no JSON.

describe('a status written as a string', () => {
    test('is read as the number it is, and decides the kind', () => {
        expect(
            readLlmIssue({ status: '402', message: 'Payment Required' }),
        ).toEqual({
            kind: 'noCredit',
            status: 402,
            code: null,
            message: 'Payment Required',
        });
        expect(
            readLlmIssue({ response: { status: '503' }, message: 'Busy' }).kind,
        ).toBe('serverTrouble');
        // Not three digits: no status at all.
        expect(readLlmIssue({ status: 'ERR', message: 'x' }).status).toBeNull();
    });
});

describe('a body behind the status that is no JSON', () => {
    test('is never shown as the sentence, and the status still decides', () => {
        expect(
            readLlmIssue({ status: 400, message: '400 {error: not json}' }),
        ).toEqual({
            kind: 'other',
            status: 400,
            code: null,
            message: '',
        });
    });
});
