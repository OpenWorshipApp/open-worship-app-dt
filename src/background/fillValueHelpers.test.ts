import { describe, expect, it } from 'vitest';

import {
    checkIsFillDark,
    checkIsFillSrc,
    checkIsSolidFillSrc,
    compareFillSrc,
    describeFill,
    genFillBackground,
    genFillCodeLabel,
    genFillCss,
    genFillMotionPlan,
    parseFill,
    toCanonicalFillSrc,
    toFillAverageColor,
    toFillHexColor,
    toFillSrc,
    type FillType,
} from './fillValueHelpers';

function parse(src: string) {
    const fill = parseFill(src);
    if (fill === null) {
        throw new Error(`not a fill: ${src}`);
    }
    return fill;
}

describe('colour codes', () => {
    it('reads a code in any of its CSS forms into the one form', () => {
        expect(toFillHexColor('#abcdef')).toBe('#ABCDEF');
        expect(toFillHexColor('ABCDEF12')).toBe('#ABCDEF12');
        expect(toFillHexColor('#abc')).toBe('#AABBCC');
        expect(toFillHexColor('#abcd')).toBe('#AABBCCDD');
        expect(toFillHexColor(' #abc ')).toBe('#AABBCC');
    });

    it('reads nothing else as a code', () => {
        for (const value of ['#abcde', '#ggg', '', 'red', '#abcdef1', 12]) {
            expect(toFillHexColor(value)).toBeNull();
        }
        expect(toFillHexColor(null)).toBeNull();
        expect(toFillHexColor(undefined)).toBeNull();
    });

    it('takes a colour as a fill only with its hash', () => {
        expect(checkIsSolidFillSrc('#abc')).toBe(true);
        expect(checkIsSolidFillSrc('#AABBCC80')).toBe(true);
        expect(checkIsSolidFillSrc('abc')).toBe(false);
        expect(checkIsSolidFillSrc('red')).toBe(false);
        expect(checkIsSolidFillSrc({})).toBe(false);
    });
});

describe('reading a fill', () => {
    it('reads a colour, a gradient and a pattern', () => {
        expect(parseFill('#1e3a8a')).toEqual({
            kind: 'solid',
            color: '#1E3A8A',
        });
        expect(
            parseFill(
                'gradient?shape=linear&angle=135&colors=1e3a8a-581C87&motion=slow',
            ),
        ).toEqual({
            kind: 'gradient',
            shape: 'linear',
            angle: 135,
            colors: ['#1E3A8A', '#581C87'],
            motion: 'slow',
        });
        expect(
            parseFill('pattern?name=dots&base=172554&ink=FFFFFF1F&size=24'),
        ).toEqual({
            kind: 'pattern',
            name: 'dots',
            base: '#172554',
            ink: '#FFFFFF1F',
            size: 24,
            motion: 'none',
        });
    });

    it('gives what is left out its default', () => {
        expect(parseFill('gradient?colors=000000-FFFFFF')).toEqual({
            kind: 'gradient',
            shape: 'linear',
            angle: 180,
            colors: ['#000000', '#FFFFFF'],
            motion: 'none',
        });
        expect(parse('pattern?name=grid&base=000000&ink=FFFFFF')).toMatchObject(
            { size: 32, motion: 'none' },
        );
    });

    it('takes two to four colours in a gradient, each a code', () => {
        expect(parseFill('gradient?colors=000000')).toBeNull();
        expect(
            parseFill('gradient?colors=000000-111111-222222-333333'),
        ).not.toBeNull();
        expect(
            parseFill('gradient?colors=000000-111111-222222-333333-444444'),
        ).toBeNull();
        expect(parseFill('gradient?colors=000000-red')).toBeNull();
        expect(parseFill('gradient?colors=000000--FFFFFF')).toBeNull();
    });

    it('keeps every number inside its bounds', () => {
        expect(
            parseFill('gradient?angle=0&colors=000000-FFFFFF'),
        ).not.toBeNull();
        expect(
            parseFill('gradient?angle=359&colors=000000-FFFFFF'),
        ).not.toBeNull();
        expect(parseFill('gradient?angle=360&colors=000000-FFFFFF')).toBeNull();
        expect(parseFill('gradient?angle=-1&colors=000000-FFFFFF')).toBeNull();
        expect(parseFill('gradient?angle=1.5&colors=000000-FFFFFF')).toBeNull();
        expect(
            parseFill('pattern?name=dots&base=000000&ink=FFFFFF&size=8'),
        ).not.toBeNull();
        expect(
            parseFill('pattern?name=dots&base=000000&ink=FFFFFF&size=160'),
        ).not.toBeNull();
        expect(
            parseFill('pattern?name=dots&base=000000&ink=FFFFFF&size=7'),
        ).toBeNull();
        expect(
            parseFill('pattern?name=dots&base=000000&ink=FFFFFF&size=161'),
        ).toBeNull();
    });

    it('reads only the names it knows', () => {
        expect(
            parseFill('gradient?shape=conic&colors=000000-FFFFFF'),
        ).toBeNull();
        expect(
            parseFill('gradient?colors=000000-FFFFFF&motion=wild'),
        ).toBeNull();
        expect(
            parseFill('pattern?name=hearts&base=000000&ink=FFFFFF'),
        ).toBeNull();
        expect(parseFill('pattern?name=dots&ink=FFFFFF')).toBeNull();
        expect(parseFill('pattern?name=dots&base=000000')).toBeNull();
    });

    it('carries no CSS of its own onto a screen', () => {
        for (const src of [
            'url(https://example.com/a.png)',
            'gradient?colors=000000-FFFFFF&x=url(a)',
            'gradient?colors=000000-FFFFFF;background:url(a)',
            'gradient?colors=000000-FFFFFF&colors=FFFFFF-000000',
            'gradient?colors=000000-FFFFFF&angle',
            'gradient?colors=000000-FFFFFF&angle=1=2',
            'gradient?colors=#000000-#FFFFFF',
            'gradient?colors=000000-FFFFFF%20',
            'pattern?name=dots&base=000000&ink=FFFFFF&=1',
            'linear-gradient(red, blue)',
            'gradient',
            'red',
            '',
        ]) {
            expect(parseFill(src)).toBeNull();
            expect(checkIsFillSrc(src)).toBe(false);
        }
        expect(
            parseFill(
                `gradient?colors=000000-FFFFFF&motion=slow${'&'.repeat(300)}`,
            ),
        ).toBeNull();
        expect(parseFill(null)).toBeNull();
        expect(parseFill(42)).toBeNull();
        expect(parseFill({ src: '#000000' })).toBeNull();
    });
});

describe('writing a fill', () => {
    it('writes every fill one way, so two equal fills are one string', () => {
        expect(
            toCanonicalFillSrc('gradient?colors=1e3a8a-581c87&angle=135'),
        ).toBe('gradient?shape=linear&angle=135&colors=1E3A8A-581C87');
        expect(
            toCanonicalFillSrc(
                'pattern?size=24&ink=fff&base=172554&name=dots&motion=none',
            ),
        ).toBe('pattern?name=dots&base=172554&ink=FFFFFF&size=24');
        expect(toCanonicalFillSrc('#abc')).toBe('#AABBCC');
        expect(toCanonicalFillSrc('url(x)')).toBeNull();
        expect(
            toFillSrc({
                kind: 'gradient',
                shape: 'radial',
                angle: 90,
                colors: ['#000000', '#FFFFFF'],
                motion: 'fast',
            }),
        ).toBe(
            'gradient?shape=radial&angle=90&colors=000000-FFFFFF&motion=fast',
        );
    });

    it('reads back what it writes', () => {
        const fill: FillType = {
            kind: 'pattern',
            name: 'zigzag',
            base: '#450A0A',
            ink: '#FFFFFF1A',
            size: 32,
            motion: 'normal',
        };
        expect(parseFill(toFillSrc(fill))).toEqual(fill);
    });

    it('compares fills by what they are, not how they were written', () => {
        expect(compareFillSrc('#abc', '#AABBCC')).toBe(true);
        expect(
            compareFillSrc(
                'gradient?colors=000000-FFFFFF',
                'gradient?shape=linear&angle=180&colors=000000-ffffff',
            ),
        ).toBe(true);
        expect(compareFillSrc('#000000', '#000001')).toBe(false);
        // Two non-fills are not "the same fill".
        expect(compareFillSrc('url(x)', 'url(x)')).toBe(false);
        expect(compareFillSrc(null, null)).toBe(false);
    });
});

describe('painting a fill', () => {
    it('paints a colour as a colour', () => {
        const fill = parse('#123456');
        expect(genFillCss(fill)).toEqual({ backgroundColor: '#123456' });
        expect(genFillBackground(fill)).toBe('#123456');
    });

    it('paints a gradient over its first colour', () => {
        const linear = parse('gradient?angle=135&colors=1E3A8A-581C87');
        expect(genFillCss(linear)).toEqual({
            backgroundColor: '#1E3A8A',
            backgroundImage: 'linear-gradient(135deg, #1E3A8A, #581C87)',
        });
        expect(genFillBackground(linear)).toBe(
            'linear-gradient(135deg, #1E3A8A, #581C87), #1E3A8A',
        );
        const radial = parse('gradient?shape=radial&colors=1E40AF-0B1120');
        expect(genFillCss(radial).backgroundImage).toBe(
            'radial-gradient(ellipse at center, #1E40AF, #0B1120)',
        );
    });

    it('paints nothing under a gradient that lets the screen show through', () => {
        // Under it, the first colour would make the faint stop solid.
        const fading = parse('gradient?angle=180&colors=1E3A8A-1E3A8A00');
        expect(genFillCss(fading)).toEqual({
            backgroundColor: 'transparent',
            backgroundImage: 'linear-gradient(180deg, #1E3A8A, #1E3A8A00)',
        });
        expect(genFillBackground(fading)).toBe(
            'linear-gradient(180deg, #1E3A8A, #1E3A8A00), transparent',
        );
    });

    it('paints a pattern tile by tile, smaller for a preview', () => {
        const dots = parse(
            'pattern?name=dots&base=172554&ink=FFFFFF26&size=24',
        );
        expect(genFillCss(dots)).toEqual({
            backgroundColor: '#172554',
            backgroundImage:
                'radial-gradient(circle, #FFFFFF26 0 18%, transparent 19%)',
            backgroundSize: '24px 24px',
        });
        expect(genFillCss(dots, 0.25).backgroundSize).toBe('6px 6px');
        // Never so small it is a flat colour.
        expect(genFillCss(dots, 0.01).backgroundSize).toBe('2px 2px');
        expect(genFillBackground(dots, 0.25)).toBe(
            'radial-gradient(circle, #FFFFFF26 0 18%, transparent 19%) ' +
                '0 0 / 6px 6px, #172554',
        );
    });

    it('draws a grid line in proportion to its tile', () => {
        const grid = parse('pattern?name=grid&base=000000&ink=FFFFFF&size=64');
        expect(genFillCss(grid).backgroundImage).toBe(
            'linear-gradient(#FFFFFF 0 4px, transparent 4px), ' +
                'linear-gradient(90deg, #FFFFFF 0 4px, transparent 4px)',
        );
        expect(genFillCss(grid).backgroundSize).toBe('64px 64px, 64px 64px');
        expect(genFillCss(grid, 0.25).backgroundImage).toContain('0 1px');
        // Two layers, split on their own commas only.
        expect(genFillBackground(grid)).toBe(
            'linear-gradient(#FFFFFF 0 4px, transparent 4px) 0 0 / 64px 64px, ' +
                'linear-gradient(90deg, #FFFFFF 0 4px, transparent 4px) ' +
                '0 0 / 64px 64px, #000000',
        );
    });

    it('offsets a zigzag’s layers by half a tile', () => {
        const zigzag = parse(
            'pattern?name=zigzag&base=450A0A&ink=FFFFFF1A&size=32',
        );
        const css = genFillCss(zigzag);
        expect(css.backgroundPosition).toBe('-16px 0, -16px 0, 0 0, 0 0');
        expect(css.backgroundSize!.split(', ')).toHaveLength(4);
        expect(genFillBackground(zigzag)).toContain(
            'linear-gradient(135deg, #FFFFFF1A 25%, transparent 25%) ' +
                '-16px 0 / 32px 32px',
        );
    });

    it('paints every pattern it knows', () => {
        for (const name of [
            'dots',
            'grid',
            'stripes',
            'diagonal',
            'checks',
            'zigzag',
        ]) {
            const css = genFillCss(
                parse(`pattern?name=${name}&base=000000&ink=FFFFFF&size=32`),
            );
            expect(css.backgroundImage).toMatch(/gradient\(/);
            expect(css.backgroundImage).not.toContain('url(');
        }
    });
});

describe('moving a fill', () => {
    it('keeps a colour and a still fill still', () => {
        expect(genFillMotionPlan(parse('#000000'))).toBeNull();
        expect(
            genFillMotionPlan(parse('gradient?colors=000000-FFFFFF')),
        ).toBeNull();
    });

    it('sways a gradient, the faster the shorter', () => {
        const seconds = ['slow', 'normal', 'fast'].map((motion) => {
            return genFillMotionPlan(
                parse(`gradient?colors=000000-FFFFFF&motion=${motion}`),
            );
        });
        expect(seconds).toEqual([
            { animationName: 'app-fill-sway', seconds: 24 },
            { animationName: 'app-fill-sway', seconds: 12 },
            { animationName: 'app-fill-sway', seconds: 6 },
        ]);
    });

    it('drifts a pattern one tile at a steady pace, whatever its size', () => {
        expect(
            genFillMotionPlan(
                parse(
                    'pattern?name=grid&base=000000&ink=FFFFFF&size=32&motion=slow',
                ),
            ),
        ).toEqual({
            animationName: 'app-fill-drift',
            seconds: 5.33,
            tilePx: 32,
        });
        expect(
            genFillMotionPlan(
                parse(
                    'pattern?name=grid&base=000000&ink=FFFFFF&size=80&motion=fast',
                ),
            ),
        ).toEqual({ animationName: 'app-fill-drift', seconds: 2, tilePx: 80 });
    });
});

describe('the colour a fill reads as', () => {
    it('averages a gradient’s colours', () => {
        expect(toFillAverageColor(parse('gradient?colors=000000-FFFFFF'))).toBe(
            '#808080',
        );
        expect(
            toFillAverageColor(parse('gradient?colors=FF0000-00FF00-0000FF')),
        ).toBe('#555555');
    });

    it('weighs a pattern’s ink by how much of the tile it covers and how see-through it is', () => {
        expect(
            toFillAverageColor(
                parse('pattern?name=stripes&base=000000&ink=FFFFFF'),
            ),
        ).toBe('#808080');
        expect(
            toFillAverageColor(
                parse('pattern?name=dots&base=000000&ink=FFFFFF'),
            ),
        ).toBe('#1A1A1A');
        expect(
            toFillAverageColor(
                parse('pattern?name=checks&base=000000&ink=FFFFFF80'),
            ),
        ).toBe('#404040');
        expect(toFillAverageColor(parse('#12345678'))).toBe('#12345678');
    });

    it('tells a dark fill from a pale one', () => {
        expect(checkIsFillDark(parse('gradient?colors=0F172A-1E3A8A'))).toBe(
            true,
        );
        expect(checkIsFillDark(parse('gradient?colors=FEF9C3-FFEDD5'))).toBe(
            false,
        );
        expect(
            checkIsFillDark(
                parse('pattern?name=dots&base=172554&ink=FFFFFF26'),
            ),
        ).toBe(true);
        expect(checkIsFillDark(parse('#FFFFFF'))).toBe(false);
    });
});

describe('a fill in words', () => {
    it('names it in English for an agent', () => {
        expect(describeFill(parse('#123456'))).toBe('#123456');
        expect(
            describeFill(
                parse('gradient?angle=135&colors=1E3A8A-581C87&motion=slow'),
            ),
        ).toBe('linear 135° gradient #1E3A8A → #581C87, moving slow');
        expect(
            describeFill(parse('gradient?shape=radial&colors=1E40AF-0B1120')),
        ).toBe('radial gradient #1E40AF → #0B1120');
        expect(
            describeFill(
                parse('pattern?name=diagonal&base=3B0764&ink=FFFFFF1A&size=32'),
            ),
        ).toBe('diagonal lines pattern, #FFFFFF1A on #3B0764, 32px tiles');
    });

    it('labels it in codes, arrows and degrees, the same in every language', () => {
        expect(genFillCodeLabel(parse('#123456'))).toBe('#123456');
        expect(
            genFillCodeLabel(parse('gradient?angle=45&colors=3B0764-7F1D1D')),
        ).toBe('45° #3B0764 → #7F1D1D');
        expect(
            genFillCodeLabel(
                parse('gradient?shape=radial&colors=1E40AF-0B1120'),
            ),
        ).toBe('◎ #1E40AF → #0B1120');
        expect(
            genFillCodeLabel(
                parse('pattern?name=dots&base=172554&ink=FFFFFF26'),
            ),
        ).toBe('#FFFFFF26 / #172554');
    });
});
