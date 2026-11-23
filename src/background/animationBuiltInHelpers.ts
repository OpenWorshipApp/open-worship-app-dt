import type { ColorModeType } from '../others/color/colorContrastHelpers';
import {
    checkIsColorDark,
    type AppColorType,
} from '../others/color/colorValueHelpers';
import {
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    parseAnimation,
    toAnimationReadColor,
    toAnimationSrc,
    type AnimationLevelType,
    type AnimationSpeedType,
    type AnimationType,
    type CssAnimationNameType,
    type GlslAnimationNameType,
} from './animationValueHelpers';
import {
    ANIMATION_CATEGORY_DATA_MAP,
    ANIMATION_CATEGORY_LIST,
    type AnimationCategoryDataType,
    type AnimationCategoryType,
    type AnimationEffectNameType,
} from './animationCategoryData';

export {
    ANIMATION_CATEGORY_GROUP_LIST,
    ANIMATION_CATEGORY_LIST,
    DEFAULT_ANIMATION_CATEGORY,
    type AnimationCategoryGroupType,
    type AnimationCategoryType,
} from './animationCategoryData';

/**
 * The samples the Animations tab offers, by CATEGORY (2026-11-19, the user:
 * _add categroy control. I want to swhich category. e.g. sunday worship,
 * christmas, thanksgiving, resurection day, ..._, then _give maximum sample
 * for each category_): every effect of both kinds in the colours of an
 * occasion -- Christmas snow, a Resurrection Day sunrise, Thanksgiving
 * leaves -- but those the occasion does not suit, the ones it is known by
 * first. Each in its one written form (`toAnimationSrc`), so a tile is lit
 * by a plain comparison. The first colour is the ground. A person recolours
 * any of them (Customize) and keeps the result as a preset.
 *
 * The effects an occasion is known by come in more than one look (the same
 * day: _add more example, e.g. christmas should have like falling snow_):
 * its first lead effect of each kind in four, the second in three, the
 * third in two -- each further look in another of the category's palettes,
 * with more of it, or slower. Christmas opens on four snowfalls of
 * each kind, `Snowfall` to `Snowfall 4`.
 *
 * Every category comes on both sides of a Dark / Light switch, as the Fills
 * tab's gradients do (2026-11-19, the user: _all category should have
 * dark/light_): the same effects in the same order, in the category's
 * light palettes. The Dark side is what there always was, src for src.
 *
 * Nothing is built when this loads -- it sits in the Presenter's static
 * closure through every animation's label -- and nothing is kept: a
 * category's samples are built when the picker shows it, a few dozen
 * strings, and a written animation's category is worked out per category
 * from its one effect.
 */

export type AnimationEngineType = AnimationType['engine'];

export type AnimationSampleType = {
    category: AnimationCategoryType;
    tone: ColorModeType;
    animation: AnimationType;
    src: string;
    /** 1 for an effect's first look, 2 and on for its further ones. */
    number: number;
};

export type AnimationCategorySamplesType = {
    css: AnimationSampleType[];
    glsl: AnimationSampleType[];
};

export type AnimationSampleFoundType = {
    category: AnimationCategoryType;
    tone: ColorModeType;
    number: number;
};

export const ANIMATION_TONE_LIST: readonly ColorModeType[] = ['dark', 'light'];

/**
 * What one side of a category draws from: its palettes, and -- the Dark
 * side alone -- the samples there were before categories.
 */
type CategoryToneDataType = Pick<
    AnimationCategoryDataType,
    'lead' | 'excluded' | 'palettes' | 'css' | 'glsl'
>;

function toCategoryToneData(
    category: AnimationCategoryType,
    tone: ColorModeType,
): CategoryToneDataType {
    const data = ANIMATION_CATEGORY_DATA_MAP[category];
    if (tone === 'dark') {
        return data;
    }
    return {
        lead: data.lead,
        excluded: data.excluded,
        palettes: data.lightPalettes,
    };
}

type SampleLookType = {
    speed: AnimationSpeedType;
    /** A CSS effect's density; a shader keeps its quality, which is cost. */
    level: AnimationLevelType;
};

// How many looks a category's first, second and third lead effect of a kind
// come in; every other effect comes in one.
const LEAD_LOOK_COUNT_LIST = [4, 3, 2];
const FIRST_LOOK: SampleLookType = { speed: 'normal', level: 'normal' };
// A further look's pace and amount, in turn; its colours are another of the
// category's palettes. Never faster -- a background behind words -- and
// never fewer: a sparse snowfall's tile was an empty colour at tile size.
const FURTHER_LOOK_LIST: readonly SampleLookType[] = [
    { speed: 'normal', level: 'high' },
    { speed: 'slow', level: 'high' },
    { speed: 'slow', level: 'normal' },
];

type CategoryEffectType<T> = { name: T; lookCount: number };

/** A category's effects of one kind, in the order its tiles are drawn. */
function listCategoryEffects<T extends AnimationEffectNameType>(
    nameList: readonly T[],
    data: CategoryToneDataType,
): CategoryEffectType<T>[] {
    const excluded: readonly AnimationEffectNameType[] = data.excluded ?? [];
    const checkIsOfKind = (name: AnimationEffectNameType): name is T => {
        return (nameList as readonly AnimationEffectNameType[]).includes(name);
    };
    const lead = data.lead.filter(checkIsOfKind).filter((name) => {
        return !excluded.includes(name);
    });
    const rest = nameList.filter((name) => {
        return !lead.includes(name) && !excluded.includes(name);
    });
    return [...lead, ...rest].map((name, index) => {
        const lookCount =
            index < lead.length ? (LEAD_LOOK_COUNT_LIST[index] ?? 1) : 1;
        return { name, lookCount };
    });
}

function pickCategoryColors(
    data: CategoryToneDataType,
    engine: AnimationEngineType,
    name: string,
    index: number,
): readonly string[] {
    const overrideMap: Partial<Record<string, readonly string[]>> =
        (engine === 'css' ? data.css : data.glsl) ?? {};
    return overrideMap[name] ?? data.palettes[index % data.palettes.length];
}

function genCssAnimation(
    name: CssAnimationNameType,
    colors: readonly string[],
    look: SampleLookType,
): AnimationType {
    return {
        engine: 'css',
        name,
        code: null,
        colors: [...colors] as AppColorType[],
        speed: look.speed,
        density: look.level,
        opacity: 100,
        blend: 'normal',
    };
}

function genGlslAnimation(
    name: GlslAnimationNameType,
    colors: readonly string[],
    look: SampleLookType,
): AnimationType {
    return {
        engine: 'glsl',
        name,
        code: null,
        colors: [...colors] as AppColorType[],
        speed: look.speed,
        quality: 'normal',
        opacity: 100,
        blend: 'normal',
    };
}

/**
 * The looks of one effect of a category, the first one first: it keeps the
 * colours it was given (a sample of before categories keeps its own), each
 * further one takes the next palette that is not the first look's.
 */
function genEffectAnimations(
    data: CategoryToneDataType,
    engine: AnimationEngineType,
    name: CssAnimationNameType | GlslAnimationNameType,
    index: number,
    lookCount: number,
): AnimationType[] {
    const firstColors = pickCategoryColors(data, engine, name, index);
    const paletteCount = data.palettes.length;
    const furtherColorsList = data.palettes
        .map((_, shift) => {
            return data.palettes[(index + shift) % paletteCount];
        })
        .filter((colors) => {
            return colors !== firstColors;
        });
    const lookList = [
        { colors: firstColors, look: FIRST_LOOK },
        ...FURTHER_LOOK_LIST.slice(0, lookCount - 1).map((look, lookIndex) => {
            return { colors: furtherColorsList[lookIndex], look };
        }),
    ].filter((item) => {
        return item.colors !== undefined;
    });
    return lookList.map(({ colors, look }) => {
        return engine === 'css'
            ? genCssAnimation(name as CssAnimationNameType, colors, look)
            : genGlslAnimation(name as GlslAnimationNameType, colors, look);
    });
}

function listCategoryKindSamples(
    category: AnimationCategoryType,
    tone: ColorModeType,
    engine: AnimationEngineType,
): AnimationSampleType[] {
    const data = toCategoryToneData(category, tone);
    const nameList: readonly (CssAnimationNameType | GlslAnimationNameType)[] =
        engine === 'css' ? CSS_ANIMATION_NAME_LIST : GLSL_ANIMATION_NAME_LIST;
    return listCategoryEffects(nameList, data).flatMap(
        ({ name, lookCount }, index) => {
            return genEffectAnimations(
                data,
                engine,
                name,
                index,
                lookCount,
            ).map((animation, lookIndex) => {
                return {
                    category,
                    tone,
                    animation,
                    src: toAnimationSrc(animation),
                    number: lookIndex + 1,
                };
            });
        },
    );
}

/**
 * One side of one category's samples, CSS and GLSL, in the order they are
 * drawn.
 */
export function listAnimationCategorySamples(
    category: AnimationCategoryType,
    tone: ColorModeType = 'dark',
): AnimationCategorySamplesType {
    return {
        css: listCategoryKindSamples(category, tone, 'css'),
        glsl: listCategoryKindSamples(category, tone, 'glsl'),
    };
}

/** The written samples of one kind of a category's side: a show's row. */
export function listAnimationCategorySrcs(
    category: AnimationCategoryType,
    engine: AnimationEngineType,
    tone: ColorModeType = 'dark',
): string[] {
    return listCategoryKindSamples(category, tone, engine).map((sample) => {
        return sample.src;
    });
}

// Whole and plain, as every sample is: its pace and amount are the src's
// to compare.
function checkIsSampleLook(animation: AnimationType) {
    if (animation.opacity !== 100 || animation.blend !== 'normal') {
        return false;
    }
    return animation.engine === 'css' || animation.quality === 'normal';
}

/** Where `animation`'s effect is drawn in the category, null if it is not. */
function findCategoryEffect(
    animation: AnimationType,
    data: CategoryToneDataType,
): (CategoryEffectType<string> & { index: number }) | null {
    if (animation.name === 'custom') {
        return null;
    }
    const nameList: readonly (CssAnimationNameType | GlslAnimationNameType)[] =
        animation.engine === 'css'
            ? CSS_ANIMATION_NAME_LIST
            : GLSL_ANIMATION_NAME_LIST;
    const effectList = listCategoryEffects(nameList, data);
    const index = effectList.findIndex((effect) => {
        return effect.name === animation.name;
    });
    return index === -1 ? null : { ...effectList[index], index };
}

/** Whether any sample of the category stands on `ground`: a few compares. */
function checkHasGround(
    data: CategoryToneDataType,
    engine: AnimationEngineType,
    ground: string,
) {
    const overrideList = Object.values(
        (engine === 'css' ? data.css : data.glsl) ?? {},
    );
    return [...data.palettes, ...overrideList].some((colors) => {
        return colors !== undefined && colors[0].toUpperCase() === ground;
    });
}

/**
 * The category an animation is a sample of, which side of it and which look
 * of its effect -- null for one recoloured, made see-through or of a
 * person's own code. Each side of each category is asked for the few looks
 * of that one effect: no list of every sample is ever built. Every label of
 * an animation asks (`genAnimationLabel`), so a side whose grounds are not
 * this one's is passed over first.
 */
export function findAnimationSample(
    animation: AnimationType,
): AnimationSampleFoundType | null {
    if (animation.name === 'custom' || !checkIsSampleLook(animation)) {
        return null;
    }
    const src = toAnimationSrc(animation);
    const ground = animation.colors[0].toUpperCase();
    for (const category of ANIMATION_CATEGORY_LIST) {
        for (const tone of ANIMATION_TONE_LIST) {
            const number = findToneSampleNumber(
                toCategoryToneData(category, tone),
                animation,
                src,
                ground,
            );
            if (number !== null) {
                return { category, tone, number };
            }
        }
    }
    return null;
}

/** Which look of its effect `animation` is on one side, null if none. */
function findToneSampleNumber(
    data: CategoryToneDataType,
    animation: AnimationType,
    src: string,
    ground: string,
): number | null {
    if (
        animation.name === 'custom' ||
        !checkHasGround(data, animation.engine, ground)
    ) {
        return null;
    }
    const effect = findCategoryEffect(animation, data);
    if (effect === null) {
        return null;
    }
    const lookIndex = genEffectAnimations(
        data,
        animation.engine,
        animation.name,
        effect.index,
        effect.lookCount,
    ).findIndex((sample) => {
        // The ground first: it rules out most looks at once.
        return (
            sample.colors[0].toUpperCase() === ground &&
            toAnimationSrc(sample) === src
        );
    });
    return lookIndex === -1 ? null : lookIndex + 1;
}

/** The category an animation is a sample of, or null. */
export function findAnimationSampleCategory(
    animation: AnimationType,
): AnimationCategoryType | null {
    return findAnimationSample(animation)?.category ?? null;
}

/** The side of the Dark / Light switch a sample is on; null for any other. */
export function findAnimationTone(src: unknown): ColorModeType | null {
    const animation = parseAnimation(src);
    return animation === null
        ? null
        : (findAnimationSample(animation)?.tone ?? null);
}

/**
 * The side the switch opens on: a sample's own, else the side an animation
 * reads as (`toAnimationReadColor`), else Dark.
 */
export function toInitialAnimationTone(src: unknown): ColorModeType {
    const animation = parseAnimation(src);
    if (animation === null) {
        return 'dark';
    }
    return (
        findAnimationSample(animation)?.tone ??
        (checkIsColorDark(toAnimationReadColor(animation)) ? 'dark' : 'light')
    );
}
