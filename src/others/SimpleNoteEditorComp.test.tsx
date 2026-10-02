// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../event/KeyboardEventListener', () => ({
    checkIsKeyboardEventMatch: () => false,
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../helper/blockUnloadHelpers', () => ({
    genBlockUnload: () => () => {},
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (current: unknown) => ({ current }),
}));

import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from './SimpleNoteEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genStore(text: string): SimpleNoteEditorStoreType {
    return {
        defaultText: text,
        currentText: text,
        checkCanSave: () => false,
        save: async () => true,
    };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('SimpleNoteEditorComp focus', () => {
    // Edit Title opens this field from a menu. It used to leave the focus
    // where it was, so the first Escape went to the Bible reference box and
    // the field stayed open.
    test('an auto-focused field takes the focus with its text selected', () => {
        act(() => {
            root.render(
                <SimpleNoteEditorComp
                    store={genStore('Sunday sermon')}
                    isInput
                    isAutoFocus
                />,
            );
        });
        const input = host.querySelector('input')!;

        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe('Sunday sermon'.length);
    });

    test('a field that did not ask for it leaves the focus alone', () => {
        const other = document.createElement('input');
        document.body.appendChild(other);
        other.focus();
        act(() => {
            root.render(
                <SimpleNoteEditorComp store={genStore('Notes')} isInput />,
            );
        });

        expect(document.activeElement).toBe(other);
        other.remove();
    });
});
