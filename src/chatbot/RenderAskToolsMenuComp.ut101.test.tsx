// @vitest-environment jsdom
/**
 * The ask row's ⋮ menu (`RenderAskToolsMenuComp.tsx`): opened by the dots,
 * walked with the arrow keys, shut by Escape, Tab, a right press beside it
 * or a row's own job -- each row doing its job once.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

import RenderAskToolsMenuComp from './RenderAskToolsMenuComp';

type PressMapType = {
    onAttachingFile: Mock<() => void>;
    onSnapping: Mock<() => void>;
    onPicking: Mock<() => void>;
    onAttachingForeground: Mock<() => void>;
    onStartingCommand: Mock<() => void>;
};

let root: Root;
let container: HTMLDivElement;
let pressMap: PressMapType;

function dots() {
    return container.querySelector<HTMLButtonElement>('.chat-ask-tools')!;
}

function menu() {
    return container.querySelector<HTMLElement>('[role="menu"]');
}

function rows() {
    return [
        ...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ];
}

function rowLabels() {
    return rows().map((row) => row.getAttribute('aria-label'));
}

async function open() {
    await act(async () => dots().click());
    expect(menu()).not.toBeNull();
}

async function pressKey(key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        (document.activeElement ?? menu()!).dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    pressMap = {
        onAttachingFile: vi.fn<() => void>(),
        onSnapping: vi.fn<() => void>(),
        onPicking: vi.fn<() => void>(),
        onAttachingForeground: vi.fn<() => void>(),
        onStartingCommand: vi.fn<() => void>(),
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(createElement(RenderAskToolsMenuComp, pressMap));
    });
}

describe('the ask row tools menu', () => {
    test('nothing is drawn at rest; the dots open it with the first row focused', async () => {
        await render();
        expect(menu()).toBeNull();
        expect(dots().getAttribute('aria-expanded')).toBe('false');
        await open();
        expect(dots().getAttribute('aria-expanded')).toBe('true');
        expect(dots().className).toContain('is-open');
        expect(rowLabels()).toEqual([
            'Attach a file',
            'Attach a picture of the app',
            'Point at a control in the app',
            'Attach a foreground session',
            'List every command',
        ]);
        expect(document.activeElement).toBe(rows()[0]);
        // Opened upward from the dots, never off the window's edge.
        expect(menu()!.style.left).toBe('4px');
        expect(Number.parseFloat(menu()!.style.bottom)).toBeGreaterThanOrEqual(
            4,
        );
        // The dots again shut it.
        await act(async () => dots().click());
        expect(menu()).toBeNull();
    });

    test('the arrow keys walk the rows round, and other keys do nothing', async () => {
        await render();
        await open();
        const down = await pressKey('ArrowDown');
        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(rows()[1]);
        await pressKey('ArrowUp');
        await pressKey('ArrowUp');
        // Up from the first is the last.
        expect(document.activeElement).toBe(rows()[4]);
        await pressKey('ArrowDown');
        expect(document.activeElement).toBe(rows()[0]);
        const letter = await pressKey('a');
        expect(letter.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(rows()[0]);
        expect(menu()).not.toBeNull();
    });

    test('Escape shuts it and gives the focus back to the dots', async () => {
        await render();
        await open();
        const escape = await pressKey('Escape');
        expect(escape.defaultPrevented).toBe(true);
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(dots());
    });

    test('Tab shuts it and leaves the focus to go on its way', async () => {
        await render();
        await open();
        const tab = await pressKey('Tab');
        // The browser's own Tab is not taken over.
        expect(tab.defaultPrevented).toBe(false);
        expect(menu()).toBeNull();
        expect(document.activeElement).not.toBe(dots());
    });

    test('a right press beside the menu shuts it, with no menu of its own', async () => {
        await render();
        await open();
        const sheet = container.querySelector('.chat-menu-sheet')!;
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            sheet.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(menu()).toBeNull();
        for (const press of Object.values(pressMap)) {
            expect(press).not.toHaveBeenCalled();
        }
    });

    test('each row does its own job once and shuts the menu', async () => {
        await render();
        // In the order the rows stand.
        const jobs: (keyof PressMapType)[] = [
            'onAttachingFile',
            'onSnapping',
            'onPicking',
            'onAttachingForeground',
            'onStartingCommand',
        ];
        for (const [index, job] of jobs.entries()) {
            await open();
            await act(async () => rows()[index].click());
            expect(menu()).toBeNull();
            expect(pressMap[job]).toHaveBeenCalledTimes(1);
            // The rows below it have not been pressed yet.
            for (const later of jobs.slice(index + 1)) {
                expect(pressMap[later]).not.toHaveBeenCalled();
            }
        }
    });
});
