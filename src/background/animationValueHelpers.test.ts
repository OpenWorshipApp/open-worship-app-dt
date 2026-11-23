import { describe, expect, it } from 'vitest';

import {
    checkGlslCodeProblem,
    checkIsAnimationSeeThrough,
    checkIsAnimationSrc,
    compareAnimationSrc,
    decodeGlslCode,
    describeAnimation,
    encodeGlslCode,
    genAnimationCodeLabel,
    MAX_GLSL_CODE_LENGTH,
    parseAnimation,
    toAnimationBlendFromSrc,
    toAnimationSrc,
    toAnimationReadColor,
    toAnimationReadFillSrc,
    toAnimationStillFill,
    toCanonicalAnimationSrc,
    type AnimationType,
} from './animationValueHelpers';
import {
    checkIsFillDark,
    parseFill,
    toFillAverageColor,
} from './fillValueHelpers';
import { checkIsColorDark } from '../others/color/colorValueHelpers';

const CSS_SRC =
    'css?name=aurora&colors=1E3A8A-581C87-0EA5E9&speed=normal&density=normal';
const GLSL_SRC = 'glsl?name=plasma&colors=0F172A-7C3AED&speed=fast&quality=low';
const CODE = [
    'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
    '    vec2 uv = fragCoord / iResolution.xy;',
    '    fragColor = vec4(palette(uv.x + iTime * 0.1), 1.0);',
    '}',
].join('\n');

describe('parseAnimation', () => {
    it('reads a CSS animation and writes it back the one way', () => {
        const animation = parseAnimation(CSS_SRC);
        expect(animation).toEqual({
            engine: 'css',
            name: 'aurora',
            code: null,
            colors: ['#1E3A8A', '#581C87', '#0EA5E9'],
            speed: 'normal',
            density: 'normal',
            opacity: 100,
            blend: 'normal',
        });
        expect(toAnimationSrc(animation!)).toBe(CSS_SRC);
    });

    it('reads a person’s own CSS and writes it back the one way', () => {
        const code = '.scene { background: var(--color-2); }';
        const src = toAnimationSrc({
            ...parseAnimation(CSS_SRC)!,
            name: 'custom',
            code,
        } as any);
        expect(src.startsWith('css?code=')).toBe(true);
        expect(src).not.toContain('name=');
        expect(parseAnimation(src)).toMatchObject({
            engine: 'css',
            name: 'custom',
            code,
            density: 'normal',
        });
        expect(toAnimationSrc(parseAnimation(src)!)).toBe(src);
    });

    it('refuses CSS that fails its check, and CSS with both name and code', () => {
        const encode = (code: string) => {
            return btoa(code)
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .replace(/=+$/, '');
        };
        const tail = '&colors=000000-FFFFFF&speed=normal&density=normal';
        expect(
            parseAnimation(
                `css?code=${encode('.scene { background: url(x.png); }')}${tail}`,
            ),
        ).toBeNull();
        expect(
            parseAnimation(
                `css?name=aurora&code=${encode('.scene { opacity: 1; }')}${tail}`,
            ),
        ).toBeNull();
        expect(parseAnimation(`css?colors=000000-FFFFFF`)).toBeNull();
    });

    it('reads a built-in shader, its look included', () => {
        const src = `${GLSL_SRC}&opacity=60&blend=screen`;
        const animation = parseAnimation(src);
        expect(animation).toMatchObject({
            engine: 'glsl',
            name: 'plasma',
            code: null,
            speed: 'fast',
            quality: 'low',
            opacity: 60,
            blend: 'screen',
        });
        expect(toAnimationSrc(animation!)).toBe(src);
        expect(toAnimationBlendFromSrc(src)).toBe('screen');
        expect(toAnimationBlendFromSrc(GLSL_SRC)).toBe('normal');
        expect(toAnimationBlendFromSrc('not one')).toBe('normal');
    });

    it('carries a person’s shader as code, and only valid code', () => {
        const src = `glsl?code=${encodeGlslCode(CODE)}&colors=000000-FFFFFF&speed=normal&quality=normal`;
        const animation = parseAnimation(src);
        expect(animation).toMatchObject({ name: 'custom', code: CODE });
        expect(toAnimationSrc(animation!)).toBe(src);
        // Both a name and code, or neither, is no animation.
        expect(
            parseAnimation(`${src.replace('glsl?', 'glsl?name=plasma&')}`),
        ).toBeNull();
        expect(
            parseAnimation('glsl?colors=000000-FFFFFF&speed=normal'),
        ).toBeNull();
        // Code that decodes to no mainImage is refused.
        const noMain = encodeGlslCode('void main() {}');
        expect(
            parseAnimation(`glsl?code=${noMain}&colors=000000-FFFFFF`),
        ).toBeNull();
    });

    it('fills in what was left out and refuses what is wrong', () => {
        expect(parseAnimation('css?name=snow&colors=000000-FFFFFF')).toEqual(
            expect.objectContaining({ speed: 'normal', density: 'normal' }),
        );
        for (const src of [
            'css?colors=000000-FFFFFF',
            'css?name=lasers&colors=000000-FFFFFF',
            'css?name=snow&colors=000000',
            'css?name=snow&colors=000000-111111-222222-333333-444444',
            'css?name=snow&colors=000000-GGGGGG',
            'css?name=snow&colors=000000-FFFFFF&speed=warp',
            'css?name=snow&colors=000000-FFFFFF&opacity=5',
            'css?name=snow&colors=000000-FFFFFF&opacity=101',
            'css?name=snow&colors=000000-FFFFFF&blend=sparkle',
            'css?name=snow&name=rays&colors=000000-FFFFFF',
            'css?name=snow&colors=000000-FFFFFF&x=url(evil)',
            'css?name=snow&colors=000000-FFFFFF;background:red',
            'html?name=snow&colors=000000-FFFFFF',
            `css?name=snow&colors=000000-FFFFFF&density=${'a'.repeat(400)}`,
        ]) {
            expect(parseAnimation(src), src).toBeNull();
            expect(checkIsAnimationSrc(src), src).toBe(false);
        }
        expect(parseAnimation(null)).toBeNull();
        expect(parseAnimation({ src: CSS_SRC })).toBeNull();
    });
});

describe('the one written form', () => {
    it('compares two ways of writing the same animation as equal', () => {
        const reordered =
            'css?density=normal&speed=normal&colors=1e3a8a-581c87-0ea5e9&name=aurora';
        expect(toCanonicalAnimationSrc(reordered)).toBe(CSS_SRC);
        expect(compareAnimationSrc(reordered, CSS_SRC)).toBe(true);
        expect(compareAnimationSrc(CSS_SRC, GLSL_SRC)).toBe(false);
        expect(compareAnimationSrc('bad', 'bad')).toBe(false);
    });

    it('writes no default look', () => {
        const animation = parseAnimation(CSS_SRC)!;
        expect(toAnimationSrc({ ...animation, opacity: 100 })).not.toContain(
            'opacity',
        );
        expect(
            toAnimationSrc({ ...animation, opacity: 40, blend: 'multiply' }),
        ).toBe(`${CSS_SRC}&opacity=40&blend=multiply`);
    });
});

describe('checkGlslCodeProblem', () => {
    it('keeps printable ASCII with a mainImage, within the length', () => {
        expect(checkGlslCodeProblem(CODE)).toBeNull();
        expect(checkGlslCodeProblem('')).not.toBeNull();
        expect(checkGlslCodeProblem(42)).not.toBeNull();
        expect(checkGlslCodeProblem('void main() {}')).toMatch(/mainImage/);
        expect(
            checkGlslCodeProblem(`${CODE}\n// ${String.fromCodePoint(233)}`),
        ).toMatch(/characters/);
        expect(
            checkGlslCodeProblem(
                `${CODE}\n//${'x'.repeat(MAX_GLSL_CODE_LENGTH)}`,
            ),
        ).toMatch(/longer/);
    });

    it('round-trips code through base64url, refusing what is not', () => {
        const encoded = encodeGlslCode(CODE);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(decodeGlslCode(encoded)).toBe(CODE);
        expect(decodeGlslCode('not base64!')).toBeNull();
    });
});

describe('what an animation stands for where it does not move', () => {
    const animation = parseAnimation(CSS_SRC) as AnimationType;

    it('is a still gradient of its colours, ground first', () => {
        expect(toAnimationStillFill(animation)).toMatchObject({
            kind: 'gradient',
            colors: ['#1E3A8A', '#581C87', '#0EA5E9'],
            motion: 'none',
        });
    });

    it('is see-through with a faint colour or less than full opacity', () => {
        expect(checkIsAnimationSeeThrough(animation)).toBe(false);
        expect(checkIsAnimationSeeThrough({ ...animation, opacity: 80 })).toBe(
            true,
        );
        expect(
            checkIsAnimationSeeThrough({
                ...animation,
                colors: ['#00000080', '#FFFFFF'],
            }),
        ).toBe(true);
    });

    it('reads in words for an agent, and as a language-neutral label', () => {
        expect(describeAnimation(animation)).toBe(
            'aurora CSS animation, #1E3A8A → #581C87 → #0EA5E9, normal speed, normal density',
        );
        expect(
            describeAnimation({
                ...parseAnimation(GLSL_SRC)!,
                opacity: 50,
                blend: 'screen',
            }),
        ).toBe(
            'plasma GLSL shader, #0F172A → #7C3AED, fast speed, low quality, 50% opacity, screen blend',
        );
        expect(genAnimationCodeLabel(animation)).toBe(
            'CSS #1E3A8A → #581C87 → #0EA5E9',
        );
    });
});

describe('the one colour an animation reads as, for the words on it', () => {
    // A dark night with a few bright bursts: as one even gradient of its
    // colours it read as LIGHT, and the contrast check turned white Bible
    // words black on it (2026-11-19, Thanksgiving - Fireworks).
    const fireworks = parseAnimation(
        'css?name=fireworks&colors=1C0F05-EA580C-F59E0B-FDE68A&speed=normal&density=normal',
    ) as AnimationType;

    it('is mostly the ground for an effect of a few bright sparks', () => {
        expect(checkIsFillDark(toAnimationStillFill(fireworks))).toBe(false);
        expect(checkIsColorDark(toAnimationReadColor(fireworks))).toBe(true);
        expect(parseFill(toAnimationReadFillSrc(fireworks))).toEqual({
            kind: 'solid',
            color: toAnimationReadColor(fireworks),
        });
    });

    it('is mostly the colours for an effect that fills the frame', () => {
        // The same pale colours: a big glow over most of the frame is light
        // to the eye, a few flakes on the ground are not.
        const colors = '1E293B-FFFFFF-FEF3C7-FDE68A';
        const breathe = parseAnimation(
            `css?name=breathe&colors=${colors}`,
        ) as AnimationType;
        const snow = parseAnimation(
            `css?name=snow&colors=${colors}`,
        ) as AnimationType;
        expect(checkIsColorDark(toAnimationReadColor(breathe))).toBe(false);
        expect(checkIsColorDark(toAnimationReadColor(snow))).toBe(true);
    });

    it('is the even gradient for a shader that mixes them all, or code', () => {
        const plasma = parseAnimation(GLSL_SRC) as AnimationType;
        expect(toAnimationReadColor(plasma)).toBe(
            toFillAverageColor(toAnimationStillFill(plasma)),
        );
        const code = {
            ...fireworks,
            name: 'custom',
            code: '.scene {}',
        } as AnimationType;
        expect(toAnimationReadColor(code)).toBe(
            toFillAverageColor(toAnimationStillFill(code)),
        );
    });
});
