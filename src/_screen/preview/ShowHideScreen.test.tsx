// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';

const mocks = vi.hoisted(() => ({
    getAllScreenManagers: vi.fn(),
    useKeyboardRegistering: vi.fn(),
}));

vi.mock('../managers/screenManagerHelpers', () => ({
    getAllScreenManagers: mocks.getAllScreenManagers,
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'F5',
    useKeyboardRegistering: mocks.useKeyboardRegistering,
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerBaseContext: vi.fn(),
    useScreenManagerEvents: vi.fn(),
}));
vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

function genScreen(screenId: number, isShowing: boolean, isSelected = false) {
    const screen = {
        screenId,
        isSelected,
        toggled: 0,
        _isShowing: isShowing,
        get isShowing() {
            return this._isShowing;
        },
        set isShowing(value: boolean) {
            this.toggled++;
            this._isShowing = value;
        },
    };
    return screen;
}

describe('toggleScreensShowing (F5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('acts on the selected screen only, leaving the others alone', async () => {
        const { toggleScreensShowing } = await import('./ShowHideScreen');
        const screen0 = genScreen(0, false);
        const screen1 = genScreen(1, false, true);
        mocks.getAllScreenManagers.mockReturnValue([screen0, screen1]);

        toggleScreensShowing();

        expect(screen1.isShowing).toBe(true);
        expect(screen0.toggled).toBe(0);
        expect(screen0.isShowing).toBe(false);
    });

    test('with one screen up, hides it rather than putting the other up', async () => {
        const { toggleScreensShowing } = await import('./ShowHideScreen');
        // Nothing selected: F5 is for every screen. One up, one down -- the
        // old per-card handlers hid the first and SHOWED the second.
        const screen0 = genScreen(0, true);
        const screen1 = genScreen(1, false);
        mocks.getAllScreenManagers.mockReturnValue([screen0, screen1]);

        toggleScreensShowing();
        expect([screen0.isShowing, screen1.isShowing]).toEqual([false, false]);
        expect(screen1.toggled).toBe(0);

        // All down: the next press puts them all up.
        toggleScreensShowing();
        expect([screen0.isShowing, screen1.isShowing]).toEqual([true, true]);
    });

    test('the key is registered once, by the panel hook', async () => {
        const { useToggleScreensShowingKey, toggleScreensShowing } =
            await import('./ShowHideScreen');
        useToggleScreensShowingKey();
        expect(mocks.useKeyboardRegistering).toHaveBeenCalledWith(
            [{ key: 'F5' }],
            toggleScreensShowing,
            [],
        );
    });
});

describe('ShowHideScreenComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function renderToggle(screen: ReturnType<typeof genScreen>) {
        vi.mocked(useScreenManagerBaseContext).mockReturnValue(screen as any);
        const { default: ShowHideScreenComp } =
            await import('./ShowHideScreen');
        await act(async () => {
            root.render(<ShowHideScreenComp />);
        });
        return container.querySelector<HTMLElement>('[role="button"]')!;
    }

    function pressKey(element: HTMLElement, key: string, repeat = false) {
        const event = new KeyboardEvent('keydown', {
            key,
            repeat,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(event);
        return event;
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

    test('says whether the screen is up, with its key in the name', async () => {
        const hidden = genScreen(0, false);
        let toggle = await renderToggle(hidden);
        expect(toggle.getAttribute('aria-label')).toBe(
            'Toggle showing screen [F5]',
        );
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.style.opacity).toBe('0.4');
        expect(toggle.querySelector('.bi-file-slides')).not.toBe(null);
        expect(vi.mocked(useScreenManagerEvents)).toHaveBeenCalledWith(
            ['visible'],
            hidden,
        );

        toggle = await renderToggle(genScreen(1, true));
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.className).toContain('showing');
        expect(toggle.style.opacity).toBe('1');
        expect(toggle.querySelector('.bi-file-slides-fill')).not.toBe(null);
    });

    test('two quick clicks toggle twice off the live state', async () => {
        const screen = genScreen(0, false);
        const toggle = await renderToggle(screen);
        // No re-render between them: each reads the manager, not a snapshot.
        toggle.click();
        expect(screen.isShowing).toBe(true);
        toggle.click();
        expect(screen.isShowing).toBe(false);
        expect(screen.toggled).toBe(2);
    });

    test('Enter and Space press it; a held key and other keys do not', async () => {
        const screen = genScreen(0, false);
        const toggle = await renderToggle(screen);

        const enter = pressKey(toggle, 'Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(screen.isShowing).toBe(true);

        pressKey(toggle, ' ');
        expect(screen.isShowing).toBe(false);

        const held = pressKey(toggle, 'Enter', true);
        expect(held.defaultPrevented).toBe(false);
        const other = pressKey(toggle, 'a');
        expect(other.defaultPrevented).toBe(false);
        expect(screen.toggled).toBe(2);
    });
});
