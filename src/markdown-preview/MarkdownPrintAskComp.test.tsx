// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
// Every word through `tran`, marked so a word drawn without it shows.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `«${key}»`,
}));

import MarkdownPrintAskComp from './MarkdownPrintAskComp';

let root: Root;
let container: HTMLDivElement;
const onAnswer = vi.fn();

async function render(
    props: Partial<{
        verseCount: number;
        nameCount: number;
        placeCount: number;
        isReading: boolean;
        purpose: 'print' | 'word';
    }> = {},
) {
    await act(async () => {
        root.render(
            createElement(MarkdownPrintAskComp, {
                verseCount: 2,
                nameCount: 0,
                placeCount: 1,
                isReading: false,
                onAnswer,
                ...props,
            }),
        );
    });
}

function buttonList() {
    return [...container.querySelectorAll('button')];
}

function pressKey(target: EventTarget, key: string, shiftKey = false) {
    const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onAnswer.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('the question before a print', () => {
    test('asks in the window language, says what the page names, and starts on Add and Print', async () => {
        await render();

        const dialog = container.querySelector('[role="dialog"]')!;
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(
            container.querySelector('#app-markdown-print-ask-question')
                ?.textContent,
        ).toBe(
            '«Add the Bible text and the name and place details to the end of the printout?»',
        );
        // Only the kinds the page names.
        expect(
            container.querySelector('#app-markdown-print-ask-counts')
                ?.textContent,
        ).toBe('«Verses»: 2 · «Places»: 1');
        expect(
            buttonList().map((element) => {
                return element.textContent;
            }),
        ).toEqual(['«Add and Print»', '«Print Page Only»', '«Cancel»']);
        expect(document.activeElement).toBe(buttonList()[0]);
    });

    test('each button is its answer', async () => {
        await render();
        for (const element of buttonList()) {
            act(() => {
                element.click();
            });
        }
        expect(onAnswer.mock.calls).toEqual([['add'], ['without'], ['cancel']]);
    });

    test('Esc is Cancel, wherever the focus is', async () => {
        await render();
        const event = pressKey(document.body, 'Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(onAnswer).toHaveBeenCalledWith('cancel');
    });

    test('Tab goes round its own buttons, both ways', async () => {
        await render();
        const [add, without, cancel] = buttonList();
        expect(pressKey(add, 'Tab').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(without);
        pressKey(without, 'Tab');
        pressKey(cancel, 'Tab');
        expect(document.activeElement).toBe(add);
        pressKey(add, 'Tab', true);
        expect(document.activeElement).toBe(cancel);
    });

    test('while the details are read, it waits: no button, no Esc', async () => {
        await render({ isReading: true });

        expect(
            buttonList().every((element) => {
                return element.disabled;
            }),
        ).toBe(true);
        expect(
            container
                .querySelector('[role="dialog"]')
                ?.getAttribute('aria-busy'),
        ).toBe('true');
        expect(container.querySelector('.spinner-border')).not.toBeNull();
        pressKey(document.body, 'Escape');
        expect(onAnswer).not.toHaveBeenCalled();
    });

    test('a press beside it keeps the focus on it', async () => {
        await render();
        const backdrop = container.querySelector(
            '.app-markdown-print-ask-backdrop',
        )!;
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        backdrop.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);

        const onButton = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        buttonList()[1].dispatchEvent(onButton);
        expect(onButton.defaultPrevented).toBe(false);
    });
});

// 2026-11-14: the same question before a Word document is made of the page.
describe('the question before a Word document', () => {
    test('asks about the Word document, in its own words, each button its answer', async () => {
        await render({ purpose: 'word' });

        expect(
            container.querySelector('#app-markdown-print-ask-question')
                ?.textContent,
        ).toBe(
            '«Add the Bible text and the name and place details to the end of the Word document?»',
        );
        expect(
            container.querySelector(
                '#app-markdown-print-ask-question .bi-file-earmark-word',
            ),
        ).not.toBeNull();
        expect(
            buttonList().map((element) => {
                return element.textContent;
            }),
        ).toEqual(['«Add and Export»', '«Export Page Only»', '«Cancel»']);
        for (const element of buttonList()) {
            act(() => {
                element.click();
            });
        }
        expect(onAnswer.mock.calls).toEqual([['add'], ['without'], ['cancel']]);
    });
});
