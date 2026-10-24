import { beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        provider: { isPagePresenter: true } as { isPagePresenter: boolean },
    };
});

vi.mock('../../server/appProvider', () => ({ default: h.provider }));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
}));

const VIRTUAL = '-500001';
const MONITOR = '2366525307';

async function load() {
    vi.resetModules();
    return await import('./virtualScreenShowingHelpers');
}

beforeEach(() => {
    h.settings.clear();
    h.provider.isPagePresenter = true;
    h.settings.set('screen-display--pid-0', VIRTUAL);
    h.settings.set('screen-display--pid-1', VIRTUAL);
    h.settings.set('screen-display--pid-2', MONITOR);
});

function genScreen(screenId: number, isShowing: boolean, displayId: number) {
    return { screenId, isShowing, displayId, show: vi.fn() };
}

// A screen on a virtual display came back hidden after every restart, its
// viewers left on the wallpaper until somebody pressed show again.
test('the screens up on a virtual display are put up again at the next start', async () => {
    const helpers = await load();
    h.settings.set(helpers.VIRTUAL_SCREENS_SHOWING_SETTING_NAME, '[0,1,2]');
    const screen0 = genScreen(0, false, -500001);
    // Up already: a reload of the window keeps it, nothing to do.
    const screen1 = genScreen(1, true, -500001);
    // Its virtual display is gone: it falls back to a monitor, and a window
    // appearing over a projector by itself is not a thing to do to a room.
    const screen2 = genScreen(2, false, 2366525307);

    expect(
        helpers.restoreVirtualScreensShowing([screen0, screen1, screen2]),
    ).toEqual([0]);
    expect(screen0.show).toHaveBeenCalledTimes(1);
    expect(screen1.show).not.toHaveBeenCalled();
    expect(screen2.show).not.toHaveBeenCalled();

    // Once per start.
    expect(helpers.restoreVirtualScreensShowing([screen0])).toEqual([]);
    expect(screen0.show).toHaveBeenCalledTimes(1);
});

test('what is kept is the showing screens set to a virtual display, from the start on', async () => {
    const helpers = await load();
    const key = helpers.VIRTUAL_SCREENS_SHOWING_SETTING_NAME;
    h.settings.set(key, '[1]');
    // A screen hiding as the app comes up does not wipe the list first.
    helpers.rememberVirtualScreensShowing([{ screenId: 1, isShowing: false }]);
    expect(h.settings.get(key)).toBe('[1]');

    helpers.restoreVirtualScreensShowing([]);
    helpers.rememberVirtualScreensShowing([
        { screenId: 2, isShowing: true },
        { screenId: 1, isShowing: true },
        { screenId: 0, isShowing: false },
    ]);
    expect(h.settings.get(key)).toBe('[1]');

    // Hidden on purpose: not put up again.
    helpers.rememberVirtualScreensShowing([{ screenId: 1, isShowing: false }]);
    expect(h.settings.get(key)).toBe('[]');
});

test('only the presenter keeps or restores it; hiding every screen forgets it', async () => {
    const helpers = await load();
    const key = helpers.VIRTUAL_SCREENS_SHOWING_SETTING_NAME;
    h.provider.isPagePresenter = false;
    h.settings.set(key, '[0]');
    const screen0 = genScreen(0, false, -500001);
    expect(helpers.restoreVirtualScreensShowing([screen0])).toEqual([]);
    expect(screen0.show).not.toHaveBeenCalled();
    helpers.rememberVirtualScreensShowing([{ screenId: 0, isShowing: false }]);
    expect(h.settings.get(key)).toBe('[0]');

    helpers.forgetVirtualScreensShowing();
    expect(helpers.readVirtualScreensShowing()).toEqual([]);

    h.settings.set(key, 'not json');
    expect(helpers.readVirtualScreensShowing()).toEqual([]);
});
