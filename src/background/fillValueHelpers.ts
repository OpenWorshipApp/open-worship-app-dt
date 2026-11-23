import {
    type AppColorType,
    checkIsColorDark,
    colorToTransparent,
} from '../others/color/colorValueHelpers';

/**
 * What a screen's FILL background holds (2026-11-14, the user: _add gradient
 * support for background color_, _add background pattern support …, would
 * rename to something else to cover color+pattern_ -- the Background panel's
 * **Fills** tab -- _`Fills` should support css pattern animation as well_,
 * _should allow customizing and saving preset_).
 *
 * A fill's `src` is ONE string, so everything that already keeps, compares,
 * drags, saves and restores a background's `src` keeps working:
 *
 * - a solid colour, as it always was: `#RRGGBB` or `#RRGGBBAA`;
 * - a gradient: `gradient?shape=linear&angle=135&colors=1E3A8A-581C87`;
 * - a pattern: `pattern?name=dots&base=172554&ink=FFFFFF1F&size=24`;
 *
 * either of the last two with `&motion=slow|normal|fast`. Nothing else is a
 * fill: no CSS is ever read from a value, it is BUILT here from parts each
 * checked on its own, so a run sheet or a screen setting from somebody else's
 * computer can carry no `url()` -- nor anything else -- onto a projector.
 * Pure, and imports nothing but `colorValueHelpers`: the screen window, the
 * presenter's previews, the Background panel and the agent helpers all read
 * fills through it.
 */

export const FILL_MOTION_LIST = ['none', 'slow', 'normal', 'fast'] as const;
export type FillMotionType = (typeof FILL_MOTION_LIST)[number];

export const FILL_PATTERN_LIST = [
    'dots',
    'grid',
    'stripes',
    'diagonal',
    'checks',
    'zigzag',
] as const;
export type FillPatternNameType = (typeof FILL_PATTERN_LIST)[number];

export const FILL_GRADIENT_SHAPE_LIST = ['linear', 'radial'] as const;
export type FillGradientShapeType = (typeof FILL_GRADIENT_SHAPE_LIST)[number];

export const MIN_FILL_PATTERN_SIZE = 8;
export const MAX_FILL_PATTERN_SIZE = 160;
export const DEFAULT_FILL_PATTERN_SIZE = 32;
export const MIN_FILL_GRADIENT_COLOR_COUNT = 2;
export const MAX_FILL_GRADIENT_COLOR_COUNT = 4;

export type FillSolidType = { kind: 'solid'; color: AppColorType };
export type FillGradientType = {
    kind: 'gradient';
    shape: FillGradientShapeType;
    /** Degrees, 0 to 359; a radial gradient keeps it but draws no angle. */
    angle: number;
    colors: AppColorType[];
    motion: FillMotionType;
};
export type FillPatternType = {
    kind: 'pattern';
    name: FillPatternNameType;
    base: AppColorType;
    ink: AppColorType;
    /** One tile's side, in screen pixels. */
    size: number;
    motion: FillMotionType;
};
export type FillType = FillSolidType | FillGradientType | FillPatternType;

const HEX_PATTERN = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * A colour code in its one form, `#RRGGBB` or `#RRGGBBAA`; a short `#RGB` or
 * `#RGBA` is read the way CSS reads it.
 */
export function toFillHexColor(value: unknown): AppColorType | null {
    if (typeof value !== 'string') {
        return null;
    }
    const matched = HEX_PATTERN.exec(value.trim());
    if (matched === null) {
        return null;
    }
    const hex = matched[1].toUpperCase();
    if (hex.length > 4) {
        return `#${hex}`;
    }
    return `#${[...hex]
        .map((digit) => {
            return digit + digit;
        })
        .join('')}`;
}

export function checkIsSolidFillSrc(src: unknown): src is AppColorType {
    return (
        typeof src === 'string' &&
        src.startsWith('#') &&
        toFillHexColor(src) !== null
    );
}

function toWholeNumber(value: string | null, min: number, max: number) {
    if (value === null || !/^-?\d{1,4}$/.test(value)) {
        return null;
    }
    const number = Number.parseInt(value, 10);
    if (number < min || number > max) {
        return null;
    }
    return number;
}

function toMotion(value: string | null): FillMotionType | null {
    if (value === null) {
        return 'none';
    }
    return FILL_MOTION_LIST.includes(value as FillMotionType)
        ? (value as FillMotionType)
        : null;
}

function parseQuery(src: string, kind: string) {
    const prefix = `${kind}?`;
    if (!src.startsWith(prefix) || src.length > 300) {
        return null;
    }
    const query = src.slice(prefix.length);
    if (!/^[a-z0-9=&\-]*$/i.test(query)) {
        return null;
    }
    const map = new Map<string, string>();
    for (const part of query.split('&')) {
        const [key, value, ...rest] = part.split('=');
        if (!key || value === undefined || rest.length > 0 || map.has(key)) {
            return null;
        }
        map.set(key, value);
    }
    return map;
}

function parseGradient(src: string): FillGradientType | null {
    const map = parseQuery(src, 'gradient');
    if (map === null) {
        return null;
    }
    const shape = map.get('shape') ?? 'linear';
    if (!FILL_GRADIENT_SHAPE_LIST.includes(shape as FillGradientShapeType)) {
        return null;
    }
    const angle = toWholeNumber(map.get('angle') ?? '180', 0, 359);
    const colorTexts = (map.get('colors') ?? '').split('-');
    const colors = colorTexts.map(toFillHexColor);
    const motion = toMotion(map.get('motion') ?? null);
    if (
        angle === null ||
        motion === null ||
        colors.length < MIN_FILL_GRADIENT_COLOR_COUNT ||
        colors.length > MAX_FILL_GRADIENT_COLOR_COUNT ||
        colors.some((color) => {
            return color === null;
        })
    ) {
        return null;
    }
    return {
        kind: 'gradient',
        shape: shape as FillGradientShapeType,
        angle,
        colors: colors as AppColorType[],
        motion,
    };
}

function parsePattern(src: string): FillPatternType | null {
    const map = parseQuery(src, 'pattern');
    if (map === null) {
        return null;
    }
    const name = map.get('name') ?? '';
    const base = toFillHexColor(map.get('base'));
    const ink = toFillHexColor(map.get('ink'));
    const size = toWholeNumber(
        map.get('size') ?? `${DEFAULT_FILL_PATTERN_SIZE}`,
        MIN_FILL_PATTERN_SIZE,
        MAX_FILL_PATTERN_SIZE,
    );
    const motion = toMotion(map.get('motion') ?? null);
    if (
        !FILL_PATTERN_LIST.includes(name as FillPatternNameType) ||
        base === null ||
        ink === null ||
        size === null ||
        motion === null
    ) {
        return null;
    }
    return {
        kind: 'pattern',
        name: name as FillPatternNameType,
        base,
        ink,
        size,
        motion,
    };
}

/** A fill's parts, or null for anything that is not one. */
export function parseFill(src: unknown): FillType | null {
    if (typeof src !== 'string') {
        return null;
    }
    if (checkIsSolidFillSrc(src)) {
        return { kind: 'solid', color: toFillHexColor(src)! };
    }
    if (src.startsWith('gradient?')) {
        return parseGradient(src);
    }
    if (src.startsWith('pattern?')) {
        return parsePattern(src);
    }
    return null;
}

// A boolean, not `src is string`: a string that is no fill is still a
// string, and a guard would narrow a caller's string to `never` past it.
export function checkIsFillSrc(src: unknown): boolean {
    return parseFill(src) !== null;
}

function toBareHex(color: AppColorType) {
    return color.slice(1);
}

/** The one way a fill is written, so two equal fills are equal strings. */
export function toFillSrc(fill: FillType): string {
    if (fill.kind === 'solid') {
        return fill.color;
    }
    const motion = fill.motion === 'none' ? '' : `&motion=${fill.motion}`;
    if (fill.kind === 'gradient') {
        return (
            `gradient?shape=${fill.shape}&angle=${fill.angle}` +
            `&colors=${fill.colors.map(toBareHex).join('-')}${motion}`
        );
    }
    return (
        `pattern?name=${fill.name}&base=${toBareHex(fill.base)}` +
        `&ink=${toBareHex(fill.ink)}&size=${fill.size}${motion}`
    );
}

/** Any written form of a fill in the one form; null for a non-fill. */
export function toCanonicalFillSrc(src: unknown): string | null {
    const fill = parseFill(src);
    return fill === null ? null : toFillSrc(fill);
}

export function compareFillSrc(src1: unknown, src2: unknown): boolean {
    const canonical1 = toCanonicalFillSrc(src1);
    return canonical1 !== null && canonical1 === toCanonicalFillSrc(src2);
}

export type FillCssType = {
    backgroundColor: string;
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
};

function genPatternLayers(
    name: FillPatternNameType,
    ink: AppColorType,
    size: number,
): { images: string[]; positions?: string[] } {
    const line = Math.max(1, Math.round(size / 16));
    switch (name) {
        case 'dots':
            return {
                images: [
                    `radial-gradient(circle, ${ink} 0 18%, transparent 19%)`,
                ],
            };
        case 'grid':
            return {
                images: [
                    `linear-gradient(${ink} 0 ${line}px, transparent ${line}px)`,
                    `linear-gradient(90deg, ${ink} 0 ${line}px, transparent ${line}px)`,
                ],
            };
        case 'stripes':
            return {
                images: [`linear-gradient(90deg, ${ink} 50%, transparent 50%)`],
            };
        case 'diagonal':
            return {
                images: [
                    `linear-gradient(45deg, ${ink} 25%, transparent 25% 50%, ` +
                        `${ink} 50% 75%, transparent 75%)`,
                ],
            };
        case 'checks':
            return {
                images: [
                    `conic-gradient(${ink} 25%, transparent 0 50%, ` +
                        `${ink} 0 75%, transparent 0)`,
                ],
            };
        case 'zigzag': {
            const half = `${size / 2}px`;
            return {
                images: [
                    `linear-gradient(135deg, ${ink} 25%, transparent 25%)`,
                    `linear-gradient(225deg, ${ink} 25%, transparent 25%)`,
                    `linear-gradient(315deg, ${ink} 25%, transparent 25%)`,
                    `linear-gradient(45deg, ${ink} 25%, transparent 25%)`,
                ],
                positions: [`-${half} 0`, `-${half} 0`, '0 0', '0 0'],
            };
        }
    }
}

/**
 * The CSS that paints a fill. `scale` draws a pattern's tiles smaller, for a
 * swatch or a preview: its size is in SCREEN pixels.
 */
export function genFillCss(fill: FillType, scale = 1): FillCssType {
    if (fill.kind === 'solid') {
        return { backgroundColor: fill.color };
    }
    if (fill.kind === 'gradient') {
        const stops = fill.colors.join(', ');
        // A stop that lets what is behind show through would be painted
        // twice -- once in the gradient, once as the colour under it -- and
        // the under-colour would make it solid where it should be faint.
        const isSeeThrough = fill.colors.some((color) => {
            return colorToTransparent(color) < 255;
        });
        return {
            backgroundColor: isSeeThrough ? 'transparent' : fill.colors[0],
            backgroundImage:
                fill.shape === 'radial'
                    ? `radial-gradient(ellipse at center, ${stops})`
                    : `linear-gradient(${fill.angle}deg, ${stops})`,
        };
    }
    const size = Math.max(2, Math.round(fill.size * scale));
    const { images, positions } = genPatternLayers(fill.name, fill.ink, size);
    return {
        backgroundColor: fill.base,
        backgroundImage: images.join(', '),
        backgroundSize: images
            .map(() => {
                return `${size}px ${size}px`;
            })
            .join(', '),
        ...(positions === undefined
            ? {}
            : { backgroundPosition: positions.join(', ') }),
    };
}

/** The same paint as one `background` shorthand, for a chip or a tile. */
export function genFillBackground(fill: FillType, scale = 1): string {
    const css = genFillCss(fill, scale);
    if (css.backgroundImage === undefined) {
        return css.backgroundColor;
    }
    if (css.backgroundSize === undefined) {
        return `${css.backgroundImage}, ${css.backgroundColor}`;
    }
    // Layers are split on their top-level commas only.
    const images = splitTopLevel(css.backgroundImage);
    const sizes = splitTopLevel(css.backgroundSize);
    const positions =
        css.backgroundPosition === undefined
            ? []
            : splitTopLevel(css.backgroundPosition);
    const layers = images.map((image, index) => {
        const position = positions[index] ?? '0 0';
        return `${image} ${position} / ${sizes[index]}`;
    });
    return `${layers.join(', ')}, ${css.backgroundColor}`;
}

function splitTopLevel(text: string) {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
        } else if (char === ',' && depth === 0) {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts;
}

/** How fast a moving fill goes: screen pixels a second, then seconds. */
const PATTERN_SPEED_MAP: Record<Exclude<FillMotionType, 'none'>, number> = {
    slow: 6,
    normal: 16,
    fast: 40,
};
const GRADIENT_SECONDS_MAP: Record<Exclude<FillMotionType, 'none'>, number> = {
    slow: 24,
    normal: 12,
    fast: 6,
};

export type FillMotionPlanType = {
    /** The `@keyframes` in `fillMotion.scss`. */
    animationName: 'app-fill-drift' | 'app-fill-sway';
    seconds: number;
    /** A pattern's one tile, which the layer drifts across and starts over. */
    tilePx?: number;
};

/**
 * How a moving fill moves, or null for a still one. Only `transform` is ever
 * animated -- a layer larger than the screen, slid -- so the compositor moves
 * a picture painted once; animating `background-position` would repaint the
 * whole screen every frame, which an old church computer cannot afford.
 */
export function genFillMotionPlan(fill: FillType): FillMotionPlanType | null {
    if (fill.kind === 'solid' || fill.motion === 'none') {
        return null;
    }
    if (fill.kind === 'gradient') {
        return {
            animationName: 'app-fill-sway',
            seconds: GRADIENT_SECONDS_MAP[fill.motion],
        };
    }
    return {
        animationName: 'app-fill-drift',
        seconds:
            Math.round((fill.size / PATTERN_SPEED_MAP[fill.motion]) * 100) /
            100,
        tilePx: fill.size,
    };
}

function toRgb(color: AppColorType) {
    return [1, 3, 5].map((index) => {
        return Number.parseInt(color.slice(index, index + 2), 16);
    });
}

function toHex(rgb: number[]) {
    return `#${rgb
        .map((value) => {
            return Math.round(Math.min(255, Math.max(0, value)))
                .toString(16)
                .padStart(2, '0');
        })
        .join('')
        .toUpperCase()}` as AppColorType;
}

/**
 * `colors` as one colour laid over `base` across `cover` of it (0 to 1):
 * what a picture that is mostly `base`, with `colors` here and there, reads
 * as from across the room.
 */
export function toCoveredColor(
    base: AppColorType,
    colors: readonly AppColorType[],
    cover: number,
): AppColorType {
    const baseRgb = toRgb(base);
    if (colors.length === 0) {
        return toHex(baseRgb);
    }
    const sums = [0, 0, 0];
    for (const color of colors) {
        toRgb(color).forEach((value, index) => {
            sums[index] += value;
        });
    }
    return toHex(
        baseRgb.map((value, index) => {
            return value * (1 - cover) + (sums[index] / colors.length) * cover;
        }),
    );
}

/** How much of a tile a pattern's ink covers, near enough. */
const PATTERN_COVER_MAP: Record<FillPatternNameType, number> = {
    dots: 0.1,
    grid: 0.12,
    stripes: 0.5,
    diagonal: 0.5,
    checks: 0.5,
    zigzag: 0.5,
};

/**
 * The one colour a fill reads as from across the room -- what a check for
 * words that would vanish into the background, or for which side (dark or
 * light) a fill is on, measures.
 */
export function toFillAverageColor(fill: FillType): AppColorType {
    if (fill.kind === 'solid') {
        return fill.color;
    }
    if (fill.kind === 'gradient') {
        const sums = [0, 0, 0];
        for (const color of fill.colors) {
            toRgb(color).forEach((value, index) => {
                sums[index] += value;
            });
        }
        return toHex(
            sums.map((sum) => {
                return sum / fill.colors.length;
            }),
        );
    }
    const inkWeight =
        (colorToTransparent(fill.ink) / 255) * PATTERN_COVER_MAP[fill.name];
    const base = toRgb(fill.base);
    const ink = toRgb(fill.ink);
    return toHex(
        base.map((value, index) => {
            return value * (1 - inkWeight) + ink[index] * inkWeight;
        }),
    );
}

export function checkIsFillDark(fill: FillType): boolean {
    return checkIsColorDark(toFillAverageColor(fill).slice(0, 7));
}

const PATTERN_ENGLISH_NAME_MAP: Record<FillPatternNameType, string> = {
    dots: 'dots',
    grid: 'grid',
    stripes: 'stripes',
    diagonal: 'diagonal lines',
    checks: 'checks',
    zigzag: 'zigzag',
};

/**
 * A fill in English words, for an agent or a log -- never a label a person
 * reads in the app (those go through `tran`).
 */
export function describeFill(fill: FillType): string {
    if (fill.kind === 'solid') {
        return fill.color;
    }
    const motion = fill.motion === 'none' ? '' : `, moving ${fill.motion}`;
    if (fill.kind === 'gradient') {
        const shape =
            fill.shape === 'radial' ? 'radial' : `linear ${fill.angle}°`;
        return `${shape} gradient ${fill.colors.join(' → ')}${motion}`;
    }
    return (
        `${PATTERN_ENGLISH_NAME_MAP[fill.name]} pattern, ${fill.ink} on ` +
        `${fill.base}, ${fill.size}px tiles${motion}`
    );
}

/** Language-neutral words for a fill: codes, arrows and degrees only. */
export function genFillCodeLabel(fill: FillType): string {
    if (fill.kind === 'solid') {
        return fill.color;
    }
    if (fill.kind === 'gradient') {
        const head = fill.shape === 'radial' ? '◎' : `${fill.angle}°`;
        return `${head} ${fill.colors.join(' → ')}`;
    }
    return `${fill.ink} / ${fill.base}`;
}
