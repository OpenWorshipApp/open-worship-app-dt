import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    store: new Map<string, string>(),
}));

// The setting store is a folder of files in the running app. A Map is all these
// need, and it keeps the real store's `appProvider` out of a node test.
vi.mock('../settingHelpers', () => ({
    setSetting: (key: string, value: string | null) => {
        h.store.set(key, value ?? '');
    },
    getSettingForce: (key: string) => {
        return h.store.get(key) ?? null;
    },
    removeSetting: (key: string) => {
        h.store.delete(key);
    },
}));

import {
    AI_KEY_FOCUS_MAX_AGE_MILLISECONDS,
    getAIKeyFocusRequest,
    requestAIKeyFocus,
    takeAIKeyFocusRequest,
    toAIKeyFocusRequest,
} from './aiKeyFocusHelpers';

beforeEach(() => {
    h.store.clear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('toAIKeyFocusRequest', () => {
    const now = 1_000_000;
    const genText = (keyName: unknown, requestedAt: unknown = now) => {
        return JSON.stringify({ keyName, requestedAt });
    };

    test('a fresh request names its box', () => {
        expect(toAIKeyFocusRequest(genText('kimiAPIKey'), now)).toEqual({
            keyName: 'kimiAPIKey',
        });
    });

    test('null asks for the AI panel itself', () => {
        expect(toAIKeyFocusRequest(genText(null), now)).toEqual({
            keyName: null,
        });
    });

    test('a request whose window never came up is not honoured later', () => {
        const tooLate = now - AI_KEY_FOCUS_MAX_AGE_MILLISECONDS - 1;
        expect(
            toAIKeyFocusRequest(genText('kimiAPIKey', tooLate), now),
        ).toBeNull();
        // Nor one stamped ahead of a clock that has since moved back.
        const tooEarly = now + AI_KEY_FOCUS_MAX_AGE_MILLISECONDS + 1;
        expect(
            toAIKeyFocusRequest(genText('kimiAPIKey', tooEarly), now),
        ).toBeNull();
    });

    test('anything that is not a request is nothing', () => {
        expect(toAIKeyFocusRequest(null, now)).toBeNull();
        expect(toAIKeyFocusRequest('', now)).toBeNull();
        expect(toAIKeyFocusRequest('{not json', now)).toBeNull();
        expect(toAIKeyFocusRequest('null', now)).toBeNull();
        expect(
            toAIKeyFocusRequest(genText('kimiAPIKey', 'yesterday'), now),
        ).toBeNull();
        expect(toAIKeyFocusRequest(genText(42), now)).toBeNull();
        // A field of the AI setting that is not a key box, and a name every
        // object answers to.
        expect(
            toAIKeyFocusRequest(genText('anthropicWorkspaceId'), now),
        ).toBeNull();
        expect(toAIKeyFocusRequest(genText('toString'), now)).toBeNull();
    });
});

describe('the request between two windows', () => {
    test('what one window writes, the other reads', () => {
        requestAIKeyFocus('anthropicAPIKey');
        expect(getAIKeyFocusRequest()).toEqual({ keyName: 'anthropicAPIKey' });
        // Looking does not take it: Settings looks to pick its tab and leaves
        // the request for the panel that holds the box.
        expect(getAIKeyFocusRequest()).toEqual({ keyName: 'anthropicAPIKey' });
    });

    test('taking it forgets it', () => {
        requestAIKeyFocus('kimiAPIKey');
        expect(takeAIKeyFocusRequest()).toEqual({ keyName: 'kimiAPIKey' });
        expect(takeAIKeyFocusRequest()).toBeNull();
        expect(getAIKeyFocusRequest()).toBeNull();
    });

    test('a stale one is thrown away when taken, not read again', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        requestAIKeyFocus('openAIAPIKey');
        vi.setSystemTime(1_000_000 + AI_KEY_FOCUS_MAX_AGE_MILLISECONDS + 1);
        expect(getAIKeyFocusRequest()).toBeNull();
        expect(takeAIKeyFocusRequest()).toBeNull();
        expect(h.store.size).toBe(0);
    });
});
