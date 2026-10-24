// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

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
