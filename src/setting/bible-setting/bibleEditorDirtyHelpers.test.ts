// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { showSimpleToastMock } = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `t(${text})`,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

import {
    checkIsBibleKeyDirty,
    setBibleEditorDirty,
    warnIfAnyBibleEditorDirty,
    warnIfBibleKeyDirty,
} from './bibleEditorDirtyHelpers';

// The map is the module's own state: every test leaves it empty.
const usedEditors: [string, string][] = [];

function markDirty(bibleKey: string, editorId: string, isDirty: boolean) {
    usedEditors.push([bibleKey, editorId]);
    setBibleEditorDirty(bibleKey, editorId, isDirty);
}

function tryUnloading() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    for (const [bibleKey, editorId] of usedEditors.splice(0)) {
        setBibleEditorDirty(bibleKey, editorId, false);
    }
    // The leave-attempt counter is module state too; let its reset run.
    vi.advanceTimersByTime(3000);
    vi.useRealTimers();
});

describe('bibleEditorDirtyHelpers', () => {
    test('a Bible stays dirty until every one of its editors is clean', () => {
        expect(checkIsBibleKeyDirty('KJV')).toBe(false);

        markDirty('KJV', 'bible-info', true);
        markDirty('KJV', 'bible-extra', true);
        expect(checkIsBibleKeyDirty('KJV')).toBe(true);
        expect(checkIsBibleKeyDirty('KSV')).toBe(false);

        setBibleEditorDirty('KJV', 'bible-info', false);
        expect(checkIsBibleKeyDirty('KJV')).toBe(true);

        setBibleEditorDirty('KJV', 'bible-extra', false);
        expect(checkIsBibleKeyDirty('KJV')).toBe(false);
    });

    test('clearing an editor that was never dirty changes nothing', () => {
        setBibleEditorDirty('KSV', 'bible-info', false);
        expect(checkIsBibleKeyDirty('KSV')).toBe(false);
        expect(warnIfAnyBibleEditorDirty('anything')).toBe(false);
    });

    test('blocks a reload while anything is unsaved, with a warning', () => {
        expect(tryUnloading()).toBe(false);

        markDirty('KJV', 'bible-info', true);
        // Marking the same editor twice must not stack a second listener.
        markDirty('KJV', 'bible-info', true);

        expect(tryUnloading()).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledOnce();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            't(Unsaved Bible Data)',
            't(You have unsaved Bible changes.) ' +
                't(Please save or discard them before reloading.) ' +
                't(Or attempt 3 times to force leaving.)',
        );

        setBibleEditorDirty('KJV', 'bible-info', false);
        showSimpleToastMock.mockClear();
        expect(tryUnloading()).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('lets the fourth attempt leave, and re-arms on the next change', () => {
        markDirty('KJV', 'bible-info', true);

        expect([tryUnloading(), tryUnloading(), tryUnloading()]).toEqual([
            true,
            true,
            true,
        ]);
        // The fourth attempt in a row forces the way out.
        expect(tryUnloading()).toBe(false);
        expect(tryUnloading()).toBe(false);

        // Still dirty: the next change puts the guard back.
        vi.advanceTimersByTime(3000);
        markDirty('KJV', 'bible-extra', true);
        expect(tryUnloading()).toBe(true);
    });

    test('warns about one Bible only when that Bible is dirty', () => {
        expect(warnIfBibleKeyDirty('KJV', 'Save first.')).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();

        markDirty('KSV', 'bible-info', true);
        expect(warnIfBibleKeyDirty('KJV', 'Save first.')).toBe(false);
        expect(warnIfBibleKeyDirty('KSV', 'Save first.')).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            't(Unsaved Bible Data)',
            't(Save first.)',
        );
    });

    test('warns about any Bible when any editor is dirty', () => {
        expect(warnIfAnyBibleEditorDirty('Save before refreshing.')).toBe(
            false,
        );

        markDirty('KSV', 'book-chapter', true);

        expect(warnIfAnyBibleEditorDirty('Save before refreshing.')).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            't(Unsaved Bible Data)',
            't(Save before refreshing.)',
        );
    });
});
