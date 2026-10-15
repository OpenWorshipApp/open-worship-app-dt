// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bibleKey: 'en',
    inputText: 'John 3:16',
    focusResult: vi.fn(),
    getBooks: vi.fn(),
    toInputText: vi.fn(),
    pasteText: vi.fn(),
    jumpChapter: vi.fn(),
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
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('./selectionHelpers', () => ({
    BIBLE_LOOKUP_INPUT_ID: 'lookup-reference',
    INPUT_TEXT_CLASS: 'lookup-reference-input',
    focusRenderFound: h.focusResult,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => h.bibleKey,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    toInputText: h.toInputText,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBookKVList: h.getBooks,
}));
vi.mock('./BibleKeySelectionComp', () => ({
    default: ({
        onBibleKeyChange,
    }: {
        onBibleKeyChange: (oldKey: string, newKey: string) => void;
    }) =>
        createElement(
            'button',
            { type: 'button', onClick: () => onBibleKeyChange('en', 'fr') },
            'Bible key',
        ),
}));
vi.mock('./InputExtraButtonsComp', () => ({
    default: () => null,
}));
vi.mock('../server/appHelpers', () => ({
    pasteTextToInput: h.pasteText,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Test Serif',
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import InputHandlerComp, {
    getInputTrueValue,
    InputTextContext,
    useInputTextContext,
} from './InputHandlerComp';

const controller = {
    inputText: '',
    tryJumpingChapter: h.jumpChapter,
};
let root: Root;
let container: HTMLDivElement;
let onBibleKeyChange: (oldBibleKey: string, newBibleKey: string) => void;
let originalExecCommand: typeof document.execCommand | undefined;

async function render() {
    await act(async () =>
        root.render(
            createElement(
                InputTextContext,
                { value: { inputText: h.inputText } },
                createElement(InputHandlerComp, { onBibleKeyChange }),
            ),
        ),
    );
}

function input() {
    return container.querySelector<HTMLInputElement>(
        'input[aria-label="Bible Reference"]',
    )!;
}

function changeInputValue(value: string) {
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.bibleKey = 'en';
    h.inputText = 'John 3:16';
    h.focusResult.mockClear();
    h.getBooks.mockReset().mockResolvedValue({ GEN: 'Genesis' });
    h.toInputText.mockReset().mockResolvedValue('Genesis 1:1-2');
    h.pasteText.mockClear();
    h.jumpChapter.mockClear();
    controller.inputText = '';
    onBibleKeyChange = vi.fn();
    originalExecCommand = document.execCommand;
    document.execCommand = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalExecCommand) {
        document.execCommand = originalExecCommand;
    } else {
        delete (document as any).execCommand;
    }
    vi.unstubAllGlobals();
});

describe('Bible lookup reference input', () => {
    it('shows the Bible placeholder and applies external input text', async () => {
        await render();
        expect(input().placeholder).toBe('Genesis 1:1-2');
        expect(input().style.fontFamily).toBe('Test Serif');
        expect(document.execCommand).toHaveBeenCalledWith('selectAll', false);
        expect(document.execCommand).toHaveBeenCalledWith(
            'insertText',
            false,
            'John 3:16',
        );
        expect(h.toInputText).toHaveBeenCalledWith('en', 'Genesis', 1, 1, 2);
        input().value = 'Luke 1:1';
        expect(getInputTrueValue()).toBe('Luke 1:1');
    });

    it('updates the controller for typed text and trims pasted verse excerpts', async () => {
        await render();
        await act(async () => changeInputValue('Psalm 23:1'));
        expect(controller.inputText).toBe('Psalm 23:1');
        await act(async () =>
            changeInputValue('(en) Genesis 1:1 (1): In the beginning'),
        );
        expect(h.pasteText).toHaveBeenCalledWith(input(), '(en) Genesis 1:1');
        expect(controller.inputText).toBe('Psalm 23:1');
    });

    it('moves arrow-key focus to results and navigates chapters', async () => {
        await render();
        input().focus();
        await act(async () =>
            input().dispatchEvent(
                new KeyboardEvent('keyup', {
                    key: 'ArrowDown',
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(h.focusResult).toHaveBeenCalledTimes(1);
        expect(document.activeElement).not.toBe(input());
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[aria-label="Previous"]')!
                .click(),
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[aria-label="Next"]')!
                .click(),
        );
        expect(
            h.jumpChapter.mock.calls.map(([direction]) => direction),
        ).toEqual([false, true]);
        await act(async () =>
            Array.from(container.querySelectorAll('button'))
                .find((button) => button.textContent === 'Bible key')!
                .click(),
        );
        expect(onBibleKeyChange).toHaveBeenCalledWith('en', 'fr');
    });

    it('requires its input text context', () => {
        function Consumer() {
            useInputTextContext();
            return null;
        }
        expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
            'InputTextContext is not provided',
        );
    });
});
