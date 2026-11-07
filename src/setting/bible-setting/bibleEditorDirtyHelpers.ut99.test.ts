// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        // What the module handed `genBlockUnload` at load, and the listener it
        // got back.
        showWarning: null as (() => void) | null,
        listener: function blockUnload() {},
    },
    mocks: { toast: vi.fn() },
}));

vi.mock('../../helper/blockUnloadHelpers', () => ({
    genBlockUnload: (showWarning: () => void) => {
        state.showWarning = showWarning;
        return state.listener;
    },
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `[${text}]`,
}));

import {
    checkIsBibleKeyDirty,
    setBibleEditorDirty,
    warnIfAnyBibleEditorDirty,
    warnIfBibleKeyDirty,
} from './bibleEditorDirtyHelpers';

let addSpy: ReturnType<typeof vi.spyOn>;
let removeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
});

afterEach(() => {
    // The map is module state: leave every editor clean for the next case.
    for (const [key, id] of [
        ['KJV', 'info'],
        ['KJV', 'books'],
        ['ESV', 'info'],
    ]) {
        setBibleEditorDirty(key, id, false);
    }
});

describe('tracking unsaved Bible editors', () => {
    test('a dirty editor marks its Bible and arms the unload guard', () => {
        expect(checkIsBibleKeyDirty('KJV')).toBe(false);
        setBibleEditorDirty('KJV', 'info', true);
        expect(checkIsBibleKeyDirty('KJV')).toBe(true);
        expect(checkIsBibleKeyDirty('ESV')).toBe(false);
        expect(addSpy).toHaveBeenCalledWith('beforeunload', state.listener);
    });

    test('the Bible stays dirty until its LAST editor is clean, then the guard goes', () => {
        setBibleEditorDirty('KJV', 'info', true);
        setBibleEditorDirty('KJV', 'books', true);
        setBibleEditorDirty('KJV', 'info', false);
        expect(checkIsBibleKeyDirty('KJV')).toBe(true);
        expect(removeSpy).not.toHaveBeenCalled();

        setBibleEditorDirty('KJV', 'books', false);
        expect(checkIsBibleKeyDirty('KJV')).toBe(false);
        expect(removeSpy).toHaveBeenCalledWith('beforeunload', state.listener);
    });

    test('one clean Bible does not disarm the guard another still needs', () => {
        setBibleEditorDirty('KJV', 'info', true);
        setBibleEditorDirty('ESV', 'info', true);
        setBibleEditorDirty('ESV', 'info', false);
        expect(removeSpy).not.toHaveBeenCalled();
        expect(addSpy).toHaveBeenLastCalledWith('beforeunload', state.listener);
    });

    test('cleaning an editor that was never dirty changes nothing but the guard', () => {
        setBibleEditorDirty('ESV', 'info', false);
        expect(checkIsBibleKeyDirty('ESV')).toBe(false);
        expect(removeSpy).toHaveBeenCalledWith('beforeunload', state.listener);
    });
});

describe('warning before an action that would discard changes', () => {
    test('warns for the Bible that is dirty, and only for it', () => {
        expect(warnIfBibleKeyDirty('KJV', 'Save first.')).toBe(false);
        expect(mocks.toast).not.toHaveBeenCalled();

        setBibleEditorDirty('KJV', 'info', true);
        expect(warnIfBibleKeyDirty('ESV', 'Save first.')).toBe(false);
        expect(warnIfBibleKeyDirty('KJV', 'Save first.')).toBe(true);
        expect(mocks.toast).toHaveBeenCalledOnce();
        expect(mocks.toast).toHaveBeenCalledWith(
            '[Unsaved Bible Data]',
            '[Save first.]',
        );
    });

    test('warns when any editor at all is dirty', () => {
        expect(warnIfAnyBibleEditorDirty('Save before switching.')).toBe(false);
        setBibleEditorDirty('ESV', 'info', true);
        expect(warnIfAnyBibleEditorDirty('Save before switching.')).toBe(true);
        expect(mocks.toast).toHaveBeenCalledWith(
            '[Unsaved Bible Data]',
            '[Save before switching.]',
        );
    });

    test('the unload guard explains itself in the window language', () => {
        state.showWarning!();
        expect(mocks.toast).toHaveBeenCalledWith(
            '[Unsaved Bible Data]',
            '[You have unsaved Bible changes.] ' +
                '[Please save or discard them before reloading.] ' +
                '[Or attempt 3 times to force leaving.]',
        );
    });
});
