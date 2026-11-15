import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

import { FILL_CSS_CLASS_NAME, genFillCssText } from './fillCssTextHelpers';
import { genFillCss, parseFill, type FillType } from './fillValueHelpers';

function toFill(src: string): FillType {
    const fill = parseFill(src);
    if (fill === null) {
        throw new Error(`not a fill: ${src}`);
    }
    return fill;
}

// Read back as a stylesheet: a declaration list inside a rule, a moving
// fill's text as it is.
function compile(text: string) {
    return compileString(text.startsWith('.') ? text : `.x {\n${text}\n}`).css;
}

describe('genFillCssText', () => {
    it('a still gradient is its declarations alone', () => {
        const text = genFillCssText(
            toFill('gradient?shape=linear&angle=180&colors=0F172A-1E3A8A'),
        );
        expect(text).toBe(
            [
                'background-color: #0F172A;',
                'background-image: linear-gradient(180deg, #0F172A, #1E3A8A);',
            ].join('\n'),
        );
        expect(() => compile(text)).not.toThrow();
    });

    it('a still pattern carries its tile size -- at a screen’s own scale -- and its layers’ places', () => {
        const fill = toFill(
            'pattern?name=zigzag&base=172554&ink=FFFFFF26&size=24',
        );
        const css = genFillCss(fill);
        expect(genFillCssText(fill)).toBe(
            [
                `background-color: ${css.backgroundColor};`,
                `background-image: ${css.backgroundImage};`,
                'background-size: 24px 24px, 24px 24px, 24px 24px, 24px 24px;',
                'background-position: -12px 0, -12px 0, 0 0, 0 0;',
            ].join('\n'),
        );
        expect(() => compile(genFillCssText(fill))).not.toThrow();
    });

    it('a colour is one declaration', () => {
        expect(genFillCssText(toFill('#FF0000'))).toBe(
            'background-color: #FF0000;',
        );
    });

    it('a moving pattern drifts a tile on a layer a tile larger, by transform alone', () => {
        const text = genFillCssText(
            toFill(
                'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
            ),
        );
        const selector = `.${FILL_CSS_CLASS_NAME}`;
        expect(text.startsWith(`${selector} {\n`)).toBe(true);
        expect(text).toContain(
            [
                `${selector} {`,
                '  position: relative;',
                '  overflow: hidden;',
                '  isolation: isolate;',
                '}',
                `${selector}::before {`,
                '  content: "";',
                '  position: absolute;',
                '  inset: -32px 0 0 -32px;',
                '  --owa-fill-tile: 32px;',
                '  z-index: -1;',
                '  background-color: #18181B;',
            ].join('\n'),
        );
        // 32px at 6px a second.
        expect(text).toContain(
            [
                '  will-change: transform;',
                '  animation: owa-fill-drift 5.33s linear infinite;',
                '}',
                '@keyframes owa-fill-drift {',
                '  from {',
                '    transform: translate3d(0, 0, 0);',
                '  }',
                '  to {',
                '    transform: translate3d(var(--owa-fill-tile), var(--owa-fill-tile), 0);',
                '  }',
                '}',
            ].join('\n'),
        );
        expect(text).not.toContain('background-position');
        expect(() => compile(text)).not.toThrow();
    });

    it('two patterns of different tiles write the same keyframes', () => {
        const genKeyframes = (src: string) => {
            const text = genFillCssText(toFill(src));
            return text.slice(text.indexOf('@keyframes'));
        };
        expect(
            genKeyframes(
                'pattern?name=dots&base=172554&ink=FFFFFF26&size=24&motion=fast',
            ),
        ).toBe(
            genKeyframes(
                'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=48&motion=slow',
            ),
        );
    });

    it('a moving gradient sways across a layer a quarter larger on every side', () => {
        const text = genFillCssText(
            toFill(
                'gradient?shape=radial&angle=0&colors=1E3A8A-581C87&motion=normal',
            ),
        );
        expect(text).toContain('  inset: -25%;\n  z-index: -1;\n');
        expect(text).toContain(
            '  background-image: radial-gradient(ellipse at center, #1E3A8A, #581C87);',
        );
        expect(text).toContain(
            '  animation: owa-fill-sway 12s ease-in-out infinite alternate;',
        );
        expect(text).toContain(
            [
                '@keyframes owa-fill-sway {',
                '  from {',
                '    transform: translate3d(-8%, -6%, 0);',
                '  }',
                '  to {',
                '    transform: translate3d(8%, 6%, 0);',
                '  }',
                '}',
            ].join('\n'),
        );
        expect(text).not.toContain('--owa-fill-tile');
        expect(() => compile(text)).not.toThrow();
    });
});
