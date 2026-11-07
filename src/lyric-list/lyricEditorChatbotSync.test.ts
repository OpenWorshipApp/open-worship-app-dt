import { beforeEach, describe, expect, test, vi } from 'vitest';

// The song's file, as the data-folder watcher tells it: one `update`
// listener, fired by the test the way a write into `.histories` fires it.
const h = vi.hoisted(() => ({
    onUpdate: null as null | (() => void),
    unregister: vi.fn(),
    forgetCachedData: vi.fn(),
    forgetCachedDataUnder: vi.fn(),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: () => ({
            registerEventListener: (events: string[], callback: () => void) => {
                expect(events).toEqual(['update']);
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

import {
    applyLyricEditorText,
    createLyricEditorSync,
    decideLyricEditorSync,
} from './lyricEditorChatbotSync';

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
    const sync = createLyricEditorSync({
        lyric: lyric as any,
        initialContent: initial,
        getShown: () => editor.value,
        setShown: (value) => {
            editor.value = value;
        },
    });
    return { lyric, editor, sync };
}

beforeEach(() => {
    h.onUpdate = null;
    h.unregister.mockReset();
    h.forgetCachedData.mockReset();
    h.forgetCachedDataUnder.mockReset();
});

describe('what a new editing head means for the editor', () => {
    test('nothing, when the editor shows it or it is what they last agreed on', () => {
        expect(
            decideLyricEditorSync({ head: 'a', value: 'a', lastSynced: 'x' }),
        ).toBe('none');
        expect(
            decideLyricEditorSync({
                head: 'x',
                value: 'typed',
                lastSynced: 'x',
            }),
        ).toBe('none');
    });

    test('put in, when nobody typed since; held back, when somebody did', () => {
        expect(
            decideLyricEditorSync({ head: 'new', value: 'x', lastSynced: 'x' }),
        ).toBe('apply');
        expect(
            decideLyricEditorSync({
                head: 'new',
                value: 'typed',
                lastSynced: 'x',
            }),
        ).toBe('notice');
    });
});

describe('the editor following the song', () => {
    test('a change from outside goes into an editor nobody typed in', async () => {
        const { lyric, editor, sync } = setUp();
        const listener = vi.fn();
        sync.subscribe(listener);
        lyric.head = 'changed by the assistant';
        await fireUpdate();
        expect(editor.value).toBe('changed by the assistant');
        expect(sync.getPendingHead()).toBeNull();
        expect(listener).toHaveBeenCalled();
        // Read fresh, never out of the two-second path cache.
        expect(h.forgetCachedData).toHaveBeenCalledWith('/docs/Still.owl');
        expect(h.forgetCachedDataUnder).toHaveBeenCalledWith(
            '/docs/Still.owl.histories',
        );
    });

    test('their typing is kept, the change held for them to load', async () => {
        const { lyric, editor, sync } = setUp();
        editor.value = 'their typing';
        lyric.head = 'changed by the assistant';
        await fireUpdate();
        expect(editor.value).toBe('their typing');
        expect(sync.getPendingHead()).toBe('changed by the assistant');
        sync.applyPending();
        expect(editor.value).toBe('changed by the assistant');
        expect(sync.getPendingHead()).toBeNull();
    });

    test('an unreadable head changes nothing', async () => {
        const { lyric, editor } = setUp();
        lyric.head = null;
        await fireUpdate();
        expect(editor.value).toBe('opened');
    });

    test('a save is the new agreement, so the next change goes in', async () => {
        const { lyric, editor, sync } = setUp();
        editor.value = 'saved text';
        sync.markSaved('saved text');
        lyric.head = 'changed after the save';
        await fireUpdate();
        expect(editor.value).toBe('changed after the save');
    });

    test('the 🤖 hands over what is on screen, written into the head', async () => {
        const { lyric, editor, sync } = setUp();
        editor.value = 'typed, not saved';
        await sync.writeShownToHead();
        expect(lyric.setContent).toHaveBeenCalledWith('typed, not saved');
        // And what the assistant then writes goes straight in.
        lyric.head = 'the assistant’s change';
        await fireUpdate();
        expect(editor.value).toBe('the assistant’s change');
    });

    test('nothing is written when the head already says it', async () => {
        const { lyric, sync } = setUp();
        await sync.writeShownToHead();
        expect(lyric.setContent).not.toHaveBeenCalled();
    });

    test('closing lets go of the listener', () => {
        const { sync } = setUp();
        sync.dispose();
        expect(h.unregister).toHaveBeenCalledWith('registered');
    });
});

describe('putting text into the editor as an edit', () => {
    test('Monaco gets one edit over the whole text, between undo stops', () => {
        const model = {
            text: 'old',
            getValue: () => model.text,
            getFullModelRange: () => 'all',
        };
        const monacoEditor = {
            getModel: () => model,
            pushUndoStop: vi.fn(),
            executeEdits: vi.fn((_source: string, edits: any[]) => {
                model.text = edits[0].text;
            }),
        };
        const editor = { value: 'old', monacoEditor };
        expect(applyLyricEditorText(editor, 'new')).toBe(true);
        expect(monacoEditor.executeEdits).toHaveBeenCalledWith(
            'owa-assistant',
            [{ range: 'all', text: 'new', forceMoveMarkers: true }],
        );
        expect(monacoEditor.pushUndoStop).toHaveBeenCalledTimes(2);
        // The baseline setter is never touched.
        expect(editor.value).toBe('old');
        // The same text again is no edit at all.
        expect(applyLyricEditorText(editor, 'new')).toBe(true);
        expect(monacoEditor.executeEdits).toHaveBeenCalledOnce();
    });

    test('the simple editor gets its textarea and an input event', () => {
        const textarea = { value: 'old', dispatchEvent: vi.fn() };
        const editor = {
            value: 'old',
            isSimpleMode: true,
            activeTextarea: textarea as unknown as HTMLTextAreaElement,
            monacoEditor: { getModel: () => ({}) },
        };
        expect(applyLyricEditorText(editor, 'new')).toBe(true);
        expect(textarea.value).toBe('new');
        expect(textarea.dispatchEvent).toHaveBeenCalledOnce();
    });

    test('no editor, or nothing to write into, says it could not', () => {
        expect(applyLyricEditorText(null, 'x')).toBe(false);
        expect(applyLyricEditorText({ value: '' }, 'x')).toBe(false);
    });
});
