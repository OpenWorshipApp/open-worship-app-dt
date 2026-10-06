// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    page: '/presenter.html',
    focused: true,
    isMain: true,
    settings: new Map<string, string>(),
    listeners: new Set<(event: unknown, data: unknown) => void>(),
    menu: vi.fn(),
    systemUtils: {
        isWindows: true,
        isMac: false,
        isLinux: false,
        isDev: false,
    },
}));
vi.mock('../helper/appHooks', async (importOriginal) => {
    const original = await importOriginal<object>();
    return { ...original, useAppEffect: useEffect };
});
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../helper/ai/aiHelpers', () => ({ getIsAIEnabled: () => true }));
vi.mock('../server/appProvider', () => ({
    default: {
        get currentHomePage() {
            return state.page;
        },
        getIsWindowFocused: () => state.focused,
        systemUtils: state.systemUtils,
    },
}));
vi.mock('../server/mainWindowHelpers', () => ({
    checkIsMainWindow: () => state.isMain,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key),
    setSetting: (key: string, value: string) => state.settings.set(key, value),
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    setAppMenuItems: state.menu,
    registerAppMenuClicked: (
        handler: (event: unknown, data: unknown) => void,
    ) => {
        state.listeners.add(handler);
        return () => state.listeners.delete(handler);
    },
}));

import KeyboardShortcutsComp from './KeyboardShortcutsComp';
import WindowEventListener from '../event/WindowEventListener';

let root: Root;
let container: HTMLDivElement;

async function sendMenu(data: object) {
    await act(async () => {
        for (const listener of state.listeners) listener({}, data);
    });
    // The panel is a lazy chunk: let it resolve and render.
    await act(async () => {
        await import('./KeyboardShortcutsPanelComp');
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function getPanel() {
    return document.querySelector<HTMLElement>(
        '[data-widget-name="Keyboard Shortcuts"]',
    );
}

function getSearchBox() {
    return document.querySelector<HTMLInputElement>(
        'input[aria-label="Search shortcuts"]',
    )!;
}

async function typeSearch(text: string) {
    const input = getSearchBox();
    await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        setValue.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressEscape() {
    const input = getSearchBox();
    const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        input.dispatchEvent(event);
    });
    return event;
}

async function fireBibleLookup(state: 'open' | 'close') {
    await act(async () => {
        WindowEventListener.fireEvent({ widget: 'bible-lookup', state });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function listRowLabels() {
    return Array.from(
        document.querySelectorAll('.app-keyboard-shortcut-row'),
    ).map((row) => row.getAttribute('aria-label'));
}

describe('Help -> Keyboard Shortcuts', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        state.settings.clear();
        state.listeners.clear();
        state.page = '/presenter.html';
        state.focused = true;
        state.isMain = true;
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    it('the main window adds the Help item and takes it back', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        expect(state.menu).toHaveBeenCalledWith(
            'keyboard-shortcuts',
            {
                help: [
                    {
                        label: 'Keyboard Shortcuts',
                        clickData: { isOpenKeyboardShortcuts: true },
                    },
                ],
            },
            { isRoutedToFocusedWindow: true },
        );
        expect(getPanel()).toBeNull();
        await act(async () => root.unmount());
        expect(state.menu).toHaveBeenLastCalledWith('keyboard-shortcuts', null);
        expect(state.listeners.size).toBe(0);
        root = createRoot(container);
    });

    it('a popup listens without owning the menu', async () => {
        state.isMain = false;
        state.page = '/setting.html';
        await act(async () => root.render(<KeyboardShortcutsComp />));
        expect(state.menu).not.toHaveBeenCalled();
        expect(state.listeners.size).toBe(1);
        await sendMenu({ isOpenKeyboardShortcuts: true });
        expect(getPanel()?.textContent).toContain(
            'Keyboard Shortcuts · Setting',
        );
    });

    it('opens only in the window in front, and only for its own click', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        state.focused = false;
        await sendMenu({ isOpenKeyboardShortcuts: true });
        expect(getPanel()).toBeNull();
        state.focused = true;
        await sendMenu({ isBrowseDailyTips: true });
        expect(getPanel()).toBeNull();
        await sendMenu({ isOpenKeyboardShortcuts: true });
        expect(getPanel()?.textContent).toContain(
            'Keyboard Shortcuts · Presenter',
        );
        expect(listRowLabels()).toContain('Show or hide the screen');
    });

    it('searches by words and by keys, and counts what matched', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        await sendMenu({ isOpenKeyboardShortcuts: true });
        const total = listRowLabels().length;
        expect(getPanel()?.textContent).toContain(`${total}/${total}`);
        await typeSearch('f5');
        expect(listRowLabels()).toEqual(['Show or hide the screen']);
        expect(getPanel()?.textContent).toContain(`1/${total}`);
        await typeSearch('split');
        expect(listRowLabels()).toEqual(
            expect.arrayContaining(['Split horizontal', 'Split vertical']),
        );
        await typeSearch('nothing like this');
        expect(listRowLabels()).toEqual([]);
        expect(getPanel()?.textContent).toContain('No shortcuts found');
    });

    it('Escape empties the search first, then closes the panel', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        await sendMenu({ isOpenKeyboardShortcuts: true });
        await typeSearch('f5');
        const firstEscape = await pressEscape();
        // Taken from the app, so a lookup behind the panel keeps its words.
        expect(firstEscape.defaultPrevented).toBe(true);
        expect(getSearchBox().value).toBe('');
        expect(getPanel()).not.toBeNull();
        await pressEscape();
        expect(getPanel()).toBeNull();
    });

    it('over the Bible Lookup popup it lists the keys of the popup', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        await sendMenu({ isOpenKeyboardShortcuts: true });
        // Stacked above the modal it is describing.
        expect(getPanel()?.className).toContain('floating-widget--above-modal');
        await fireBibleLookup('open');
        expect(getPanel()?.textContent).toContain(
            'Keyboard Shortcuts · Bible Lookup',
        );
        expect(listRowLabels()).toContain('Close the Bible Lookup popup');
        expect(listRowLabels()).not.toContain('Show or hide the screen');
        await fireBibleLookup('close');
        expect(getPanel()?.textContent).toContain(
            'Keyboard Shortcuts · Presenter',
        );
        expect(listRowLabels()).toContain('Show or hide the screen');
    });

    it('keeps typing in its box, and lets function keys through', async () => {
        await act(async () => root.render(<KeyboardShortcutsComp />));
        await sendMenu({ isOpenKeyboardShortcuts: true });
        const reachedKeys: string[] = [];
        const handleDocumentKey = (event: KeyboardEvent) => {
            reachedKeys.push(event.key);
        };
        document.addEventListener('keydown', handleDocumentKey);
        for (const key of ['Enter', 'Tab', 'ArrowDown', 'a', 'F5']) {
            await act(async () => {
                getSearchBox().dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key,
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            });
        }
        await act(async () => {
            getSearchBox().dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 's',
                    ctrlKey: true,
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        document.removeEventListener('keydown', handleDocumentKey);
        expect(reachedKeys).toEqual(['F5', 's']);
    });

    it('the Reader lists its own lookup keys', async () => {
        state.page = '/reader.html';
        await act(async () => root.render(<KeyboardShortcutsComp />));
        await sendMenu({ isOpenKeyboardShortcuts: true });
        const labels = listRowLabels();
        expect(getPanel()?.textContent).toContain(
            'Keyboard Shortcuts · Bible Reader',
        );
        expect(labels).toContain('Clear the reference');
        expect(labels).not.toContain('Show or hide the screen');
        expect(labels).not.toContain('Close the Bible Lookup popup');
    });
});
