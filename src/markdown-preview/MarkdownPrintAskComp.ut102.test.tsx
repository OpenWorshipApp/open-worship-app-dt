// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The keys inside the question that are not Tab, and Tab while every button
// waits on the details being read.

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
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import MarkdownPrintAskComp from './MarkdownPrintAskComp';

let root: Root;
let container: HTMLDivElement;
const onAnswer = vi.fn();

async function render(isReading: boolean) {
    await act(async () => {
        root.render(
            createElement(MarkdownPrintAskComp, {
                verseCount: 1,
                nameCount: 1,
                placeCount: 0,
                isReading,
                onAnswer,
            }),
        );
    });
}

function pressKey(target: Element, key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
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

describe('keys inside the question', () => {
    test('a key that is not Tab is left to the page: nothing moves, nothing answers', async () => {
        await render(false);
        const [add] = [...container.querySelectorAll('button')];
        add.focus();
        for (const key of ['ArrowRight', 'Enter', 'a']) {
            expect(pressKey(add, key).defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(add);
        }
        expect(onAnswer).not.toHaveBeenCalled();
    });

    test('Tab while every button waits stays in the question', async () => {
        await render(true);
        const dialog = container.querySelector('[role="dialog"]')!;
        const buttonList = [...container.querySelectorAll('button')];
        expect(buttonList.every((button) => button.disabled)).toBe(true);
        expect(pressKey(dialog, 'Tab').defaultPrevented).toBe(true);
        // No button could take the focus, and none was pressed.
        expect(buttonList).not.toContain(document.activeElement);
        expect(onAnswer).not.toHaveBeenCalled();
    });
});
