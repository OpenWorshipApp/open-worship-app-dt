/**
 * The rules `owa_animation_edit` changes an animation by (2026-11-19, the
 * user: _let chatbot control editor_, the goal _chatbot can help handle css
 * and glsl code editing_): the fields Customize holds, in the words an
 * assistant writes them, checked before anything changes and turned into
 * the very animation a person's presses would make. Pure: no editor, no
 * screen, no colour resolver of its own (the worker hands one in, which
 * reads any CSS colour the page knows).
 *
 * Both kinds have the same settings and code: a shader's GLSL, typed into
 * Shader Code, and a CSS animation's own style sheet, typed into CSS Code
 * (a built-in CSS effect is built from checked parts and has none until a
 * person or the assistant writes it). Code of the OTHER kind makes the
 * animation that kind, its colours, speed and look kept.
 */
import { toValidBlendMode } from '../helper/blendModeHelpers';
import type { AppColorType } from '../others/color/colorValueHelpers';
import {
    ANIMATION_LEVEL_LIST,
    ANIMATION_SPEED_LIST,
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    MAX_ANIMATION_COLOR_COUNT,
    MAX_ANIMATION_OPACITY,
    MIN_ANIMATION_COLOR_COUNT,
    MIN_ANIMATION_OPACITY,
    describeAnimation,
    type AnimationLevelType,
    type AnimationSpeedType,
    type AnimationType,
    type CssAnimationNameType,
    type CssAnimationType,
    type GlslAnimationNameType,
    type GlslAnimationType,
} from './animationValueHelpers';
import { toFillHexColor } from './fillValueHelpers';

// Held in step with the tool's own list (`agentAnimationEdit.mjs`); a test
// holds the two together.
export const ANIMATION_AGENT_ACTION_LIST = [
    'read',
    'set',
    'code',
    'undo',
] as const;
export type AnimationAgentActionType =
    (typeof ANIMATION_AGENT_ACTION_LIST)[number];

/** The fields a `set` takes, as the assistant writes them. */
export type AnimationAgentFieldsType = {
    effect?: unknown;
    engine?: unknown;
    colors?: unknown;
    speed?: unknown;
    level?: unknown;
    opacity?: unknown;
    blend?: unknown;
};

export const ANIMATION_AGENT_FIELD_LIST = [
    'effect',
    'engine',
    'colors',
    'speed',
    'level',
    'opacity',
    'blend',
] as const;

type PlanType =
    { animation: AnimationType; changed: string[] } | { reason: string };

function toWord(value: unknown) {
    return typeof value === 'string'
        ? value
              .trim()
              .toLowerCase()
              .replace(/[\s_]+/g, '-')
        : '';
}

// Words an assistant writes for an effect, beside its key.
const EFFECT_WORD_MAP: Record<string, string> = {
    'light-rays': 'rays',
    starfield: 'stars',
    'starry-night': 'stars',
    snowfall: 'snow',
    'mesh-gradient': 'mesh',
    'stained-glass': 'glass',
    fire: 'flames',
    'falling-leaves': 'leaves',
    leaf: 'leaves',
    firework: 'fireworks',
    petal: 'petals',
    candle: 'candles',
    candlelight: 'candles',
    heart: 'hearts',
};

function pickEffect(
    animation: AnimationType,
    effectValue: unknown,
    engineValue: unknown,
): { engine: 'css' | 'glsl'; name: string } | { reason: string } | null {
    const engineWord = toWord(engineValue);
    if (engineWord !== '' && engineWord !== 'css' && engineWord !== 'glsl') {
        return { reason: '`engine` is css or glsl.' };
    }
    const word = toWord(effectValue);
    if (word === '') {
        if (engineWord === '' || engineWord === animation.engine) {
            return null;
        }
        // Another engine named alone: its first effect, as its tiles start.
        return engineWord === 'css'
            ? { engine: 'css', name: CSS_ANIMATION_NAME_LIST[0] }
            : { engine: 'glsl', name: GLSL_ANIMATION_NAME_LIST[0] };
    }
    const name = EFFECT_WORD_MAP[word] ?? word;
    const isCss = (CSS_ANIMATION_NAME_LIST as readonly string[]).includes(name);
    const isGlsl = (GLSL_ANIMATION_NAME_LIST as readonly string[]).includes(
        name,
    );
    const wanted = engineWord === '' ? animation.engine : engineWord;
    if (wanted === 'css' && isCss) {
        return { engine: 'css', name };
    }
    if (wanted === 'glsl' && isGlsl) {
        return { engine: 'glsl', name };
    }
    // Named by no engine asked: the one that has it.
    if (engineWord === '' && (isCss || isGlsl)) {
        return { engine: isCss ? 'css' : 'glsl', name };
    }
    return {
        reason:
            `No ${wanted === 'css' ? 'CSS animation' : 'shader'} effect is ` +
            `called "${String(effectValue)}". CSS effects: ` +
            `${CSS_ANIMATION_NAME_LIST.join(', ')}. Shader effects: ` +
            `${GLSL_ANIMATION_NAME_LIST.join(', ')}.`,
    };
}

function stepOf<T extends string>(
    list: readonly T[],
    current: T,
    word: string,
    upWords: string[],
    downWords: string[],
): T | null {
    if ((list as readonly string[]).includes(word)) {
        return word as T;
    }
    const index = list.indexOf(current);
    if (upWords.includes(word)) {
        return list[Math.min(list.length - 1, index + 1)];
    }
    if (downWords.includes(word)) {
        return list[Math.max(0, index - 1)];
    }
    return null;
}

function toColors(
    value: unknown,
    resolveColor: (text: string) => string | null,
): AppColorType[] | { reason: string } {
    const list = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(/\s*[,;]\s*|\s+→\s+/)
          : null;
    if (list === null) {
        return { reason: '`colors` is a list of colours, ground first.' };
    }
    if (
        list.length < MIN_ANIMATION_COLOR_COUNT ||
        list.length > MAX_ANIMATION_COLOR_COUNT
    ) {
        return {
            reason:
                `An animation has ${MIN_ANIMATION_COLOR_COUNT} to ` +
                `${MAX_ANIMATION_COLOR_COUNT} colours (the first is the ` +
                `ground the others move over); ${list.length} were sent.`,
        };
    }
    const colors: AppColorType[] = [];
    for (const one of list) {
        const text = String(one ?? '').trim();
        const color =
            toFillHexColor(text) ?? toFillHexColor(resolveColor(text));
        if (color === null) {
            return {
                reason:
                    `"${text}" is not a colour: write #RRGGBB, #RRGGBBAA ` +
                    '(see-through) or a CSS colour name.',
            };
        }
        colors.push(color);
    }
    return colors;
}

/**
 * The animation a `set` makes of `animation`, and the fields that changed --
 * or why nothing may change. Every field is checked first: one wrong field
 * refuses the whole call, so a refusal never leaves half a change up.
 */
export function planAnimationChange(
    animation: AnimationType,
    fields: AnimationAgentFieldsType,
    resolveColor: (text: string) => string | null,
): PlanType {
    const sent = ANIMATION_AGENT_FIELD_LIST.filter((key) => {
        return fields[key] !== undefined && fields[key] !== null;
    });
    if (sent.length === 0) {
        return {
            reason:
                'Nothing to change: send effect, colors, speed, level, ' +
                'opacity or blend.',
        };
    }
    const effect = pickEffect(animation, fields.effect, fields.engine);
    if (effect !== null && 'reason' in effect) {
        return effect;
    }
    let next: AnimationType = animation;
    if (effect !== null) {
        if (effect.engine === 'css') {
            next = {
                engine: 'css',
                name: effect.name as CssAnimationNameType,
                // A built-in again: a person's own code goes with it.
                code: null,
                colors: animation.colors,
                speed: animation.speed,
                density:
                    animation.engine === 'css'
                        ? animation.density
                        : animation.quality,
                opacity: animation.opacity,
                blend: animation.blend,
            };
        } else {
            next = {
                engine: 'glsl',
                name: effect.name as GlslAnimationNameType,
                // A built-in again: a person's own code goes with it, as
                // the Effect list does.
                code: null,
                colors: animation.colors,
                speed: animation.speed,
                quality:
                    animation.engine === 'glsl'
                        ? animation.quality
                        : animation.density,
                opacity: animation.opacity,
                blend: animation.blend,
            };
        }
    }
    if (fields.colors !== undefined && fields.colors !== null) {
        const colors = toColors(fields.colors, resolveColor);
        if (!Array.isArray(colors)) {
            return colors;
        }
        next = { ...next, colors };
    }
    if (fields.speed !== undefined && fields.speed !== null) {
        const speed = stepOf<AnimationSpeedType>(
            ANIMATION_SPEED_LIST,
            next.speed,
            toWord(fields.speed),
            ['faster', 'quicker'],
            ['slower'],
        );
        if (speed === null) {
            return {
                reason: '`speed` is slow, normal or fast (or slower / faster).',
            };
        }
        next = { ...next, speed };
    }
    if (fields.level !== undefined && fields.level !== null) {
        const current = next.engine === 'css' ? next.density : next.quality;
        const level = stepOf<AnimationLevelType>(
            ANIMATION_LEVEL_LIST,
            current,
            toWord(fields.level),
            ['more', 'higher'],
            ['less', 'lower'],
        );
        if (level === null) {
            return {
                reason:
                    '`level` (a CSS animation’s density, a shader’s ' +
                    'quality) is low, normal or high (or less / more).',
            };
        }
        next =
            next.engine === 'css'
                ? { ...next, density: level }
                : { ...next, quality: level };
    }
    if (fields.opacity !== undefined && fields.opacity !== null) {
        const opacity = Number(fields.opacity);
        if (
            !Number.isFinite(opacity) ||
            opacity < MIN_ANIMATION_OPACITY ||
            opacity > MAX_ANIMATION_OPACITY
        ) {
            return {
                reason:
                    `\`opacity\` is a percent from ${MIN_ANIMATION_OPACITY} ` +
                    `to ${MAX_ANIMATION_OPACITY} (100 is solid).`,
            };
        }
        next = { ...next, opacity: Math.round(opacity) };
    }
    if (fields.blend !== undefined && fields.blend !== null) {
        const word = toWord(fields.blend);
        const blend = toValidBlendMode(word === 'none' ? 'normal' : word);
        if (blend !== word && !(word === 'none' && blend === 'normal')) {
            return {
                reason:
                    '`blend` is a CSS mix-blend-mode: normal, multiply, ' +
                    'screen, overlay, darken, lighten, color-dodge, ' +
                    'color-burn, plus-lighter, soft-light, hard-light, ' +
                    'difference, exclusion, hue, saturation, color or ' +
                    'luminosity.',
            };
        }
        next = { ...next, blend };
    }
    return { animation: next, changed: [...sent] };
}

/**
 * An animation made a person's own CSS animation for CSS written for it:
 * its colours, speed and look kept, a shader's quality its density.
 */
export function toCustomCssAnimation(
    animation: AnimationType,
    code: string,
): CssAnimationType {
    return {
        engine: 'css',
        name: 'custom',
        code,
        colors: animation.colors,
        speed: animation.speed,
        density:
            animation.engine === 'css' ? animation.density : animation.quality,
        opacity: animation.opacity,
        blend: animation.blend,
    };
}

/**
 * An animation made a custom shader for code written for it: its colours,
 * speed and look kept, its density its quality.
 */
export function toCustomShader(
    animation: AnimationType,
    code: string,
): GlslAnimationType {
    return {
        engine: 'glsl',
        name: 'custom',
        code,
        colors: animation.colors,
        speed: animation.speed,
        quality:
            animation.engine === 'glsl' ? animation.quality : animation.density,
        opacity: animation.opacity,
        blend: animation.blend,
    };
}

/** An animation as fields an assistant reads, never a label a person reads. */
export function toAnimationAgentFields(animation: AnimationType) {
    return {
        engine: animation.engine,
        effect: animation.name,
        colors: animation.colors,
        speed: animation.speed,
        ...(animation.engine === 'css'
            ? { density: animation.density }
            : { quality: animation.quality }),
        opacity: animation.opacity,
        blend: animation.blend,
        description: describeAnimation(animation),
    };
}
