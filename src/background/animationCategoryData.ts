import type {
    CssAnimationNameType,
    GlslAnimationNameType,
} from './animationValueHelpers';

/**
 * The occasions the Animations tab's samples are sorted by (2026-11-19, the
 * user: _add categroy control. I want to swhich category. e.g. sunday
 * worship, christmas, thanksgiving, resurection day, ..._, _give maximum
 * sample for each category_, _add all possible category_), grouped as the
 * Category list shows them.
 *
 * Constants only, and small: a category's samples are BUILT from it when
 * the picker shows that category (`listAnimationCategorySamples`), never
 * all of them at load -- this module sits in the Presenter's static closure
 * through every label of an animation.
 */

export const ANIMATION_CATEGORY_GROUP_LIST = [
    {
        group: 'services',
        categories: [
            'sunday-worship',
            'worship-night',
            'prayer-meeting',
            'bible-study',
            'youth-service',
            'children-service',
            'revival',
            'evangelism',
            'missions',
        ],
    },
    {
        group: 'church-year',
        categories: [
            'advent',
            'christmas',
            'epiphany',
            'ash-wednesday',
            'lent',
            'palm-sunday',
            'maundy-thursday',
            'good-friday',
            'resurrection-day',
            'ascension-day',
            'pentecost',
            'trinity-sunday',
            'transfiguration',
            'reformation-day',
            'all-saints-day',
            'christ-the-king',
        ],
    },
    {
        group: 'special-services',
        categories: [
            'baptism',
            'communion',
            'wedding',
            'funeral',
            'baby-dedication',
            'confirmation',
            'ordination',
            'church-anniversary',
            'graduation',
            'healing-service',
        ],
    },
    {
        group: 'holidays',
        categories: [
            'new-year',
            'thanksgiving',
            'harvest',
            'mothers-day',
            'fathers-day',
            'national-day',
        ],
    },
    {
        group: 'seasons',
        categories: ['springtime', 'summer', 'autumn', 'winter'],
    },
    {
        group: 'themes',
        categories: [
            'glory',
            'heaven',
            'holy-spirit',
            'living-water',
            'grace',
            'peace',
            'joy',
            'majesty',
            'hope',
            'praise',
            'light-of-the-world',
            'morning-light',
        ],
    },
] as const;

export type AnimationCategoryGroupType =
    (typeof ANIMATION_CATEGORY_GROUP_LIST)[number]['group'];
export type AnimationCategoryType =
    (typeof ANIMATION_CATEGORY_GROUP_LIST)[number]['categories'][number];

export const ANIMATION_CATEGORY_LIST: readonly AnimationCategoryType[] =
    ANIMATION_CATEGORY_GROUP_LIST.flatMap((item) => {
        return item.categories;
    });

export const DEFAULT_ANIMATION_CATEGORY: AnimationCategoryType =
    'sunday-worship';

export type AnimationEffectNameType =
    CssAnimationNameType | GlslAnimationNameType;

export type AnimationCategoryDataType = {
    /** Shown first, in this order: what the occasion is known by. */
    lead: readonly AnimationEffectNameType[];
    /**
     * The Dark side's: 2-4 colours each, the ground first and dark enough
     * for white words; the effects take them in turn.
     */
    palettes: readonly (readonly string[])[];
    /**
     * The Light side's (2026-11-19, the user: _`Animations` of background
     * and foreground should support dark/light mode, keep the pin. all
     * category should have dark/light_), as the Fills tab has one: the
     * ground pale enough for black words, the strongest colour next, so a
     * few falling things still show on it.
     */
    lightPalettes: readonly (readonly string[])[];
    /** Effects that do not suit the occasion. */
    excluded?: readonly AnimationEffectNameType[];
    /**
     * The samples there were before categories (the themes of 2026-11-15),
     * kept exactly as written: saved presets, sessions and run sheets hold
     * them, and keep their names. All of the Dark side.
     */
    css?: Partial<Record<CssAnimationNameType, readonly string[]>>;
    glsl?: Partial<Record<GlslAnimationNameType, readonly string[]>>;
};

// Days of mourning and repentance: nothing that celebrates.
const SOLEMN_EXCLUDED = ['fireworks', 'confetti', 'hearts'] as const;
// Quiet gatherings: no party.
const QUIET_EXCLUDED = ['fireworks', 'confetti'] as const;
// Spring and summer days: no snow.
const WARM_EXCLUDED = ['snow'] as const;

export const ANIMATION_CATEGORY_DATA_MAP: Record<
    AnimationCategoryType,
    AnimationCategoryDataType
> = {
    'sunday-worship': {
        lead: ['breathe', 'flow', 'rays', 'cross', 'aurora'],
        palettes: [
            ['#0F172A', '#3B82F6', '#A78BFA', '#F9A8D4'],
            ['#111827', '#F59E0B', '#FDE68A', '#FFFFFF'],
            ['#0C1A2E', '#38BDF8', '#BAE6FD', '#FDE68A'],
            ['#1E1B4B', '#818CF8', '#C4B5FD', '#FBCFE8'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#2563EB', '#A78BFA', '#F9A8D4'],
            ['#FFFBEB', '#D97706', '#FBBF24', '#FDE68A'],
            ['#F0F9FF', '#0284C7', '#38BDF8', '#FCD34D'],
            ['#EEF2FF', '#4F46E5', '#A5B4FC', '#F9A8D4'],
        ],
        css: { breathe: ['#0F172A', '#2563EB', '#7C3AED', '#DB2777'] },
        glsl: { flow: ['#020617', '#0EA5E9', '#6366F1', '#22D3EE'] },
    },
    'worship-night': {
        lead: ['aurora', 'bokeh', 'plasma', 'candles', 'stars'],
        palettes: [
            ['#0A0A1F', '#7C3AED', '#EC4899', '#22D3EE'],
            ['#050816', '#6366F1', '#A855F7', '#F0ABFC'],
            ['#0B0F1A', '#0EA5E9', '#8B5CF6', '#F472B6'],
            ['#120B1F', '#DB2777', '#F59E0B', '#FDE68A'],
        ],
        lightPalettes: [
            ['#F5F3FF', '#7C3AED', '#EC4899', '#22D3EE'],
            ['#EEF2FF', '#6366F1', '#A855F7', '#F0ABFC'],
            ['#F0F9FF', '#0EA5E9', '#8B5CF6', '#F472B6'],
            ['#FDF2F8', '#DB2777', '#F59E0B', '#FDE68A'],
        ],
    },
    'prayer-meeting': {
        lead: ['candles', 'breathe', 'flow', 'clouds'],
        palettes: [
            ['#0F1729', '#64748B', '#94A3B8', '#E2E8F0'],
            ['#1A1625', '#7C6F9B', '#C4B5FD', '#F5F3FF'],
            ['#0E1A1A', '#2DD4BF', '#99F6E4', '#F0FDFA'],
            ['#1C1408', '#D97706', '#FCD34D', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#475569', '#94A3B8', '#CBD5E1'],
            ['#F5F3FF', '#7C6F9B', '#A78BFA', '#DDD6FE'],
            ['#F0FDFA', '#0D9488', '#5EEAD4', '#99F6E4'],
            ['#FFFBEB', '#B45309', '#F59E0B', '#FCD34D'],
        ],
        excluded: QUIET_EXCLUDED,
    },
    'bible-study': {
        lead: ['candles', 'rays', 'glass', 'clouds'],
        palettes: [
            ['#1C1410', '#B45309', '#FBBF24', '#FEF3C7'],
            ['#0F1B2D', '#3B82F6', '#93C5FD', '#F8FAFC'],
            ['#14201A', '#16A34A', '#86EFAC', '#F0FDF4'],
            ['#1F1A2E', '#8B5CF6', '#DDD6FE', '#FDE68A'],
        ],
        lightPalettes: [
            ['#FFFBEB', '#92400E', '#D97706', '#FCD34D'],
            ['#EFF6FF', '#1D4ED8', '#60A5FA', '#BFDBFE'],
            ['#F0FDF4', '#15803D', '#4ADE80', '#BBF7D0'],
            ['#F5F3FF', '#6D28D9', '#A78BFA', '#FCD34D'],
        ],
        excluded: QUIET_EXCLUDED,
    },
    'youth-service': {
        lead: ['plasma', 'fireworks', 'confetti', 'bokeh', 'aurora'],
        palettes: [
            ['#0B0221', '#F43F5E', '#F59E0B', '#22D3EE'],
            ['#030712', '#22C55E', '#06B6D4', '#A3E635'],
            ['#120321', '#D946EF', '#6366F1', '#2DD4BF'],
            ['#0A0F1F', '#F97316', '#FACC15', '#38BDF8'],
        ],
        lightPalettes: [
            ['#FFF1F2', '#E11D48', '#F59E0B', '#06B6D4'],
            ['#F7FEE7', '#16A34A', '#0891B2', '#84CC16'],
            ['#FDF4FF', '#C026D3', '#6366F1', '#14B8A6'],
            ['#FFF7ED', '#EA580C', '#EAB308', '#0EA5E9'],
        ],
    },
    'children-service': {
        lead: ['confetti', 'bokeh', 'hearts', 'clouds', 'stars'],
        palettes: [
            ['#1E1B4B', '#F472B6', '#FACC15', '#34D399'],
            ['#0C2A4A', '#38BDF8', '#FDE047', '#FB7185'],
            ['#1A2E05', '#84CC16', '#FDE68A', '#60A5FA'],
            ['#2E1065', '#F97316', '#A78BFA', '#FDE047'],
        ],
        lightPalettes: [
            ['#FEFCE8', '#EC4899', '#EAB308', '#10B981'],
            ['#F0F9FF', '#0EA5E9', '#FACC15', '#FB7185'],
            ['#F7FEE7', '#65A30D', '#F59E0B', '#3B82F6'],
            ['#FAF5FF', '#F97316', '#8B5CF6', '#FACC15'],
        ],
    },
    revival: {
        lead: ['embers', 'flames', 'aurora', 'plasma', 'rays'],
        palettes: [
            ['#1A0505', '#EF4444', '#F97316', '#FDE68A'],
            ['#0F0A05', '#F59E0B', '#FB923C', '#FFFFFF'],
            ['#1F0A14', '#E11D48', '#F59E0B', '#FECDD3'],
            ['#120A00', '#EA580C', '#FACC15', '#FEF9C3'],
        ],
        lightPalettes: [
            ['#FEF2F2', '#DC2626', '#F97316', '#FBBF24'],
            ['#FFFBEB', '#D97706', '#FB923C', '#FDE68A'],
            ['#FFF1F2', '#E11D48', '#F59E0B', '#FDA4AF'],
            ['#FFF7ED', '#C2410C', '#EAB308', '#FDE047'],
        ],
        css: { aurora: ['#1C1917', '#F59E0B', '#EF4444', '#FDE68A'] },
        glsl: { plasma: ['#1C0A00', '#DC2626', '#F59E0B', '#FDE047'] },
    },
    evangelism: {
        lead: ['rays', 'sunrise', 'cross', 'aurora'],
        palettes: [
            ['#071A2E', '#0EA5E9', '#FDE68A', '#FFFFFF'],
            ['#0F172A', '#F59E0B', '#38BDF8', '#F8FAFC'],
            ['#0A1F14', '#22C55E', '#FACC15', '#FFFFFF'],
            ['#1E0B2E', '#A855F7', '#F59E0B', '#FDE68A'],
        ],
        lightPalettes: [
            ['#F0F9FF', '#0284C7', '#F59E0B', '#BAE6FD'],
            ['#F8FAFC', '#D97706', '#0EA5E9', '#FDE68A'],
            ['#F0FDF4', '#16A34A', '#EAB308', '#BBF7D0'],
            ['#FAF5FF', '#9333EA', '#F59E0B', '#FDE68A'],
        ],
    },
    missions: {
        lead: ['waves', 'flow', 'aurora', 'stars'],
        palettes: [
            ['#0A1A2F', '#2563EB', '#22C55E', '#FDE68A'],
            ['#102A1E', '#10B981', '#38BDF8', '#F0FDF4'],
            ['#1C1408', '#D97706', '#0EA5E9', '#FEF3C7'],
            ['#0B1220', '#06B6D4', '#84CC16', '#F8FAFC'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#2563EB', '#22C55E', '#FCD34D'],
            ['#ECFDF5', '#059669', '#38BDF8', '#A7F3D0'],
            ['#FFFBEB', '#B45309', '#0EA5E9', '#FDE68A'],
            ['#ECFEFF', '#0891B2', '#84CC16', '#A5F3FC'],
        ],
    },
    advent: {
        lead: ['candles', 'stars', 'bokeh'],
        palettes: [
            ['#1E0B3A', '#7C3AED', '#C4B5FD', '#FDE68A'],
            ['#170A2E', '#A78BFA', '#F9A8D4', '#FEF3C7'],
            ['#0F0A24', '#6D28D9', '#FBCFE8', '#FFFFFF'],
            ['#1A1033', '#8B5CF6', '#F472B6', '#FDE047'],
        ],
        lightPalettes: [
            ['#F5F3FF', '#7C3AED', '#C4B5FD', '#FBBF24'],
            ['#FAF5FF', '#9333EA', '#F9A8D4', '#FCD34D'],
            ['#EDE9FE', '#6D28D9', '#F472B6', '#FDE68A'],
            ['#FDF4FF', '#A855F7', '#EC4899', '#FACC15'],
        ],
        css: { bokeh: ['#2E1065', '#C084FC', '#F9A8D4', '#FDE68A'] },
        glsl: { stars: ['#1E1033', '#4C1D95', '#E9D5FF', '#FDE68A'] },
    },
    christmas: {
        lead: ['snow', 'stars', 'bokeh', 'candles', 'glass'],
        palettes: [
            ['#0B2E1A', '#DC2626', '#FDE68A', '#FFFFFF'],
            ['#3B0A0A', '#F59E0B', '#FFFFFF', '#16A34A'],
            ['#0A1628', '#FDE68A', '#FFFFFF', '#93C5FD'],
            ['#14532D', '#FEF3C7', '#EF4444', '#FACC15'],
        ],
        lightPalettes: [
            ['#F0FDF4', '#DC2626', '#16A34A', '#F59E0B'],
            ['#FEF2F2', '#B91C1C', '#D97706', '#15803D'],
            ['#F0F9FF', '#1D4ED8', '#93C5FD', '#FBBF24'],
            ['#FFFBEB', '#15803D', '#EF4444', '#EAB308'],
        ],
        css: {
            stars: ['#05060F', '#FFFFFF', '#BFDBFE', '#FDE68A'],
            snow: ['#052E16', '#FFFFFF', '#DCFCE7'],
        },
        glsl: {
            stars: ['#020617', '#1E3A8A', '#BFDBFE', '#FDE68A'],
            snow: ['#7F1D1D', '#FFFFFF', '#FECACA'],
        },
    },
    epiphany: {
        lead: ['stars', 'rays', 'glass'],
        palettes: [
            ['#0B1026', '#FACC15', '#FEF3C7', '#FFFFFF'],
            ['#1E1B4B', '#F59E0B', '#C4B5FD', '#FFFFFF'],
            ['#0A0F2C', '#FDE68A', '#60A5FA', '#E0F2FE'],
            ['#1A0F2E', '#EAB308', '#A855F7', '#FEF9C3'],
        ],
        lightPalettes: [
            ['#FEFCE8', '#CA8A04', '#FACC15', '#FEF08A'],
            ['#EEF2FF', '#D97706', '#818CF8', '#FCD34D'],
            ['#EFF6FF', '#B45309', '#60A5FA', '#FDE68A'],
            ['#FAF5FF', '#A16207', '#A855F7', '#FDE047'],
        ],
    },
    'ash-wednesday': {
        lead: ['cross', 'breathe', 'clouds'],
        palettes: [
            ['#111111', '#6B7280', '#A1A1AA', '#E5E7EB'],
            ['#1C1917', '#78716C', '#A8A29E', '#E7E5E4'],
            ['#18122B', '#6D28D9', '#9CA3AF', '#E5E7EB'],
            ['#0F0F14', '#52525B', '#7C3AED', '#D4D4D8'],
        ],
        lightPalettes: [
            ['#F4F4F5', '#52525B', '#A1A1AA', '#D4D4D8'],
            ['#F5F5F4', '#57534E', '#A8A29E', '#D6D3D1'],
            ['#F5F3FF', '#6D28D9', '#9CA3AF', '#D1D5DB'],
            ['#FAFAFA', '#3F3F46', '#7C3AED', '#D4D4D8'],
        ],
        excluded: SOLEMN_EXCLUDED,
    },
    lent: {
        lead: ['breathe', 'flow', 'cross', 'candles'],
        palettes: [
            ['#1A0B2E', '#7E22CE', '#C084FC', '#E9D5FF'],
            ['#120A1F', '#5B21B6', '#A78BFA', '#D4D4D8'],
            ['#1C1430', '#6B21A8', '#9CA3AF', '#F3E8FF'],
            ['#0F0A1A', '#4C1D95', '#8B5CF6', '#DDD6FE'],
        ],
        lightPalettes: [
            ['#FAF5FF', '#7E22CE', '#C084FC', '#E9D5FF'],
            ['#F5F3FF', '#5B21B6', '#A78BFA', '#D4D4D8'],
            ['#F3E8FF', '#6B21A8', '#9CA3AF', '#D8B4FE'],
            ['#EDE9FE', '#4C1D95', '#8B5CF6', '#C4B5FD'],
        ],
        excluded: SOLEMN_EXCLUDED,
        css: { breathe: ['#1E1B4B', '#6D28D9', '#7C3AED', '#A78BFA'] },
        glsl: { flow: ['#1E1B4B', '#6D28D9', '#A78BFA', '#4C1D95'] },
    },
    'palm-sunday': {
        lead: ['leaves', 'rays', 'sunrise', 'cross'],
        palettes: [
            ['#052E16', '#22C55E', '#BEF264', '#FDE68A'],
            ['#0F2A1A', '#16A34A', '#7C3AED', '#F0FDF4'],
            ['#1A2E05', '#65A30D', '#FACC15', '#FFFFFF'],
            ['#0B1F14', '#10B981', '#A78BFA', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#F0FDF4', '#16A34A', '#84CC16', '#FACC15'],
            ['#ECFDF5', '#15803D', '#7C3AED', '#BBF7D0'],
            ['#F7FEE7', '#4D7C0F', '#EAB308', '#BEF264'],
            ['#F0FDFA', '#059669', '#A78BFA', '#FDE68A'],
        ],
        excluded: WARM_EXCLUDED,
    },
    'maundy-thursday': {
        lead: ['candles', 'glass', 'cross'],
        palettes: [
            ['#1A0A0A', '#991B1B', '#D97706', '#FEF3C7'],
            ['#120A14', '#7F1D1D', '#A78BFA', '#F5F5F4'],
            ['#1C1410', '#B45309', '#7F1D1D', '#FDE68A'],
            ['#0F0A0F', '#881337', '#E7E5E4', '#FCD34D'],
        ],
        lightPalettes: [
            ['#FEF2F2', '#991B1B', '#D97706', '#FDE68A'],
            ['#FAF5FF', '#7F1D1D', '#A78BFA', '#E7E5E4'],
            ['#FFFBEB', '#B45309', '#991B1B', '#FCD34D'],
            ['#FFF1F2', '#881337', '#A8A29E', '#FBBF24'],
        ],
        excluded: SOLEMN_EXCLUDED,
    },
    'good-friday': {
        lead: ['cross', 'clouds', 'candles'],
        palettes: [
            ['#0A0A0A', '#991B1B', '#525252', '#D4D4D4'],
            ['#120505', '#7F1D1D', '#A3A3A3', '#F5F5F5'],
            ['#0C0A12', '#4C1D95', '#991B1B', '#D6D3D1'],
            ['#100808', '#B91C1C', '#57534E', '#E7E5E4'],
        ],
        lightPalettes: [
            ['#FAFAFA', '#991B1B', '#525252', '#D4D4D4'],
            ['#FEF2F2', '#7F1D1D', '#A3A3A3', '#E5E5E5'],
            ['#F5F3FF', '#4C1D95', '#991B1B', '#D6D3D1'],
            ['#F5F5F4', '#B91C1C', '#57534E', '#D6D3D1'],
        ],
        excluded: SOLEMN_EXCLUDED,
        css: { cross: ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D'] },
        glsl: { cross: ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D'] },
    },
    'resurrection-day': {
        lead: ['sunrise', 'cross', 'rays', 'petals'],
        palettes: [
            ['#1E1B4B', '#FDE68A', '#FFFFFF', '#F472B6'],
            ['#0C2340', '#F59E0B', '#FEF3C7', '#86EFAC'],
            ['#2E1065', '#FACC15', '#FFFBEB', '#C4B5FD'],
            ['#0F172A', '#FB923C', '#FDE68A', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FFFBEB', '#F59E0B', '#F472B6', '#FDE68A'],
            ['#F0F9FF', '#D97706', '#86EFAC', '#FCD34D'],
            ['#FAF5FF', '#CA8A04', '#C4B5FD', '#FEF08A'],
            ['#FFF7ED', '#EA580C', '#FBBF24', '#FDBA74'],
        ],
        excluded: WARM_EXCLUDED,
        css: { cross: ['#1E1B4B', '#FFFBEB', '#FDE68A', '#F59E0B'] },
        glsl: {
            sunrise: ['#1E1B4B', '#F59E0B', '#FDE68A', '#FFFFFF'],
            cross: ['#0B1026', '#FFFFFF', '#FDE68A', '#F59E0B'],
        },
    },
    'ascension-day': {
        lead: ['clouds', 'rays', 'sunrise'],
        palettes: [
            ['#0C2A4A', '#FFFFFF', '#BAE6FD', '#FDE68A'],
            ['#1E3A8A', '#E0F2FE', '#FEF3C7', '#FFFFFF'],
            ['#0B1A33', '#93C5FD', '#FDE68A', '#F8FAFC'],
            ['#172554', '#60A5FA', '#FFFFFF', '#FACC15'],
        ],
        lightPalettes: [
            ['#F0F9FF', '#0284C7', '#7DD3FC', '#FDE68A'],
            ['#EFF6FF', '#1D4ED8', '#BFDBFE', '#FCD34D'],
            ['#F8FAFC', '#3B82F6', '#FBBF24', '#BAE6FD'],
            ['#E0F2FE', '#2563EB', '#FFFFFF', '#FACC15'],
        ],
        excluded: WARM_EXCLUDED,
    },
    pentecost: {
        lead: ['flames', 'embers', 'aurora'],
        palettes: [
            ['#2A0505', '#EF4444', '#FB923C', '#FEF08A'],
            ['#1C0A00', '#F97316', '#FACC15', '#FFFFFF'],
            ['#3F0A0A', '#DC2626', '#FDBA74', '#FEF3C7'],
            ['#1A0505', '#E11D48', '#F59E0B', '#FDE047'],
        ],
        lightPalettes: [
            ['#FEF2F2', '#DC2626', '#F97316', '#FACC15'],
            ['#FFF7ED', '#EA580C', '#FBBF24', '#FDE047'],
            ['#FFF1F2', '#B91C1C', '#FB923C', '#FDE68A'],
            ['#FEFCE8', '#E11D48', '#F59E0B', '#FDBA74'],
        ],
        excluded: WARM_EXCLUDED,
        css: { embers: ['#450A0A', '#DC2626', '#F97316', '#FDE047'] },
        glsl: { flames: ['#2A0A0A', '#DC2626', '#F97316', '#FDE047'] },
    },
    'trinity-sunday': {
        lead: ['glass', 'mesh', 'aurora', 'rays'],
        palettes: [
            ['#052E16', '#22C55E', '#FFFFFF', '#FDE68A'],
            ['#0B1026', '#3B82F6', '#FDE68A', '#FFFFFF'],
            ['#1E1B4B', '#F59E0B', '#22D3EE', '#F9A8D4'],
            ['#0F1F17', '#10B981', '#93C5FD', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#F0FDF4', '#15803D', '#EAB308', '#93C5FD'],
            ['#EFF6FF', '#2563EB', '#F59E0B', '#BFDBFE'],
            ['#FFFBEB', '#D97706', '#06B6D4', '#F9A8D4'],
            ['#ECFDF5', '#059669', '#60A5FA', '#FDE68A'],
        ],
    },
    transfiguration: {
        lead: ['rays', 'glass', 'clouds'],
        palettes: [
            ['#0B1026', '#FFFFFF', '#FEF9C3', '#BAE6FD'],
            ['#1C1917', '#FFFBEB', '#FCD34D', '#FFFFFF'],
            ['#111827', '#E0F2FE', '#FFFFFF', '#FDE68A'],
            ['#1E1B4B', '#F8FAFC', '#C4B5FD', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#FFFFFF', '#CA8A04', '#FDE047', '#BAE6FD'],
            ['#FFFBEB', '#B45309', '#FCD34D', '#FEF3C7'],
            ['#F8FAFC', '#0284C7', '#FDE68A', '#E0F2FE'],
            ['#F5F3FF', '#A16207', '#C4B5FD', '#FEF9C3'],
        ],
    },
    'reformation-day': {
        lead: ['glass', 'flames', 'cross', 'embers'],
        palettes: [
            ['#2A0505', '#DC2626', '#F87171', '#FFFFFF'],
            ['#1C1410', '#B91C1C', '#FBBF24', '#FEF3C7'],
            ['#0F0A0A', '#991B1B', '#E5E7EB', '#F59E0B'],
            ['#1A0A10', '#E11D48', '#FDE68A', '#F5F5F4'],
        ],
        lightPalettes: [
            ['#FEF2F2', '#DC2626', '#F87171', '#FECACA'],
            ['#FFFBEB', '#B91C1C', '#F59E0B', '#FDE68A'],
            ['#FAFAF9', '#991B1B', '#9CA3AF', '#F59E0B'],
            ['#FFF1F2', '#E11D48', '#EAB308', '#E7E5E4'],
        ],
    },
    'all-saints-day': {
        lead: ['candles', 'stars', 'glass'],
        palettes: [
            ['#0B1026', '#FFFFFF', '#FDE68A', '#E0E7FF'],
            ['#1C1917', '#FCD34D', '#FFFBEB', '#C4B5FD'],
            ['#111827', '#F8FAFC', '#FBBF24', '#A5B4FC'],
            ['#0F0A1F', '#E9D5FF', '#FDE68A', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#CA8A04', '#A5B4FC', '#FDE68A'],
            ['#FFFBEB', '#D97706', '#C4B5FD', '#FEF3C7'],
            ['#EEF2FF', '#4F46E5', '#FBBF24', '#E0E7FF'],
            ['#FAF5FF', '#9333EA', '#FCD34D', '#E9D5FF'],
        ],
        excluded: QUIET_EXCLUDED,
    },
    'christ-the-king': {
        lead: ['rays', 'glass', 'cross', 'stars'],
        palettes: [
            ['#1E0B3A', '#FACC15', '#FEF08A', '#FFFFFF'],
            ['#120A24', '#EAB308', '#A855F7', '#FEF3C7'],
            ['#2E1065', '#F59E0B', '#FDE68A', '#E9D5FF'],
            ['#0B0B1A', '#CA8A04', '#FDE047', '#C4B5FD'],
        ],
        lightPalettes: [
            ['#FEFCE8', '#A16207', '#EAB308', '#FDE047'],
            ['#FAF5FF', '#CA8A04', '#A855F7', '#FEF3C7'],
            ['#F5F3FF', '#7E22CE', '#F59E0B', '#FDE68A'],
            ['#FFFBEB', '#B45309', '#8B5CF6', '#FDE047'],
        ],
    },
    baptism: {
        lead: ['ripples', 'waves', 'bokeh', 'clouds'],
        palettes: [
            ['#082F49', '#38BDF8', '#BAE6FD', '#FFFFFF'],
            ['#0C2A3E', '#22D3EE', '#A5F3FC', '#F0F9FF'],
            ['#0B1F3A', '#60A5FA', '#E0F2FE', '#FDE68A'],
            ['#062A30', '#2DD4BF', '#CCFBF1', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#F0F9FF', '#0284C7', '#38BDF8', '#BAE6FD'],
            ['#ECFEFF', '#0891B2', '#22D3EE', '#A5F3FC'],
            ['#EFF6FF', '#2563EB', '#93C5FD', '#FDE68A'],
            ['#F0FDFA', '#0D9488', '#2DD4BF', '#CCFBF1'],
        ],
        css: { bokeh: ['#0C4A6E', '#7DD3FC', '#E0F2FE', '#FFFFFF'] },
        glsl: { ripples: ['#0C4A6E', '#38BDF8', '#E0F2FE'] },
    },
    communion: {
        lead: ['glass', 'candles', 'cross', 'breathe'],
        palettes: [
            ['#1C0A0A', '#991B1B', '#F59E0B', '#FEF3C7'],
            ['#120A0F', '#7F1D1D', '#D97706', '#FDE68A'],
            ['#1A1410', '#B45309', '#9F1239', '#F5F5F4'],
            ['#0F0A14', '#881337', '#FBBF24', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FFF1F2', '#9F1239', '#D97706', '#FDE68A'],
            ['#FFFBEB', '#7F1D1D', '#B45309', '#FCD34D'],
            ['#FAFAF9', '#B45309', '#9F1239', '#E7E5E4'],
            ['#FDF2F8', '#881337', '#F59E0B', '#FBCFE8'],
        ],
        excluded: QUIET_EXCLUDED,
        glsl: { glass: ['#1C1917', '#B91C1C', '#F59E0B', '#1D4ED8'] },
    },
    wedding: {
        lead: ['hearts', 'petals', 'bokeh', 'candles'],
        palettes: [
            ['#2A1A24', '#FBCFE8', '#FFFFFF', '#FDE68A'],
            ['#1F1A2E', '#F9A8D4', '#FEF3C7', '#FFFFFF'],
            ['#2E1A1A', '#FDA4AF', '#FFE4E6', '#FCD34D'],
            ['#1C1B2E', '#E9D5FF', '#FBCFE8', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FDF2F8', '#EC4899', '#FBCFE8', '#FCD34D'],
            ['#FAF5FF', '#DB2777', '#F9A8D4', '#FDE68A'],
            ['#FFF1F2', '#F43F5E', '#FDA4AF', '#FBBF24'],
            ['#F5F3FF', '#A855F7', '#F9A8D4', '#FECDD3'],
        ],
    },
    funeral: {
        lead: ['candles', 'clouds', 'stars', 'breathe'],
        palettes: [
            ['#0F1218', '#94A3B8', '#E2E8F0', '#FDE68A'],
            ['#14121A', '#A78BFA', '#E5E7EB', '#FFFFFF'],
            ['#101418', '#64748B', '#F1F5F9', '#FCD34D'],
            ['#0C0F1A', '#818CF8', '#C7D2FE', '#F8FAFC'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#64748B', '#CBD5E1', '#FCD34D'],
            ['#F5F3FF', '#8B5CF6', '#D1D5DB', '#E9D5FF'],
            ['#F1F5F9', '#475569', '#94A3B8', '#FDE68A'],
            ['#EEF2FF', '#6366F1', '#A5B4FC', '#E0E7FF'],
        ],
        excluded: SOLEMN_EXCLUDED,
    },
    'baby-dedication': {
        lead: ['clouds', 'bokeh', 'hearts', 'stars'],
        palettes: [
            ['#1E2A3E', '#93C5FD', '#FBCFE8', '#FFFFFF'],
            ['#1F2937', '#FDE68A', '#BAE6FD', '#FFFFFF'],
            ['#2A1F2E', '#F9A8D4', '#BFDBFE', '#FEF3C7'],
            ['#132A2A', '#99F6E4', '#FDE68A', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#60A5FA', '#F9A8D4', '#FDE68A'],
            ['#FFFBEB', '#F59E0B', '#7DD3FC', '#FBCFE8'],
            ['#FDF2F8', '#F472B6', '#93C5FD', '#FEF08A'],
            ['#F0FDFA', '#2DD4BF', '#FCD34D', '#BAE6FD'],
        ],
    },
    confirmation: {
        lead: ['flames', 'embers', 'rays', 'cross'],
        palettes: [
            ['#0B1026', '#FFFFFF', '#FCA5A5', '#FDE68A'],
            ['#1A0A0A', '#EF4444', '#FFFFFF', '#FDE68A'],
            ['#0F172A', '#F8FAFC', '#F97316', '#BAE6FD'],
            ['#1E1B4B', '#FEF3C7', '#DC2626', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#DC2626', '#FCA5A5', '#FDE68A'],
            ['#FEF2F2', '#EF4444', '#F59E0B', '#FECACA'],
            ['#F0F9FF', '#F97316', '#7DD3FC', '#FDE68A'],
            ['#FFFBEB', '#DC2626', '#FBBF24', '#E0E7FF'],
        ],
    },
    ordination: {
        lead: ['rays', 'flames', 'cross', 'glass'],
        palettes: [
            ['#1A0505', '#DC2626', '#FFFFFF', '#FACC15'],
            ['#0B1026', '#FDE68A', '#FFFFFF', '#E11D48'],
            ['#1C1410', '#F59E0B', '#FEF3C7', '#B91C1C'],
            ['#120A1F', '#FBBF24', '#F8FAFC', '#7C3AED'],
        ],
        lightPalettes: [
            ['#FEF2F2', '#B91C1C', '#EAB308', '#FDE68A'],
            ['#FFFBEB', '#E11D48', '#F59E0B', '#FEF3C7'],
            ['#FFF7ED', '#B45309', '#DC2626', '#FED7AA'],
            ['#F5F3FF', '#7C3AED', '#FBBF24', '#DDD6FE'],
        ],
    },
    'church-anniversary': {
        lead: ['fireworks', 'confetti', 'bokeh', 'rays'],
        palettes: [
            ['#1C1408', '#F59E0B', '#FDE68A', '#FFFFFF'],
            ['#0F172A', '#FBBF24', '#60A5FA', '#F8FAFC'],
            ['#1E0B2E', '#EAB308', '#F472B6', '#FEF3C7'],
            ['#0A1F1A', '#FACC15', '#34D399', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FFFBEB', '#CA8A04', '#F59E0B', '#FDE68A'],
            ['#EFF6FF', '#CA8A04', '#3B82F6', '#BFDBFE'],
            ['#FDF2F8', '#EAB308', '#EC4899', '#FEF3C7'],
            ['#ECFDF5', '#CA8A04', '#10B981', '#FDE047'],
        ],
    },
    graduation: {
        lead: ['confetti', 'fireworks', 'stars', 'rays'],
        palettes: [
            ['#0B1730', '#FACC15', '#FFFFFF', '#3B82F6'],
            ['#111111', '#F59E0B', '#F8FAFC', '#DC2626'],
            ['#1E1B4B', '#FDE047', '#A5B4FC', '#FFFFFF'],
            ['#052E16', '#FBBF24', '#86EFAC', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#1E40AF', '#EAB308', '#93C5FD'],
            ['#FAFAFA', '#DC2626', '#F59E0B', '#D4D4D8'],
            ['#EEF2FF', '#4338CA', '#FACC15', '#C7D2FE'],
            ['#F0FDF4', '#15803D', '#FBBF24', '#86EFAC'],
        ],
        excluded: WARM_EXCLUDED,
    },
    'healing-service': {
        lead: ['flow', 'breathe', 'ripples', 'rays'],
        palettes: [
            ['#062A26', '#2DD4BF', '#A7F3D0', '#FFFFFF'],
            ['#0B1F33', '#7DD3FC', '#BBF7D0', '#F8FAFC'],
            ['#132A1A', '#4ADE80', '#FEF3C7', '#FFFFFF'],
            ['#0F1A2E', '#A5B4FC', '#99F6E4', '#FDE68A'],
        ],
        lightPalettes: [
            ['#F0FDFA', '#0D9488', '#5EEAD4', '#A7F3D0'],
            ['#F0F9FF', '#0284C7', '#86EFAC', '#BAE6FD'],
            ['#F0FDF4', '#16A34A', '#FCD34D', '#BBF7D0'],
            ['#EEF2FF', '#6366F1', '#5EEAD4', '#FDE68A'],
        ],
        excluded: QUIET_EXCLUDED,
    },
    'new-year': {
        lead: ['fireworks', 'confetti', 'stars', 'bokeh'],
        palettes: [
            ['#05060F', '#FACC15', '#F8FAFC', '#E11D48'],
            ['#0B0B1F', '#22D3EE', '#F472B6', '#FDE047'],
            ['#0A0A14', '#CBD5E1', '#FBBF24', '#A855F7'],
            ['#020617', '#38BDF8', '#FDE68A', '#FB7185'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#CA8A04', '#E11D48', '#94A3B8'],
            ['#F0F9FF', '#0891B2', '#EC4899', '#FACC15'],
            ['#FAFAFA', '#A855F7', '#F59E0B', '#94A3B8'],
            ['#FFF1F2', '#0284C7', '#F43F5E', '#FCD34D'],
        ],
    },
    thanksgiving: {
        lead: ['leaves', 'candles', 'sunrise', 'embers'],
        palettes: [
            ['#1C0F05', '#EA580C', '#F59E0B', '#FDE68A'],
            ['#1A1005', '#B45309', '#DC2626', '#FCD34D'],
            ['#140F05', '#C2410C', '#FBBF24', '#FEF3C7'],
            ['#1F1209', '#D97706', '#991B1B', '#FDBA74'],
        ],
        lightPalettes: [
            ['#FFF7ED', '#EA580C', '#F59E0B', '#FCD34D'],
            ['#FFFBEB', '#B45309', '#DC2626', '#FBBF24'],
            ['#FEFCE8', '#C2410C', '#EAB308', '#FDBA74'],
            ['#FEF2F2', '#D97706', '#991B1B', '#FDBA74'],
        ],
    },
    harvest: {
        lead: ['leaves', 'sunrise', 'rays', 'waves'],
        palettes: [
            ['#1A1505', '#CA8A04', '#FACC15', '#FEF9C3'],
            ['#14200A', '#65A30D', '#EAB308', '#FDE68A'],
            ['#1F1408', '#D97706', '#84CC16', '#FEF3C7'],
            ['#18100A', '#B45309', '#F59E0B', '#BEF264'],
        ],
        lightPalettes: [
            ['#FEFCE8', '#A16207', '#EAB308', '#D9F99D'],
            ['#F7FEE7', '#65A30D', '#EAB308', '#FDE68A'],
            ['#FFFBEB', '#D97706', '#84CC16', '#FED7AA'],
            ['#FFF7ED', '#B45309', '#F59E0B', '#BEF264'],
        ],
        excluded: WARM_EXCLUDED,
    },
    'mothers-day': {
        lead: ['petals', 'hearts', 'bokeh'],
        palettes: [
            ['#2A0F1F', '#F472B6', '#FBCFE8', '#FFFFFF'],
            ['#1F0F24', '#E879F9', '#F9A8D4', '#FEF3C7'],
            ['#2A1418', '#FB7185', '#FECDD3', '#FDE68A'],
            ['#1A1028', '#C084FC', '#FBCFE8', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FDF2F8', '#DB2777', '#F472B6', '#FBCFE8'],
            ['#FDF4FF', '#C026D3', '#F0ABFC', '#FDE68A'],
            ['#FFF1F2', '#E11D48', '#FDA4AF', '#FCD34D'],
            ['#FAF5FF', '#9333EA', '#F9A8D4', '#E9D5FF'],
        ],
        excluded: WARM_EXCLUDED,
    },
    'fathers-day': {
        lead: ['rays', 'stars', 'waves', 'clouds'],
        palettes: [
            ['#0B1A2E', '#3B82F6', '#93C5FD', '#F8FAFC'],
            ['#111827', '#0EA5E9', '#F59E0B', '#E5E7EB'],
            ['#0F1F2A', '#14B8A6', '#7DD3FC', '#FFFFFF'],
            ['#1A1A1A', '#60A5FA', '#FBBF24', '#F1F5F9'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#1D4ED8', '#60A5FA', '#E2E8F0'],
            ['#F8FAFC', '#0284C7', '#F59E0B', '#CBD5E1'],
            ['#F0FDFA', '#0F766E', '#7DD3FC', '#CCFBF1'],
            ['#F1F5F9', '#2563EB', '#FBBF24', '#94A3B8'],
        ],
        excluded: WARM_EXCLUDED,
    },
    'national-day': {
        lead: ['fireworks', 'confetti', 'rays'],
        palettes: [
            ['#0A1530', '#EF4444', '#FFFFFF', '#3B82F6'],
            ['#071F14', '#16A34A', '#FFFFFF', '#FACC15'],
            ['#1A0505', '#DC2626', '#FDE047', '#FFFFFF'],
            ['#0B0F1F', '#2563EB', '#F43F5E', '#F8FAFC'],
        ],
        lightPalettes: [
            ['#F8FAFC', '#DC2626', '#2563EB', '#CBD5E1'],
            ['#F0FDF4', '#15803D', '#EAB308', '#BBF7D0'],
            ['#FEF2F2', '#B91C1C', '#FACC15', '#FECACA'],
            ['#EFF6FF', '#1D4ED8', '#E11D48', '#BFDBFE'],
        ],
    },
    springtime: {
        lead: ['petals', 'clouds', 'sunrise', 'bokeh'],
        palettes: [
            ['#0F2A1A', '#86EFAC', '#F9A8D4', '#FEF9C3'],
            ['#1A2E1A', '#A3E635', '#FBCFE8', '#FFFFFF'],
            ['#132A2E', '#5EEAD4', '#FDE68A', '#F9A8D4'],
            ['#1E1B3A', '#C4B5FD', '#86EFAC', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#F0FDF4', '#22C55E', '#F472B6', '#FDE047'],
            ['#F7FEE7', '#65A30D', '#F9A8D4', '#D9F99D'],
            ['#F0FDFA', '#14B8A6', '#FBBF24', '#FBCFE8'],
            ['#F5F3FF', '#8B5CF6', '#4ADE80', '#FDE68A'],
        ],
        excluded: WARM_EXCLUDED,
    },
    summer: {
        lead: ['sunrise', 'waves', 'rays', 'ripples'],
        palettes: [
            ['#082F49', '#FACC15', '#38BDF8', '#FFFFFF'],
            ['#0C1A3A', '#F97316', '#FDE047', '#22D3EE'],
            ['#062A30', '#2DD4BF', '#FDE68A', '#FB923C'],
            ['#1A1205', '#F59E0B', '#FEF08A', '#0EA5E9'],
        ],
        lightPalettes: [
            ['#F0F9FF', '#0EA5E9', '#FACC15', '#7DD3FC'],
            ['#FFF7ED', '#F97316', '#FDE047', '#22D3EE'],
            ['#F0FDFA', '#14B8A6', '#FB923C', '#FDE68A'],
            ['#FEFCE8', '#EAB308', '#0EA5E9', '#FDBA74'],
        ],
        excluded: WARM_EXCLUDED,
    },
    autumn: {
        lead: ['leaves', 'embers', 'sunrise'],
        palettes: [
            ['#1F0F05', '#EA580C', '#FBBF24', '#B91C1C'],
            ['#1A1208', '#D97706', '#F97316', '#FDE68A'],
            ['#170C08', '#C2410C', '#EAB308', '#FED7AA'],
            ['#1C1410', '#9A3412', '#FACC15', '#FB923C'],
        ],
        lightPalettes: [
            ['#FFF7ED', '#C2410C', '#EAB308', '#DC2626'],
            ['#FFFBEB', '#D97706', '#F97316', '#FDE68A'],
            ['#FEF2F2', '#9A3412', '#EAB308', '#FDBA74'],
            ['#FAFAF9', '#B45309', '#FACC15', '#FB923C'],
        ],
    },
    winter: {
        lead: ['snow', 'stars', 'clouds', 'candles'],
        palettes: [
            ['#0B1A2E', '#FFFFFF', '#BAE6FD', '#93C5FD'],
            ['#0F172A', '#E0F2FE', '#C7D2FE', '#FFFFFF'],
            ['#111827', '#F1F5F9', '#7DD3FC', '#E0E7FF'],
            ['#0C1426', '#CBD5E1', '#FFFFFF', '#A5F3FC'],
        ],
        lightPalettes: [
            ['#F0F9FF', '#0369A1', '#7DD3FC', '#BAE6FD'],
            ['#F8FAFC', '#475569', '#93C5FD', '#E0E7FF'],
            ['#EFF6FF', '#1D4ED8', '#A5B4FC', '#DBEAFE'],
            ['#ECFEFF', '#0E7490', '#94A3B8', '#A5F3FC'],
        ],
        excluded: ['petals', 'leaves'],
    },
    glory: {
        lead: ['rays', 'glass', 'cross'],
        palettes: [
            ['#0F0A05', '#FBBF24', '#FEF3C7', '#FFFFFF'],
            ['#1C1408', '#F59E0B', '#FDE047', '#FFFBEB'],
            ['#0B1026', '#EAB308', '#FEF9C3', '#F8FAFC'],
            ['#1A1033', '#FCD34D', '#FFFFFF', '#E9D5FF'],
        ],
        lightPalettes: [
            ['#FFFBEB', '#B45309', '#FBBF24', '#FEF3C7'],
            ['#FEFCE8', '#CA8A04', '#F59E0B', '#FEF08A'],
            ['#F8FAFC', '#A16207', '#FDE047', '#FEF9C3'],
            ['#FAF5FF', '#D97706', '#FCD34D', '#E9D5FF'],
        ],
        css: { rays: ['#0C1E3A', '#FDE68A', '#FFFFFF'] },
        glsl: { rays: ['#1C1917', '#F59E0B', '#FEF3C7'] },
    },
    heaven: {
        lead: ['clouds', 'rays', 'stars'],
        palettes: [
            ['#1E3A6E', '#FFFFFF', '#BFDBFE', '#FDE68A'],
            ['#0C2A4A', '#E0F2FE', '#FFFFFF', '#FEF3C7'],
            ['#172554', '#DBEAFE', '#FDE68A', '#FFFFFF'],
            ['#1E2B4F', '#F8FAFC', '#C7D2FE', '#FEF9C3'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#3B82F6', '#BFDBFE', '#FDE68A'],
            ['#F0F9FF', '#0EA5E9', '#E0F2FE', '#FCD34D'],
            ['#F8FAFC', '#60A5FA', '#FBBF24', '#DBEAFE'],
            ['#EEF2FF', '#818CF8', '#FDE047', '#E0E7FF'],
        ],
        css: { clouds: ['#3B6FB6', '#FFFFFF', '#E0F2FE'] },
        glsl: { clouds: ['#1D4ED8', '#FFFFFF', '#BFDBFE'] },
    },
    'holy-spirit': {
        lead: ['flames', 'embers', 'flow'],
        palettes: [
            ['#1A0A05', '#FB923C', '#FDE047', '#FFFFFF'],
            ['#0B1026', '#F8FAFC', '#FDE68A', '#F97316'],
            ['#1F0505', '#F87171', '#FBBF24', '#FEF3C7'],
            ['#120A00', '#EA580C', '#FEF08A', '#FDBA74'],
        ],
        lightPalettes: [
            ['#FFF7ED', '#F97316', '#FACC15', '#FED7AA'],
            ['#F8FAFC', '#EA580C', '#FDE047', '#FDBA74'],
            ['#FEF2F2', '#EF4444', '#FBBF24', '#FECACA'],
            ['#FEFCE8', '#C2410C', '#F59E0B', '#FEF08A'],
        ],
        css: { embers: ['#1F0A05', '#F97316', '#FACC15', '#EF4444'] },
        glsl: { flames: ['#1C0500', '#F97316', '#FACC15', '#FFFFFF'] },
    },
    'living-water': {
        lead: ['waves', 'ripples', 'flow'],
        palettes: [
            ['#06283D', '#06B6D4', '#67E8F9', '#ECFEFF'],
            ['#0B2545', '#3B82F6', '#7DD3FC', '#F0F9FF'],
            ['#042F2E', '#14B8A6', '#5EEAD4', '#F0FDFA'],
            ['#0A1F3A', '#0284C7', '#A5F3FC', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#ECFEFF', '#0E7490', '#06B6D4', '#67E8F9'],
            ['#EFF6FF', '#2563EB', '#38BDF8', '#BAE6FD'],
            ['#F0FDFA', '#0F766E', '#14B8A6', '#99F6E4'],
            ['#F0F9FF', '#0369A1', '#0EA5E9', '#A5F3FC'],
        ],
        css: { waves: ['#082F49', '#0EA5E9', '#38BDF8', '#BAE6FD'] },
        glsl: { ripples: ['#042F49', '#0EA5E9', '#7DD3FC', '#F0F9FF'] },
    },
    grace: {
        lead: ['aurora', 'mesh', 'breathe'],
        palettes: [
            ['#0F0B26', '#A78BFA', '#F9A8D4', '#99F6E4'],
            ['#1A1033', '#C084FC', '#67E8F9', '#FDE68A'],
            ['#0B1A2E', '#818CF8', '#5EEAD4', '#FBCFE8'],
            ['#1E1235', '#E879F9', '#A5B4FC', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#F5F3FF', '#8B5CF6', '#F472B6', '#5EEAD4'],
            ['#FAF5FF', '#A855F7', '#22D3EE', '#FDE68A'],
            ['#EEF2FF', '#6366F1', '#2DD4BF', '#FBCFE8'],
            ['#FDF4FF', '#D946EF', '#818CF8', '#FEF3C7'],
        ],
        css: { aurora: ['#0B1026', '#22D3EE', '#8B5CF6', '#10B981'] },
        glsl: { mesh: ['#4C1D95', '#DB2777', '#F59E0B', '#2563EB'] },
    },
    peace: {
        lead: ['clouds', 'mesh', 'breathe'],
        palettes: [
            ['#13283F', '#93C5FD', '#E0E7FF', '#F8FAFC'],
            ['#102A2A', '#99F6E4', '#E0F2FE', '#FFFFFF'],
            ['#1A1F33', '#A5B4FC', '#DDD6FE', '#F0F9FF'],
            ['#14213D', '#7DD3FC', '#BBF7D0', '#F8FAFC'],
        ],
        lightPalettes: [
            ['#EFF6FF', '#60A5FA', '#C7D2FE', '#E0F2FE'],
            ['#F0FDFA', '#2DD4BF', '#7DD3FC', '#CCFBF1'],
            ['#EEF2FF', '#818CF8', '#C4B5FD', '#E0F2FE'],
            ['#F0F9FF', '#38BDF8', '#86EFAC', '#E0E7FF'],
        ],
        css: { clouds: ['#1E3A5F', '#CBD5E1', '#F1F5F9'] },
        glsl: { mesh: ['#0F172A', '#60A5FA', '#C4B5FD', '#99F6E4'] },
    },
    joy: {
        lead: ['bokeh', 'plasma', 'confetti'],
        palettes: [
            ['#1F0A1A', '#F472B6', '#FACC15', '#34D399'],
            ['#120B2E', '#FB923C', '#F472B6', '#FDE047'],
            ['#0A1A2E', '#FACC15', '#22D3EE', '#F9A8D4'],
            ['#1A0F05', '#F59E0B', '#FB7185', '#A3E635'],
        ],
        lightPalettes: [
            ['#FDF2F8', '#EC4899', '#FACC15', '#34D399'],
            ['#FFF7ED', '#F97316', '#F472B6', '#FACC15'],
            ['#F0F9FF', '#EAB308', '#06B6D4', '#F472B6'],
            ['#FEFCE8', '#F59E0B', '#FB7185', '#84CC16'],
        ],
        css: { bokeh: ['#1A1033', '#F59E0B', '#EC4899', '#FDE68A'] },
        glsl: { plasma: ['#0F0A1E', '#7C3AED', '#EC4899', '#F59E0B'] },
    },
    majesty: {
        lead: ['rays', 'glass', 'stars'],
        palettes: [
            ['#1E0B3A', '#EAB308', '#FDE68A', '#F5F3FF'],
            ['#120A24', '#A855F7', '#FACC15', '#FFFFFF'],
            ['#0B0B14', '#CA8A04', '#7C3AED', '#FEF3C7'],
            ['#170A2E', '#FBBF24', '#C4B5FD', '#FEF9C3'],
        ],
        lightPalettes: [
            ['#FAF5FF', '#7E22CE', '#EAB308', '#E9D5FF'],
            ['#F5F3FF', '#A855F7', '#CA8A04', '#FDE68A'],
            ['#FEFCE8', '#A16207', '#7C3AED', '#FEF08A'],
            ['#EDE9FE', '#B45309', '#8B5CF6', '#FCD34D'],
        ],
        css: { rays: ['#2E1065', '#FACC15', '#FEF08A'] },
        glsl: { glass: ['#0B0B0B', '#7C3AED', '#DC2626', '#F59E0B'] },
    },
    hope: {
        lead: ['aurora', 'sunrise', 'stars'],
        palettes: [
            ['#062A26', '#34D399', '#FDE68A', '#FFFFFF'],
            ['#0B1A2E', '#5EEAD4', '#FEF08A', '#E0F2FE'],
            ['#0F2417', '#4ADE80', '#FDE047', '#F0FDF4'],
            ['#101B30', '#38BDF8', '#86EFAC', '#FEF3C7'],
        ],
        lightPalettes: [
            ['#ECFDF5', '#059669', '#FBBF24', '#A7F3D0'],
            ['#F0FDFA', '#0D9488', '#FACC15', '#BAE6FD'],
            ['#F0FDF4', '#16A34A', '#EAB308', '#D9F99D'],
            ['#F0F9FF', '#0284C7', '#4ADE80', '#FDE68A'],
        ],
        css: { aurora: ['#042F2E', '#2DD4BF', '#86EFAC', '#FDE68A'] },
        glsl: { aurora: ['#030712', '#34D399', '#22D3EE', '#A78BFA'] },
    },
    praise: {
        lead: ['waves', 'plasma', 'bokeh'],
        palettes: [
            ['#1A0B2E', '#C084FC', '#F472B6', '#FDE047'],
            ['#0B1026', '#6366F1', '#22D3EE', '#F9A8D4'],
            ['#1F0A1F', '#DB2777', '#FB923C', '#FEF3C7'],
            ['#120A24', '#8B5CF6', '#FBBF24', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FAF5FF', '#A855F7', '#EC4899', '#FACC15'],
            ['#EEF2FF', '#4F46E5', '#06B6D4', '#F9A8D4'],
            ['#FDF2F8', '#DB2777', '#F97316', '#FDE68A'],
            ['#F5F3FF', '#7C3AED', '#F59E0B', '#C4B5FD'],
        ],
        css: { waves: ['#1E1B4B', '#8B5CF6', '#EC4899', '#F59E0B'] },
        glsl: { waves: ['#1E1B4B', '#7C3AED', '#EC4899', '#F59E0B'] },
    },
    'light-of-the-world': {
        lead: ['cross', 'rays', 'candles'],
        palettes: [
            ['#05060F', '#FFFFFF', '#FEF08A', '#FDBA74'],
            ['#0F0A05', '#FDE68A', '#FFFFFF', '#FCD34D'],
            ['#0A0F1F', '#F8FAFC', '#FBBF24', '#FEF3C7'],
            ['#140F0A', '#FEF3C7', '#F59E0B', '#FFFFFF'],
        ],
        lightPalettes: [
            ['#FFFFFF', '#D97706', '#FDE047', '#FDBA74'],
            ['#FFFBEB', '#CA8A04', '#FCD34D', '#FFFFFF'],
            ['#F8FAFC', '#B45309', '#FBBF24', '#FEF3C7'],
            ['#FFF7ED', '#EA580C', '#FACC15', '#FFEDD5'],
        ],
        css: { cross: ['#0B1026', '#FFFFFF', '#FDE68A', '#FEF3C7'] },
        glsl: { rays: ['#111827', '#FDE68A', '#FFFFFF'] },
    },
    'morning-light': {
        lead: ['rays', 'sunrise', 'clouds'],
        palettes: [
            ['#1E2A44', '#FDBA74', '#FDE68A', '#FFFFFF'],
            ['#172033', '#FB923C', '#FEF3C7', '#BAE6FD'],
            ['#0F2A44', '#FCD34D', '#FED7AA', '#F0F9FF'],
            ['#1F1F33', '#F9A8D4', '#FDBA74', '#FEF9C3'],
        ],
        lightPalettes: [
            ['#FFF7ED', '#FB923C', '#FDE68A', '#BAE6FD'],
            ['#FFFBEB', '#F97316', '#FDBA74', '#E0F2FE'],
            ['#F0F9FF', '#F59E0B', '#FED7AA', '#7DD3FC'],
            ['#FDF2F8', '#F472B6', '#FDBA74', '#FEF08A'],
        ],
        css: { rays: ['#1E293B', '#FDBA74', '#FEF3C7'] },
        glsl: { sunrise: ['#0C4A6E', '#FDBA74', '#FEF3C7', '#FFFFFF'] },
    },
};
