import type { AppColorType } from '../others/color/colorValueHelpers';
import {
    toAnimationSrc,
    type AnimationType,
    type CssAnimationNameType,
    type GlslAnimationNameType,
} from './animationValueHelpers';

/**
 * The samples the Animations tab starts with (2026-11-15, the user: _supply
 * maximum sample for christian worshiping background_): every effect, in
 * the colours of a season or a theme of worship -- Christmas snow, an Easter
 * sunrise, Pentecost flames, living water -- each in its one written form
 * (`toAnimationSrc`), so a tile is lit by a plain comparison. The first
 * colour is the ground. A person recolours any of them (Customize) and
 * keeps the result as a preset.
 */

export const ANIMATION_THEME_LIST = [
    'glory',
    'heaven',
    'holy-spirit',
    'living-water',
    'silent-night',
    'christmas',
    'advent',
    'lent',
    'easter',
    'calvary',
    'grace',
    'peace',
    'joy',
    'majesty',
    'worship',
    'pentecost',
    'hope',
    'praise',
    'baptism',
    'light-of-the-world',
    'morning-light',
    'resurrection',
    'communion',
    'revival',
] as const;
export type AnimationThemeType = (typeof ANIMATION_THEME_LIST)[number];

export type AnimationSampleType = {
    theme: AnimationThemeType;
    animation: AnimationType;
    src: string;
};

function genCss(
    theme: AnimationThemeType,
    name: CssAnimationNameType,
    colors: string[],
): AnimationSampleType {
    const animation: AnimationType = {
        engine: 'css',
        name,
        colors: colors as AppColorType[],
        speed: 'normal',
        density: 'normal',
        opacity: 100,
        blend: 'normal',
    };
    return { theme, animation, src: toAnimationSrc(animation) };
}

function genGlsl(
    theme: AnimationThemeType,
    name: GlslAnimationNameType,
    colors: string[],
): AnimationSampleType {
    const animation: AnimationType = {
        engine: 'glsl',
        name,
        code: null,
        colors: colors as AppColorType[],
        speed: 'normal',
        quality: 'normal',
        opacity: 100,
        blend: 'normal',
    };
    return { theme, animation, src: toAnimationSrc(animation) };
}

export const CSS_ANIMATION_SAMPLE_LIST: AnimationSampleType[] = [
    genCss('glory', 'rays', ['#0C1E3A', '#FDE68A', '#FFFFFF']),
    genCss('heaven', 'clouds', ['#3B6FB6', '#FFFFFF', '#E0F2FE']),
    genCss('holy-spirit', 'embers', [
        '#1F0A05',
        '#F97316',
        '#FACC15',
        '#EF4444',
    ]),
    genCss('living-water', 'waves', [
        '#082F49',
        '#0EA5E9',
        '#38BDF8',
        '#BAE6FD',
    ]),
    genCss('silent-night', 'stars', [
        '#05060F',
        '#FFFFFF',
        '#BFDBFE',
        '#FDE68A',
    ]),
    genCss('christmas', 'snow', ['#052E16', '#FFFFFF', '#DCFCE7']),
    genCss('advent', 'bokeh', ['#2E1065', '#C084FC', '#F9A8D4', '#FDE68A']),
    genCss('lent', 'breathe', ['#1E1B4B', '#6D28D9', '#7C3AED', '#A78BFA']),
    genCss('easter', 'cross', ['#1E1B4B', '#FFFBEB', '#FDE68A', '#F59E0B']),
    genCss('calvary', 'cross', ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D']),
    genCss('grace', 'aurora', ['#0B1026', '#22D3EE', '#8B5CF6', '#10B981']),
    genCss('peace', 'clouds', ['#1E3A5F', '#CBD5E1', '#F1F5F9']),
    genCss('joy', 'bokeh', ['#1A1033', '#F59E0B', '#EC4899', '#FDE68A']),
    genCss('majesty', 'rays', ['#2E1065', '#FACC15', '#FEF08A']),
    genCss('worship', 'breathe', ['#0F172A', '#2563EB', '#7C3AED', '#DB2777']),
    genCss('pentecost', 'embers', ['#450A0A', '#DC2626', '#F97316', '#FDE047']),
    genCss('hope', 'aurora', ['#042F2E', '#2DD4BF', '#86EFAC', '#FDE68A']),
    genCss('praise', 'waves', ['#1E1B4B', '#8B5CF6', '#EC4899', '#F59E0B']),
    genCss('baptism', 'bokeh', ['#0C4A6E', '#7DD3FC', '#E0F2FE', '#FFFFFF']),
    genCss('light-of-the-world', 'cross', [
        '#0B1026',
        '#FFFFFF',
        '#FDE68A',
        '#FEF3C7',
    ]),
    genCss('morning-light', 'rays', ['#1E293B', '#FDBA74', '#FEF3C7']),
    genCss('revival', 'aurora', ['#1C1917', '#F59E0B', '#EF4444', '#FDE68A']),
];

export const GLSL_ANIMATION_SAMPLE_LIST: AnimationSampleType[] = [
    genGlsl('heaven', 'clouds', ['#1D4ED8', '#FFFFFF', '#BFDBFE']),
    genGlsl('holy-spirit', 'flames', [
        '#1C0500',
        '#F97316',
        '#FACC15',
        '#FFFFFF',
    ]),
    genGlsl('pentecost', 'flames', [
        '#2A0A0A',
        '#DC2626',
        '#F97316',
        '#FDE047',
    ]),
    genGlsl('living-water', 'ripples', [
        '#042F49',
        '#0EA5E9',
        '#7DD3FC',
        '#F0F9FF',
    ]),
    genGlsl('baptism', 'ripples', ['#0C4A6E', '#38BDF8', '#E0F2FE']),
    genGlsl('silent-night', 'stars', [
        '#020617',
        '#1E3A8A',
        '#BFDBFE',
        '#FDE68A',
    ]),
    genGlsl('christmas', 'snow', ['#7F1D1D', '#FFFFFF', '#FECACA']),
    genGlsl('easter', 'sunrise', ['#1E1B4B', '#F59E0B', '#FDE68A', '#FFFFFF']),
    genGlsl('resurrection', 'cross', [
        '#0B1026',
        '#FFFFFF',
        '#FDE68A',
        '#F59E0B',
    ]),
    genGlsl('calvary', 'cross', ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D']),
    genGlsl('light-of-the-world', 'rays', ['#111827', '#FDE68A', '#FFFFFF']),
    genGlsl('grace', 'mesh', ['#4C1D95', '#DB2777', '#F59E0B', '#2563EB']),
    genGlsl('peace', 'mesh', ['#0F172A', '#60A5FA', '#C4B5FD', '#99F6E4']),
    genGlsl('joy', 'plasma', ['#0F0A1E', '#7C3AED', '#EC4899', '#F59E0B']),
    genGlsl('worship', 'flow', ['#020617', '#0EA5E9', '#6366F1', '#22D3EE']),
    genGlsl('majesty', 'glass', ['#0B0B0B', '#7C3AED', '#DC2626', '#F59E0B']),
    genGlsl('communion', 'glass', ['#1C1917', '#B91C1C', '#F59E0B', '#1D4ED8']),
    genGlsl('hope', 'aurora', ['#030712', '#34D399', '#22D3EE', '#A78BFA']),
    genGlsl('praise', 'waves', ['#1E1B4B', '#7C3AED', '#EC4899', '#F59E0B']),
    genGlsl('advent', 'stars', ['#1E1033', '#4C1D95', '#E9D5FF', '#FDE68A']),
    genGlsl('morning-light', 'sunrise', [
        '#0C4A6E',
        '#FDBA74',
        '#FEF3C7',
        '#FFFFFF',
    ]),
    genGlsl('glory', 'rays', ['#1C1917', '#F59E0B', '#FEF3C7']),
    genGlsl('lent', 'flow', ['#1E1B4B', '#6D28D9', '#A78BFA', '#4C1D95']),
    genGlsl('revival', 'plasma', ['#1C0A00', '#DC2626', '#F59E0B', '#FDE047']),
];

const sampleThemeMap = new Map<string, AnimationThemeType>(
    [...CSS_ANIMATION_SAMPLE_LIST, ...GLSL_ANIMATION_SAMPLE_LIST].map(
        (sample) => {
            return [sample.src, sample.theme];
        },
    ),
);

/** The theme a written animation is a sample of, if it is one as it is. */
export function findAnimationSampleTheme(
    src: string,
): AnimationThemeType | null {
    return sampleThemeMap.get(src) ?? null;
}
