import { genForegroundDefaultColors } from './foregroundContrastHelpers';

/**
 * Whether the window is drawn in the dark theme now: read off the page
 * root's `data-bs-theme` (`others/main.tsx` sets it from the theme setting,
 * and keeps it in step when the theme changes), so this needs none of the
 * theme's app-wide plumbing -- a module that only writes a look stays as
 * light as it was. No root (a screen page, a test): dark, the defaults as
 * they always were.
 */
export function checkIsAppDarkTheme() {
    const theme = globalThis.document
        ?.getElementById('app')
        ?.getAttribute('data-bs-theme');
    return theme !== 'light';
}

/**
 * A foreground session's words' and box's colours while none is set, on the
 * side the app's theme is on now (`genForegroundDefaultColors`). Read by the
 * Properties rows, the style sent to the screens, the Presets row, Create
 * Quick Text and the help window's assistant -- every place an unset colour
 * is read.
 */
export function getForegroundDefaultColors() {
    return genForegroundDefaultColors(checkIsAppDarkTheme());
}
