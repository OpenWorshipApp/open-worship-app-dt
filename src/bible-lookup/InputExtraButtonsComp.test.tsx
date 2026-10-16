// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    inputText: '',
    focused: false,
    focusInput: vi.fn(),
    parseChapter: vi.fn(),
    editingResult: {
        oldInputText: '',
        result: {
            bookKey: null as string | null,
            guessingChapter: null as number | null,
            bibleItem: null as null | {
                target: {
                    chapter?: number;
                    verseStart: number;
                    verseEnd: number;
                    chapterEnd?: number;
                };
            },
        },
    },
    getEditingResult: vi.fn(),
    handlers: new Map<string, (...args: any[]) => unknown>(),
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffectAsync: (
            method: (context: {
                setIsTabAvailable: (value: boolean) => void;
            }) => Promise<void>,
            deps: unknown[],
            context: { setIsTabAvailable: (value: boolean) => void },
        ) =>
            react.useEffect(() => {
                void method(context);
            }, deps),
    };
});
vi.mock('./selectionHelpers', () => ({
    checkIsBibleLookupInputFocused: () => h.focused,
    INPUT_TEXT_CLASS: 'lookup-input',
    setBibleLookupInputFocus: h.focusInput,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: (value: string) => value,
    useKeyboardRegistering: (
        eventMaps: string[],
        callback: (...args: any[]) => unknown,
    ) => {
        h.handlers.set(eventMaps[0], callback);
    },
}));
vi.mock('../keyboard-shortcut/appShortcutMappers', () => ({
    lookupEscapeEventMapper: 'escape',
    lookupRemoveAllEventMapper: 'remove-all',
    lookupTabEventMapper: 'tab',
}));
vi.mock('./InputHandlerComp', () => ({
    useInputTextContext: () => ({ inputText: h.inputText }),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    parseChapterFromGuessing: h.parseChapter,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import InputExtraButtonsComp from './InputExtraButtonsComp';

const controller = {
    inputText: '',
    selectedBibleItem: { bibleKey: 'en' },
    getEditingResult: (...args: unknown[]) => h.getEditingResult(...args),
};
let root: Root;
let container: HTMLDivElement;

function action(label: string) {
    const element = Array.from(
        container.querySelectorAll<HTMLElement>('[role="button"]'),
    ).find((node) => node.getAttribute('aria-label')?.startsWith(label));
    expect(element).not.toBeNull();
    return element!;
}

async function render() {
    await act(async () =>
        root.render(
            createElement(
                'div',
                {},
                createElement('input', { className: 'lookup-input' }),
                createElement(InputExtraButtonsComp),
            ),
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.inputText = '';
    h.focused = false;
    h.focusInput.mockClear();
    h.parseChapter.mockReset().mockResolvedValue(null);
    h.editingResult = {
        oldInputText: '',
        result: {
            bookKey: null,
            guessingChapter: null,
            bibleItem: null,
        },
    };
    h.getEditingResult
        .mockReset()
        .mockImplementation(async () => h.editingResult);
    h.handlers.clear();
    controller.inputText = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Bible lookup input actions', () => {
    it('disables actions when empty and positions them beside the input', async () => {
        await render();
        expect(action('Clear input').getAttribute('aria-disabled')).toBe(
            'true',
        );
        expect(action('Tab to complete').getAttribute('tabindex')).toBe('-1');
        const wrapper = container.querySelector<HTMLElement>(
            '.custom-clear-input-wrapper',
        )!;
        expect(wrapper.style.right).toBe('5px');
        expect(wrapper.style.zIndex).toBe('5');
        expect(h.handlers.has('escape')).toBe(true);
        expect(h.handlers.has('remove-all')).toBe(true);
        expect(h.handlers.has('tab')).toBe(true);
    });

    it('completes a single verse with a dash on click and on the Tab shortcut', async () => {
        h.inputText = 'John 3:16';
        h.editingResult = {
            oldInputText: 'John 3:16',
            result: {
                bookKey: 'JHN',
                guessingChapter: 3,
                bibleItem: { target: { verseStart: 16, verseEnd: 16 } },
            },
        };
        await render();
        expect(
            action('Tab to complete').getAttribute('aria-disabled'),
        ).toBeNull();
        await act(async () => action('Tab to complete').click());
        expect(controller.inputText).toBe('John 3:16-');
        controller.inputText = '';
        const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
        await act(async () => h.handlers.get('tab')!(event));
        expect(controller.inputText).toBe('John 3:16-');
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('leaves a cross-chapter passage alone though its verses match', async () => {
        h.inputText = 'John 1:2-3:2';
        h.editingResult = {
            oldInputText: 'John 1:2-3:2',
            result: {
                bookKey: 'JHN',
                guessingChapter: 1,
                bibleItem: {
                    target: {
                        chapter: 1,
                        verseStart: 2,
                        verseEnd: 2,
                        chapterEnd: 3,
                    },
                },
            },
        };
        await render();
        expect(action('Tab to complete').getAttribute('aria-disabled')).toBe(
            'true',
        );
        controller.inputText = 'John 1:2-3:2';
        const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
        await act(async () => h.handlers.get('tab')!(event));
        expect(controller.inputText).toBe('John 1:2-3:2');
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('completes a recognized chapter with a colon', async () => {
        h.inputText = 'Psalm 23';
        h.editingResult = {
            oldInputText: 'Psalm 23',
            result: {
                bookKey: 'PSA',
                guessingChapter: 23,
                bibleItem: null,
            },
        };
        h.parseChapter.mockResolvedValue(23);
        await render();
        expect(
            action('Tab to complete').getAttribute('aria-disabled'),
        ).toBeNull();
        await act(async () => action('Tab to complete').click());
        expect(controller.inputText).toBe('Psalm 23:');
        expect(h.parseChapter).toHaveBeenCalledWith('en', 'PSA', 23);
    });

    it('removes the last chunk or all text through icons and shortcuts', async () => {
        h.inputText = 'John 3:16 17';
        h.focused = true;
        await render();
        await act(async () => action('Clear input chunk').click());
        expect(controller.inputText).toBe('John 3:16 ');
        expect(h.focusInput).toHaveBeenCalledTimes(1);
        controller.inputText = '';
        await act(async () => h.handlers.get('escape')!());
        expect(controller.inputText).toBe('John 3:16 ');
        await act(async () => h.handlers.get('remove-all')!());
        expect(controller.inputText).toBe('');
        await act(async () => action('Clear input').click());
        expect(h.focusInput).toHaveBeenCalled();
    });

    it('returns focus to lookup on Escape when another non-input element is focused', async () => {
        h.inputText = 'John';
        await render();
        const other = document.createElement('button');
        document.body.appendChild(other);
        other.focus();
        await act(async () => h.handlers.get('escape')!());
        expect(h.focusInput).toHaveBeenCalledTimes(1);
        other.remove();
    });
});
