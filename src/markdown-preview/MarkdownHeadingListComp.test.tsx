// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `[${key}]`,
}));

import MarkdownHeadingListComp from './MarkdownHeadingListComp';

const HEADINGS = [
    { level: 2, text: 'Intro' },
    { level: 3, text: 'Detail' },
    { level: 4, text: 'Fine print' },
    { level: 2, text: 'End' },
];

let root: Root;
let container: HTMLDivElement;
let toggle: HTMLButtonElement;
const onPick = vi.fn();
const onClose = vi.fn();

function render(currentIndex: number) {
    act(() => {
        root.render(
            <MarkdownHeadingListComp
                headings={HEADINGS}
                currentIndex={currentIndex}
                toggleRef={{ current: toggle }}
                onPick={onPick}
                onClose={onClose}
            />,
        );
    });
}

function entries() {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>(
            '.app-markdown-heading-list-item',
        ),
    );
}

function entry(text: string) {
    const element = entries().find((candidate) => {
        return candidate.textContent === text;
    });
    expect(element).toBeDefined();
    return element!;
}

function pressKey(key: string, target: EventTarget = document.activeElement!) {
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

function pressPointer(target: EventTarget) {
    act(() => {
        target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onPick.mockReset();
    onClose.mockReset();
    toggle = document.createElement('button');
    toggle.append(document.createElement('i'));
    container = document.createElement('div');
    document.body.append(toggle, container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    toggle.remove();
    vi.unstubAllGlobals();
});

describe('MarkdownHeadingListComp', () => {
    test("lists the headings set in by level under the page's highest, the section read marked and focused", () => {
        render(2);
        const nav = container.querySelector('nav')!;
        expect(nav.className).toBe('app-markdown-heading-list');
        expect(nav.getAttribute('aria-label')).toBe('[Sections]');
        expect(
            entries().map((element) => {
                return [
                    element.textContent,
                    element.title,
                    element.style.getPropertyValue('--app-heading-depth'),
                    element.classList.contains(
                        'app-markdown-heading-list-item--top',
                    ),
                    element.getAttribute('aria-current'),
                ];
            }),
        ).toEqual([
            ['Intro', 'Intro', '0', true, null],
            ['Detail', 'Detail', '1', false, null],
            ['Fine print', 'Fine print', '2', false, 'location'],
            ['End', 'End', '0', true, null],
        ]);
        expect(document.activeElement).toBe(entry('Fine print'));
    });

    test('above the first heading, the first is focused and none marked', () => {
        render(-1);
        expect(document.activeElement).toBe(entry('Intro'));
        expect(container.querySelector('[aria-current]')).toBeNull();
    });

    test('the arrows, Home and End move along the list and no further', () => {
        render(1);
        expect(pressKey('ArrowDown').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(entry('Fine print'));
        pressKey('ArrowDown');
        pressKey('ArrowDown');
        expect(document.activeElement).toBe(entry('End'));
        pressKey('ArrowUp');
        expect(document.activeElement).toBe(entry('Fine print'));
        pressKey('Home');
        pressKey('ArrowUp');
        expect(document.activeElement).toBe(entry('Intro'));
        pressKey('End');
        expect(document.activeElement).toBe(entry('End'));
        // Any other key is left to the page.
        expect(pressKey('a').defaultPrevented).toBe(false);
        expect(onClose).not.toHaveBeenCalled();
    });

    test('from outside the entries an arrow starts at an end of the list', () => {
        render(0);
        const nav = container.querySelector('nav')!;
        (document.activeElement as HTMLElement).blur();
        pressKey('ArrowDown', nav);
        expect(document.activeElement).toBe(entry('Intro'));
        (document.activeElement as HTMLElement).blur();
        pressKey('ArrowUp', nav);
        expect(document.activeElement).toBe(entry('End'));
    });

    test('a press on a heading picks it by its place in the list', () => {
        render(0);
        act(() => {
            entry('End').click();
        });
        expect(onPick).toHaveBeenCalledWith(3);
        expect(onClose).not.toHaveBeenCalled();
    });

    test('Escape closes it and sends the focus back, unless something else took it', () => {
        render(0);
        const handled = new KeyboardEvent('keydown', {
            key: 'Escape',
            cancelable: true,
        });
        handled.preventDefault();
        act(() => {
            document.dispatchEvent(handled);
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(pressKey('Escape', document.body).defaultPrevented).toBe(true);
        expect(onClose).toHaveBeenCalledWith(true);
    });

    test('a press outside closes it, keeping the focus where it went; one inside it or on its button does not', () => {
        render(0);
        pressPointer(entry('Detail'));
        pressPointer(toggle.firstElementChild!);
        expect(onClose).not.toHaveBeenCalled();
        pressPointer(document.body);
        expect(onClose).toHaveBeenCalledWith(false);
    });

    test('closed, it no longer listens to the window', () => {
        render(0);
        act(() => {
            root.render(null);
        });
        pressPointer(document.body);
        pressKey('Escape', document.body);
        expect(onClose).not.toHaveBeenCalled();
    });
});
