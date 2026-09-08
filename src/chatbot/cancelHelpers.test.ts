import { describe, expect, test } from 'vitest';

import {
    checkIsCancelError,
    throwIfCancelled,
    AskCancelledError,
} from './cancelHelpers';

// The one thing this must never get wrong is calling a stop a failure: the
// window would then tell a volunteer their internet is down because they
// pressed a button.
describe('checkIsCancelError', () => {
    test('an aborted signal makes whatever came back a stop', () => {
        const controller = new AbortController();
        controller.abort();

        expect(
            checkIsCancelError(new Error('fetch failed'), controller.signal),
        ).toBe(true);
    });

    test('each layer names an abort differently, and all of them count', () => {
        expect(checkIsCancelError(new AskCancelledError())).toBe(true);
        // What `fetch` rejects with.
        expect(checkIsCancelError({ name: 'AbortError' })).toBe(true);
        // What both SDKs reject with.
        expect(checkIsCancelError({ name: 'APIUserAbortError' })).toBe(true);
    });

    test('a real failure with nobody pressing anything is still a failure', () => {
        const controller = new AbortController();

        expect(checkIsCancelError({ status: 429 }, controller.signal)).toBe(
            false,
        );
        expect(checkIsCancelError(new Error('fetch failed'))).toBe(false);
        expect(checkIsCancelError(null)).toBe(false);
    });
});

describe('throwIfCancelled', () => {
    test('no signal and a live signal both carry on', () => {
        const controller = new AbortController();

        expect(() => {
            throwIfCancelled();
        }).not.toThrow();
        expect(() => {
            throwIfCancelled(controller.signal);
        }).not.toThrow();
    });

    test('an aborted signal stops the caller', () => {
        const controller = new AbortController();
        controller.abort();

        expect(() => {
            throwIfCancelled(controller.signal);
        }).toThrow(AskCancelledError);
    });
});
