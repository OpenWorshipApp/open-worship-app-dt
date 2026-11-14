import { describe, expect, it } from 'vitest';

import {
    MIN_BIBLE_TEXT_LETTER_SPACING,
    MIN_BIBLE_TEXT_LINE_HEIGHT,
    toBibleTextStyleView,
    type BibleTextEffectType,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import {
    genBibleTextEffectPatch,
    genBibleTextLookEffect,
} from '../screen-setting/bibleTextLookHelpers';
import {
    checkIsScreenRefusal,
    describeScreenStyle,
    genScreenStylePatch,
    type ScreenStyleArgsType,
} from './agentScreenControlRules';

// White words on a dark picture, nothing else set: a fresh install's screen.
function genView(textStyle: Record<string, unknown> = {}) {
    return toBibleTextStyleView(textStyle);
}

function genPatch(
    args: ScreenStyleArgsType,
    view: BibleTextStyleViewType = genView(),
) {
    const result = genScreenStylePatch(view, args);
    if (checkIsScreenRefusal(result)) {
        throw new Error(`refused: ${result.reason}`);
    }
    return result;
}

function genReason(
    args: ScreenStyleArgsType,
    view: BibleTextStyleViewType = genView(),
) {
    const result = genScreenStylePatch(view, args);
    if (!checkIsScreenRefusal(result)) {
        throw new Error('expected a refusal');
    }
    return result.reason;
}

// An effect no tile of the panel draws: the sliders moved by hand.
function genOwnEffectView(effect: Partial<BibleTextEffectType>) {
    const base = genBibleTextLookEffect('normal', 'dark');
    return genView(genBibleTextEffectPatch({ ...base, ...effect }));
}

describe('a switch said in words', () => {
    it('reads yes, on and true as on, the way a person writes them', () => {
        expect(genPatch({ bold: 'yes' }).patch.isBold).toBe(true);
        expect(genPatch({ italic: 'On' }).patch.isItalic).toBe(true);
        expect(genPatch({ bold: 'true' }).said).toEqual(['bold']);
        // A shadow switched on in words is the soft one, as `true` is.
        expect(genPatch({ shadow: 'on' }).said).toEqual(['a soft shadow']);
        expect(genPatch({ reset: 'yes' }).said[0]).toContain(
            'the style is plain again',
        );
    });
});

describe('the spacing stepped in words', () => {
    it('closes the lines up a step, never under the least', () => {
        const { patch, said } = genPatch({ lineHeight: 'tighter' });
        expect(patch.lineHeight).toBe(1.25);
        expect(said).toEqual(['line height 1.5 -> 1.25']);
        const tight = genView({ lineHeight: 1.1 });
        expect(
            genPatch({ lineHeight: 'a bit closer' }, tight).patch.lineHeight,
        ).toBe(MIN_BIBLE_TEXT_LINE_HEIGHT);
    });

    it('closes the letters up a step, never under the least', () => {
        const { patch, said } = genPatch({ letterSpacing: 'narrower' });
        expect(patch.letterSpacing).toBe(-0.02);
        expect(said).toEqual(['letter spacing -0.02em']);
        const close = genView({ letterSpacing: -0.04 });
        expect(
            genPatch({ letterSpacing: 'tighter' }, close).patch.letterSpacing,
        ).toBe(MIN_BIBLE_TEXT_LETTER_SPACING);
    });
});

describe('the glow taken off', () => {
    it('leaves the outline and the shadow as they are', () => {
        const view = genOwnEffectView({
            outlineWidth: 0.04,
            glowSize: 0.24,
            glowColor: '#FFD700',
        });
        for (const glow of [false, 'off', 'none']) {
            const { patch, said } = genPatch({ glow }, view);
            expect(said).toEqual(['no glow']);
            expect(patch.effect).toMatchObject({
                glowSize: 0,
                outlineWidth: 0.04,
            });
            expect(patch.textShadow).not.toContain('#FFD700');
        }
    });
});

describe('refusals inside one style', () => {
    it('refuses the whole style for one field it cannot read, naming it', () => {
        expect(genReason({ bold: true, size: 'huge' })).toContain('`size`');
        expect(genReason({ size: 'larger', letterSpacing: 'roomy' })).toBe(
            '`letterSpacing` is "tighter", "wider", "default" or a number ' +
                'of em from -0.05 to 0.3.',
        );
        expect(genReason({ highlight: 'shiny' })).toBe(
            '"shiny" is not a colour the app knows for the highlight.',
        );
        expect(genReason({ outline: 'thick', outlineColor: 'shiny' })).toBe(
            '"shiny" is not a colour the app knows.',
        );
        expect(genReason({ glow: true, glowColor: 'sparkly' })).toBe(
            '"sparkly" is not a colour the app knows.',
        );
    });
});

describe('describeScreenStyle: an effect no tile draws', () => {
    it('names its outline, its shadow and its glow, each with its colour', () => {
        const view = genOwnEffectView({
            outlineWidth: 0.05,
            outlineColor: '#FF0000',
            shadowX: 0.02,
            shadowY: 0.02,
            shadowBlur: 0.05,
            shadowColor: '#000000',
            glowSize: 0.1,
            glowColor: '#FFD700',
        });
        expect(view.effect).not.toBeNull();
        expect(describeScreenStyle(view)).toBe(
            '65px, words #FFFFFF, outline 0.05em #FF0000, shadow #000000, ' +
                'glow #FFD700',
        );
    });

    it('names only the parts that are on', () => {
        const outlineOnly = genOwnEffectView({
            outlineWidth: 0.05,
            outlineColor: '#00FF00',
        });
        expect(describeScreenStyle(outlineOnly)).toBe(
            '65px, words #FFFFFF, outline 0.05em #00FF00',
        );
        const glowOnly = genOwnEffectView({
            glowSize: 0.1,
            glowColor: '#00FFFF',
        });
        expect(describeScreenStyle(glowOnly)).toBe(
            '65px, words #FFFFFF, glow #00FFFF',
        );
        const shadowOnly = genOwnEffectView({
            shadowX: 0.01,
            shadowY: 0.01,
            shadowColor: '#333333',
        });
        expect(describeScreenStyle(shadowOnly)).toBe(
            '65px, words #FFFFFF, shadow #333333',
        );
    });

    it('says the right and justified line-up in words', () => {
        expect(describeScreenStyle(genView({ textAlign: 'end' }))).toBe(
            '65px, words #FFFFFF, right',
        );
        expect(describeScreenStyle(genView({ textAlign: 'justify' }))).toBe(
            '65px, words #FFFFFF, justified',
        );
    });
});

describe('the rest of what a style says it did', () => {
    it('says dark words for a light background', () => {
        const { patch, said } = genPatch({ backdrop: 'light' });
        expect(said).toEqual(['words for a light background (black words)']);
        expect(patch.color).toBe('#000000');
    });

    it('says a line-up on the right and a justified one in words', () => {
        expect(genPatch({ align: 'right' }).said).toEqual([
            'lined up on the right',
        ]);
        expect(genPatch({ align: 'justified' }).said).toEqual(['justified']);
        expect(genPatch({ align: 'justify' }).patch.textAlign).toBe('justify');
    });

    it('keeps the transparency a highlight comes with', () => {
        const { patch, said } = genPatch({ highlight: '#ffd70080' });
        expect(patch.highlightColorDark).toBe('#ffd70080');
        expect(said).toEqual(['the selected verse marked in #ffd70080']);
    });

    it('starts a reset with a shadow from the plain look, not the old outline', () => {
        const outlined = genView(
            genBibleTextEffectPatch(
                genBibleTextLookEffect('heavy-outline', 'dark'),
            ),
        );
        const { patch } = genPatch({ reset: true, shadow: 'deep' }, outlined);
        expect(patch.effect.outlineWidth).toBe(0);
        expect(patch.effect.shadowBlur).toBeGreaterThan(0);
    });

    it('recolours a glow that is on, keeping its size', () => {
        const glowing = genOwnEffectView({
            glowSize: 0.24,
            glowColor: '#FFFFFF',
        });
        const { patch, said } = genPatch({ glowColor: 'gold' }, glowing);
        expect(patch.effect).toMatchObject({
            glowSize: 0.24,
            glowColor: '#ffd700',
        });
        expect(said).toEqual(['the glow #ffd700']);
    });

    it('takes an outline written in em as em, and refuses a negative one', () => {
        expect(genPatch({ outline: 0.05 }).patch.effect.outlineWidth).toBe(
            0.05,
        );
        expect(genPatch({ outline: '0.03em' }).said).toEqual([
            'an outline 0.03em wide',
        ]);
        expect(genReason({ outline: -2 })).toContain('`outline`');
    });

    it('reads a number written as a word of digits', () => {
        expect(genPatch({ size: '72' }).patch.fontSize).toBe(72);
        expect(genReason({ size: Number.NaN })).toContain('`size`');
    });
});
