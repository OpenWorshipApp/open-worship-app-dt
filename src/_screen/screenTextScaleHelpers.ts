/**
 * A screen's own scale of the Bible / Long Text size.
 *
 * The look set in Bible/LongText Properties is one for every screen, and its
 * size is in pixels -- the same 65px on a small projector as on a wall-sized
 * one (2026-11-19, the user: _all sizing can't be applied to all screens, some
 * screens are smaller or bigger_). Each screen multiplies that size by its own
 * factor; everything else in the look is in `em` of it and follows.
 *
 * No imports: the screen reads it on every redraw, the panel on every row.
 */

export const MIN_SCREEN_TEXT_SCALE = 0.1;
export const MAX_SCREEN_TEXT_SCALE = 10;
export const DEFAULT_SCREEN_TEXT_SCALE = 1;

function roundTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
}

/**
 * A scale as it may be drawn: a number (or the setting's string of one),
 * clamped to 0.1..10, two decimals. Anything else is the default, 1.
 */
export function readScreenTextScale(value: unknown) {
    let scale = value;
    if (typeof scale === 'string' && scale.trim() !== '') {
        scale = Number(scale);
    }
    if (typeof scale !== 'number' || !Number.isFinite(scale)) {
        return DEFAULT_SCREEN_TEXT_SCALE;
    }
    return roundTwoDecimals(
        Math.min(MAX_SCREEN_TEXT_SCALE, Math.max(MIN_SCREEN_TEXT_SCALE, scale)),
    );
}

/**
 * The rule that sizes this screen's rows, written after the shared look's
 * own `#bible-screen-view tr` rule so it wins at the same specificity. Empty
 * at 1: an unscaled screen draws exactly what it drew before.
 */
export function genScreenTextScaleCss(fontSize: number, scale: number) {
    if (scale === DEFAULT_SCREEN_TEXT_SCALE) {
        return '';
    }
    const scaledFontSize = roundTwoDecimals(fontSize * scale);
    return `#bible-screen-view tr { font-size: ${scaledFontSize}px; }`;
}
