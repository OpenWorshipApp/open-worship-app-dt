import type { CSSProperties } from 'react';

import type { AppColorType } from '../../others/color/colorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

/**
 * The shadow one canvas box casts.
 *
 * TWO kinds, because a slide holds two different things and no single CSS
 * property dresses both. `box` is `box-shadow`: the shadow of the box's own
 * RECTANGLE, rounded corners included -- what a text box with a backing colour
 * wants. `drop` is `filter: drop-shadow()`: the shadow of what is actually
 * PAINTED, so it follows the letterforms of a box with no backing, the cut-out
 * of a logo PNG and the transparent edge of any image. Giving a transparent
 * logo a box shadow draws a rectangle in mid-air behind it, and that mistake is
 * the reason this is a picker rather than one checkbox.
 *
 * A leaf module -- it imports TYPES only -- so the screen renderer, the print
 * markup, the editor box and the properties panel all read one set of rules
 * without any of them pulling in the others.
 *
 * ABSENT means no shadow: there is no `none` kind on disk, for the same reason
 * `blendMode` is never written as `normal` (`cleanupBlendMode` in
 * `CanvasItem.ts`). Every slide document written before this existed has to
 * read and re-save byte for byte the same, and a box nobody dressed must cost
 * no declaration at all.
 */

export const CANVAS_SHADOW_KIND_LIST = ['box', 'drop'] as const;
export type CanvasShadowKindType = (typeof CANVAS_SHADOW_KIND_LIST)[number];

export type CanvasItemShadowType = {
    kind: CanvasShadowKindType;
    /** Pixels in the slide's own coordinates, so it scales with the slide. */
    offsetX: number;
    offsetY: number;
    blur: number;
    color: AppColorType;
};

/**
 * Bounds, not taste. A shadow is painted by blurring a copy of the whole box,
 * so the blur radius is the one number here that costs a low-spec machine
 * anything -- and 200px is already a fifth of the height of a 1080p slide.
 * Past that it is fog rather than a shadow, at a raster cost that grows with
 * the box.
 */
export const CANVAS_SHADOW_OFFSET_LIMIT = 200;
export const CANVAS_SHADOW_BLUR_LIMIT = 200;

/**
 * What a shadow IS the moment one is picked: straight down, soft, and dark
 * enough to read against a bright photo without becoming a smudge. A picker
 * whose first pick changes nothing visible reads as a broken picker.
 */
export const DEFAULT_CANVAS_SHADOW: CanvasItemShadowType = {
    kind: 'box',
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    color: '#000000A6',
};

const SHADOW_KIND_SET = new Set<string>(CANVAS_SHADOW_KIND_LIST);
// The same shape the foreground's own decoration accepts: `#rgb` through
// `#rrggbbaa`.
const SHADOW_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function toValidShadowNumber(value: unknown, max: number, min: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    // Whole pixels: a slide is laid out in them, and a fraction only makes the
    // document longer.
    return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * A shadow as it may be used, or `null` for "this box casts none".
 *
 * Every field is repaired rather than trusted, because these reach the screen
 * as ONE CSS declaration and a single unparseable token voids the whole thing
 * -- a hand-edited document would silently unstyle the box it belongs to. Only
 * an unknown `kind` means no shadow: past that, a missing colour or a wild
 * offset is a value to clamp, not a reason to drop what the operator asked
 * for.
 */
export function toValidCanvasShadow(
    value: unknown,
): CanvasItemShadowType | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const shadow = value as Partial<CanvasItemShadowType>;
    if (typeof shadow.kind !== 'string' || !SHADOW_KIND_SET.has(shadow.kind)) {
        return null;
    }
    const { color } = shadow;
    return {
        kind: shadow.kind as CanvasShadowKindType,
        offsetX: toValidShadowNumber(
            shadow.offsetX,
            CANVAS_SHADOW_OFFSET_LIMIT,
            -CANVAS_SHADOW_OFFSET_LIMIT,
        ),
        offsetY: toValidShadowNumber(
            shadow.offsetY,
            CANVAS_SHADOW_OFFSET_LIMIT,
            -CANVAS_SHADOW_OFFSET_LIMIT,
        ),
        blur: toValidShadowNumber(shadow.blur, CANVAS_SHADOW_BLUR_LIMIT, 0),
        color:
            typeof color === 'string' && SHADOW_COLOR_PATTERN.test(color)
                ? (color as AppColorType)
                : DEFAULT_CANVAS_SHADOW.color,
    };
}

/**
 * Keeps `shadow` a two-state field on disk: a whole repaired shadow, or no key
 * at all. Called from the item constructor and from `applyProps`, so picking
 * **No Shadow** back REMOVES what a previous pick wrote instead of storing a
 * shadow that paints nothing.
 */
export function cleanupCanvasShadow(props: AnyObjectType) {
    const shadow = toValidCanvasShadow(props.shadow);
    if (shadow === null) {
        delete props.shadow;
    } else {
        props.shadow = shadow;
    }
}

/**
 * The shadow as CSS, or nothing.
 *
 * The `shadow` key is read before anything is validated so that the common
 * case -- a box with no shadow, which is nearly every box of every slide --
 * allocates nothing at all on a path that runs per item per render.
 */
export function genCanvasShadowStyle(props: {
    shadow?: CanvasItemShadowType;
}): CSSProperties {
    if (!props.shadow) {
        return {};
    }
    const shadow = toValidCanvasShadow(props.shadow);
    if (shadow === null) {
        return {};
    }
    const value =
        `${shadow.offsetX}px ${shadow.offsetY}px ` +
        `${shadow.blur}px ${shadow.color}`;
    // `drop-shadow()` reads its three lengths exactly as `box-shadow` does
    // (spread alone is unsupported), so one number means the same fall and the
    // same softness whichever kind is picked.
    return shadow.kind === 'drop'
        ? { filter: `drop-shadow(${value})` }
        : { boxShadow: value };
}
