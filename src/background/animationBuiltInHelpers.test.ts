import { describe, expect, it, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => `[${key}]` }));

import {
    ANIMATION_CATEGORY_GROUP_LIST,
    ANIMATION_CATEGORY_LIST,
    ANIMATION_TONE_LIST,
    DEFAULT_ANIMATION_CATEGORY,
    findAnimationSample,
    findAnimationSampleCategory,
    findAnimationTone,
    listAnimationCategorySamples,
    listAnimationCategorySrcs,
    toInitialAnimationTone,
    type AnimationCategoryType,
} from './animationBuiltInHelpers';
import {
    ANIMATION_CATEGORY_DATA_MAP,
    type AnimationEffectNameType,
} from './animationCategoryData';
import {
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    checkGlslCodeProblem,
    parseAnimation,
    toAnimationReadColor,
    toAnimationSrc,
    toCanonicalAnimationSrc,
    type AnimationType,
} from './animationValueHelpers';
import {
    GLSL_BUILT_IN_SOURCE_MAP,
    GLSL_FOOTER_SOURCE,
    GLSL_HEADER_SOURCE,
    assembleGlslFragmentSource,
    genGlslAnimationCode,
} from './glslAnimationSources';
import {
    genAnimationCategoryLabel,
    genAnimationLabel,
    genAnimationSampleCaption,
    tranAnimationCategory,
    tranAnimationCategoryGroup,
    tranCssAnimationName,
    tranGlslAnimationName,
} from './animationLabelHelpers';
import {
    checkIsColorDark,
    type AppColorType,
} from '../others/color/colorValueHelpers';

const EFFECT_NAME_SET = new Set<string>([
    ...CSS_ANIMATION_NAME_LIST,
    ...GLSL_ANIMATION_NAME_LIST,
]);

function genSample(
    engine: 'css' | 'glsl',
    name: string,
    colors: string[],
): AnimationType {
    const base = {
        code: null,
        colors: colors as AppColorType[],
        speed: 'normal',
        opacity: 100,
        blend: 'normal',
    } as const;
    return engine === 'css'
        ? ({ ...base, engine, name, density: 'normal' } as AnimationType)
        : ({ ...base, engine, name, quality: 'normal' } as AnimationType);
}

// The samples there were before categories (the themes of 2026-11-15),
// each as it was written, and the category that keeps it: saved presets,
// sessions and run sheets hold these, and must keep their names.
const LEGACY_SAMPLE_LIST: [
    'css' | 'glsl',
    string,
    string[],
    AnimationCategoryType,
][] = [
    ['css', 'rays', ['#0C1E3A', '#FDE68A', '#FFFFFF'], 'glory'],
    ['css', 'clouds', ['#3B6FB6', '#FFFFFF', '#E0F2FE'], 'heaven'],
    [
        'css',
        'embers',
        ['#1F0A05', '#F97316', '#FACC15', '#EF4444'],
        'holy-spirit',
    ],
    [
        'css',
        'waves',
        ['#082F49', '#0EA5E9', '#38BDF8', '#BAE6FD'],
        'living-water',
    ],
    ['css', 'stars', ['#05060F', '#FFFFFF', '#BFDBFE', '#FDE68A'], 'christmas'],
    ['css', 'snow', ['#052E16', '#FFFFFF', '#DCFCE7'], 'christmas'],
    ['css', 'bokeh', ['#2E1065', '#C084FC', '#F9A8D4', '#FDE68A'], 'advent'],
    ['css', 'breathe', ['#1E1B4B', '#6D28D9', '#7C3AED', '#A78BFA'], 'lent'],
    [
        'css',
        'cross',
        ['#1E1B4B', '#FFFBEB', '#FDE68A', '#F59E0B'],
        'resurrection-day',
    ],
    [
        'css',
        'cross',
        ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D'],
        'good-friday',
    ],
    ['css', 'aurora', ['#0B1026', '#22D3EE', '#8B5CF6', '#10B981'], 'grace'],
    ['css', 'clouds', ['#1E3A5F', '#CBD5E1', '#F1F5F9'], 'peace'],
    ['css', 'bokeh', ['#1A1033', '#F59E0B', '#EC4899', '#FDE68A'], 'joy'],
    ['css', 'rays', ['#2E1065', '#FACC15', '#FEF08A'], 'majesty'],
    [
        'css',
        'breathe',
        ['#0F172A', '#2563EB', '#7C3AED', '#DB2777'],
        'sunday-worship',
    ],
    [
        'css',
        'embers',
        ['#450A0A', '#DC2626', '#F97316', '#FDE047'],
        'pentecost',
    ],
    ['css', 'aurora', ['#042F2E', '#2DD4BF', '#86EFAC', '#FDE68A'], 'hope'],
    ['css', 'waves', ['#1E1B4B', '#8B5CF6', '#EC4899', '#F59E0B'], 'praise'],
    ['css', 'bokeh', ['#0C4A6E', '#7DD3FC', '#E0F2FE', '#FFFFFF'], 'baptism'],
    [
        'css',
        'cross',
        ['#0B1026', '#FFFFFF', '#FDE68A', '#FEF3C7'],
        'light-of-the-world',
    ],
    ['css', 'rays', ['#1E293B', '#FDBA74', '#FEF3C7'], 'morning-light'],
    ['css', 'aurora', ['#1C1917', '#F59E0B', '#EF4444', '#FDE68A'], 'revival'],
    ['glsl', 'clouds', ['#1D4ED8', '#FFFFFF', '#BFDBFE'], 'heaven'],
    [
        'glsl',
        'flames',
        ['#1C0500', '#F97316', '#FACC15', '#FFFFFF'],
        'holy-spirit',
    ],
    [
        'glsl',
        'flames',
        ['#2A0A0A', '#DC2626', '#F97316', '#FDE047'],
        'pentecost',
    ],
    [
        'glsl',
        'ripples',
        ['#042F49', '#0EA5E9', '#7DD3FC', '#F0F9FF'],
        'living-water',
    ],
    ['glsl', 'ripples', ['#0C4A6E', '#38BDF8', '#E0F2FE'], 'baptism'],
    [
        'glsl',
        'stars',
        ['#020617', '#1E3A8A', '#BFDBFE', '#FDE68A'],
        'christmas',
    ],
    ['glsl', 'snow', ['#7F1D1D', '#FFFFFF', '#FECACA'], 'christmas'],
    [
        'glsl',
        'sunrise',
        ['#1E1B4B', '#F59E0B', '#FDE68A', '#FFFFFF'],
        'resurrection-day',
    ],
    [
        'glsl',
        'cross',
        ['#0B1026', '#FFFFFF', '#FDE68A', '#F59E0B'],
        'resurrection-day',
    ],
    [
        'glsl',
        'cross',
        ['#0A0505', '#E5E5E5', '#B91C1C', '#7F1D1D'],
        'good-friday',
    ],
    ['glsl', 'rays', ['#111827', '#FDE68A', '#FFFFFF'], 'light-of-the-world'],
    ['glsl', 'mesh', ['#4C1D95', '#DB2777', '#F59E0B', '#2563EB'], 'grace'],
    ['glsl', 'mesh', ['#0F172A', '#60A5FA', '#C4B5FD', '#99F6E4'], 'peace'],
    ['glsl', 'plasma', ['#0F0A1E', '#7C3AED', '#EC4899', '#F59E0B'], 'joy'],
    [
        'glsl',
        'flow',
        ['#020617', '#0EA5E9', '#6366F1', '#22D3EE'],
        'sunday-worship',
    ],
    ['glsl', 'glass', ['#0B0B0B', '#7C3AED', '#DC2626', '#F59E0B'], 'majesty'],
    [
        'glsl',
        'glass',
        ['#1C1917', '#B91C1C', '#F59E0B', '#1D4ED8'],
        'communion',
    ],
    ['glsl', 'aurora', ['#030712', '#34D399', '#22D3EE', '#A78BFA'], 'hope'],
    ['glsl', 'waves', ['#1E1B4B', '#7C3AED', '#EC4899', '#F59E0B'], 'praise'],
    ['glsl', 'stars', ['#1E1033', '#4C1D95', '#E9D5FF', '#FDE68A'], 'advent'],
    [
        'glsl',
        'sunrise',
        ['#0C4A6E', '#FDBA74', '#FEF3C7', '#FFFFFF'],
        'morning-light',
    ],
    ['glsl', 'rays', ['#1C1917', '#F59E0B', '#FEF3C7'], 'glory'],
    ['glsl', 'flow', ['#1E1B4B', '#6D28D9', '#A78BFA', '#4C1D95'], 'lent'],
    ['glsl', 'plasma', ['#1C0A00', '#DC2626', '#F59E0B', '#FDE047'], 'revival'],
];

/** WCAG's relative luminance of `#RRGGBB`. */
function toLuminance(color: string) {
    const [red, green, blue] = [1, 3, 5].map((index) => {
        const channel = Number.parseInt(color.slice(index, index + 2), 16);
        const value = channel / 255;
        return value <= 0.039_28
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

describe('the categories', () => {
    it('are each in one group, once, Sunday Worship first', () => {
        const grouped = ANIMATION_CATEGORY_GROUP_LIST.flatMap((item) => {
            return item.categories;
        });
        expect(grouped).toEqual([...ANIMATION_CATEGORY_LIST]);
        expect(new Set(grouped).size).toBe(grouped.length);
        expect(grouped.length).toBeGreaterThanOrEqual(50);
        expect(DEFAULT_ANIMATION_CATEGORY).toBe('sunday-worship');
        expect(grouped[0]).toBe(DEFAULT_ANIMATION_CATEGORY);
        // What the user named first.
        for (const category of [
            'christmas',
            'thanksgiving',
            'resurrection-day',
        ] as const) {
            expect(grouped).toContain(category);
        }
        expect(Object.keys(ANIMATION_CATEGORY_DATA_MAP).sort()).toEqual(
            [...grouped].sort(),
        );
    });

    it('colour with 2-4 colours, the ground dark enough for white words', () => {
        for (const category of ANIMATION_CATEGORY_LIST) {
            const data = ANIMATION_CATEGORY_DATA_MAP[category];
            const colorLists = [
                ...data.palettes,
                ...Object.values(data.css ?? {}),
                ...Object.values(data.glsl ?? {}),
            ];
            expect(data.palettes.length, category).toBeGreaterThanOrEqual(3);
            for (const colors of colorLists) {
                expect(colors.length, category).toBeGreaterThanOrEqual(2);
                expect(colors.length, category).toBeLessThanOrEqual(4);
                for (const color of colors) {
                    expect(color, category).toMatch(/^#[0-9A-F]{6}$/);
                }
                expect(toLuminance(colors[0]), category).toBeLessThan(0.2);
            }
            // The Light side: as many palettes, the ground pale enough for
            // black words, none the same as another category's.
            expect(data.lightPalettes.length, category).toBe(
                data.palettes.length,
            );
            for (const colors of data.lightPalettes) {
                expect(colors.length, category).toBeGreaterThanOrEqual(2);
                expect(colors.length, category).toBeLessThanOrEqual(4);
                for (const color of colors) {
                    expect(color, category).toMatch(/^#[0-9A-F]{6}$/);
                }
                expect(toLuminance(colors[0]), category).toBeGreaterThan(0.75);
            }
            for (const name of [...data.lead, ...(data.excluded ?? [])]) {
                expect(EFFECT_NAME_SET, category).toContain(name);
            }
            for (const name of data.lead) {
                expect(data.excluded ?? [], category).not.toContain(name);
            }
            for (const name of Object.keys(data.css ?? {})) {
                expect(CSS_ANIMATION_NAME_LIST, category).toContain(name);
            }
            for (const name of Object.keys(data.glsl ?? {})) {
                expect(GLSL_ANIMATION_NAME_LIST, category).toContain(name);
            }
        }
    });
});

describe('a category’s samples', () => {
    it('are every effect of both kinds but those it leaves out, its own first, on both sides', () => {
        for (const [category, tone] of ANIMATION_CATEGORY_LIST.flatMap(
            (category) => {
                return ANIMATION_TONE_LIST.map((tone) => {
                    return [category, tone] as const;
                });
            },
        )) {
            const data = ANIMATION_CATEGORY_DATA_MAP[category];
            const excluded: readonly AnimationEffectNameType[] =
                data.excluded ?? [];
            const samples = listAnimationCategorySamples(category, tone);
            const kinds = [
                ['css', samples.css, CSS_ANIMATION_NAME_LIST],
                ['glsl', samples.glsl, GLSL_ANIMATION_NAME_LIST],
            ] as const;
            for (const [engine, list, nameList] of kinds) {
                const names = list
                    .filter((sample) => {
                        expect(sample.category).toBe(category);
                        expect(sample.tone).toBe(tone);
                        expect(sample.animation.engine).toBe(engine);
                        return sample.number === 1;
                    })
                    .map((sample) => {
                        return sample.animation.name as AnimationEffectNameType;
                    });
                const expectedNames = nameList.filter((name) => {
                    return !excluded.includes(name);
                });
                expect([...names].sort(), category).toEqual(
                    [...expectedNames].sort(),
                );
                const lead = data.lead.filter((name) => {
                    return (expectedNames as string[]).includes(name);
                });
                expect(names.slice(0, lead.length), category).toEqual(lead);
                // The first lead effect in four looks, the second in three,
                // the third in two, every other in one -- each further look
                // right after the one before it, in a palette of its own.
                expect(
                    names.map((name) => {
                        return list.filter((sample) => {
                            return sample.animation.name === name;
                        }).length;
                    }),
                    category,
                ).toEqual(
                    names.map((_, index) => {
                        return index < lead.length
                            ? ([4, 3, 2][index] ?? 1)
                            : 1;
                    }),
                );
                list.forEach((sample, index) => {
                    if (sample.number === 1) {
                        return;
                    }
                    const previous = list[index - 1];
                    expect(previous.animation.name).toBe(sample.animation.name);
                    expect(previous.number).toBe(sample.number - 1);
                    const first = list[index - sample.number + 1];
                    expect(first.number).toBe(1);
                    expect(sample.animation.colors, sample.src).not.toEqual(
                        first.animation.colors,
                    );
                });
                expect(
                    listAnimationCategorySrcs(category, engine, tone),
                ).toEqual(
                    list.map((sample) => {
                        return sample.src;
                    }),
                );
            }
            expect(
                samples.css.length + samples.glsl.length,
            ).toBeGreaterThanOrEqual(28);
        }
    });

    it('leave out what does not suit the day', () => {
        const names = (category: AnimationCategoryType) => {
            const samples = listAnimationCategorySamples(category);
            return [...samples.css, ...samples.glsl]
                .filter((sample) => {
                    return sample.number === 1;
                })
                .map((sample) => {
                    return sample.animation.name;
                });
        };
        for (const category of [
            'good-friday',
            'funeral',
            'ash-wednesday',
        ] as const) {
            expect(names(category)).not.toContain('fireworks');
            expect(names(category)).not.toContain('confetti');
            expect(names(category)).not.toContain('hearts');
        }
        expect(names('prayer-meeting')).not.toContain('fireworks');
        expect(names('summer')).not.toContain('snow');
        expect(names('winter')).not.toContain('leaves');
        expect(names('christmas').slice(0, 2)).toEqual(['snow', 'stars']);
        expect(names('thanksgiving')[0]).toBe('leaves');
        expect(names('new-year')[0]).toBe('fireworks');
    });

    it('open Christmas on four snowfalls of each kind', () => {
        // 2026-11-19, the user: _add more example, e.g. christmas should
        // have like falling snow_.
        const samples = listAnimationCategorySamples('christmas');
        for (const list of [samples.css, samples.glsl]) {
            expect(
                list.slice(0, 5).map((sample) => {
                    return `${sample.animation.name} ${sample.number}`;
                }),
            ).toEqual(['snow 1', 'snow 2', 'snow 3', 'snow 4', 'stars 1']);
            const grounds = list.slice(0, 4).map((sample) => {
                return sample.animation.colors[0];
            });
            expect(new Set(grounds).size).toBe(4);
        }
    });

    it('read dark where they are a few bright things on a dark ground', () => {
        // The Bible text-contrast check judges a background by the colour it
        // reads as: white words must stay white on all of these.
        const sparseNameList = [
            'snow',
            'stars',
            'bokeh',
            'embers',
            'leaves',
            'fireworks',
            'petals',
            'candles',
            'confetti',
            'hearts',
        ];
        let count = 0;
        for (const category of ANIMATION_CATEGORY_LIST) {
            const samples = listAnimationCategorySamples(category);
            for (const sample of [...samples.css, ...samples.glsl]) {
                if (!sparseNameList.includes(sample.animation.name)) {
                    continue;
                }
                count += 1;
                expect(
                    checkIsColorDark(toAnimationReadColor(sample.animation)),
                    sample.src,
                ).toBe(true);
            }
        }
        expect(count).toBeGreaterThan(500);
    });

    it('on the Light side read light, every one of them', () => {
        // Light is the promise of black words: the text-contrast check must
        // never turn them white on any Light sample, sparse or all colour.
        let count = 0;
        for (const category of ANIMATION_CATEGORY_LIST) {
            const samples = listAnimationCategorySamples(category, 'light');
            for (const sample of [...samples.css, ...samples.glsl]) {
                count += 1;
                expect(
                    checkIsColorDark(toAnimationReadColor(sample.animation)),
                    sample.src,
                ).toBe(false);
            }
        }
        expect(count).toBeGreaterThan(1500);
    });

    it('keep the Dark side as it was, the Light side apart', () => {
        expect(listAnimationCategorySamples('christmas')).toEqual(
            listAnimationCategorySamples('christmas', 'dark'),
        );
        expect(listAnimationCategorySrcs('christmas', 'glsl')).toEqual(
            listAnimationCategorySrcs('christmas', 'glsl', 'dark'),
        );
        const light = listAnimationCategorySamples('christmas', 'light');
        expect(
            light.css.slice(0, 5).map((sample) => {
                return `${sample.animation.name} ${sample.number}`;
            }),
        ).toEqual(['snow 1', 'snow 2', 'snow 3', 'snow 4', 'stars 1']);
        expect(light.css[0].animation.colors).toEqual(
            ANIMATION_CATEGORY_DATA_MAP.christmas.lightPalettes[0],
        );
    });

    it('are each written once, in their one form, and found by category and side', () => {
        const srcSet = new Set<string>();
        let count = 0;
        for (const category of ANIMATION_CATEGORY_LIST) {
            const samples = [
                ...ANIMATION_TONE_LIST.flatMap((tone) => {
                    const list = listAnimationCategorySamples(category, tone);
                    return [...list.css, ...list.glsl];
                }),
            ];
            for (const sample of samples) {
                count += 1;
                srcSet.add(sample.src);
                expect(toCanonicalAnimationSrc(sample.src)).toBe(sample.src);
                expect(parseAnimation(sample.src), sample.src).toEqual(
                    sample.animation,
                );
                expect(toAnimationSrc(sample.animation)).toBe(sample.src);
                expect(
                    findAnimationSampleCategory(sample.animation),
                    sample.src,
                ).toBe(category);
                expect(findAnimationSample(sample.animation)).toEqual({
                    category,
                    tone: sample.tone,
                    number: sample.number,
                });
                expect(findAnimationTone(sample.src), sample.src).toBe(
                    sample.tone,
                );
                expect(toInitialAnimationTone(sample.src), sample.src).toBe(
                    sample.tone,
                );
            }
        }
        // None twice, across every category and side: a written one names
        // ONE.
        expect(srcSet.size).toBe(count);
    });

    it('keep every sample there was before, in the category that took it', () => {
        expect(LEGACY_SAMPLE_LIST).toHaveLength(46);
        for (const [engine, name, colors, category] of LEGACY_SAMPLE_LIST) {
            const animation = genSample(engine, name, colors);
            const src = toAnimationSrc(animation);
            expect(listAnimationCategorySrcs(category, engine), src).toContain(
                src,
            );
            expect(findAnimationSampleCategory(animation), src).toBe(category);
        }
    });

    it('open the switch on the side a recoloured one reads as, else Dark', () => {
        const [sample] = listAnimationCategorySamples('christmas').glsl;
        const pale = {
            ...sample.animation,
            colors: ['#FFFFFF', '#E0F2FE'],
        } as AnimationType;
        expect(findAnimationTone(toAnimationSrc(pale))).toBeNull();
        expect(toInitialAnimationTone(toAnimationSrc(pale))).toBe('light');
        const deep = { ...pale, colors: ['#000000', '#1E3A8A'] };
        expect(
            toInitialAnimationTone(toAnimationSrc(deep as AnimationType)),
        ).toBe('dark');
        expect(toInitialAnimationTone(null)).toBe('dark');
        expect(toInitialAnimationTone('not an animation')).toBe('dark');
    });

    it('name none recoloured, sped up or of a person’s own code', () => {
        const [sample] = listAnimationCategorySamples('christmas').glsl;
        expect(findAnimationSampleCategory(sample.animation)).toBe('christmas');
        const changes: Partial<AnimationType>[] = [
            { colors: ['#000000', '#FFFFFF'] as AppColorType[] },
            { speed: 'fast' },
            { opacity: 50 },
            { blend: 'screen' } as Partial<AnimationType>,
            { quality: 'high' } as Partial<AnimationType>,
            {
                name: 'custom',
                code: 'void mainImage(out vec4 c, in vec2 p) {}',
            } as Partial<AnimationType>,
        ];
        for (const change of changes) {
            const changed = { ...sample.animation, ...change } as AnimationType;
            expect(
                findAnimationSampleCategory(changed),
                JSON.stringify(change),
            ).toBeNull();
        }
    });
});

describe('the names', () => {
    it('are a sample’s category and effect, a recoloured one its effect', () => {
        const sample = listAnimationCategorySamples('christmas').css[0];
        expect(sample.animation.name).toBe('snow');
        expect(genAnimationLabel(sample.animation)).toBe(
            '[Christmas] - [Snowfall]',
        );
        expect(genAnimationCategoryLabel('christmas', sample.animation)).toBe(
            '[Christmas] - [Snowfall]',
        );
        const recoloured = {
            ...sample.animation,
            colors: ['#000000', '#FFFFFF'],
        } as AnimationType;
        expect(genAnimationLabel(recoloured)).toBe('[Snowfall]');
    });

    it('mark a Light sample, the Dark one named as it always was', () => {
        const [dark] = listAnimationCategorySamples('christmas', 'dark').css;
        const [light] = listAnimationCategorySamples('christmas', 'light').css;
        expect(genAnimationLabel(dark.animation)).toBe(
            '[Christmas] - [Snowfall]',
        );
        expect(genAnimationLabel(light.animation)).toBe(
            '[Christmas] - [Snowfall] ([Light])',
        );
        expect(
            genAnimationCategoryLabel('christmas', light.animation, 2, 'light'),
        ).toBe('[Christmas] - [Snowfall] 2 ([Light])');
    });

    it('number an effect’s further looks', () => {
        const sample = listAnimationCategorySamples('christmas').glsl[1];
        expect([sample.animation.name, sample.number]).toEqual(['snow', 2]);
        expect(genAnimationLabel(sample.animation)).toBe(
            '[Christmas] - [Snowfall] 2',
        );
        expect(genAnimationSampleCaption(sample.animation, 2)).toBe(
            '[Snowfall] 2',
        );
        expect(genAnimationSampleCaption(sample.animation)).toBe('[Snowfall]');
    });

    it('have a literal key for every effect, category and group', () => {
        for (const name of [...CSS_ANIMATION_NAME_LIST, 'custom'] as const) {
            expect(tranCssAnimationName(name)).toMatch(/^\[.+\]$/);
        }
        for (const name of [...GLSL_ANIMATION_NAME_LIST, 'custom'] as const) {
            expect(tranGlslAnimationName(name)).toMatch(/^\[.+\]$/);
        }
        expect(tranCssAnimationName('candles')).toBe('[Candlelight]');
        expect(tranGlslAnimationName('leaves')).toBe('[Falling Leaves]');
        const categoryLabels = ANIMATION_CATEGORY_LIST.map((category) => {
            return tranAnimationCategory(category);
        });
        for (const label of categoryLabels) {
            expect(label).toMatch(/^\[.+\]$/);
        }
        expect(new Set(categoryLabels).size).toBe(categoryLabels.length);
        expect(tranAnimationCategory('resurrection-day')).toBe(
            '[Resurrection Day]',
        );
        for (const item of ANIMATION_CATEGORY_GROUP_LIST) {
            expect(tranAnimationCategoryGroup(item.group)).toMatch(/^\[.+\]$/);
        }
    });
});

describe('the built-in shaders', () => {
    it('are each a mainImage a person could have written', () => {
        for (const name of GLSL_ANIMATION_NAME_LIST) {
            const code = GLSL_BUILT_IN_SOURCE_MAP[name];
            expect(checkGlslCodeProblem(code), name).toBeNull();
            // GLSL ES 1.00: no `%` on numbers, and loops bounded by a
            // constant -- what a weak card's compiler accepts.
            expect(code, name).not.toMatch(/[^%]%[^%]/);
            for (const match of code.matchAll(/for\s*\(([^;]*);([^;]*);/g)) {
                expect(match[2], name).toMatch(/<=?\s*-?\d/);
            }
            // A float is written as one: `2.0`, never `2`, in a call that
            // takes floats -- a strict compiler refuses the int.
            expect(code, name).not.toMatch(
                /\b(?:pow|smoothstep|mix|exp|sin|cos)\(\s*\d+\s*[,)]/,
            );
        }
    });

    it('a person’s own code is the code it starts from', () => {
        expect(
            genGlslAnimationCode({
                engine: 'glsl',
                name: 'custom',
                code: 'void mainImage(out vec4 c, in vec2 p) { c = vec4(1); }',
                colors: ['#000000', '#FFFFFF'],
                speed: 'normal',
                quality: 'normal',
                opacity: 100,
                blend: 'normal',
            }),
        ).toContain('vec4(1)');
        const assembled = assembleGlslFragmentSource('CODE');
        expect(assembled.startsWith(GLSL_HEADER_SOURCE)).toBe(true);
        expect(assembled.endsWith(GLSL_FOOTER_SOURCE)).toBe(true);
        expect(assembled).toContain('\nCODE\n');
        // The footer premultiplies: the canvas is see-through by its alpha.
        expect(GLSL_FOOTER_SOURCE).toMatch(/mainImage\(/);
        expect(GLSL_FOOTER_SOURCE).toMatch(/\.rgb\s*\*=?|rgb \* /);
    });
});
