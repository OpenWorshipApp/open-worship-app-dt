// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    screenManager: null as any,
    shortcuts: new Map<string, () => void>(),
    updateEventCalls: 0,
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: (eventMap: { key: string }) => eventMap.key,
    useKeyboardRegistering: (
        eventMappers: { key: string }[],
        listener: () => void,
    ) => {
        h.shortcuts.set(eventMappers[0].key, listener);
    },
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => h.screenManager,
    useScreenUpdateEvents: () => {
        h.updateEventCalls += 1;
    },
}));

import MiniScreenClearControlComp from './MiniScreenClearControlComp';

let container: HTMLDivElement;
let root: Root;

function createScreenManager(showing: {
    background?: boolean;
    slide?: boolean;
    longText?: boolean;
    foreground?: boolean;
    draw?: boolean;
    focus?: boolean;
}) {
    return {
        isShowingForeground: !!showing.foreground,
        clear: vi.fn(),
        clearForeground: vi.fn(),
        screenBackgroundManager: {
            isShowing: !!showing.background,
            clear: vi.fn(),
        },
        screenVaryAppDocumentManager: {
            isShowing: !!showing.slide,
            clear: vi.fn(),
        },
        screenLongTextManager: {
            isShowing: !!showing.longText,
            clear: vi.fn(),
        },
        screenDrawManager: { isShowing: !!showing.draw },
        screenFocusManager: { isShowing: !!showing.focus },
    };
}

async function renderComp(screenManager: any) {
    h.screenManager = screenManager;
    await act(async () => {
        root.render(<MiniScreenClearControlComp />);
    });
}

function getButton(label: string) {
    return container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.shortcuts.clear();
    h.updateEventCalls = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('MiniScreenClearControlComp', () => {
    test('draws the five clear buttons with their shortcut keys', async () => {
        await renderComp(createScreenManager({}));
        const buttons = [...container.querySelectorAll('button')];
        expect(
            buttons.map((button) => {
                return [button.getAttribute('aria-label'), button.title];
            }),
        ).toEqual([
            ['Clear All', 'Clear All [F6]'],
            ['Clear Background', 'Clear Background [F7]'],
            ['Clear Slide', 'Clear Slide [F8]'],
            ['Clear Long Text', 'Clear Long Text [F9]'],
            ['Clear Foreground', 'Clear Foreground [F10]'],
        ]);
        expect(
            buttons.slice(1).map((button) => {
                return button.textContent;
            }),
        ).toEqual(['BG', 'SL', 'LT', 'FG']);
        expect(h.updateEventCalls).toBeGreaterThan(0);
    });

    test('with nothing on the screen every button is idle', async () => {
        const screenManager = createScreenManager({});
        await renderComp(screenManager);
        for (const button of container.querySelectorAll('button')) {
            expect(button.className).toContain('btn-outline-');
        }
        await act(async () => {
            getButton('Clear All').click();
            getButton('Clear Background').click();
        });
        for (const key of ['F6', 'F7', 'F8', 'F9', 'F10']) {
            h.shortcuts.get(key)!();
        }
        expect(screenManager.clear).not.toHaveBeenCalled();
        expect(
            screenManager.screenBackgroundManager.clear,
        ).not.toHaveBeenCalled();
        expect(screenManager.clearForeground).not.toHaveBeenCalled();
    });

    test('each layer on screen arms its own button and Clear All', async () => {
        const screenManager = createScreenManager({
            background: true,
            slide: true,
            longText: true,
            foreground: true,
        });
        await renderComp(screenManager);
        expect(getButton('Clear All').className).toBe('btn btn-danger');
        expect(getButton('Clear Background').className).toBe(
            'btn btn-secondary',
        );
        expect(getButton('Clear Slide').className).toBe('btn btn-info');
        expect(getButton('Clear Long Text').className).toBe('btn btn-primary');

        await act(async () => {
            getButton('Clear Background').click();
            getButton('Clear Slide').click();
            getButton('Clear Long Text').click();
            getButton('Clear Foreground').click();
            getButton('Clear All').click();
        });
        expect(
            screenManager.screenBackgroundManager.clear,
        ).toHaveBeenCalledTimes(1);
        expect(
            screenManager.screenVaryAppDocumentManager.clear,
        ).toHaveBeenCalledTimes(1);
        expect(screenManager.screenLongTextManager.clear).toHaveBeenCalledTimes(
            1,
        );
        expect(screenManager.clearForeground).toHaveBeenCalledTimes(1);
        expect(screenManager.clear).toHaveBeenCalledTimes(1);
    });

    test('the shortcut keys clear exactly what their button clears', async () => {
        const screenManager = createScreenManager({
            slide: true,
            foreground: true,
        });
        await renderComp(screenManager);
        h.shortcuts.get('F8')!();
        h.shortcuts.get('F10')!();
        // Background is not up: its key does nothing.
        h.shortcuts.get('F7')!();
        expect(
            screenManager.screenVaryAppDocumentManager.clear,
        ).toHaveBeenCalledTimes(1);
        expect(screenManager.clearForeground).toHaveBeenCalledTimes(1);
        expect(
            screenManager.screenBackgroundManager.clear,
        ).not.toHaveBeenCalled();
    });

    test('a drawing or a spotlight alone still arms Clear All', async () => {
        for (const showing of [{ draw: true }, { focus: true }]) {
            const screenManager = createScreenManager(showing);
            await renderComp(screenManager);
            expect(getButton('Clear All').className).toBe('btn btn-danger');
            expect(getButton('Clear Background').className).toContain(
                'outline',
            );
            h.shortcuts.get('F6')!();
            expect(screenManager.clear).toHaveBeenCalledTimes(1);
        }
    });
});
