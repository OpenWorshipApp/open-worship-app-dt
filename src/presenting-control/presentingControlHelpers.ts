import {
    clampNumber,
    toAlphaHex,
} from '../_screen/managers/screenOverlayHelpers';
import { getSetting } from '../helper/settingHelpers';
import type { PaintToolType } from '../_screen/managers/ScreenDrawManager';

// App-wide annotation ("Presenting Control"): the same Draw and Focus tools the
// previewer offers for a SCREEN, but pointed at the presenter window itself, so
// the app can be presented (shared/mirrored) with drawing and a spotlight over
// its own UI.
//
// Deliberately NOT built on ScreenDrawManager/ScreenFocusManager. Everything
// those two exist to do — per-screen instances, sync groups, the screen-message
// IPC to the output window, persisting a drawing so it survives a reload with
// the projector still live — is meaningless here: this overlay is one window's
// own annotation layer, it never leaves the window, and it is thrown away when
// the user stops controlling. What IS shared is the part that actually draws:
// `paintStroke` and `buildSpotlightBackground` in `screenOverlayHelpers`.
//
// Coordinates are WINDOW CSS px (the overlay is `position: fixed; inset: 0`),
// not native screen px: there is no second display to land on, so the overlay's
// own box is the coordinate space.

export const presentingToolList = [
    // Overlay is click-through: the app is fully usable and whatever has been
    // drawn stays visible on top. This is the mode the controller opens in.
    'interact',
    'paint',
    'eraser',
    'focus',
] as const;
export type PresentingToolType = (typeof presentingToolList)[number];

export function checkIsDrawingTool(tool: PresentingToolType) {
    return tool === 'paint' || tool === 'eraser';
}

// Every tool except `interact` covers the window and takes the pointer.
export function checkIsArmedTool(tool: PresentingToolType) {
    return tool !== 'interact';
}

const SETTING_PREFIX = 'presenting-control-';
export function toPresentingSettingKey(name: string) {
    return `${SETTING_PREFIX}${name}`;
}

export const WIDGET_RECT_SETTING_NAME = 'widget-rect';

export const DEFAULT_PAINT_COLOR = '#ff2d2d';
export const DEFAULT_PAINT_SIZE = 10;
export const DEFAULT_PAINT_ALPHA = 100;
export const DEFAULT_IS_STRAIGHT = false;
export const DEFAULT_IS_3D = false;
export const DEFAULT_IS_DOTS = false;
export const DEFAULT_IS_HIGH_QUALITY = true;
export const PAINT_SIZE_MIN = 1;
export const PAINT_SIZE_MAX = 60;
export const PAINT_ALPHA_MIN = 5;
export const PAINT_ALPHA_MAX = 100;

// Setting names for the brush, named once because BOTH the panel (which edits
// them through `useStateSetting*`) and the draw engine (which reads them on
// construction) have to agree on the keys. A literal spelled out at either end
// instead of one of these is a setting that silently stops round-tripping, so
// every read and write below goes through them.
export const PAINT_COLOR_SETTING_NAME = 'paint-color';
export const PAINT_ALPHA_SETTING_NAME = 'paint-alpha';
export const PAINT_SIZE_SETTING_NAME = 'paint-size';
export const PAINT_STRAIGHT_SETTING_NAME = 'paint-straight';
export const PAINT_3D_SETTING_NAME = 'paint-3d';
export const PAINT_DOTS_SETTING_NAME = 'paint-dots';
// Quality is the one brush setting the ENGINE owns rather than the panel (it is
// about the backing store, not about how a stroke looks), so the panel seeds its
// button from the engine and this key is only ever touched there. It is
// persisted because it is the setting that MATTERS on a weak machine: Fast
// quarters the backing store and skips curve smoothing, and having to turn it
// off again at the start of every service is exactly the wrong default.
export const PAINT_QUALITY_SETTING_NAME = 'paint-quality';

// Setting names for the spotlight. Same reason, one owner: the focus engine.
export const FOCUS_SIZE_SETTING_NAME = 'focus-size';
export const FOCUS_COLOR_SETTING_NAME = 'focus-color';
export const FOCUS_DIM_SETTING_NAME = 'focus-dim';
export const FOCUS_BLUR_SETTING_NAME = 'focus-blur';
export const FOCUS_CONTRAST_SETTING_NAME = 'focus-contrast';
export const FOCUS_HOLD_SETTING_NAME = 'focus-hold';

// What the brush LOOKS like. Deliberately without `isEraser`: paint-vs-erase is
// a tool choice (the toolbar's), not a brush setting.
export type PresentingPaintParamsType = Omit<PaintToolType, 'isEraser'>;

// The spotlight is aimed at app UI (a button, a list row), not at a slide, so it
// opens smaller and softer than the screen one's 300px/70%.
export const DEFAULT_FOCUS_SIZE = 260;
export const DEFAULT_FOCUS_COLOR = '#000000';
export const DEFAULT_FOCUS_DIM = 65;
export const DEFAULT_FOCUS_BLUR = 35;
export const DEFAULT_IS_CONTRAST = false;
// Follow (the default) keeps the spotlight on the pointer for as long as the
// tool is selected — the natural gesture when narrating an app on a projector.
// Hold matches the screen panel: dim only while the button is down.
export const DEFAULT_IS_HOLD_MODE = false;
export const FOCUS_SIZE_MIN = 40;
export const FOCUS_SIZE_MAX = 1200;
export const FOCUS_DIM_MIN = 10;
export const FOCUS_DIM_MAX = 100;
export const FOCUS_BLUR_MIN = 0;
export const FOCUS_BLUR_MAX = 100;

// Nudge amounts. The paint sliders are small ranges (1..60px, 5..100%) so they
// step by 1/5 like the screen draw panel; the spotlight size spans 40..1200 and
// needs a coarser step to be usable.
export const PAINT_STEP_SMALL = 1;
export const PAINT_STEP_BIG = 5;
export const FOCUS_SIZE_STEP_SMALL = 10;
export const FOCUS_SIZE_STEP_BIG = 50;
export const FOCUS_PERCENT_STEP_SMALL = 5;
export const FOCUS_PERCENT_STEP_BIG = 20;

// The colour goes straight into a canvas fillStyle / a gradient string, so
// anything that is not exactly `#rrggbb` falls back rather than producing an
// unparseable value (which would silently paint NOTHING).
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
export function toValidHexColor(color: unknown, fallback: string) {
    return typeof color === 'string' && HEX_COLOR_REGEX.test(color)
        ? color.toLowerCase()
        : fallback;
}

// One persisted integer, clamped into range, falling back to the shipped default
// for a missing or corrupt value. The engines read their settings directly —
// they are constructed before any panel mounts, and a panel can be gone again
// (collapsed) while its tool is still selected — so this is not the
// `useStateSettingNumber` path.
export function readPersistedNumber(
    name: string,
    fallback: number,
    min: number,
    max: number,
) {
    const parsed = Number.parseInt(
        getSetting(toPresentingSettingKey(name)) ?? '',
        10,
    );
    return Number.isFinite(parsed) ? clampNumber(parsed, min, max) : fallback;
}

export function readPersistedBoolean(name: string, fallback: boolean) {
    const raw = getSetting(toPresentingSettingKey(name));
    return raw === null || raw === '' ? fallback : raw === 'true';
}

export function readPersistedString(name: string) {
    return getSetting(toPresentingSettingKey(name));
}

// The whole brush, off disk. The draw ENGINE owns the live brush (not the panel)
// so that a tool stays usable while its settings panel is not mounted — the
// panel is only there when the widget is expanded, and collapsing it must not
// silently disarm the brush the user is drawing with.
export function readPersistedPaintParams(): PresentingPaintParamsType {
    const baseColor = toValidHexColor(
        readPersistedString(PAINT_COLOR_SETTING_NAME),
        DEFAULT_PAINT_COLOR,
    );
    const alpha = readPersistedNumber(
        PAINT_ALPHA_SETTING_NAME,
        DEFAULT_PAINT_ALPHA,
        PAINT_ALPHA_MIN,
        PAINT_ALPHA_MAX,
    );
    return {
        // Canvas takes the transparency in the colour itself, as `#rrggbbaa`.
        color: `${baseColor}${toAlphaHex(alpha)}`,
        size: readPersistedNumber(
            PAINT_SIZE_SETTING_NAME,
            DEFAULT_PAINT_SIZE,
            PAINT_SIZE_MIN,
            PAINT_SIZE_MAX,
        ),
        isStraight: readPersistedBoolean(
            PAINT_STRAIGHT_SETTING_NAME,
            DEFAULT_IS_STRAIGHT,
        ),
        is3D: readPersistedBoolean(PAINT_3D_SETTING_NAME, DEFAULT_IS_3D),
        isDots: readPersistedBoolean(PAINT_DOTS_SETTING_NAME, DEFAULT_IS_DOTS),
    };
}

// Everything the spotlight engine remembers between sessions. Grouped as one
// object so the defaults, the load and the write are three views of the SAME
// list rather than three lists that have to be kept in step by hand.
export type PresentingFocusParamsType = {
    size: number;
    dimColor: string;
    dimOpacity: number;
    edgeBlur: number;
    isContrast: boolean;
    isHoldMode: boolean;
};

export const DEFAULT_FOCUS_PARAMS: PresentingFocusParamsType = {
    size: DEFAULT_FOCUS_SIZE,
    dimColor: DEFAULT_FOCUS_COLOR,
    dimOpacity: DEFAULT_FOCUS_DIM,
    edgeBlur: DEFAULT_FOCUS_BLUR,
    isContrast: DEFAULT_IS_CONTRAST,
    isHoldMode: DEFAULT_IS_HOLD_MODE,
};

export function readPersistedFocusParams(): PresentingFocusParamsType {
    return {
        size: readPersistedNumber(
            FOCUS_SIZE_SETTING_NAME,
            DEFAULT_FOCUS_SIZE,
            FOCUS_SIZE_MIN,
            FOCUS_SIZE_MAX,
        ),
        dimColor: toValidHexColor(
            readPersistedString(FOCUS_COLOR_SETTING_NAME),
            DEFAULT_FOCUS_COLOR,
        ),
        dimOpacity: readPersistedNumber(
            FOCUS_DIM_SETTING_NAME,
            DEFAULT_FOCUS_DIM,
            FOCUS_DIM_MIN,
            FOCUS_DIM_MAX,
        ),
        edgeBlur: readPersistedNumber(
            FOCUS_BLUR_SETTING_NAME,
            DEFAULT_FOCUS_BLUR,
            FOCUS_BLUR_MIN,
            FOCUS_BLUR_MAX,
        ),
        isContrast: readPersistedBoolean(
            FOCUS_CONTRAST_SETTING_NAME,
            DEFAULT_IS_CONTRAST,
        ),
        isHoldMode: readPersistedBoolean(
            FOCUS_HOLD_SETTING_NAME,
            DEFAULT_IS_HOLD_MODE,
        ),
    };
}
