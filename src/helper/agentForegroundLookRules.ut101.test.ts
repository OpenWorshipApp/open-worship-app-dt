import { describe, expect, it } from 'vitest';

import {
    FOREGROUND_LOOK_FIELD_LIST,
    planForegroundLook,
    toForegroundAlignment,
    toForegroundHexColor,
    toForegroundPlaceWords,
    type ForegroundLookContextType,
} from './agentForegroundLookRules';

// Every rule of a `look` in words, held to what the Properties panel itself
// writes: the keys are spelled out literally (a drift in a setting name is a
// look the panel never shows), and every number is checked against the
// panel's own bounds -- Width 1-100 %, Scale 0.1-3, Opacity 0-100 %, Border
// Width 0-40 px, Padding 0-2 em, a marquee's Speed 10-1000 % -- not merely
// recorded from what the code returns.

const TEXT_FLAGS = {
    isFontSize: true,
    isGeometry: true,
    isCommonStyle: true,
    isBlendMode: false,
};
const MARQUEE_FLAGS = {
    isFontSize: false,
    isGeometry: false,
    isCommonStyle: true,
    isBlendMode: false,
};
const PICTURE_FLAGS = {
    isFontSize: false,
    isGeometry: true,
    isCommonStyle: false,
    isBlendMode: true,
};
const BARE_FLAGS = {
    isFontSize: false,
    isGeometry: false,
    isCommonStyle: false,
    isBlendMode: false,
};

function genContext(
    stored: Record<string, string> = {},
    extra: Partial<ForegroundLookContextType> = {},
): ForegroundLookContextType {
    return {
        widget: 'quick-text',
        prefix: 'qt',
        suffix: '-s1',
        flags: TEXT_FLAGS,
        read: (key) => {
            return stored[key] ?? null;
        },
        ...extra,
    };
}

function genMarquee(
    stored: Record<string, string> = {},
    widget = 'marquee-top',
) {
    return genContext(stored, {
        widget,
        prefix: `${widget}-s1`,
        flags: MARQUEE_FLAGS,
    });
}

function genPicture(stored: Record<string, string> = {}) {
    return genContext(stored, {
        widget: 'image',
        prefix: 'img',
        suffix: '',
        flags: PICTURE_FLAGS,
    });
}

function genBare() {
    return genContext(
        {},
        { widget: 'long-text', prefix: 'lt', flags: BARE_FLAGS },
    );
}

function plan(look: unknown, context = genContext()) {
    const result = planForegroundLook(look, context);
    if ('reason' in result) {
        throw new Error(`refused: ${result.reason}`);
    }
    return result;
}

function toWriteMap(look: unknown, context = genContext()) {
    return Object.fromEntries(
        plan(look, context).writes.map((write) => {
            return [write.key, write.value];
        }),
    );
}

function toReason(look: unknown, context = genContext()) {
    const result = planForegroundLook(look, context);
    if (!('reason' in result)) {
        throw new Error(`not refused: ${JSON.stringify(result.writes)}`);
    }
    return result.reason;
}

function toDecoration(look: unknown, context = genContext()) {
    const map = toWriteMap(look, context);
    const key = `${context.prefix}-setting-show-widget-decoration`;
    expect(Object.keys(map)).toContain(key);
    return JSON.parse(String(map[key]));
}

describe('what a look must be', () => {
    it.each([[null], ['make it big'], [[{ size: 'larger' }]], [42]])(
        'refuses %j as no object of fields',
        (look) => {
            expect(toReason(look)).toContain('look must be an object');
        },
    );

    it('refuses a look whose every field is empty', () => {
        expect(toReason({ size: undefined, color: null, font: '' })).toBe(
            'look has no field to change.',
        );
    });

    it('refuses a field no look has, naming what this component takes', () => {
        const reason = toReason({ sparkle: true });
        expect(reason).toContain('"sparkle" is not a look field');
        expect(reason).toContain('size, color, background');
        // A quick text has no marquee speed and no blend mode to offer.
        expect(reason).not.toContain('speed');
        expect(reason).not.toContain('blend');
    });

    it('is all or nothing: one bad field refuses the fields before it too', () => {
        const result = planForegroundLook(
            { size: 'larger', width: 60, opacity: 500 },
            genContext(),
        );
        expect(result).toEqual({ reason: 'opacity is a percentage, 0-100.' });
    });

    it('gives back the writes and the words in the order asked', () => {
        const result = plan({ width: 60, bold: true, position: 'top' });
        expect(result.writes.map((write) => write.key)).toEqual([
            'qt-setting-show-widget-width-percentage',
            'qt-common-font-weight',
            'qt-setting-show-widget-alignment-data',
            'qt-setting-show-widget-offset-x',
            'qt-setting-show-widget-offset-y',
        ]);
        expect(result.said).toEqual(['width 60%', 'bold', 'position top']);
    });
});

describe('which fields each kind of component takes', () => {
    it('a picture takes geometry and a blend mode, never a text colour', () => {
        expect(toReason({ color: 'red' }, genPicture())).toBe(
            'The image has no "color". It takes: size, position, width, ' +
                'scale, opacity, round, border, borderWidth, borderColor, ' +
                'shadow, padding, behind, onTop, blend, transition.',
        );
    });

    it('a marquee takes its speed and its words, never a place', () => {
        const reason = toReason({ width: 50 }, genMarquee());
        expect(reason).toContain('The marquee-top has no "width"');
        expect(reason).toContain('speed');
        expect(reason).toContain('color');
        expect(reason).not.toContain('position');
        expect(reason).not.toContain('blend');
    });

    it('a component with no Properties rows still takes the Effects and its layer', () => {
        const reason = toReason({ size: 'larger' }, genBare());
        expect(reason).toBe(
            'The long-text has no "size". It takes: round, border, ' +
                'borderWidth, borderColor, shadow, padding, behind, onTop, ' +
                'transition.',
        );
    });

    it('only a marquee has a speed', () => {
        expect(toReason({ speed: 150 })).toContain(
            'The quick-text has no "speed"',
        );
    });

    it('lists every field it knows', () => {
        expect(FOREGROUND_LOOK_FIELD_LIST).toHaveLength(26);
        expect(FOREGROUND_LOOK_FIELD_LIST).toContain('borderColor');
    });
});

describe('size of words with a Font Size row', () => {
    const FONT_SIZE = 'qt-setting-show-widget-font-size';

    it.each([
        ['48', 48],
        [48, 48],
        ['36px', 36],
        [8, 8],
        [600, 600],
    ])('takes %j px as %d', (value, expected) => {
        const result = plan({ size: value });
        expect(result.writes).toEqual([
            { key: FONT_SIZE, value: `${expected}` },
        ]);
        expect(result.said).toEqual([`size 100 → ${expected}px`]);
    });

    it.each([['bigger'], ['increase'], ['up'], ['more'], ['  LARGER ']])(
        'grows the default 100 by a quarter for %j',
        (value) => {
            expect(toWriteMap({ size: value })[FONT_SIZE]).toBe('125');
        },
    );

    it.each([['decrease'], ['down'], ['less']])(
        'shrinks to four fifths for %j',
        (value) => {
            expect(
                toWriteMap({ size: value }, genContext({ [FONT_SIZE]: '50' }))[
                    FONT_SIZE
                ],
            ).toBe('40');
        },
    );

    it('reads a stored size that is no number as the default', () => {
        expect(
            toWriteMap({ size: 'larger' }, genContext({ [FONT_SIZE]: 'big' }))[
                FONT_SIZE
            ],
        ).toBe('125');
    });

    it.each([[7], [601], ['huge'], [true]])(
        'refuses %j, naming the 8-600 px the row takes',
        (value) => {
            expect(toReason({ size: value })).toContain(
                'give px from 8 to 600',
            );
        },
    );

    it('never makes words smaller than the row allows', () => {
        // 9 x 0.8 is 7: under the 8 px the row starts at.
        expect(
            'reason' in
                planForegroundLook(
                    { size: 'smaller' },
                    genContext({ [FONT_SIZE]: '9' }),
                ),
        ).toBe(true);
        expect(
            'reason' in
                planForegroundLook(
                    { size: 'larger' },
                    genContext({ [FONT_SIZE]: '500' }),
                ),
        ).toBe(true);
    });
});

describe("a marquee's own size and speed", () => {
    const SIZE = 'foreground-marquee-top-font-size-s1';
    const SPEED = 'foreground-marquee-top-speed-percentage-s1';

    it('sets a px size from what it was, or from Auto', () => {
        const fromSixty = plan({ size: '48' }, genMarquee({ [SIZE]: '60' }));
        expect(fromSixty.writes).toEqual([{ key: SIZE, value: '48' }]);
        expect(fromSixty.said).toEqual(['size 60 → 48px']);
        const fromAuto = plan({ size: 48 }, genMarquee());
        expect(fromAuto.said).toEqual(['size 48px']);
    });

    it('makes a set size smaller by four fifths', () => {
        expect(
            toWriteMap({ size: 'smaller' }, genMarquee({ [SIZE]: '60' }))[SIZE],
        ).toBe('48');
    });

    it('puts it back on Auto (0) when told to take the size off', () => {
        for (const value of ['none', 'default', 'reset']) {
            const result = plan({ size: value }, genMarquee({ [SIZE]: '60' }));
            expect(result.writes).toEqual([{ key: SIZE, value: '0' }]);
            expect(result.said).toEqual(['size auto']);
        }
    });

    it('has no size to make smaller while on Auto', () => {
        const reason = toReason({ size: 'smaller' }, genMarquee());
        expect(reason).toContain('Auto size');
        expect(reason).toContain('no size to make smaller');
    });

    it.each([[-5], [601], ['enormous']])('refuses %j as no size', (value) => {
        expect(toReason({ size: value }, genMarquee())).toContain(
            'is not a size',
        );
    });

    it('a bottom marquee writes its own keys', () => {
        expect(
            toWriteMap(
                { size: 40, speed: 50 },
                genMarquee({}, 'marquee-bottom'),
            ),
        ).toEqual({
            'foreground-marquee-bottom-font-size-s1': '40',
            'foreground-marquee-bottom-speed-percentage-s1': '50',
        });
    });

    it('speeds up and slows down from what it was, or from normal (100)', () => {
        expect(
            toWriteMap({ speed: 'more' }, genMarquee({ [SPEED]: '200' }))[
                SPEED
            ],
        ).toBe('250');
        const slower = plan({ speed: 'less' }, genMarquee());
        expect(slower.writes).toEqual([{ key: SPEED, value: '80' }]);
        expect(slower.said).toEqual(['speed 80%']);
    });

    it('takes a percentage as the read answer writes it', () => {
        expect(toWriteMap({ speed: '150%' }, genMarquee())[SPEED]).toBe('150');
        expect(toWriteMap({ speed: 10 }, genMarquee())[SPEED]).toBe('10');
        expect(toWriteMap({ speed: 1000 }, genMarquee())[SPEED]).toBe('1000');
    });

    it.each([[9], [1001], ['zoom']])(
        'refuses a speed of %j, outside the 10-1000 the row takes',
        (value) => {
            expect(toReason({ speed: value }, genMarquee())).toContain(
                'speed is a percentage of normal, 10-1000',
            );
        },
    );
});

describe('a picture is sized by its scale', () => {
    const SCALE = 'img-setting-show-widget-scale';

    it('grows its scale by a quarter for "larger"', () => {
        const result = plan({ size: 'larger' }, genPicture());
        expect(result.writes).toEqual([{ key: SCALE, value: '1.25' }]);
        expect(result.said).toEqual(['scale 1 → 1.25']);
    });

    it('keeps the scale inside 0.1-3', () => {
        expect(
            toWriteMap({ size: 'larger' }, genPicture({ [SCALE]: '2.8' }))[
                SCALE
            ],
        ).toBe('3');
        expect(
            toWriteMap({ size: 'smaller' }, genPicture({ [SCALE]: '0.1' }))[
                SCALE
            ],
        ).toBe('0.1');
    });

    it('refuses a px size, which a scale cannot be', () => {
        expect(toReason({ size: 200 }, genPicture())).toContain(
            'sized by its scale, not by px',
        );
    });
});

describe('the geometry rows', () => {
    const SCALE = 'qt-setting-show-widget-scale';

    it('sets a scale, relative or as a number, to two places', () => {
        expect(
            toWriteMap({ scale: 'larger' }, genContext({ [SCALE]: '2' }))[
                SCALE
            ],
        ).toBe('2.5');
        const result = plan({ scale: '1.234' });
        expect(result.writes).toEqual([{ key: SCALE, value: '1.23' }]);
        expect(result.said).toEqual(['scale 1.23']);
    });

    it.each([
        [0.05, {}],
        [3.5, {}],
        ['larger', { [SCALE]: '2.8' }],
        ['wide', {}],
    ])('refuses a scale of %j outside 0.1-3', (value, stored) => {
        expect(toReason({ scale: value }, genContext(stored))).toBe(
            'scale must be from 0.1 to 3.',
        );
    });

    it('sets a width in whole percent of the screen', () => {
        const result = plan({ width: '75%' });
        expect(result.writes).toEqual([
            { key: 'qt-setting-show-widget-width-percentage', value: '75' },
        ]);
        expect(result.said).toEqual(['width 75%']);
        expect(
            toWriteMap({ width: 33.6 })[
                'qt-setting-show-widget-width-percentage'
            ],
        ).toBe('34');
    });

    it.each([[0], [101], ['wide']])('refuses a width of %j', (value) => {
        expect(toReason({ width: value })).toBe(
            'width is a percentage of the screen, 1-100.',
        );
    });

    it.each([
        [0, '0'],
        ['50%', '50'],
        [100, '100'],
        [12.5, '13'],
    ])('sets opacity %j as %s percent', (value, expected) => {
        const result = plan({ opacity: value });
        expect(result.writes).toEqual([
            {
                key: 'qt-setting-show-widget-opacity-percentage',
                value: expected,
            },
        ]);
        expect(result.said).toEqual([`opacity ${expected}%`]);
    });

    it.each([[-1], [101], ['clear']])('refuses opacity %j', (value) => {
        expect(toReason({ opacity: value })).toBe(
            'opacity is a percentage, 0-100.',
        );
    });

    it('puts it in a place, said back as the pad reads it', () => {
        const result = plan({ position: 'top-right' });
        expect(result.writes).toEqual([
            {
                key: 'qt-setting-show-widget-alignment-data',
                value: JSON.stringify({
                    horizontalAlignment: 'right',
                    verticalAlignment: 'start',
                }),
            },
            { key: 'qt-setting-show-widget-offset-x', value: null },
            { key: 'qt-setting-show-widget-offset-y', value: null },
        ]);
        expect(result.said).toEqual(['position top right']);
        expect(plan({ position: 'Middle' }).said).toEqual(['position center']);
    });

    it('refuses a place it cannot read', () => {
        expect(toReason({ position: 'near the pulpit' })).toContain(
            'is not a place',
        );
    });
});

describe('round corners', () => {
    const PX = 'qt-setting-show-widget-round-size-px';
    const PERCENT = 'qt-setting-show-widget-round-percentage';

    it('takes a px size and leaves the percentage, which px > 0 overrides', () => {
        const result = plan({ round: 12.6 });
        expect(result.writes).toEqual([{ key: PX, value: '13' }]);
        expect(result.said).toEqual(['round 13px']);
    });

    // A px size of 0 means "use the percentage": square corners need both.
    it.each([['none'], ['off'], [0], ['0']])(
        'makes square corners for %j by zeroing both units',
        (value) => {
            const result = plan({ round: value });
            expect(result.writes).toEqual([
                { key: PX, value: '0' },
                { key: PERCENT, value: '0' },
            ]);
            expect(result.said).toEqual(['square corners']);
        },
    );

    it.each([[501], [-2], ['soft']])('refuses a corner of %j', (value) => {
        expect(toReason({ round: value })).toBe(
            'round is the corner size in px, e.g. 12, or "none".',
        );
    });

    it('rounds a band with no geometry too', () => {
        expect(
            toWriteMap({ round: 8 }, genMarquee())[
                'marquee-top-s1-setting-show-widget-round-size-px'
            ],
        ).toBe('8');
    });
});

describe('colours, blur, font and weight', () => {
    const COLOR = 'qt-common-color';
    const BACKGROUND = 'qt-common-background-color';

    it('writes a colour word as the panel stores it, upper-case hex', () => {
        const result = plan({ color: 'Sky Blue', background: 'navy' });
        expect(result.writes).toEqual([
            { key: COLOR, value: '#87CEEB' },
            { key: BACKGROUND, value: '#000080' },
        ]);
        expect(result.said).toEqual([
            'text colour Sky Blue',
            'background navy',
        ]);
    });

    it('keeps a colour with its alpha', () => {
        expect(toWriteMap({ background: '#abcd' })[BACKGROUND]).toBe(
            '#AABBCCDD',
        );
        expect(toWriteMap({ background: '#000080AA' })[BACKGROUND]).toBe(
            '#000080AA',
        );
        expect(toWriteMap({ background: 'transparent' })[BACKGROUND]).toBe(
            '#00000000',
        );
    });

    it('takes a background off as see-through, the text colour back to the default', () => {
        const off = plan({ background: 'none', color: 'default' });
        expect(off.writes).toEqual([
            { key: BACKGROUND, value: '#00000000' },
            { key: COLOR, value: null },
        ]);
        expect(off.said).toEqual([
            'no background',
            'text colour back to the default',
        ]);
    });

    it('asks the renderer for a colour name the table lacks', () => {
        const context = genContext(
            {},
            {
                toHexColor: (value) => {
                    return value === 'rebeccapurple' ? '#663399' : null;
                },
            },
        );
        expect(toWriteMap({ color: 'rebeccapurple' }, context)[COLOR]).toBe(
            '#663399',
        );
        expect(toReason({ color: 'mauve-ish' }, context)).toBe(
            'color "mauve-ish" is not a colour: give a colour name or #rrggbb.',
        );
    });

    it('refuses what a resolver gives back that is no hex', () => {
        const context = genContext(
            {},
            {
                toHexColor: () => {
                    return 'rgb(1, 2, 3)';
                },
            },
        );
        expect(toReason({ background: 'clay' }, context)).toContain(
            'is not a colour',
        );
    });

    it.each([
        ['none', '0'],
        [12.4, '12'],
        ['8px', '8'],
        [50, '50'],
    ])('sets the blur behind the words for %j', (value, expected) => {
        const result = plan({ blur: value });
        expect(result.writes).toEqual([
            { key: 'qt-common-backdrop-filter', value: expected },
        ]);
        expect(result.said).toEqual([`blur ${expected}px`]);
    });

    it.each([[51], [-1], ['lots']])('refuses a blur of %j', (value) => {
        expect(toReason({ blur: value })).toBe(
            'blur is px behind the words, 0-50.',
        );
    });

    it('sets a font by its name, or back to the default', () => {
        expect(plan({ font: '  Georgia ' })).toEqual({
            writes: [{ key: 'qt-common-font-family', value: 'Georgia' }],
            said: ['font Georgia'],
        });
        expect(plan({ font: 'default' })).toEqual({
            writes: [{ key: 'qt-common-font-family', value: null }],
            said: ['font back to the default'],
        });
    });

    it.each([['a; color: red'], ['x'.repeat(81)], [42], ['<b>']])(
        'refuses %j as a font name',
        (value) => {
            expect(toReason({ font: value })).toBe(
                'font is the name of an installed font.',
            );
        },
    );

    it.each([
        [true, '700', 'bold'],
        ['yes', '700', 'bold'],
        ['On', '700', 'bold'],
        [false, null, 'not bold'],
        ['off', null, 'not bold'],
        ['No', null, 'not bold'],
    ])('bold %j writes the weight %j', (value, weight, words) => {
        expect(plan({ bold: value })).toEqual({
            writes: [{ key: 'qt-common-font-weight', value: weight }],
            said: [words],
        });
    });

    it.each([['maybe'], [1]])('refuses bold %j', (value) => {
        expect(toReason({ bold: value })).toBe('bold is true or false.');
    });
});

describe('the layer, the blend and the transition', () => {
    it('puts a component behind the slide, and back in front', () => {
        expect(plan({ behind: 'true' })).toEqual({
            writes: [
                { key: 'qt-setting-show-widget-is-behind', value: 'true' },
            ],
            said: ['behind the slide'],
        });
        expect(plan({ behind: 'no' })).toEqual({
            writes: [{ key: 'qt-setting-show-widget-is-behind', value: null }],
            said: ['in front of the slide'],
        });
        expect(toReason({ behind: 'under' })).toContain('behind is true');
    });

    it('keeps it always on top, or not', () => {
        expect(plan({ onTop: 'on' })).toEqual({
            writes: [
                { key: 'qt-setting-show-widget-always-on-top', value: 'true' },
            ],
            said: ['always on top'],
        });
        expect(plan({ onTop: false }).writes).toEqual([
            { key: 'qt-setting-show-widget-always-on-top', value: 'false' },
        ]);
        expect(plan({ onTop: false }).said).toEqual(['not always on top']);
        expect(toReason({ onTop: 'high' })).toContain('onTop is true');
    });

    it.each([
        ['Color Burn', 'color-burn'],
        ['soft light', 'soft-light'],
        ['PLUS-LIGHTER', 'plus-lighter'],
        ['luminosity', 'luminosity'],
    ])('reads the blend %j as the CSS mode %s', (value, mode) => {
        expect(plan({ blend: value }, genPicture())).toEqual({
            writes: [
                { key: 'img-setting-show-widget-blend-mode', value: mode },
            ],
            said: [`blend ${mode}`],
        });
    });

    it('refuses a blend mode CSS has not got, listing those it has', () => {
        const reason = toReason({ blend: 'glow' }, genPicture());
        expect(reason).toContain('blend "glow" is not a blend mode');
        expect(reason).toContain('multiply');
        expect(toReason({ blend: 7 }, genPicture())).toContain(
            'is not a blend mode',
        );
    });

    it.each([
        ['Fade', 'fade'],
        ['zoom', 'zoom'],
        ['move', 'move'],
        ['none', 'none'],
    ])(
        'sets the transition %j for the next time it comes up',
        (value, effect) => {
            expect(plan({ transition: value })).toEqual({
                writes: [
                    {
                        key: 'qt-setting-show-widget-transition',
                        value: effect,
                    },
                ],
                said: [`transition ${effect} (the next time it comes up)`],
            });
        },
    );

    it.each([['default'], ['off'], ['Reset']])(
        "hands %j back to the component's own transition",
        (value) => {
            expect(plan({ transition: value })).toEqual({
                writes: [
                    { key: 'qt-setting-show-widget-transition', value: null },
                ],
                said: ["the component's own transition"],
            });
        },
    );

    it.each([['slide'], [3]])('refuses the transition %j', (value) => {
        expect(toReason({ transition: value })).toContain(
            'fade, move, zoom, or "default"',
        );
    });
});

describe('the ONE Effects key', () => {
    const DECORATION = 'qt-setting-show-widget-decoration';

    it('merges every Effects field into one write after the others', () => {
        const result = plan(
            {
                border: 'Dashed',
                borderWidth: '2.5',
                borderColor: 'red',
                width: 40,
                shadow: 'Glow',
                textShadow: 'outline',
                textAlign: 'Centre',
                italic: true,
                underline: 'no',
                uppercase: 'yes',
                padding: 0.5,
            },
            genContext({
                [DECORATION]: JSON.stringify({
                    lineHeight: 1.4,
                    shadow: 'soft',
                }),
            }),
        );
        expect(result.writes.map((write) => write.key)).toEqual([
            'qt-setting-show-widget-width-percentage',
            DECORATION,
        ]);
        expect(JSON.parse(String(result.writes[1].value))).toEqual({
            lineHeight: 1.4,
            borderStyle: 'dashed',
            borderWidth: 2.5,
            borderColor: '#FF0000',
            shadow: 'glow',
            textShadow: 'outline',
            textAlign: 'center',
            isItalic: true,
            isUnderline: false,
            isUppercase: true,
            padding: 0.5,
        });
        expect(result.said).toEqual([
            'border dashed',
            'border 2.5px',
            'border colour red',
            'width 40%',
            'shadow glow',
            'text shadow outline',
            'words center',
            'italic',
            'not underline',
            'uppercase',
            'padding 0.5em',
        ]);
    });

    it('takes a border off as "none"', () => {
        const result = plan({ border: 'remove' });
        expect(JSON.parse(String(result.writes[0].value))).toEqual({
            borderStyle: 'none',
        });
        expect(result.said).toEqual(['no border']);
    });

    it('starts from nothing when the stored Effects are broken or empty', () => {
        expect(
            toDecoration(
                { textAlign: 'right' },
                genContext({ [DECORATION]: 'not json' }),
            ),
        ).toEqual({ textAlign: 'right' });
        expect(
            toDecoration(
                { textAlign: 'left' },
                genContext({ [DECORATION]: 'null' }),
            ),
        ).toEqual({ textAlign: 'left' });
    });

    it.each([
        [
            { border: 'wavy' },
            'border is one of: none, solid, dashed, dotted, double.',
        ],
        [{ border: 5 }, 'border is one of'],
        [{ borderWidth: 41 }, 'borderWidth is px, 0-40.'],
        [{ borderWidth: 'thick' }, 'borderWidth is px, 0-40.'],
        [{ borderColor: 'nope' }, 'borderColor "nope" is not a colour.'],
        [
            { shadow: 'huge' },
            'shadow is one of: none, soft, medium, strong, glow.',
        ],
        // The words' shadow has no "medium": that is the box's alone.
        [
            { textShadow: 'medium' },
            'textShadow is one of: none, soft, glow, outline.',
        ],
        [{ textShadow: 2 }, 'textShadow is one of'],
        [{ textAlign: 'justify' }, 'textAlign is left, center or right.'],
        [{ italic: 'slanted' }, 'italic is true or false.'],
        [{ uppercase: 3 }, 'uppercase is true or false.'],
        [{ padding: 3 }, 'padding is in em (the font size), 0-2.'],
        [{ padding: -0.1 }, 'padding is in em'],
    ])('refuses %j', (look, words) => {
        expect(toReason(look)).toContain(words);
    });

    it('a picture keeps its Effects under its own prefix', () => {
        expect(toDecoration({ shadow: 'strong' }, genPicture())).toEqual({
            shadow: 'strong',
        });
    });
});

describe('the words a place and a colour are given in', () => {
    it.each([[undefined], [5], ['   '], ['of the']])(
        'reads no place in %j',
        (value) => {
            expect(toForegroundAlignment(value)).toBeNull();
        },
    );

    it.each([
        [
            'lower left',
            { horizontalAlignment: 'left', verticalAlignment: 'end' },
        ],
        [
            'centre of the screen',
            { horizontalAlignment: 'center', verticalAlignment: 'center' },
        ],
        [
            'right_bottom',
            { horizontalAlignment: 'right', verticalAlignment: 'end' },
        ],
        ['left', { horizontalAlignment: 'left', verticalAlignment: 'center' }],
    ])('reads %j as the pad does', (value, expected) => {
        expect(toForegroundAlignment(value)).toEqual(expected);
    });

    it('says a stored place back in words, the centre for anything else', () => {
        expect(
            toForegroundPlaceWords(
                JSON.stringify({ verticalAlignment: 'start' }),
            ),
        ).toBe('top');
        expect(
            toForegroundPlaceWords(
                JSON.stringify({ horizontalAlignment: 'right' }),
            ),
        ).toBe('right');
        expect(
            toForegroundPlaceWords(
                JSON.stringify({
                    horizontalAlignment: 'center',
                    verticalAlignment: 'center',
                }),
            ),
        ).toBe('center');
        expect(toForegroundPlaceWords('{broken')).toBe('center');
        expect(toForegroundPlaceWords('null')).toBe('center');
    });

    it.each([
        ['#ABCDEF', '#abcdef'],
        ['#12345678', '#12345678'],
        ['#abcd', '#aabbccdd'],
        ['light_blue', '#add8e6'],
        ['dark-red', '#8b0000'],
        ['GREEN', '#008000'],
    ])('reads %j as %s', (value, expected) => {
        expect(toForegroundHexColor(value)).toBe(expected);
    });

    it('takes a resolved colour only when it is hex, lower-cased', () => {
        expect(
            toForegroundHexColor('hotpink', () => {
                return '#FF69B4';
            }),
        ).toBe('#ff69b4');
        expect(
            toForegroundHexColor('hotpink', () => {
                return '#FF69B';
            }),
        ).toBeNull();
        expect(toForegroundHexColor('#12345')).toBeNull();
    });
});
