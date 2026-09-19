import colorList from '../../others/color-list.json';

/**
 * Each screen's identity colour — the one its mini-screen id badge wears, and
 * with it every other place a screen id is shown, so an operator recognizes
 * "screen 2" by colour without reading the number.
 *
 * Deliberately its OWN module rather than living beside the component that
 * first drew it: `ScreenEventHandler` reaches this through
 * `screenChoosingHelpers`, so anything imported here lands in every screen
 * manager. That rules out `helpers.ts` (it pulls `tran`, and with it the whole
 * settings/file graph) — hence a plain `Object.freeze` rather than the shared
 * `freezeObject`, and no other import than the palette itself.
 */
const allColors = Object.freeze(
    Object.values(colorList.main).concat(Object.values(colorList.extension)),
);

const screenIdColorMap: Record<string, string> = {};

export function genColorFromScreenId(screenId: number) {
    if (screenIdColorMap[screenId]) {
        return screenIdColorMap[screenId];
    }
    const colorIndex = screenId % allColors.length;
    const color = allColors[colorIndex];
    screenIdColorMap[screenId] = color;
    return color;
}
