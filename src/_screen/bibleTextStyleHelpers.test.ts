import { describe, expect, test } from 'vitest';

import {
    BIBLE_TEXT_FONT_FAMILY_VAR,
    type BibleTextStyleViewType,
    DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP,
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
    DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
    MAX_BIBLE_TEXT_OUTLINE_WIDTH,
    checkIsDefaultBibleHighlightColor,
    genBibleTextDefaultHighlightColor,
    genBibleTextEffectDefault,
    genBibleTextHighlightBackground,
    genBibleTextShadow,
    genBibleTextStyleCss,
    genBibleTextStylePatch,
    readBibleTextHighlightColor,
    toBibleBackdrop,
    toBibleTextEffect,
    toBibleTextStyleView,
} from './bibleTextStyleHelpers';

function genEffect(patch: object) {
    return { ...genBibleTextEffectDefault(), ...patch };
}

describe('genBibleTextShadow', () => {
    test('an effect with nothing on draws nothing', () => {
        expect(genBibleTextShadow(genBibleTextEffectDefault())).toBe('none');
    });

    test('an outline is a ring of copies, more of them as it gets wider', () => {
        const thin = genBibleTextShadow(genEffect({ outlineWidth: 0.02 }));
        const medium = genBibleTextShadow(genEffect({ outlineWidth: 0.04 }));
        const heavy = genBibleTextShadow(genEffect({ outlineWidth: 0.08 }));
        expect(thin.split(', ')).toHaveLength(8);
        expect(medium.split(', ')).toHaveLength(12);
        expect(heavy.split(', ')).toHaveLength(16);
        // The first copy sits straight to the right, a whole width away, and
        // the one a quarter turn on straight below: a cosine's 6e-17 and a
        // `-0` are both written as a plain 0.
        expect(thin.split(', ')[0]).toBe('0.02em 0 0 #000000');
        expect(thin.split(', ')[2]).toBe('0 0.02em 0 #000000');
        expect(thin).not.toContain('-0 ');
        expect(thin).not.toContain('e-');
    });

    test('every length is in em, so a look follows the font size', () => {
        const textShadow = genBibleTextShadow(
            genEffect({
                outlineWidth: 0.03,
                shadowX: 0.02,
                shadowY: -0.05,
                shadowBlur: 0.1,
                glowSize: 0.2,
            }),
        );
        expect(textShadow).not.toContain('px');
        expect(textShadow).toContain('0.02em -0.05em 0.1em #000000');
    });

    test('layers are stacked edge first, glow last', () => {
        const layers = genBibleTextShadow(
            genEffect({
                outlineWidth: 0.02,
                outlineColor: '#111111',
                shadowY: 0.04,
                shadowColor: '#222222CC',
                glowSize: 0.2,
                glowColor: '#333333',
            }),
        ).split(', ');
        expect(layers).toHaveLength(8 + 1 + 2);
        expect(layers[0]).toContain('#111111');
        expect(layers[8]).toBe('0 0.04em 0 #222222CC');
        // A tight glow for density, a wide one for the fall-off.
        expect(layers[9]).toBe('0 0 0.1em #333333');
        expect(layers[10]).toBe('0 0 0.2em #333333');
    });

    test('a shadow with no offset and no blur is hidden, so it is left out', () => {
        expect(genBibleTextShadow(genEffect({ shadowColor: '#FF0000' }))).toBe(
            'none',
        );
        expect(genBibleTextShadow(genEffect({ shadowBlur: 0.1 }))).toBe(
            '0 0 0.1em #000000',
        );
    });
});

describe('toBibleTextEffect', () => {
    test('is null for anything that is not an object', () => {
        expect(toBibleTextEffect(undefined)).toBeNull();
        expect(toBibleTextEffect(null)).toBeNull();
        expect(toBibleTextEffect('0.02em')).toBeNull();
    });

    test('pulls every number into range and refuses a colour that is not hex', () => {
        expect(
            toBibleTextEffect({
                outlineWidth: 9,
                outlineColor: 'red; } body { display: none',
                shadowX: -5,
                shadowY: Number.NaN,
                shadowBlur: '3',
                shadowColor: '#abcdef80',
                glowSize: -1,
                glowColor: '#FFF',
            }),
        ).toEqual({
            outlineWidth: MAX_BIBLE_TEXT_OUTLINE_WIDTH,
            outlineColor: '#000000',
            shadowX: -0.2,
            shadowY: 0,
            shadowBlur: 0,
            shadowColor: '#abcdef80',
            glowSize: 0,
            glowColor: '#000000',
        });
    });
});

describe('toBibleTextStyleView', () => {
    test('an empty style is the screen as it always was', () => {
        expect(toBibleTextStyleView({})).toEqual({
            fontFamily: '',
            fontSize: DEFAULT_BIBLE_TEXT_FONT_SIZE,
            color: '#FFFFFF',
            textShadow: 'none',
            effect: genBibleTextEffectDefault(),
            isBold: false,
            isItalic: false,
            lineHeight: 1.5,
            letterSpacing: 0,
            textAlign: 'start',
            // The pink band it always was, and its light-backdrop twin.
            highlightColorDark: '#FF009D33',
            highlightColorLight: DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.light,
        });
    });

    test('reads a style saved by an earlier release', () => {
        const view = toBibleTextStyleView({
            fontSize: 101,
            // The old presets stored the colour the browser handed back.
            color: 'rgb(255, 255, 255)',
            textShadow: '2px 2px 0 #00000030, 1px 1px 5px #000',
        });
        expect(view.fontSize).toBe(101);
        expect(view.color).toBe('rgb(255, 255, 255)');
        expect(view.textShadow).toBe('2px 2px 0 #00000030, 1px 1px 5px #000');
        // No slider describes it, so the panel must not pretend one does.
        expect(view.effect).toBeNull();
    });

    test('Reset White / Reset Black left an empty shadow, which is none', () => {
        expect(toBibleTextStyleView({ textShadow: '' }).textShadow).toBe(
            'none',
        );
    });

    test('keeps the effect only while it is still what the screen draws', () => {
        const effect = genEffect({ outlineWidth: 0.04 });
        const textShadow = genBibleTextShadow(effect);
        expect(toBibleTextStyleView({ effect, textShadow }).effect).toEqual(
            effect,
        );
        // An earlier release, or CSS typed by hand, changes `textShadow` and
        // knows nothing of `effect`.
        expect(
            toBibleTextStyleView({ effect, textShadow: '1px 1px black' })
                .effect,
        ).toBeNull();
    });

    test('ignores values of the wrong kind rather than drawing them', () => {
        const view = toBibleTextStyleView({
            fontSize: '101',
            isBold: 'yes',
            lineHeight: 99,
            letterSpacing: -4,
            textAlign: 'middle',
        });
        expect(view.fontSize).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);
        expect(view.isBold).toBe(false);
        expect(view.lineHeight).toBe(3);
        expect(view.letterSpacing).toBe(-0.05);
        expect(view.textAlign).toBe('start');
    });
});

describe('genBibleTextStyleCss', () => {
    test('an untouched style writes the three declarations it always did', () => {
        expect(genBibleTextStyleCss({})).toBe(
            'font-size: 65px;\ncolor: #FFFFFF;\ntext-shadow: none;',
        );
    });

    test('writes only what is set, the cell rules nested and last', () => {
        const css = genBibleTextStyleCss({
            fontSize: 80,
            color: '#000000',
            isBold: true,
            isItalic: true,
            letterSpacing: 0.02,
            lineHeight: 1.8,
            textAlign: 'center',
        });
        expect(css.split('\n')).toEqual([
            'font-size: 80px;',
            'color: #000000;',
            'text-shadow: none;',
            'font-weight: 700;',
            'font-style: italic;',
            'letter-spacing: 0.02em;',
            // `!important` because a right-to-left column sets its own side
            // inline.
            '& td { line-height: 1.8em; text-align: center !important; }',
        ]);
    });

    test('a chosen family reaches the row and a verse with a font of its own', () => {
        const lines = genBibleTextStyleCss({
            fontFamily: 'Made Up Sans',
            textAlign: 'center',
        }).split('\n');
        // The declaration for the row, the screen's own stack behind it for a
        // machine that does not have the font.
        expect(lines).toContainEqual(
            expect.stringMatching(
                /^font-family: "Made Up Sans", app-Google-Sans, system-ui, .*;$/,
            ),
        );
        // The variable a verse reads ahead of its language's own inline font.
        expect(lines).toContain(
            `${BIBLE_TEXT_FONT_FAMILY_VAR}: "Made Up Sans";`,
        );
        // The cell rules stay last.
        expect(lines.at(-1)).toBe('& td { text-align: center !important; }');
    });

    test('a family cannot close its own quotes', () => {
        const css = genBibleTextStyleCss({
            fontFamily: 'A"; } body { display: none } /* \\\n B',
        });
        expect(css).not.toContain('font-family');
        expect(
            genBibleTextStyleCss({ fontFamily: 'A"\\ \n\tB' }).split('\n'),
        ).toContain(`${BIBLE_TEXT_FONT_FAMILY_VAR}: "A B";`);
        expect(toBibleTextStyleView({ fontFamily: 42 }).fontFamily).toBe('');
    });

    test('the default line height and alignment leave the cell alone', () => {
        expect(
            genBibleTextStyleCss({ lineHeight: 1.5, textAlign: 'start' }),
        ).not.toContain('td');
    });

    test('nothing in a style can close the declaration or the rule', () => {
        const css = genBibleTextStyleCss({
            color: 'red; } body { display: none',
            textShadow: '0 0 red; } * { color: red } /* <style>',
        });
        expect(css).not.toMatch(/[{}<>]/);
        // An unclosed comment would swallow every declaration after it, so a
        // value carrying one is dropped for the default.
        expect(css).toContain('text-shadow: none;');
        // One `;` per declaration, none smuggled in by a value.
        expect(css.split('\n').every((line) => /^[^;]*;$/.test(line))).toBe(
            true,
        );
    });
});

describe('genBibleTextStylePatch', () => {
    const STYLE_KEYS = [
        'color',
        'effect',
        'fontFamily',
        'fontSize',
        'highlightColorDark',
        'highlightColorLight',
        'isBold',
        'isItalic',
        'letterSpacing',
        'lineHeight',
        'textAlign',
        'textShadow',
    ];

    test('names every key, and leaves the ones at their default undefined so they clear another look', () => {
        const view: BibleTextStyleViewType = {
            fontFamily: '',
            fontSize: DEFAULT_BIBLE_TEXT_FONT_SIZE,
            color: '#ffffff',
            textShadow: 'none',
            effect: null,
            isBold: false,
            isItalic: false,
            lineHeight: DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
            letterSpacing: 0,
            textAlign: 'start',
            highlightColorDark: DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.dark,
            // The picker writes lowercase: still the default.
            highlightColorLight:
                DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.light.toLowerCase(),
        };
        const patch = genBibleTextStylePatch(view);
        expect(Object.keys(patch).sort()).toEqual(STYLE_KEYS);
        expect(patch).toStrictEqual({
            fontFamily: undefined,
            fontSize: DEFAULT_BIBLE_TEXT_FONT_SIZE,
            color: '#ffffff',
            textShadow: 'none',
            effect: undefined,
            isBold: undefined,
            isItalic: undefined,
            lineHeight: undefined,
            letterSpacing: undefined,
            textAlign: undefined,
            highlightColorDark: undefined,
            highlightColorLight: undefined,
        });
    });

    test('a look that is set is written as it is', () => {
        const view: BibleTextStyleViewType = {
            fontFamily: 'Made Up Sans',
            fontSize: 80,
            color: '#ffff00',
            textShadow: '1px 1px 0 #000000',
            effect: genEffect({ outlineWidth: 0.04 }),
            isBold: true,
            isItalic: true,
            lineHeight: 2,
            letterSpacing: 0.02,
            textAlign: 'center',
            highlightColorDark: '#00ff0040',
            highlightColorLight: '#ff000040',
        };
        const patch = genBibleTextStylePatch(view);
        expect(Object.keys(patch).sort()).toEqual(STYLE_KEYS);
        expect(patch).toStrictEqual({ ...view });
    });
});

describe('the selection band', () => {
    test('is read off the side the words are on, one colour per side', () => {
        expect(toBibleBackdrop('#FFFFFF')).toBe('dark');
        expect(toBibleBackdrop('#000000')).toBe('light');
        const style = {
            highlightColorDark: '#00ff0040',
            highlightColorLight: '#ff000040',
        };
        expect(
            readBibleTextHighlightColor(
                toBibleTextStyleView({ ...style, color: '#FFFFFF' }),
            ),
        ).toBe('#00ff0040');
        expect(
            readBibleTextHighlightColor(
                toBibleTextStyleView({ ...style, color: '#000000' }),
            ),
        ).toBe('#ff000040');
    });

    test('nobody chose one: the defaults, the pink it always was over a dark backdrop', () => {
        const view = toBibleTextStyleView({});
        expect(view.highlightColorDark).toBe('#FF009D33');
        expect(view.highlightColorLight).toBe(
            DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.light,
        );
        expect(genBibleTextDefaultHighlightColor('#FFFFFF')).toBe(
            DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.dark,
        );
        expect(genBibleTextDefaultHighlightColor('#000000')).toBe(
            DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.light,
        );
        expect(checkIsDefaultBibleHighlightColor('#ff009d33', 'dark')).toBe(
            true,
        );
        expect(checkIsDefaultBibleHighlightColor('#ff009d33', 'light')).toBe(
            false,
        );
    });

    test('a value that is not a hex colour is the default, never written into the sheet', () => {
        const view = toBibleTextStyleView({
            highlightColorDark: 'red; } body { display: none',
            highlightColorLight: 42,
        });
        expect(view.highlightColorDark).toBe(
            DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.dark,
        );
        expect(view.highlightColorLight).toBe(
            DEFAULT_BIBLE_HIGHLIGHT_COLOR_MAP.light,
        );
    });

    test('only a chosen band is written into the row, the one for the words side, last', () => {
        // The default stays the screen sheet's.
        expect(
            genBibleTextStyleCss({
                highlightColorLight: '#ff000040',
            }),
        ).not.toContain('highlight');
        const lines = genBibleTextStyleCss({
            color: '#000000',
            textAlign: 'center',
            highlightColorDark: '#00ff0040',
            highlightColorLight: '#ff000040',
        }).split('\n');
        expect(lines.at(-1)).toBe(
            '& .highlight.selected { background: ' +
                `${genBibleTextHighlightBackground('#ff000040')}; }`,
        );
        expect(lines.join('\n')).not.toContain('#00ff0040');
    });
});
