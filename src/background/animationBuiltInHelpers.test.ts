import { describe, expect, it, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => `[${key}]` }));

import {
    ANIMATION_THEME_LIST,
    CSS_ANIMATION_SAMPLE_LIST,
    findAnimationSampleTheme,
    GLSL_ANIMATION_SAMPLE_LIST,
} from './animationBuiltInHelpers';
import {
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    checkGlslCodeProblem,
    parseAnimation,
    toAnimationSrc,
} from './animationValueHelpers';
import {
    GLSL_BUILT_IN_SOURCE_MAP,
    GLSL_FOOTER_SOURCE,
    GLSL_HEADER_SOURCE,
    assembleGlslFragmentSource,
    genGlslAnimationCode,
} from './glslAnimationSources';
import {
    genAnimationLabel,
    tranAnimationTheme,
    tranCssAnimationName,
    tranGlslAnimationName,
} from './animationLabelHelpers';

const ALL_SAMPLE_LIST = [
    ...CSS_ANIMATION_SAMPLE_LIST,
    ...GLSL_ANIMATION_SAMPLE_LIST,
];

describe('the worship samples', () => {
    it('are each an animation in its one written form, none twice', () => {
        for (const sample of ALL_SAMPLE_LIST) {
            expect(parseAnimation(sample.src), sample.src).toEqual(
                sample.animation,
            );
            expect(toAnimationSrc(sample.animation)).toBe(sample.src);
        }
        const srcSet = new Set(
            ALL_SAMPLE_LIST.map((sample) => {
                return sample.src;
            }),
        );
        expect(srcSet.size).toBe(ALL_SAMPLE_LIST.length);
    });

    it('show every effect of both kinds, and every theme', () => {
        const cssNames = new Set(
            CSS_ANIMATION_SAMPLE_LIST.map((sample) => {
                return sample.animation.name;
            }),
        );
        expect([...cssNames].sort()).toEqual(
            [...CSS_ANIMATION_NAME_LIST].sort(),
        );
        const glslNames = new Set(
            GLSL_ANIMATION_SAMPLE_LIST.map((sample) => {
                return sample.animation.name;
            }),
        );
        for (const name of ['flames', 'cross', 'snow', 'sunrise', 'glass']) {
            expect(glslNames).toContain(name);
        }
        const themes = new Set(
            ALL_SAMPLE_LIST.map((sample) => {
                return sample.theme;
            }),
        );
        expect([...themes].sort()).toEqual([...ANIMATION_THEME_LIST].sort());
    });

    it('are named by theme and effect, a recoloured one by its effect', () => {
        const sample = GLSL_ANIMATION_SAMPLE_LIST.find((one) => {
            return one.theme === 'easter';
        })!;
        expect(findAnimationSampleTheme(sample.src)).toBe('easter');
        expect(genAnimationLabel(sample.animation)).toBe(
            '[Easter] - [Sunrise]',
        );
        const recoloured = {
            ...sample.animation,
            colors: ['#000000', '#FFFFFF'],
        } as typeof sample.animation;
        expect(findAnimationSampleTheme(toAnimationSrc(recoloured))).toBeNull();
        expect(genAnimationLabel(recoloured)).toBe('[Sunrise]');
    });

    it('have a label for every effect and theme, as a literal', () => {
        for (const name of CSS_ANIMATION_NAME_LIST) {
            expect(tranCssAnimationName(name)).toMatch(/^\[.+\]$/);
        }
        for (const name of [...GLSL_ANIMATION_NAME_LIST, 'custom'] as const) {
            expect(tranGlslAnimationName(name)).toMatch(/^\[.+\]$/);
        }
        for (const theme of ANIMATION_THEME_LIST) {
            expect(tranAnimationTheme(theme)).toMatch(/^\[.+\]$/);
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
