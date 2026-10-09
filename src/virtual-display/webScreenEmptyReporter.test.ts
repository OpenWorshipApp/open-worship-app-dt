// @vitest-environment jsdom

import { afterEach, expect, test, vi } from 'vitest';

const { managers } = vi.hoisted(() => ({
    managers: new Map<number, any>(),
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getScreenManagerByScreenId: (screenId: number) => {
        return managers.get(screenId) ?? null;
    },
}));

import { reportScreenEmptiness } from './webScreenEmptyReporter';

// One layer of a screen: shows something or not, and says when it changed.
function genLayer() {
    const listeners: (() => void)[] = [];
    return {
        isShowing: false,
        registerEventListener: (_names: string[], listener: () => void) => {
            listeners.push(listener);
            return [];
        },
        set(isShowing: boolean) {
            this.isShowing = isShowing;
            for (const listener of listeners) listener();
        },
    };
}

afterEach(() => {
    managers.clear();
    vi.restoreAllMocks();
});

test('a screen in a browser tells its viewer page whether it shows anything', async () => {
    // A frame's page: its parent is another window.
    const parent = { postMessage: vi.fn() };
    vi.spyOn(globalThis, 'parent', 'get').mockReturnValue(parent as any);
    const layers = Array.from({ length: 6 }, genLayer);
    const [background, slide, bible, foreground, draw, focus] = layers;
    reportScreenEmptiness(3);
    // Its manager comes with the page's first render.
    managers.set(3, {
        screenId: 3,
        screenBackgroundManager: background,
        screenVaryAppDocumentManager: slide,
        screenBibleManager: bible,
        screenForegroundManager: foreground,
        screenDrawManager: draw,
        screenFocusManager: focus,
    });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledTimes(1));
    const told = () => parent.postMessage.mock.calls.map((call) => call[0]);
    expect(parent.postMessage).toHaveBeenLastCalledWith(
        { type: 'owa-vd-screen-state', screenId: 3, isEmpty: true },
        globalThis.location.origin,
    );
    slide.set(true);
    // Said only when it changes.
    background.set(true);
    slide.set(false);
    background.set(false);
    focus.set(true);
    expect(told().map((message) => message.isEmpty)).toEqual([
        true,
        false,
        true,
        false,
    ]);
});

test('a page that is not in a frame tells no one', () => {
    const post = vi.spyOn(globalThis, 'postMessage');
    reportScreenEmptiness(3);
    expect(post).not.toHaveBeenCalled();
});
