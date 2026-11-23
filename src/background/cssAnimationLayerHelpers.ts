import type { AppColorType } from '../others/color/colorValueHelpers';
import {
    ANIMATION_SPEED_FACTOR_MAP,
    MAX_ANIMATION_OPACITY,
    type AnimationLevelType,
    type CssAnimationType,
} from './animationValueHelpers';

/**
 * A CSS animation's elements, BUILT here from its checked parts
 * (`animationValueHelpers`): one tree of plain style records, drawn by the
 * screen (`ScreenBackgroundAnimationComp`), by a tile, and written out whole
 * by Copy Code (`genCssAnimationHtml`) -- the same tree, so the three cannot
 * drift apart the way a hand-kept copy does.
 *
 * Only `transform` and `opacity` ever move (`CSS_ANIMATION_KEYFRAMES_CSS`,
 * held to it by its test): every layer is painted ONCE and the compositor
 * slides, turns and fades it, so a moving background costs a projector no
 * repaint (CLAUDE.md's rule against animated paint properties, at screen
 * size). Sizes are in container units, so a 16:9 tile and a projector draw
 * the same picture.
 *
 * Every position comes from a seed of the effect's name and density: the
 * same animation is the same markup everywhere, which is what lets a still
 * tile stand for what the screen shows, and a test compare it.
 */

export type CssStyleRecordType = Record<string, string>;
export type CssAnimationNodeType = {
    style: CssStyleRecordType;
    /** Only while it moves: added to `style`. */
    movingStyle?: CssStyleRecordType;
    /** Only while it stands still: added to `style`. */
    stillStyle?: CssStyleRecordType;
    children?: CssAnimationNodeType[];
};

export const CSS_ANIMATION_ROOT_CLASS_NAME = 'app-anim-box';
export const CSS_ANIMATION_MOVING_CLASS_NAME = 'app-anim-moving';
/** On the root only where it is presented: see the keyframes' last rule. */
export const CSS_ANIMATION_ON_SCREEN_CLASS_NAME = 'app-anim-on-screen';
export const CSS_ANIMATION_STYLE_ELEMENT_ID = 'app-anim-keyframes';

/**
 * Everything that moves. `transform` and `opacity` ONLY -- the test reads
 * this text and fails on any other property inside a `@keyframes`.
 *
 * The prefers-reduced-motion clamp in `interaction.scss` is lifted for the
 * projected screen alone, for the reason a fill's motion is
 * (`ScreenBackgroundFillComp.scss`): whoever set the screen up chose it for
 * the congregation. A tile that moves under the pointer stays clamped.
 */
export const CSS_ANIMATION_KEYFRAMES_CSS = `
.app-anim-moving {
  will-change: transform;
  animation-duration: var(--app-anim-seconds, 12s);
  animation-iteration-count: infinite;
}
@keyframes app-anim-float {
  from { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  to { transform: translate3d(var(--app-anim-x, 0), var(--app-anim-y, 0), 0) rotate(var(--app-anim-r, 0deg)) scale(var(--app-anim-s, 1)); }
}
@keyframes app-anim-rise {
  from { transform: translate3d(0, 105%, 0); }
  to { transform: translate3d(var(--app-anim-x, 0), -30%, 0); }
}
@keyframes app-anim-fade {
  0% { opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes app-anim-sway {
  from { transform: rotate(var(--app-anim-r0, -6deg)); }
  to { transform: rotate(var(--app-anim-r1, 6deg)); }
}
@keyframes app-anim-pulse {
  from { opacity: 0.55; }
  to { opacity: 1; }
}
@keyframes app-anim-slide {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(var(--app-anim-x, -12.5%), 0, 0); }
}
@keyframes app-anim-fall {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(0, var(--app-anim-y, 20cqmin), 0); }
}
@keyframes app-anim-twinkle {
  from { opacity: 1; }
  to { opacity: 0.35; }
}
@keyframes app-anim-drop {
  from { transform: translate3d(0, -6%, 0); }
  to { transform: translate3d(var(--app-anim-x, 0), 101%, 0); }
}
@keyframes app-anim-drift-x {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(var(--app-anim-x, 100%), 0, 0); }
}
@keyframes app-anim-glow {
  0% { opacity: 0; transform: scale(0.92); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.08); }
}
@keyframes app-anim-tumble {
  from { transform: rotate3d(var(--app-anim-tx, 1), var(--app-anim-ty, 0.4), 0, 0deg); }
  to { transform: rotate3d(var(--app-anim-tx, 1), var(--app-anim-ty, 0.4), 0, 360deg); }
}
@keyframes app-anim-burst {
  0% { opacity: 0; transform: scale(0.1); }
  8% { opacity: 1; }
  40% { opacity: 1; }
  62% { opacity: 0; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes app-anim-flicker {
  0% { opacity: 0.9; transform: scale(1, 1) rotate(-1.5deg); }
  20% { opacity: 1; transform: scale(0.95, 1.06) rotate(1.5deg); }
  45% { opacity: 0.82; transform: scale(1.04, 0.95) rotate(-1deg); }
  70% { opacity: 1; transform: scale(0.97, 1.04) rotate(2deg); }
  100% { opacity: 0.9; transform: scale(1, 1) rotate(-1.5deg); }
}
@media (prefers-reduced-motion: reduce) {
  .app .app-anim-on-screen .app-anim-moving:not(.spinner-border):not(.spinner-grow) {
    animation-duration: var(--app-anim-seconds, 12s) !important;
    animation-iteration-count: infinite !important;
  }
}
`;

/**
 * The keyframes, once per document, the first time an animation is drawn
 * in it: a few hundred bytes nobody pays for until then.
 */
export function ensureCssAnimationKeyframes(targetDocument: Document) {
    if (
        targetDocument.getElementById(CSS_ANIMATION_STYLE_ELEMENT_ID) !== null
    ) {
        return;
    }
    const style = targetDocument.createElement('style');
    style.id = CSS_ANIMATION_STYLE_ELEMENT_ID;
    style.textContent = CSS_ANIMATION_KEYFRAMES_CSS;
    targetDocument.head.appendChild(style);
}

function hashText(text: string) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** A small seeded random source (mulberry32): the same seed, the same run. */
function genRandom(seedText: string) {
    let state = hashText(seedText);
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const between = (min: number, max: number) => {
        return min + (max - min) * next();
    };
    return { next, between };
}

function round(value: number, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

/** A colour with its own alpha times `factor`, as `rgba()`. */
export function toRgba(color: AppColorType, factor = 1): string {
    const hex = color.slice(1);
    const [red, green, blue] = [0, 2, 4].map((index) => {
        return Number.parseInt(hex.slice(index, index + 2), 16);
    });
    const ownAlpha =
        hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const alpha = round(Math.min(1, Math.max(0, ownAlpha * factor)), 3);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function genAccents(animation: CssAnimationType) {
    const accents = animation.colors.slice(1);
    return accents.length > 0 ? accents : animation.colors;
}

type MotionType = {
    names: string[];
    seconds: number;
    delaySeconds: number;
    timing?: string;
    direction?: string;
};

/** The inline half of a moving element: which keyframes, how long, where. */
function genMovingStyle(
    animation: CssAnimationType,
    { names, seconds, delaySeconds, timing, direction }: MotionType,
): CssStyleRecordType {
    const factor = ANIMATION_SPEED_FACTOR_MAP[animation.speed];
    const duration = `${round(seconds / factor)}s`;
    const delay = `${round(-delaySeconds / factor)}s`;
    return {
        'animation-name': names.join(', '),
        '--app-anim-seconds': names
            .map(() => {
                return duration;
            })
            .join(', '),
        'animation-delay': names
            .map(() => {
                return delay;
            })
            .join(', '),
        'animation-timing-function': timing ?? 'linear',
        'animation-direction': direction ?? 'normal',
    };
}

function genLevelCount(
    level: AnimationLevelType,
    counts: [number, number, number],
) {
    if (level === 'low') {
        return counts[0];
    }
    return level === 'normal' ? counts[1] : counts[2];
}

const ABSOLUTE: CssStyleRecordType = { position: 'absolute' };

function genAurora(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`aurora:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, [3, 4, 6]);
    return Array.from({ length: count }, (_, index) => {
        const color = accents[index % accents.length];
        const size = round(random.between(42, 68));
        return {
            style: {
                ...ABSOLUTE,
                left: `${round(random.between(-25, 75))}%`,
                top: `${round(random.between(-30, 60))}%`,
                width: `${size}cqmax`,
                height: `${size}cqmax`,
                background:
                    `radial-gradient(closest-side, ${toRgba(color, 0.7)}, ` +
                    `${toRgba(color, 0.25)} 55%, ${toRgba(color, 0)})`,
                '--app-anim-x': `${round(random.between(-35, 35))}%`,
                '--app-anim-y': `${round(random.between(-25, 25))}%`,
                '--app-anim-r': `${round(random.between(-40, 40))}deg`,
                '--app-anim-s': `${round(random.between(0.85, 1.25))}`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-float'],
                seconds: round(random.between(16, 28)),
                delaySeconds: round(random.between(0, 20)),
                timing: 'ease-in-out',
                direction: 'alternate',
            }),
        };
    });
}

type RandomType = ReturnType<typeof genRandom>;

/**
 * A particle that is not a soft round light: a leaf, a petal, a ribbon of
 * confetti, a heart -- its look painted once, and how it turns on its way.
 */
type ParticleShapeType = {
    /** Its look, and a still turn that shows in a tile. */
    genStyle: (color: AppColorType, random: RandomType) => CssStyleRecordType;
    turn?: {
        names: string[];
        secondsRange: [number, number];
        genVars: (random: RandomType) => CssStyleRecordType;
        timing?: string;
        direction?: string;
    };
};

type ParticleOptionType = {
    seed: string;
    counts: [number, number, number];
    sizeRange: [number, number];
    secondsRange: [number, number];
    swayCqmin: number;
    isFalling: boolean;
    alphas: [number, number];
    sharpness: number;
    shape?: ParticleShapeType;
};

/** Two moving styles on one element, each keeping its own time. */
function mergeMovingStyles(
    first: CssStyleRecordType,
    second: CssStyleRecordType,
): CssStyleRecordType {
    const merged: CssStyleRecordType = { ...first };
    for (const [property, value] of Object.entries(second)) {
        merged[property] =
            first[property] === undefined
                ? value
                : `${first[property]}, ${value}`;
    }
    return merged;
}

/**
 * Things that cross the screen one by one -- bokeh and embers rising, snow
 * falling. A column as tall as the screen carries each at its top, so the
 * journey is a percentage of the column's OWN height and nothing but its
 * `transform` changes.
 */
function genParticles(
    animation: CssAnimationType,
    option: ParticleOptionType,
): CssAnimationNodeType[] {
    const random = genRandom(`${option.seed}:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, option.counts);
    return Array.from({ length: count }, (_, index) => {
        const color = accents[index % accents.length];
        const size = round(random.between(...option.sizeRange));
        const seconds = round(random.between(...option.secondsRange));
        const motion = {
            seconds,
            delaySeconds: round(random.between(0, seconds)),
        };
        const solid = round(option.sharpness * 100);
        const circle: CssAnimationNodeType = {
            style:
                option.shape === undefined
                    ? {
                          width: '100%',
                          'aspect-ratio': '1',
                          'border-radius': '50%',
                          background:
                              `radial-gradient(circle, ${toRgba(color, option.alphas[0])} 0 ${solid * 0.6}%, ` +
                              `${toRgba(color, option.alphas[1])} ${solid}%, ${toRgba(color, 0)} 70%)`,
                      }
                    : {
                          width: '100%',
                          ...option.shape.genStyle(color, random),
                      },
        };
        if (!option.isFalling) {
            circle.movingStyle = genMovingStyle(animation, {
                ...motion,
                names: ['app-anim-fade'],
            });
        }
        const turn = option.shape?.turn;
        if (turn !== undefined) {
            circle.style = { ...circle.style, ...turn.genVars(random) };
            const turnSeconds = round(random.between(...turn.secondsRange));
            const turnStyle = genMovingStyle(animation, {
                names: turn.names,
                seconds: turnSeconds,
                delaySeconds: round(random.between(0, turnSeconds)),
                timing: turn.timing,
                direction: turn.direction,
            });
            circle.movingStyle =
                circle.movingStyle === undefined
                    ? turnStyle
                    : mergeMovingStyles(circle.movingStyle, turnStyle);
        }
        return {
            style: {
                ...ABSOLUTE,
                left: `${round(random.between(-3, 97))}%`,
                top: '0',
                width: `${size}cqmin`,
                height: '100%',
                '--app-anim-x': `${round(random.between(-option.swayCqmin, option.swayCqmin))}cqmin`,
            },
            movingStyle: genMovingStyle(animation, {
                ...motion,
                names: [option.isFalling ? 'app-anim-drop' : 'app-anim-rise'],
            }),
            stillStyle: {
                transform: `translate3d(0, ${round(random.between(0, 90))}%, 0)`,
            },
            children: [circle],
        };
    });
}

function genBokeh(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'bokeh',
        counts: [10, 18, 28],
        sizeRange: [4, 13],
        secondsRange: [14, 26],
        swayCqmin: 8,
        isFalling: false,
        alphas: [0.55, 0.22],
        sharpness: 0.6,
    });
}

function genEmbers(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'embers',
        counts: [16, 28, 44],
        sizeRange: [0.7, 2.2],
        secondsRange: [7, 13],
        swayCqmin: 14,
        isFalling: false,
        alphas: [1, 0.45],
        sharpness: 0.45,
    });
}

function genSnow(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'snow',
        counts: [24, 40, 60],
        sizeRange: [0.6, 1.9],
        secondsRange: [10, 22],
        swayCqmin: 10,
        isFalling: true,
        alphas: [0.95, 0.5],
        sharpness: 0.5,
    });
}

/** A leaf, pointed at two corners, turning back and forth as it falls. */
function genLeaves(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'leaves',
        counts: [10, 16, 26],
        sizeRange: [2.2, 4.6],
        secondsRange: [12, 21],
        swayCqmin: 16,
        isFalling: true,
        alphas: [0.95, 0.75],
        sharpness: 0.5,
        shape: {
            genStyle: (color, random) => {
                return {
                    'aspect-ratio': '1',
                    'border-radius': '0 80% 0 80%',
                    background:
                        `linear-gradient(135deg, ${toRgba(color, 0.95)} 0 47%, ` +
                        `${toRgba(color, 0.55)} 50%, ${toRgba(color, 0.8)} 53% 100%)`,
                    transform: `rotate(${round(random.between(-60, 60))}deg)`,
                };
            },
            turn: {
                names: ['app-anim-sway'],
                secondsRange: [2.4, 4.6],
                genVars: (random) => {
                    const swing = round(random.between(25, 60));
                    return {
                        '--app-anim-r0': `${-swing}deg`,
                        '--app-anim-r1': `${swing}deg`,
                    };
                },
                timing: 'ease-in-out',
                direction: 'alternate',
            },
        },
    });
}

/** Soft petals drifting down, turning over as they go. */
function genPetals(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'petals',
        counts: [14, 24, 36],
        sizeRange: [1.2, 2.6],
        secondsRange: [14, 24],
        swayCqmin: 22,
        isFalling: true,
        alphas: [0.95, 0.7],
        sharpness: 0.5,
        shape: {
            genStyle: (color, random) => {
                return {
                    'aspect-ratio': '0.75',
                    'border-radius': '50% 50% 50% 50% / 62% 62% 38% 38%',
                    background:
                        `radial-gradient(ellipse at 40% 30%, ${toRgba(color, 0.95)}, ` +
                        `${toRgba(color, 0.7)} 70%)`,
                    transform: `rotate(${round(random.between(-90, 90))}deg)`,
                };
            },
            turn: {
                names: ['app-anim-tumble'],
                secondsRange: [3, 6],
                genVars: (random) => {
                    return {
                        '--app-anim-tx': `${round(random.between(0.4, 1))}`,
                        '--app-anim-ty': `${round(random.between(-0.6, 0.6))}`,
                    };
                },
            },
        },
    });
}

/** Ribbons of every colour, tumbling down quickly. */
function genConfetti(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'confetti',
        counts: [24, 40, 64],
        sizeRange: [0.7, 1.4],
        secondsRange: [7, 13],
        swayCqmin: 8,
        isFalling: true,
        alphas: [0.95, 0.95],
        sharpness: 0.5,
        shape: {
            genStyle: (color, random) => {
                return {
                    'aspect-ratio': '0.45',
                    'border-radius': '0.15cqmin',
                    background: toRgba(color, 0.95),
                    transform: `rotate(${round(random.between(-80, 80))}deg)`,
                };
            },
            turn: {
                names: ['app-anim-tumble'],
                secondsRange: [1.4, 3],
                genVars: (random) => {
                    return {
                        '--app-anim-tx': `${round(random.between(0.2, 1))}`,
                        '--app-anim-ty': `${round(random.between(-1, 1))}`,
                    };
                },
            },
        },
    });
}

// A heart in percentages of its own box, point down.
const HEART_CLIP_PATH =
    'polygon(50% 100%, 14% 64%, 3% 44%, 2% 26%, 10% 11%, 24% 3%, ' +
    '38% 4%, 50% 16%, 62% 4%, 76% 3%, 90% 11%, 98% 26%, 97% 44%, 86% 64%)';

/** Hearts rising and fading, each tilted its own way. */
function genHearts(animation: CssAnimationType): CssAnimationNodeType[] {
    return genParticles(animation, {
        seed: 'hearts',
        counts: [8, 14, 22],
        sizeRange: [2, 5],
        secondsRange: [12, 20],
        swayCqmin: 10,
        isFalling: false,
        alphas: [0.9, 0.6],
        sharpness: 0.5,
        shape: {
            genStyle: (color, random) => {
                return {
                    'aspect-ratio': '1.08',
                    'clip-path': HEART_CLIP_PATH,
                    background:
                        `radial-gradient(circle at 32% 30%, ${toRgba(color, 0.95)}, ` +
                        `${toRgba(color, 0.65)} 75%)`,
                    transform: `rotate(${round(random.between(-18, 18))}deg)`,
                };
            },
            turn: {
                names: ['app-anim-sway'],
                secondsRange: [2.6, 4.4],
                genVars: (random) => {
                    const swing = round(random.between(8, 16));
                    return {
                        '--app-anim-r0': `${-swing}deg`,
                        '--app-anim-r1': `${swing}deg`,
                    };
                },
                timing: 'ease-in-out',
                direction: 'alternate',
            },
        },
    });
}

/**
 * Bursts of sparks, each opening from its centre and fading, then dark a
 * while before the next: the sparks are painted once and the burst they
 * sit in grows (`app-anim-burst`), sinking a little as it goes.
 */
function genFireworks(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`fireworks:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, [3, 5, 8]);
    const sparkCount = 12;
    return Array.from({ length: count }, (_, index) => {
        const color = accents[index % accents.length];
        const tip = accents[(index + 1) % accents.length];
        const size = round(random.between(22, 38));
        const seconds = round(random.between(3.2, 5.4));
        const delaySeconds = round(random.between(0, seconds));
        const turn = round(random.between(0, 360 / sparkCount));
        const sparks = Array.from(
            { length: sparkCount },
            (_, sparkIndex): CssAnimationNodeType => {
                return {
                    style: {
                        ...ABSOLUTE,
                        left: '50%',
                        top: 'calc(50% - 0.3cqmin)',
                        width: '50%',
                        height: '0.6cqmin',
                        'transform-origin': '0 50%',
                        transform: `rotate(${round(turn + (360 * sparkIndex) / sparkCount)}deg)`,
                        background:
                            `linear-gradient(90deg, ${toRgba(color, 0)} 35%, ` +
                            `${toRgba(color, 0.55)} 75%, ${toRgba(tip, 1)} 96%, ${toRgba(tip, 0)})`,
                    },
                };
            },
        );
        const glow: CssAnimationNodeType = {
            style: {
                ...ABSOLUTE,
                inset: '0',
                background:
                    `radial-gradient(circle, ${toRgba(tip, 0.45)}, ` +
                    `${toRgba(color, 0.12)} 30%, ${toRgba(color, 0)} 60%)`,
            },
        };
        const burst: CssAnimationNodeType = {
            style: { ...ABSOLUTE, inset: '0' },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-burst'],
                seconds,
                delaySeconds,
                timing: 'ease-out',
            }),
            children: [glow, ...sparks],
        };
        return {
            style: {
                ...ABSOLUTE,
                left: `calc(${round(random.between(8, 92))}% - ${round(size / 2)}cqmin)`,
                top: `calc(${round(random.between(12, 58))}% - ${round(size / 2)}cqmin)`,
                width: `${size}cqmin`,
                height: `${size}cqmin`,
                '--app-anim-y': `${round(random.between(3, 7))}cqmin`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-fall'],
                seconds,
                delaySeconds,
            }),
            children: [burst],
        };
    });
}

/**
 * Candles in rows, the far ones smaller and higher: each a body in the
 * first accent, a flame of the last over the middle one, and a halo that
 * breathes; a few sparks rise from them.
 */
function genCandles(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`candles:${animation.density}`);
    const accents = genAccents(animation);
    const wax = accents[0];
    const core = accents[accents.length - 1];
    const flameColor = accents.length >= 3 ? accents[1] : core;
    const count = genLevelCount(animation.density, [5, 8, 12]);
    const candles = Array.from(
        { length: count },
        (_, index): CssAnimationNodeType => {
            const depth = round(random.between(0, 1));
            const size = round(2.2 + depth * 2.6);
            const left = round(
                ((index + 0.5) / count) * 100 + random.between(-4, 4),
            );
            const top = round(78 - (1 - depth) * 26 + random.between(-3, 3));
            const bodyHeight = round(size * random.between(2.2, 3.8));
            const flameSeconds = round(random.between(1.6, 2.6));
            const haloSeconds = round(random.between(2.4, 4));
            return {
                style: {
                    ...ABSOLUTE,
                    left: `calc(${left}% - ${round(size / 2)}cqmin)`,
                    top: `${top}%`,
                    width: `${size}cqmin`,
                    height: `${round(size * 1.9 + bodyHeight)}cqmin`,
                },
                children: [
                    {
                        style: {
                            ...ABSOLUTE,
                            left: `${-size * 2.5}cqmin`,
                            top: `${-size * 2.4}cqmin`,
                            width: `${size * 6}cqmin`,
                            height: `${size * 6}cqmin`,
                            background:
                                `radial-gradient(circle, ${toRgba(flameColor, 0.42)}, ` +
                                `${toRgba(flameColor, 0.12)} 40%, ${toRgba(flameColor, 0)} 70%)`,
                        },
                        movingStyle: genMovingStyle(animation, {
                            names: ['app-anim-pulse'],
                            seconds: haloSeconds,
                            delaySeconds: round(random.between(0, haloSeconds)),
                            timing: 'ease-in-out',
                            direction: 'alternate',
                        }),
                    },
                    {
                        style: {
                            ...ABSOLUTE,
                            left: `${round(size * 0.22)}cqmin`,
                            top: '0',
                            width: `${round(size * 0.56)}cqmin`,
                            height: `${round(size * 1.6)}cqmin`,
                            'border-radius':
                                '50% 50% 50% 50% / 62% 62% 38% 38%',
                            'transform-origin': '50% 90%',
                            background:
                                `radial-gradient(ellipse at 50% 72%, ${toRgba(core, 1)} 0 22%, ` +
                                `${toRgba(flameColor, 0.95)} 46%, ${toRgba(flameColor, 0)} 74%)`,
                        },
                        movingStyle: genMovingStyle(animation, {
                            names: ['app-anim-flicker'],
                            seconds: flameSeconds,
                            delaySeconds: round(
                                random.between(0, flameSeconds),
                            ),
                            timing: 'ease-in-out',
                        }),
                    },
                    {
                        style: {
                            ...ABSOLUTE,
                            left: '0',
                            top: `${round(size * 1.75)}cqmin`,
                            width: '100%',
                            height: `${bodyHeight}cqmin`,
                            'border-radius':
                                '0.5cqmin 0.5cqmin 0.3cqmin 0.3cqmin',
                            background:
                                `linear-gradient(90deg, ${toRgba(wax, 0.6)}, ` +
                                `${toRgba(wax, 0.92)} 45%, ${toRgba(wax, 0.7)})`,
                        },
                    },
                ],
            };
        },
    );
    const sparks = genParticles(animation, {
        seed: 'candle-sparks',
        counts: [4, 8, 12],
        sizeRange: [0.4, 0.9],
        secondsRange: [9, 15],
        swayCqmin: 8,
        isFalling: false,
        alphas: [0.8, 0.3],
        sharpness: 0.45,
    });
    return [...sparks, ...candles];
}

function genClouds(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`clouds:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, [4, 6, 9]);
    return Array.from({ length: count }, (_, index) => {
        const color = accents[index % accents.length];
        const puffs = Array.from({ length: 4 }, () => {
            const width = round(random.between(24, 40));
            const height = round(random.between(32, 55));
            return (
                `radial-gradient(ellipse ${width}% ${height}% at ` +
                `${round(random.between(25, 75))}% ${round(random.between(45, 65))}%, ` +
                `${toRgba(color, 0.75)}, ${toRgba(color, 0.4)} 45%, ${toRgba(color, 0)} 72%)`
            );
        });
        const width = round(random.between(32, 52));
        const seconds = round(random.between(70, 120));
        return {
            style: {
                ...ABSOLUTE,
                left: `-${width}cqw`,
                top: `${round(random.between(-6, 58))}%`,
                width: `${width}cqw`,
                height: `${round(width * 0.42)}cqw`,
                background: puffs.join(', '),
                '--app-anim-x': 'calc(100cqw + 100%)',
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-drift-x'],
                seconds,
                delaySeconds: round(random.between(0, seconds)),
            }),
            stillStyle: {
                transform: `translate3d(calc(${round(random.between(0.15, 0.95))} * (100cqw + 100%)), 0, 0)`,
            },
        };
    });
}

function genCross(animation: CssAnimationType): CssAnimationNodeType[] {
    const [, crossColor, glowColor = crossColor, rayColor = glowColor] =
        animation.colors;
    const period = genLevelCount(animation.density, [18, 12, 8]);
    const width = round(period * 0.4);
    const center = '50% 45%';
    const bar = (style: CssStyleRecordType): CssAnimationNodeType => {
        return {
            style: {
                ...ABSOLUTE,
                'border-radius': '0.6cqmin',
                background:
                    `linear-gradient(90deg, ${toRgba(crossColor, 0.85)}, ` +
                    `${toRgba(crossColor, 1)} 50%, ${toRgba(crossColor, 0.85)})`,
                'box-shadow': `0 0 3cqmin ${toRgba(glowColor, 0.8)}`,
                ...style,
            },
        };
    };
    return [
        {
            style: {
                ...ABSOLUTE,
                left: '-20%',
                top: '-15%',
                width: '140%',
                height: '140%',
                'transform-origin': '50% 43%',
                background:
                    `repeating-conic-gradient(from 0deg at 50% 43%, ` +
                    `${toRgba(rayColor, 0)} 0deg, ${toRgba(rayColor, 0.22)} ${round(width / 2)}deg, ` +
                    `${toRgba(rayColor, 0)} ${width}deg, ${toRgba(rayColor, 0)} ${period}deg)`,
                '--app-anim-r0': '-8deg',
                '--app-anim-r1': '8deg',
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-sway'],
                seconds: 24,
                delaySeconds: 0,
                timing: 'ease-in-out',
                direction: 'alternate',
            }),
        },
        {
            style: {
                ...ABSOLUTE,
                inset: '0',
                background:
                    `radial-gradient(circle at ${center}, ${toRgba(glowColor, 0.65)}, ` +
                    `${toRgba(glowColor, 0.2)} 22cqmin, ${toRgba(glowColor, 0)} 48cqmin)`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-pulse'],
                seconds: 5,
                delaySeconds: 0,
                timing: 'ease-in-out',
                direction: 'alternate',
            }),
        },
        bar({
            left: 'calc(50% - 2.1cqmin)',
            top: 'calc(45% - 20cqmin)',
            width: '4.2cqmin',
            height: '58cqmin',
        }),
        bar({
            left: 'calc(50% - 17cqmin)',
            top: 'calc(45% - 4.7cqmin)',
            width: '34cqmin',
            height: '4.2cqmin',
        }),
    ];
}

function genRays(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`rays:${animation.density}`);
    const accents = genAccents(animation).slice(0, 2);
    const period = genLevelCount(animation.density, [18, 12, 8]);
    const ground = animation.colors[0];
    const rays = accents.map((color, index): CssAnimationNodeType => {
        const width = round(period * 0.4);
        const offset = round(random.between(0, period));
        return {
            style: {
                ...ABSOLUTE,
                left: '-30%',
                top: '-10%',
                width: '160%',
                height: '130%',
                'transform-origin': '50% 8%',
                background:
                    `repeating-conic-gradient(from ${offset}deg at 50% 8%, ` +
                    `${toRgba(color, 0)} 0deg, ${toRgba(color, 0.32)} ${round(width / 2)}deg, ` +
                    `${toRgba(color, 0)} ${width}deg, ${toRgba(color, 0)} ${period}deg)`,
                '--app-anim-r0': `${index === 0 ? -6 : 5}deg`,
                '--app-anim-r1': `${index === 0 ? 6 : -5}deg`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-sway', 'app-anim-pulse'],
                seconds: round(random.between(14, 22)),
                delaySeconds: round(random.between(0, 10)),
                timing: 'ease-in-out',
                direction: 'alternate',
            }),
        };
    });
    // Painted once and never moved: the light fades into the ground below.
    const fade: CssAnimationNodeType = {
        style: {
            ...ABSOLUTE,
            inset: '0',
            background:
                `linear-gradient(180deg, ${toRgba(ground, 0)} 25%, ` +
                `${toRgba(ground, 1)} 100%)`,
        },
    };
    return [...rays, fade];
}

function genWaves(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`waves:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, [2, 3, 4]);
    return Array.from({ length: count }, (_, index) => {
        const color = toRgba(
            accents[index % accents.length],
            0.3 + (0.45 * (index + 1)) / count,
        );
        // Back to front: each band lower, its crests shorter and quicker.
        const height = round(55 - (index * 30) / count);
        const crest = round(random.between(10, 18));
        const tileShare = [12.5, 10, 8.33, 6.25][index % 4];
        return {
            style: {
                ...ABSOLUTE,
                left: '0',
                bottom: '0',
                width: '200%',
                height: `${height}%`,
                background:
                    `radial-gradient(ellipse 50% 100% at 50% 100%, ${color} 98%, ` +
                    `rgba(0, 0, 0, 0) 100%) 0 0 / ${tileShare}% ${crest}% repeat-x, ` +
                    `linear-gradient(180deg, rgba(0, 0, 0, 0) ${crest}%, ${color} ${crest}%)`,
                '--app-anim-x': `-${tileShare}%`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-slide'],
                seconds: round(random.between(6, 11) - index),
                delaySeconds: round(random.between(0, 5)),
            }),
            stillStyle: {
                transform: `translate3d(-${round(random.between(0, tileShare))}%, 0, 0)`,
            },
        };
    });
}

function genStars(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`stars:${animation.density}`);
    const accents = genAccents(animation);
    const dotCount = genLevelCount(animation.density, [3, 5, 8]);
    return [18, 27, 41].map((tile, index) => {
        const dots = Array.from({ length: dotCount }, (_, dotIndex) => {
            const color = accents[(index + dotIndex) % accents.length];
            const radius = round(random.between(0.12, 0.28) * (3 - index), 3);
            return (
                `radial-gradient(circle at ${round(random.between(2, 98))}% ` +
                `${round(random.between(2, 98))}%, ${toRgba(color, 0.95)} 0 ` +
                `${radius}cqmin, ${toRgba(color, 0)} ${round(radius * 2.2, 3)}cqmin)`
            );
        });
        return {
            style: {
                ...ABSOLUTE,
                left: '0',
                right: '0',
                bottom: '0',
                top: `-${tile}cqmin`,
                background: dots.join(', '),
                'background-size': `${tile}cqmin ${tile}cqmin`,
                '--app-anim-y': `${tile}cqmin`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-fall', 'app-anim-twinkle'],
                seconds: round(40 + index * 25),
                delaySeconds: round(random.between(0, 40)),
            }),
        };
    });
}

function genBreathe(animation: CssAnimationType): CssAnimationNodeType[] {
    const random = genRandom(`breathe:${animation.density}`);
    const accents = genAccents(animation);
    const count = genLevelCount(animation.density, [2, 3, 4]);
    const seconds = 12;
    return Array.from({ length: count }, (_, index) => {
        const color = accents[index % accents.length];
        return {
            style: {
                ...ABSOLUTE,
                inset: '0',
                background:
                    `radial-gradient(ellipse at ${round(random.between(15, 85))}% ` +
                    `${round(random.between(15, 85))}%, ${toRgba(color, 0.8)}, ` +
                    `${toRgba(color, 0)} 65%)`,
            },
            movingStyle: genMovingStyle(animation, {
                names: ['app-anim-glow'],
                seconds,
                delaySeconds: round((seconds * index) / count),
                timing: 'ease-in-out',
            }),
            stillStyle: {
                opacity: `${round(1 - index / (count + 1))}`,
            },
        };
    });
}

function genGround(animation: CssAnimationType) {
    const ground = animation.colors[0];
    if (animation.name === 'clouds') {
        const light = genAccents(animation).at(-1) ?? ground;
        return (
            `radial-gradient(ellipse at 50% -10%, ${toRgba(light, 0.45)}, ` +
            `${toRgba(light, 0)} 55%), linear-gradient(180deg, ` +
            `${toRgba(light, 0)} 30%, ${toRgba(light, 0.3)} 100%), ${toRgba(ground)}`
        );
    }
    if (animation.name === 'embers') {
        const glow = genAccents(animation)[0];
        return (
            `radial-gradient(ellipse at 50% 120%, ${toRgba(glow, 0.45)}, ` +
            `${toRgba(glow, 0)} 60%), ${toRgba(ground)}`
        );
    }
    if (animation.name === 'stars' || animation.name === 'fireworks') {
        const glow = genAccents(animation)[0];
        return (
            `radial-gradient(ellipse at 50% 115%, ${toRgba(glow, 0.3)}, ` +
            `${toRgba(glow, 0)} 60%), ${toRgba(ground)}`
        );
    }
    if (animation.name === 'candles') {
        const glow = genAccents(animation).at(-1) ?? ground;
        return (
            `radial-gradient(ellipse at 50% 100%, ${toRgba(glow, 0.22)}, ` +
            `${toRgba(glow, 0)} 65%), ${toRgba(ground)}`
        );
    }
    return toRgba(ground);
}

/**
 * The whole animation as one tree: the root is the ground (and the
 * animation's opacity), its children the layers.
 */
export function genCssAnimationTree(
    animation: CssAnimationType,
): CssAnimationNodeType {
    const layerMap = {
        aurora: genAurora,
        bokeh: genBokeh,
        rays: genRays,
        waves: genWaves,
        stars: genStars,
        breathe: genBreathe,
        snow: genSnow,
        clouds: genClouds,
        cross: genCross,
        embers: genEmbers,
        leaves: genLeaves,
        fireworks: genFireworks,
        petals: genPetals,
        candles: genCandles,
        confetti: genConfetti,
        hearts: genHearts,
    };
    const style: CssStyleRecordType = {
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        'container-type': 'size',
        background: genGround(animation),
    };
    if (animation.opacity < MAX_ANIMATION_OPACITY) {
        style.opacity = `${animation.opacity / 100}`;
    }
    // A person's own CSS is drawn from its code
    // (`cssCodeAnimationElementHelpers`); here it is its ground alone.
    return {
        style,
        children:
            animation.name === 'custom'
                ? []
                : layerMap[animation.name](animation),
    };
}

/** A node's own style for one of the two ways it is drawn. */
export function genCssAnimationNodeStyle(
    node: CssAnimationNodeType,
    isMoving: boolean,
): CssStyleRecordType {
    return {
        ...node.style,
        ...(isMoving ? node.movingStyle : node.stillStyle),
    };
}

export function checkIsCssAnimationNodeMoving(
    node: CssAnimationNodeType,
    isMoving: boolean,
) {
    return isMoving && node.movingStyle !== undefined;
}

/** `{ 'border-radius': '50%' }` as React's `{ borderRadius: '50%' }`. */
export function toReactStyle(record: CssStyleRecordType) {
    const style: Record<string, string> = {};
    for (const [property, value] of Object.entries(record)) {
        const key = property.startsWith('--')
            ? property
            : property.replace(/-([a-z])/g, (_, letter: string) => {
                  return letter.toUpperCase();
              });
        style[key] = value;
    }
    return style;
}

function escapeAttribute(text: string) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;');
}

function toCssText(record: CssStyleRecordType) {
    return Object.entries(record)
        .map(([property, value]) => {
            return `${property}: ${value}`;
        })
        .join('; ');
}

function genNodeHtml(
    node: CssAnimationNodeType,
    indent: string,
    isMoving: boolean,
): string {
    const className = checkIsCssAnimationNodeMoving(node, isMoving)
        ? ` class="${CSS_ANIMATION_MOVING_CLASS_NAME}"`
        : '';
    const style = escapeAttribute(
        toCssText(genCssAnimationNodeStyle(node, isMoving)),
    );
    const children = (node.children ?? [])
        .map((child) => {
            return `\n${genNodeHtml(child, `${indent}  `, isMoving)}`;
        })
        .join('');
    const close = children === '' ? '' : `\n${indent}`;
    return `${indent}<div${className} style="${style}">${children}${close}</div>`;
}

/**
 * A CSS animation as it stands, as markup: for paper, where nothing moves
 * and no keyframes are needed.
 */
export function genCssAnimationStillMarkup(animation: CssAnimationType) {
    return genNodeHtml(genCssAnimationTree(animation), '', false);
}

/**
 * Copy Code for a CSS animation: a whole web page that plays it, for a
 * person to change in the Webs tab's editor -- where any HTML and CSS may
 * run, in its own frame -- or anywhere else.
 */
export function genCssAnimationHtml(animation: CssAnimationType): string {
    const tree = genCssAnimationTree(animation);
    return [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8" />',
        '<style>',
        'html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }',
        CSS_ANIMATION_KEYFRAMES_CSS.trim(),
        '</style>',
        '</head>',
        '<body>',
        genNodeHtml(tree, '', true),
        '</body>',
        '</html>',
        '',
    ].join('\n');
}
