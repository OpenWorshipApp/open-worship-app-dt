// Setting keys that are namespaced by screen id but are owned by the previewer
// UI rather than by a manager (the managers delete the keys they own from their
// own `delete()`).
//
// They live here, in a module with no imports, for two reasons: the delete path
// (`screenManagerDeleteHelpers`) must be able to drop every per-screen key
// without importing React components, and a screen id is REUSED — deleting
// screen 1 and adding a screen hands the new screen id 1 — so a key left behind
// is silently inherited by a different screen rather than merely wasting space.

export const DRAW_MODE_SETTING_PREFIX = 'screen-draw-mode-';
export const DRAW_PAINT_COLOR_SETTING_PREFIX = 'draw-paint-color-';
export const DRAW_PAINT_ALPHA_SETTING_PREFIX = 'draw-paint-alpha-';
export const DRAW_PAINT_SIZE_SETTING_PREFIX = 'draw-paint-size-';
export const DRAW_PAINT_STRAIGHT_SETTING_PREFIX = 'draw-paint-straight-';
export const DRAW_PAINT_3D_SETTING_PREFIX = 'draw-paint-3d-';
export const DRAW_PAINT_DOTS_SETTING_PREFIX = 'draw-paint-dots-';

// Every prefix above. Add new per-screen previewer settings to BOTH the export
// above and this list, or deleting a screen will leave them behind.
export const drawPanelSettingPrefixList = [
    DRAW_MODE_SETTING_PREFIX,
    DRAW_PAINT_COLOR_SETTING_PREFIX,
    DRAW_PAINT_ALPHA_SETTING_PREFIX,
    DRAW_PAINT_SIZE_SETTING_PREFIX,
    DRAW_PAINT_STRAIGHT_SETTING_PREFIX,
    DRAW_PAINT_3D_SETTING_PREFIX,
    DRAW_PAINT_DOTS_SETTING_PREFIX,
];
