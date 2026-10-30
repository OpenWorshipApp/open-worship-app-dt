// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The sibling `SimpleNoteEditorComp.test.tsx` replaces the 5-second debounce
// with an immediate call and the Ctrl+S matcher with `false`, so saving, the
// unsaved state and the keys never run there. Here the real debounce runs on
// fake timers and the real unload blocker is kept.

const state = vi.hoisted(() => ({
    showSimpleToast: vi.fn(),
    checkIsKeyboardEventMatch: vi.fn(),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: state.showSimpleToast,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../event/KeyboardEventListener', () => ({
    checkIsKeyboardEventMatch: state.checkIsKeyboardEventMatch,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from './SimpleNoteEditorComp';

function genStore(
    text: string,
    {
        canSave = true,
        saveResult = true,
        isReadOnly = false,
    }: { canSave?: boolean; saveResult?: boolean; isReadOnly?: boolean } = {},
) {
    const save = vi.fn(async () => saveResult);
    const store: SimpleNoteEditorStoreType = {
        defaultText: text,
        currentText: text,
        checkCanSave: () => canSave,
        ...(isReadOnly ? {} : { save }),
    };
    return { store, save };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.checkIsKeyboardEventMatch.mockImplementation(
        (_mappers: unknown, event: KeyboardEvent) =>
            event.ctrlKey && event.key === 's',
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    // Let the unload blocker's attempt counter reset between tests.
    await vi.advanceTimersByTimeAsync(5000);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function getField() {
    return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
    )!;
}

async function typeInto(value: string) {
    const field = getField();
    const proto =
        field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(
            field,
            value,
        );
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressKey(init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    await act(async () => {
        getField().dispatchEvent(event);
    });
    return event;
}

function isShownSaved() {
    return getField().style.border.includes('transparent');
}

function fireBeforeUnload() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event;
}

describe('typing and saving', () => {
    test('typing marks the note unsaved and saves once, 5 seconds after the last key', async () => {
        const { store, save } = genStore('Hello');
        await act(async () =>
            root.render(
                <SimpleNoteEditorComp store={store} placeholder="Write here" />,
            ),
        );
        expect(getField().tagName).toBe('TEXTAREA');
        expect(getField().placeholder).toBe('Write here');
        expect(isShownSaved()).toBe(true);

        await typeInto('Hello w');
        await act(async () => vi.advanceTimersByTimeAsync(3000));
        await typeInto('Hello world');
        expect(store.currentText).toBe('Hello world');
        expect((getField() as HTMLTextAreaElement).value).toBe('Hello world');
        expect(isShownSaved()).toBe(false);
        await act(async () => vi.advanceTimersByTimeAsync(4999));
        expect(save).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(save).toHaveBeenCalledOnce();
        expect(isShownSaved()).toBe(true);
    });

    test('a save that fails leaves the note shown unsaved', async () => {
        const { store, save } = genStore('a', { saveResult: false });
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        await typeInto('ab');
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(save).toHaveBeenCalledOnce();
        expect(isShownSaved()).toBe(false);
    });

    test('a store with nothing to save stays shown saved while typing', async () => {
        const { store } = genStore('a', { canSave: false });
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        await typeInto('abc');
        expect(isShownSaved()).toBe(true);
    });

    test('a read-only note ignores typing, keys and prompts', async () => {
        const { store } = genStore('PowerPoint note', { isReadOnly: true });
        await act(async () =>
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    placeholder="Write here"
                    isInput
                    onEnter={vi.fn()}
                />,
            ),
        );
        const field = getField() as HTMLInputElement;
        expect(field.readOnly).toBe(true);
        expect(field.placeholder).toBe('');
        await typeInto('changed');
        expect(store.currentText).toBe('PowerPoint note');
        expect(field.value).toBe('PowerPoint note');
        const event = await pressKey({ key: 's', ctrlKey: true });
        expect(event.defaultPrevented).toBe(false);
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(isShownSaved()).toBe(true);
    });

    test('a new store resets the text and the saved state', async () => {
        const first = genStore('first');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={first.store} isInput />),
        );
        await typeInto('first draft');
        expect(isShownSaved()).toBe(false);
        const second = genStore('second');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={second.store} isInput />),
        );
        expect((getField() as HTMLInputElement).value).toBe('second');
        expect(isShownSaved()).toBe(true);
    });

    test('resizable notes can be resized, others cannot', async () => {
        const { store } = genStore('x');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isResizable />),
        );
        expect(getField().style.resize).toBe('both');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} />),
        );
        expect(getField().style.resize).toBe('none');
    });
});

describe('leaving with an unsaved note', () => {
    test('is blocked with a toast until the note is saved', async () => {
        const { store } = genStore('draft');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        // Saved: leaving is not blocked.
        expect(fireBeforeUnload().defaultPrevented).toBe(false);

        await typeInto('draft 2');
        const blocked = fireBeforeUnload();
        expect(blocked.defaultPrevented).toBe(true);
        expect(state.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Saving note',
            'Please wait while the note is being saved. Or attempt 3 times to force leaving.',
        );

        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(isShownSaved()).toBe(true);
        expect(fireBeforeUnload().defaultPrevented).toBe(false);
        expect(state.showSimpleToast).toHaveBeenCalledOnce();
    });
});

describe('keys', () => {
    test('Escape alone calls onEscape and nothing else', async () => {
        const { store, save } = genStore('x');
        const onEscape = vi.fn();
        const onEnter = vi.fn();
        await act(async () =>
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    isInput
                    onEscape={onEscape}
                    onEnter={onEnter}
                />,
            ),
        );
        await pressKey({ key: 'Escape', shiftKey: true });
        expect(onEscape).not.toHaveBeenCalled();
        await pressKey({ key: 'Escape' });
        expect(onEscape).toHaveBeenCalledOnce();
        expect(save).not.toHaveBeenCalled();
        expect(onEnter).not.toHaveBeenCalled();
    });

    test('Ctrl+S saves at once instead of waiting for the debounce', async () => {
        const { store, save } = genStore('x');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        await typeInto('xy');
        expect(isShownSaved()).toBe(false);
        const event = await pressKey({ key: 's', ctrlKey: true });
        expect(event.defaultPrevented).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        expect(isShownSaved()).toBe(true);
        expect(state.checkIsKeyboardEventMatch).toHaveBeenCalledWith(
            [
                {
                    mControlKey: ['Meta'],
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                    key: 's',
                },
            ],
            expect.anything(),
        );
    });

    test('Enter saves and hands over to onEnter', async () => {
        const { store, save } = genStore('x');
        const onEnter = vi.fn();
        await act(async () =>
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    isInput
                    onEnter={onEnter}
                />,
            ),
        );
        await pressKey({ key: 'Enter' });
        expect(save).toHaveBeenCalledOnce();
        expect(onEnter).toHaveBeenCalledOnce();
    });

    test('Enter with no onEnter does nothing', async () => {
        const { store, save } = genStore('x');
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        await pressKey({ key: 'Enter' });
        expect(save).not.toHaveBeenCalled();
    });

    test('leaving the field saves and calls onBlur', async () => {
        const { store, save } = genStore('x');
        const onBlur = vi.fn();
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} onBlur={onBlur} />),
        );
        await act(async () => {
            getField().focus();
            getField().blur();
        });
        expect(save).toHaveBeenCalledOnce();
        expect(onBlur).toHaveBeenCalledOnce();
    });

    test('leaving a read-only field saves nothing', async () => {
        const { store, save } = genStore('x', { isReadOnly: true });
        await act(async () =>
            root.render(<SimpleNoteEditorComp store={store} isInput />),
        );
        await act(async () => {
            getField().focus();
            getField().blur();
        });
        expect(save).not.toHaveBeenCalled();
    });
});
