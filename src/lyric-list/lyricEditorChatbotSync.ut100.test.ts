import { beforeEach, describe, expect, test, vi } from 'vitest';

// The lyric editor and its song's editing head, past the paths the main test
// walks: a held change that the person then typed into the editor themselves
// (it is no longer held), a listener let go, and Load pressed with nothing
// held. The same mock surface as `lyricEditorChatbotSync.test.ts`.
const h = vi.hoisted(() => ({
    onUpdate: null as null | (() => void),
    unregister: vi.fn(),
    forgetCachedData: vi.fn(),
    forgetCachedDataUnder: vi.fn(),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: () => ({
            registerEventListener: (
                _events: string[],
                callback: () => void,
            ) => {
                h.onUpdate = callback;
                return 'registered';
            },
            unregisterEventListener: h.unregister,
        }),
        forgetCachedData: h.forgetCachedData,
        forgetCachedDataUnder: h.forgetCachedDataUnder,
    },
}));
// Debounced in the app; at once here, the waiting is not what is tested.
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => {
        return (callback: () => void) => {
            callback();
        };
    },
}));

import { createLyricEditorSync } from './lyricEditorChatbotSync';

function genLyric(initialHead: string) {
    const lyric = {
        filePath: '/docs/Still.owl',
        head: initialHead as string | null,
        getJsonData: vi.fn(async () => {
            return lyric.head === null ? null : { content: lyric.head };
        }),
        setContent: vi.fn(async (value: string) => {
            lyric.head = value;
        }),
    };
    return lyric;
}

async function fireUpdate() {
    h.onUpdate?.();
    for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
    }
}

function setUp(initial = 'opened') {
    const lyric = genLyric(initial);
    const editor = { value: initial };
    const setShown = vi.fn((value: string) => {
        editor.value = value;
    });
    const sync = createLyricEditorSync({
        lyric: lyric as any,
        initialContent: initial,
        getShown: () => editor.value,
        setShown,
    });
    return { lyric, editor, setShown, sync };
}

beforeEach(() => {
    h.onUpdate = null;
});

describe('the editor and the song agreeing again by themselves', () => {
    test('a held change the editor now shows is no longer held, and is the new agreement', async () => {
        const { lyric, editor, setShown, sync } = setUp();
        const listener = vi.fn();
        sync.subscribe(listener);

        editor.value = 'their typing';
        lyric.head = 'changed by the assistant';
        await fireUpdate();
        expect(sync.getPendingHead()).toBe('changed by the assistant');
        listener.mockClear();

        // They typed the same text the assistant wrote.
        editor.value = 'changed by the assistant';
        await fireUpdate();

        expect(sync.getPendingHead()).toBeNull();
        expect(listener).toHaveBeenCalledOnce();
        expect(setShown).not.toHaveBeenCalled();

        // That text is what the two agree on now: the next change from
        // outside goes straight in, not held back.
        lyric.head = 'changed again';
        await fireUpdate();
        expect(editor.value).toBe('changed again');
        expect(sync.getPendingHead()).toBeNull();
    });
});

describe('listening and loading', () => {
    test('a listener let go is not told of the next change', async () => {
        const { lyric, sync } = setUp();
        const kept = vi.fn();
        const letGo = vi.fn();
        sync.subscribe(kept);
        const unsubscribe = sync.subscribe(letGo);

        unsubscribe();
        lyric.head = 'changed by the assistant';
        await fireUpdate();

        expect(kept).toHaveBeenCalledOnce();
        expect(letGo).not.toHaveBeenCalled();
    });

    test('Load with nothing held changes nothing and tells nobody', () => {
        const { editor, setShown, sync } = setUp();
        const listener = vi.fn();
        sync.subscribe(listener);
        editor.value = 'their typing';

        sync.applyPending();

        expect(setShown).not.toHaveBeenCalled();
        expect(editor.value).toBe('their typing');
        expect(listener).not.toHaveBeenCalled();
    });
});
