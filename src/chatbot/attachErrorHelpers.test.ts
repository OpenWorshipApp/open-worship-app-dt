import { describe, expect, test, vi } from 'vitest';

const { appErrorMock } = vi.hoisted(() => ({ appErrorMock: vi.fn() }));

vi.mock('../helper/loggerHelpers', () => ({
    appError: appErrorMock,
}));

import { describeAttachError } from './attachErrorHelpers';

describe('describeAttachError', () => {
    test('says a plain sentence and keeps the tool’s own words in the log', () => {
        const error = new Error(
            'no open page matching "presenter.html" among chatbot.html',
        );
        const text = describeAttachError(error, 'owa_pick_element');
        expect(text).not.toContain('presenter.html');
        expect(text).not.toContain('owa_');
        expect(text).toMatch(/could not/);
        expect(appErrorMock).toHaveBeenCalledWith(
            error,
            'chatbot attach owa_pick_element',
        );
    });
});
