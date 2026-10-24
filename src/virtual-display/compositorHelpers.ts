import type { VirtualDisplayCompositorConfig } from '../../electron/virtualDisplayProtocol';

// Pure decisions for the compositor page, kept apart so they are tested
// without a window.

// What changes between the screens on show and the ones asked for: a screen
// whose page address changed is removed and added again, never navigated.
export function diffCompositorScreens(
    current: ReadonlyMap<number, string>,
    screens: VirtualDisplayCompositorConfig['screens'],
) {
    const wanted = new Map(
        screens.map((screen) => [screen.screenId, screen.src] as const),
    );
    const removed: number[] = [];
    for (const [screenId, src] of current) {
        if (wanted.get(screenId) !== src) {
            removed.push(screenId);
        }
    }
    const added = screens
        .filter((screen) => {
            return current.get(screen.screenId) !== screen.src;
        })
        .map((screen) => screen.screenId);
    // Later in the list is drawn on top.
    const order = screens.map((screen) => screen.screenId);
    return { removed, added, order };
}

export function toWallpaperKey(
    wallpaper: VirtualDisplayCompositorConfig['wallpaper'],
) {
    return JSON.stringify(wallpaper);
}
