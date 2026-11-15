import {
    type AppColorType,
    colorToTransparent,
} from '../others/color/colorValueHelpers';
import {
    type BlendModeType,
    DEFAULT_BLEND_MODE,
    toValidBlendMode,
} from '../helper/blendModeHelpers';
import {
    toFillHexColor,
    toFillSrc,
    type FillGradientType,
} from './fillValueHelpers';

/**
 * What a screen's ANIMATION background holds (2026-11-15, the user:
 * _implement `Animation` for background, it should provide both css and
 * glsl_, _to support creative animation_) -- the Background panel's
 * **Animations** tab.
 *
 * Like a fill (`fillValueHelpers`), an animation's `src` is ONE string, so
 * everything that keeps, compares, drags, saves and restores a background's
 * `src` keeps working:
 *
 * - a CSS animation: `css?name=aurora&colors=0B1026-4C1D95-0EA5E9&speed=normal&density=normal`;
 * - a built-in shader: `glsl?name=plasma&colors=...&speed=normal&quality=normal`;
 * - a person's own shader: `glsl?code=<base64url>&colors=...&speed=...&quality=...`;
 *
 * any of them with `&opacity=<10..99>` and `&blend=<mix-blend-mode>`
 * (2026-11-15, the user: _make sure it support transparency and blending
 * mode so for screen in screen show it should supply the effect_). A colour
 * may carry its own alpha too -- a see-through ground leaves only the light
 * moving. The blend mode is how the animation meets what lies UNDER it, and
 * under a background there is nothing on its own screen; it acts where that
 * screen is drawn over another one, a Screen Show, whose frame takes it
 * (`screenShowFrameHelpers`).
 *
 * No CSS is ever read from a value: a CSS animation is one of the effects
 * named here, BUILT from parts each checked on its own
 * (`cssAnimationLayerHelpers`), so a run sheet from somebody else's computer
 * can carry no `url()` onto a projector. A shader's code IS read from a
 * value -- that is what makes it creative -- but it runs on the graphics card
 * alone, in WebGL, with no way to the network, the files or the page; it is
 * checked for its size and its characters here and compiled by the screen,
 * which falls back to a still gradient of the colours when it cannot run it
 * (`glslAnimationRuntime`).
 *
 * Pure, and imports nothing but leaf value helpers: the screen window, the
 * presenter's previews, the Background panel and the agent helpers all read
 * animations through it.
 */

export const CSS_ANIMATION_NAME_LIST = [
    'aurora',
    'bokeh',
    'rays',
    'waves',
    'stars',
    'breathe',
    'snow',
    'clouds',
    'cross',
    'embers',
] as const;
export type CssAnimationNameType = (typeof CSS_ANIMATION_NAME_LIST)[number];

export const GLSL_ANIMATION_NAME_LIST = [
    'plasma',
    'flow',
    'mesh',
    'aurora',
    'waves',
    'rays',
    'clouds',
    'cross',
    'flames',
    'glass',
    'ripples',
    'snow',
    'sunrise',
    'stars',
] as const;
export type GlslAnimationNameType = (typeof GLSL_ANIMATION_NAME_LIST)[number];

export const ANIMATION_SPEED_LIST = ['slow', 'normal', 'fast'] as const;
export type AnimationSpeedType = (typeof ANIMATION_SPEED_LIST)[number];

/** A CSS animation's density and a shader's quality share one scale. */
export const ANIMATION_LEVEL_LIST = ['low', 'normal', 'high'] as const;
export type AnimationLevelType = (typeof ANIMATION_LEVEL_LIST)[number];

export const MIN_ANIMATION_OPACITY = 10;
export const MAX_ANIMATION_OPACITY = 100;
export const MIN_ANIMATION_COLOR_COUNT = 2;
export const MAX_ANIMATION_COLOR_COUNT = 4;
/** A person's own shader, in characters: a screenful of code, not a file. */
export const MAX_GLSL_CODE_LENGTH = 12000;
const MAX_SHORT_SRC_LENGTH = 300;
const MAX_CODE_SRC_LENGTH =
    MAX_SHORT_SRC_LENGTH + Math.ceil((MAX_GLSL_CODE_LENGTH * 4) / 3);

export type CssAnimationType = {
    engine: 'css';
    name: CssAnimationNameType;
    /** The first is the ground, the others the light moving over it. */
    colors: AppColorType[];
    speed: AnimationSpeedType;
    density: AnimationLevelType;
    /** Percent, the whole animation's: 100 is solid. */
    opacity: number;
    blend: BlendModeType;
};
export type GlslAnimationType = {
    engine: 'glsl';
    /** `custom` when `code` is a person's own shader. */
    name: GlslAnimationNameType | 'custom';
    code: string | null;
    colors: AppColorType[];
    speed: AnimationSpeedType;
    quality: AnimationLevelType;
    opacity: number;
    blend: BlendModeType;
};
export type AnimationType = CssAnimationType | GlslAnimationType;

/** How many times faster than `normal` an animation runs. */
export const ANIMATION_SPEED_FACTOR_MAP: Record<AnimationSpeedType, number> = {
    slow: 0.5,
    normal: 1,
    fast: 2,
};

/**
 * What a shader's quality costs: the share of the screen's pixels it draws
 * (the canvas is stretched to fill the rest) and how many frames a second.
 * Smooth light and colour lose nothing worth a projector at half size, and
 * an old church computer cannot draw a full one sixty times a second.
 */
export const GLSL_QUALITY_PLAN_MAP: Record<
    AnimationLevelType,
    { scale: number; fps: number }
> = {
    low: { scale: 0.35, fps: 24 },
    normal: { scale: 0.5, fps: 30 },
    high: { scale: 1, fps: 60 },
};

const CODE_CHAR_PATTERN = /^[\t\n\r\x20-\x7E]*$/;
const MAIN_IMAGE_PATTERN = /\bmainImage\s*\(/;

/**
 * Why a person's shader cannot be kept, in English for a log, or null when
 * it can: printable ASCII only (GLSL ES 1.00 has no other characters), a
 * screenful at most, and a `mainImage` for the screen to call.
 */
export function checkGlslCodeProblem(code: unknown): string | null {
    if (typeof code !== 'string' || code.trim() === '') {
        return 'The shader is empty.';
    }
    if (code.length > MAX_GLSL_CODE_LENGTH) {
        return `The shader is longer than ${MAX_GLSL_CODE_LENGTH} characters.`;
    }
    if (!CODE_CHAR_PATTERN.test(code)) {
        return 'The shader has characters GLSL does not allow.';
    }
    if (!MAIN_IMAGE_PATTERN.test(code)) {
        return 'The shader has no mainImage function.';
    }
    return null;
}

export function encodeGlslCode(code: string): string {
    return btoa(code)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
}

export function decodeGlslCode(encoded: string): string | null {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
        return null;
    }
    try {
        const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
        const code = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
        return checkGlslCodeProblem(code) === null ? code : null;
    } catch {
        return null;
    }
}

function parseQuery(src: string, kind: string) {
    const prefix = `${kind}?`;
    if (!src.startsWith(prefix) || src.length > MAX_CODE_SRC_LENGTH) {
        return null;
    }
    const query = src.slice(prefix.length);
    if (!/^[a-z0-9=&_\-]*$/i.test(query)) {
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
    if (!map.has('code') && src.length > MAX_SHORT_SRC_LENGTH) {
        return null;
    }
    return map;
}

function toOneOf<T extends string>(
    list: readonly T[],
    value: string | undefined,
    defaultValue: T,
): T | null {
    if (value === undefined) {
        return defaultValue;
    }
    return list.includes(value as T) ? (value as T) : null;
}

function toAnimationColors(text: string | undefined): AppColorType[] | null {
    const colors = (text ?? '').split('-').map(toFillHexColor);
    if (
        colors.length < MIN_ANIMATION_COLOR_COUNT ||
        colors.length > MAX_ANIMATION_COLOR_COUNT ||
        colors.some((color) => {
            return color === null;
        })
    ) {
        return null;
    }
    return colors as AppColorType[];
}

function toOpacity(value: string | undefined): number | null {
    if (value === undefined) {
        return MAX_ANIMATION_OPACITY;
    }
    if (!/^\d{1,3}$/.test(value)) {
        return null;
    }
    const opacity = Number.parseInt(value, 10);
    return opacity < MIN_ANIMATION_OPACITY || opacity > MAX_ANIMATION_OPACITY
        ? null
        : opacity;
}

function toBlend(value: string | undefined): BlendModeType | null {
    if (value === undefined) {
        return DEFAULT_BLEND_MODE;
    }
    const blend = toValidBlendMode(value);
    // Unknown is not `normal` here: a value is either right or not one.
    return blend === value ? blend : null;
}

function parseLook(map: Map<string, string>) {
    const opacity = toOpacity(map.get('opacity'));
    const blend = toBlend(map.get('blend'));
    if (opacity === null || blend === null) {
        return null;
    }
    return { opacity, blend };
}

function parseCssAnimation(src: string): CssAnimationType | null {
    const map = parseQuery(src, 'css');
    if (map === null || map.has('code')) {
        return null;
    }
    const name = toOneOf(CSS_ANIMATION_NAME_LIST, map.get('name'), 'aurora');
    const colors = toAnimationColors(map.get('colors'));
    const speed = toOneOf(ANIMATION_SPEED_LIST, map.get('speed'), 'normal');
    const density = toOneOf(ANIMATION_LEVEL_LIST, map.get('density'), 'normal');
    const look = parseLook(map);
    if (
        !map.has('name') ||
        name === null ||
        colors === null ||
        speed === null ||
        density === null ||
        look === null
    ) {
        return null;
    }
    return { engine: 'css', name, colors, speed, density, ...look };
}

function parseGlslAnimation(src: string): GlslAnimationType | null {
    const map = parseQuery(src, 'glsl');
    if (map === null || map.has('name') === map.has('code')) {
        // One of the two, never both and never neither.
        return null;
    }
    const encodedCode = map.get('code');
    const code = encodedCode === undefined ? null : decodeGlslCode(encodedCode);
    const name =
        encodedCode === undefined
            ? toOneOf(GLSL_ANIMATION_NAME_LIST, map.get('name'), 'plasma')
            : 'custom';
    const colors = toAnimationColors(map.get('colors'));
    const speed = toOneOf(ANIMATION_SPEED_LIST, map.get('speed'), 'normal');
    const quality = toOneOf(ANIMATION_LEVEL_LIST, map.get('quality'), 'normal');
    const look = parseLook(map);
    if (
        name === null ||
        (encodedCode !== undefined && code === null) ||
        colors === null ||
        speed === null ||
        quality === null ||
        look === null
    ) {
        return null;
    }
    return { engine: 'glsl', name, code, colors, speed, quality, ...look };
}

/** An animation's parts, or null for anything that is not one. */
export function parseAnimation(src: unknown): AnimationType | null {
    if (typeof src !== 'string') {
        return null;
    }
    if (src.startsWith('css?')) {
        return parseCssAnimation(src);
    }
    if (src.startsWith('glsl?')) {
        return parseGlslAnimation(src);
    }
    return null;
}

// A boolean, not `src is string`: see `checkIsFillSrc`.
export function checkIsAnimationSrc(src: unknown): boolean {
    return parseAnimation(src) !== null;
}

function toBareColors(colors: AppColorType[]) {
    return colors
        .map((color) => {
            return color.slice(1).toUpperCase();
        })
        .join('-');
}

function toLookQuery(animation: AnimationType) {
    const opacity =
        animation.opacity === MAX_ANIMATION_OPACITY
            ? ''
            : `&opacity=${animation.opacity}`;
    const blend =
        animation.blend === DEFAULT_BLEND_MODE
            ? ''
            : `&blend=${animation.blend}`;
    return opacity + blend;
}

/** The one way an animation is written, so two equal ones are equal strings. */
export function toAnimationSrc(animation: AnimationType): string {
    const colors = toBareColors(animation.colors);
    if (animation.engine === 'css') {
        return (
            `css?name=${animation.name}&colors=${colors}` +
            `&speed=${animation.speed}&density=${animation.density}` +
            toLookQuery(animation)
        );
    }
    const head =
        animation.name === 'custom'
            ? `code=${encodeGlslCode(animation.code ?? '')}`
            : `name=${animation.name}`;
    return (
        `glsl?${head}&colors=${colors}` +
        `&speed=${animation.speed}&quality=${animation.quality}` +
        toLookQuery(animation)
    );
}

/**
 * True when what is under the animation shows through it -- a see-through
 * colour or less than full opacity. Nobody can say then which colour the
 * words over it sit on, so no contrast is judged from its colours.
 */
export function checkIsAnimationSeeThrough(animation: AnimationType): boolean {
    return (
        animation.opacity < MAX_ANIMATION_OPACITY ||
        animation.colors.some((color) => {
            return colorToTransparent(color) < 255;
        })
    );
}

/** The blend mode a Screen Show frame of a screen holding `src` takes. */
export function toAnimationBlendFromSrc(src: unknown): BlendModeType {
    return parseAnimation(src)?.blend ?? DEFAULT_BLEND_MODE;
}

/** Any written form of an animation in the one form; null for a non-one. */
export function toCanonicalAnimationSrc(src: unknown): string | null {
    const animation = parseAnimation(src);
    return animation === null ? null : toAnimationSrc(animation);
}

export function compareAnimationSrc(src1: unknown, src2: unknown): boolean {
    const canonical1 = toCanonicalAnimationSrc(src1);
    return canonical1 !== null && canonical1 === toCanonicalAnimationSrc(src2);
}

/**
 * The still picture an animation stands for wherever it does not move -- a
 * printed page, a PowerPoint slide, a run sheet's colour chip, the screen
 * when it cannot run a shader -- and the colour the text-contrast check
 * judges it by: its colours as one gradient, ground first.
 */
export function toAnimationStillFill(
    animation: AnimationType,
): FillGradientType {
    return {
        kind: 'gradient',
        shape: 'linear',
        angle: 160,
        colors: animation.colors,
        motion: 'none',
    };
}

export function toAnimationStillFillSrc(animation: AnimationType): string {
    return toFillSrc(toAnimationStillFill(animation));
}

const CSS_ENGLISH_NAME_MAP: Record<CssAnimationNameType, string> = {
    aurora: 'aurora',
    bokeh: 'bokeh',
    rays: 'light rays',
    waves: 'waves',
    stars: 'starfield',
    breathe: 'breathe',
    snow: 'snowfall',
    clouds: 'clouds',
    cross: 'cross',
    embers: 'embers',
};
const GLSL_ENGLISH_NAME_MAP: Record<GlslAnimationNameType | 'custom', string> =
    {
        plasma: 'plasma',
        flow: 'flow',
        mesh: 'mesh gradient',
        aurora: 'aurora',
        waves: 'waves',
        rays: 'light rays',
        clouds: 'clouds',
        cross: 'cross',
        flames: 'flames',
        glass: 'stained glass',
        ripples: 'ripples',
        snow: 'snowfall',
        sunrise: 'sunrise',
        stars: 'starry night',
        custom: 'custom',
    };

/**
 * An animation in English words, for an agent or a log -- never a label a
 * person reads in the app (those go through `tran`).
 */
export function describeAnimation(animation: AnimationType): string {
    const colors = animation.colors.join(' → ');
    const look =
        (animation.opacity === MAX_ANIMATION_OPACITY
            ? ''
            : `, ${animation.opacity}% opacity`) +
        (animation.blend === DEFAULT_BLEND_MODE
            ? ''
            : `, ${animation.blend} blend`);
    if (animation.engine === 'css') {
        return (
            `${CSS_ENGLISH_NAME_MAP[animation.name]} CSS animation, ` +
            `${colors}, ${animation.speed} speed, ` +
            `${animation.density} density${look}`
        );
    }
    return (
        `${GLSL_ENGLISH_NAME_MAP[animation.name]} GLSL shader, ${colors}, ` +
        `${animation.speed} speed, ${animation.quality} quality${look}`
    );
}

/** Language-neutral words for an animation: its engine and its colours. */
export function genAnimationCodeLabel(animation: AnimationType): string {
    const engine = animation.engine === 'css' ? 'CSS' : 'GLSL';
    return `${engine} ${animation.colors.join(' → ')}`;
}
