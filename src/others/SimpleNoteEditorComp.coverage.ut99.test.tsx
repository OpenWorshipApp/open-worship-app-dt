// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The saving side of the note editor: the 5 s debounce (the real
// `genTimeoutAttempt`, on fake timers), the unload guard (the real
// `genBlockUnload`) and the keyboard paths. The sibling
// `SimpleNoteEditorComp.test.tsx` keeps the focus behaviour.
const h = vi.hoisted(() => ({
    showSimpleToast: vi.fn(),
    keyboardMappers: [] as unknown[],
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: (...args: unknown[]) => h.showSimpleToast(...args),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../event/KeyboardEventListener', () => ({
    // Ctrl+S as Windows and Linux fire it.
    checkIsKeyboardEventMatch: (mappers: unknown[], event: KeyboardEvent) => {
        h.keyboardMappers.push(mappers);
        return (
            event.key === 's' &&
            event.ctrlKey &&
            !event.altKey &&
            !event.shiftKey &&
            !event.metaKey
        );
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(target: T) => {
            const ref = useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from './SimpleNoteEditorComp';

// The borders the component writes, read back the way the DOM spells them.
function toDomBorder(border: string) {
    const probe = document.createElement('div');
    probe.style.border = border;
    return probe.style.border;
}
const UNSAVED_BORDER = toDomBorder('2px solid #007bff44');
const SAVED_BORDER = toDomBorder('2px solid transparent');

let container: HTMLDivElement;
let root: Root;

function genStore(
    overrides: Partial<SimpleNoteEditorStoreType> = {},
): SimpleNoteEditorStoreType {
    const store: SimpleNoteEditorStoreType = {
        defaultText: 'Hello',
        currentText: 'Hello',
        checkCanSave: () => store.currentText !== store.defaultText,
        save: vi.fn(async () => true),
        ...overrides,
    };
    return store;
}

function getField() {
    return container.querySelector('textarea, input') as
        HTMLTextAreaElement | HTMLInputElement;
}

async function typeInto(value: string) {
    const field = getField();
    const prototype =
        field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
    await act(async () => {
        setter.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressKey(init: KeyboardEventInit) {
    let isNotPrevented = true;
    await act(async () => {
        isNotPrevented = getField().dispatchEvent(
            new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
    return isNotPrevented;
}

async function tryLeaving() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    h.keyboardMappers.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    // Let the unload guard's attempt counter reset between tests.
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
});

describe('SimpleNoteEditorComp saving', () => {
    test('typing marks the note unsaved, guards the unload and saves 5 s later', async () => {
        const store = genStore();
        await act(async () => {
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    placeholder="Type here"
                    isResizable
                />,
            );
        });
        const field = getField();
        expect(field).toBeInstanceOf(HTMLTextAreaElement);
        expect(field.value).toBe('Hello');
        expect(field.placeholder).toBe('Type here');
        expect(field.readOnly).toBe(false);
        expect(field.style.resize).toBe('both');
        expect(field.style.border).toBe(SAVED_BORDER);
        expect(await tryLeaving()).toBe(false);

        await typeInto('Hello world');
        expect(field.value).toBe('Hello world');
        expect(store.currentText).toBe('Hello world');
        expect(field.style.border).toBe(UNSAVED_BORDER);
        // Leaving now is held back with a toast.
        expect(await tryLeaving()).toBe(true);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Saving note',
            'Please wait while the note is being saved. Or attempt 3 times to force leaving.',
        );

        // More typing pushes the one save back.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        await typeInto('Hello world!');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4999);
        });
        expect(store.save).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(store.save).toHaveBeenCalledTimes(1);
        expect(store.currentText).toBe('Hello world!');
        expect(field.style.border).toBe(SAVED_BORDER);
        h.showSimpleToast.mockClear();
        expect(await tryLeaving()).toBe(false);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a failed save keeps the note marked unsaved', async () => {
        const store = genStore({ save: vi.fn(async () => false) });
        await act(async () => {
            root.render(<SimpleNoteEditorComp store={store} isInput />);
        });
        await typeInto('Hello there');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(store.save).toHaveBeenCalledTimes(1);
        expect(getField().style.border).toBe(UNSAVED_BORDER);
    });

    test('Ctrl+S saves at once and swallows the browser shortcut', async () => {
        const store = genStore({ save: vi.fn(async () => false) });
        await act(async () => {
            root.render(<SimpleNoteEditorComp store={store} isInput />);
        });
        expect(getField().style.border).toBe(SAVED_BORDER);
        const isNotPrevented = await pressKey({ key: 's', ctrlKey: true });
        expect(isNotPrevented).toBe(false);
        expect(store.save).toHaveBeenCalledTimes(1);
        expect(getField().style.border).toBe(UNSAVED_BORDER);
        expect(h.keyboardMappers[0]).toEqual([
            {
                mControlKey: ['Meta'],
                wControlKey: ['Ctrl'],
                lControlKey: ['Ctrl'],
                key: 's',
            },
        ]);
        // A plain key is left alone.
        expect(await pressKey({ key: 'a' })).toBe(true);
        expect(store.save).toHaveBeenCalledTimes(1);
    });

    test('Escape, Enter and blur reach their handlers, saving on the way out', async () => {
        const store = genStore();
        const onEscape = vi.fn();
        const onEnter = vi.fn();
        const onBlur = vi.fn();
        await act(async () => {
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    isInput
                    onEscape={onEscape}
                    onEnter={onEnter}
                    onBlur={onBlur}
                />,
            );
        });
        await pressKey({ key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(store.save).not.toHaveBeenCalled();
        // A modified Escape is not the plain close.
        await pressKey({ key: 'Escape', shiftKey: true });
        expect(onEscape).toHaveBeenCalledTimes(1);

        await pressKey({ key: 'Enter' });
        expect(store.save).toHaveBeenCalledTimes(1);
        expect(onEnter).toHaveBeenCalledTimes(1);

        const field = getField();
        await act(async () => {
            field.focus();
        });
        await act(async () => {
            field.blur();
        });
        expect(store.save).toHaveBeenCalledTimes(2);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    test('without handlers Escape does nothing and a blur still saves', async () => {
        const store = genStore();
        await act(async () => {
            root.render(<SimpleNoteEditorComp store={store} />);
        });
        expect(await pressKey({ key: 'Escape' })).toBe(true);
        expect(await pressKey({ key: 'Enter' })).toBe(true);
        expect(store.save).not.toHaveBeenCalled();
        const field = getField();
        expect(field.style.resize).toBe('none');
        await act(async () => {
            field.focus();
        });
        await act(async () => {
            field.blur();
        });
        expect(store.save).toHaveBeenCalledTimes(1);
    });

    test('a store with no save is read-only and ignores every way in', async () => {
        const store = genStore({ save: undefined });
        const onEnter = vi.fn();
        await act(async () => {
            root.render(
                <SimpleNoteEditorComp
                    store={store}
                    placeholder="Type here"
                    isInput
                    onEnter={onEnter}
                />,
            );
        });
        const field = getField();
        expect(field.readOnly).toBe(true);
        expect(field.hasAttribute('placeholder')).toBe(false);
        await typeInto('Changed');
        expect(store.currentText).toBe('Hello');
        expect(field.value).toBe('Hello');
        expect(field.style.border).toBe(SAVED_BORDER);
        expect(await pressKey({ key: 's', ctrlKey: true })).toBe(true);
        await pressKey({ key: 'Enter' });
        expect(onEnter).toHaveBeenCalledTimes(1);
        await act(async () => {
            field.focus();
        });
        await act(async () => {
            field.blur();
        });
        expect(await tryLeaving()).toBe(false);
    });

    test('a new store resets the text and the saved state', async () => {
        const firstStore = genStore();
        await act(async () => {
            root.render(<SimpleNoteEditorComp store={firstStore} isInput />);
        });
        await typeInto('Draft');
        expect(getField().style.border).toBe(UNSAVED_BORDER);
        const secondStore = genStore({
            defaultText: 'Other note',
            currentText: 'Other note',
        });
        await act(async () => {
            root.render(<SimpleNoteEditorComp store={secondStore} isInput />);
        });
        expect(getField().value).toBe('Other note');
        expect(getField().style.border).toBe(SAVED_BORDER);
        expect(await tryLeaving()).toBe(false);
    });
});
