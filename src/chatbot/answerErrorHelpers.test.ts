import { describe, expect, test, vi } from 'vitest';

const { appErrorMock } = vi.hoisted(() => ({ appErrorMock: vi.fn() }));

vi.mock('../helper/loggerHelpers', () => ({
    appError: appErrorMock,
}));

import { describeAnswerError } from './answerErrorHelpers';

describe('describeAnswerError', () => {
    // 2026-10-17: "I could not answer that: DO_ON_ASK_TOOL_SET is not
    // defined" under 26 Khmer answers (EC-324).
    test('a bug in the code is said as what to do, and logged', () => {
        const error = new ReferenceError('DO_ON_ASK_TOOL_SET is not defined');
        const text = describeAnswerError(error);
        expect(text).not.toContain('DO_ON_ASK_TOOL_SET');
        expect(text).toMatch(/Ask it again/);
        expect(appErrorMock).toHaveBeenCalledWith(error, 'chatbot answer');
        expect(
            describeAnswerError(
                new TypeError(
                    "Cannot read properties of undefined (reading 'x')",
                ),
            ),
        ).not.toContain('undefined');
    });

    test('a sentence written for the person is said after the lead', () => {
        appErrorMock.mockClear();
        expect(
            describeAnswerError(new Error('The AI account is out of credit.')),
        ).toBe('I could not answer that: The AI account is out of credit.');
        expect(appErrorMock).not.toHaveBeenCalled();
        expect(describeAnswerError('plain words')).toBe(
            'I could not answer that: plain words',
        );
    });
});
