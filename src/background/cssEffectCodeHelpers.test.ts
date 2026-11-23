import { describe, expect, it } from 'vitest';

import {
    CSS_ANIMATION_NAME_LIST,
    type CssAnimationType,
} from './animationValueHelpers';
import { checkCssCodeProblem } from './cssCodeCheckHelpers';
import {
    CSS_CODE_DOT_COUNT_MAP,
    CSS_CODE_STARTER,
    checkCssCodeNeeds,
    findCssCodeHint,
} from './cssCodeAnimationHelpers';
import { CSS_EFFECT_CODE_MAP, genCssEffectCode } from './cssEffectCodeHelpers';

function genAnimation(
    overrides: Partial<CssAnimationType> = {},
): CssAnimationType {
    return {
        engine: 'css',
        name: 'rays',
        code: null,
        colors: ['#0B1026', '#F59E0B', '#FDE68A'],
        speed: 'normal',
        density: 'normal',
        opacity: 100,
        blend: 'normal',
        ...overrides,
    };
}

// The built-in effects: a custom animation is named apart, `custom`.
const BUILT_IN_NAME_LIST = CSS_ANIMATION_NAME_LIST;

/** An effect's rules, its comments -- the header naming every slot -- out. */
function genRules(name: (typeof BUILT_IN_NAME_LIST)[number]) {
    return CSS_EFFECT_CODE_MAP[name].replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

function listAccentSlots(name: (typeof BUILT_IN_NAME_LIST)[number]) {
    return [...genRules(name).matchAll(/var\(--accent-(\d)\)/g)].map(
        (match) => {
            return Number(match[1]);
        },
    );
}

describe('CSS_EFFECT_CODE_MAP', () => {
    it('writes every built-in effect, and each passes the code check', () => {
        expect(Object.keys(CSS_EFFECT_CODE_MAP).sort()).toEqual(
            [...BUILT_IN_NAME_LIST].sort(),
        );
        for (const name of BUILT_IN_NAME_LIST) {
            const code = CSS_EFFECT_CODE_MAP[name];
            // Applied as it stands, it must go up: Apply is never greyed
            // out on the code the panel opened with.
            expect(checkCssCodeProblem(code), name).toBeNull();
            // Nothing the assistant would be told to fix.
            expect(findCssCodeHint(code), name).toBeNull();
        }
    });

    it('draws dots only for an effect made of them', () => {
        // A gradient sheet costs no boxes: its comment names the dots, its
        // rules do not.
        const dotless = ['rays', 'cross', 'stars'];
        for (const name of BUILT_IN_NAME_LIST) {
            expect(
                checkCssCodeNeeds(CSS_EFFECT_CODE_MAP[name]).isDotNeeded,
                name,
            ).toBe(!dotless.includes(name));
            expect(
                checkCssCodeNeeds(CSS_EFFECT_CODE_MAP[name]).isLayerNeeded,
                name,
            ).toBe(true);
        }
    });

    it('names no colour of its own: the pickers keep working', () => {
        for (const name of BUILT_IN_NAME_LIST) {
            const code = CSS_EFFECT_CODE_MAP[name];
            expect(code, name).not.toMatch(/#[0-9a-f]{3,8}\b/i);
            expect(code, name).not.toMatch(/\b(?:rgb|hsl)a?\(/i);
            expect(code, name).toMatch(/var\(--(?:color-[2-4]|accent)/);
        }
    });

    it('gives each part the accent the built-in gives it', () => {
        // The built-ins colour part i with the i-th colour after the
        // ground, going round (`genAccents`): three colours go a, b, a, b.
        // The frame's slot k is accent (k - 1) mod count, and a dot's own
        // `--accent` is its turn among its siblings, (dot - 1) mod 6 + 1.
        const turnOf = (dot: number) => {
            return ((dot - 1) % 6) + 1;
        };
        const turns = (list: number[]) => {
            return list.map(turnOf);
        };
        expect(CSS_EFFECT_CODE_MAP.clouds).toContain(
            '.dot:is(:nth-child(-n + 4), :nth-child(n + 11):nth-child(-n + 15))',
        );
        // Light i, cloud i: the turn i + 1, so accent i, whatever the count.
        expect(turns([1, 2, 3, 10, 17, 18])).toEqual([1, 2, 3, 4, 5, 6]);
        expect(turns([1, 2, 3, 4, 11, 12, 13, 14, 15])).toEqual([
            1, 2, 3, 4, 5, 6, 1, 2, 3,
        ]);
        // A band, a glow: named one by one.
        for (const name of ['waves', 'breathe'] as const) {
            expect(listAccentSlots(name), name).toEqual([1, 2, 3, 4]);
        }
        // Star j of sheet s: accent s + j, as `(index + dotIndex)`.
        expect(listAccentSlots('stars')).toEqual([
            1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 3, 4, 5, 6, 1,
        ]);
        // A dot or sheet effect reads its own accent, never a colour by
        // place past the first.
        for (const name of [
            'aurora',
            'bokeh',
            'embers',
            'snow',
            'clouds',
            'rays',
            'leaves',
            'fireworks',
            'petals',
            'confetti',
            'hearts',
        ] as const) {
            const rules = genRules(name);
            expect(rules, name).toContain('var(--accent)');
            expect(rules, name).not.toMatch(/var\(--color-3\)/);
        }
    });

    it('shows as many of a dotted effect as the built-in, by Density', () => {
        // Aurora's selector keeps dots 1-3, 10, 17 and 18 of layer 1: 3, 4
        // and 6 lights, as the built-in draws.
        const shown = (count: number, list: number[]) => {
            return list.filter((index) => {
                return index <= count;
            }).length;
        };
        expect(CSS_EFFECT_CODE_MAP.aurora).toContain(
            ':is(:nth-child(-n + 3), :nth-child(10), :nth-child(17), :nth-child(18))',
        );
        const auroraDots = [1, 2, 3, 10, 17, 18];
        expect([
            shown(CSS_CODE_DOT_COUNT_MAP.low, auroraDots),
            shown(CSS_CODE_DOT_COUNT_MAP.normal, auroraDots),
            shown(CSS_CODE_DOT_COUNT_MAP.high, auroraDots),
        ]).toEqual([3, 4, 6]);
        const bandDots = [1, 2, 7, 13];
        const cloudDots = [1, 2, 3, 4, 11, 12, 13, 14, 15];
        expect([
            shown(CSS_CODE_DOT_COUNT_MAP.low, cloudDots),
            shown(CSS_CODE_DOT_COUNT_MAP.normal, cloudDots),
            shown(CSS_CODE_DOT_COUNT_MAP.high, cloudDots),
        ]).toEqual([4, 6, 9]);
        for (const name of ['waves', 'breathe'] as const) {
            expect(CSS_EFFECT_CODE_MAP[name]).toContain(
                ':is(:nth-child(-n + 2), :nth-child(7), :nth-child(13))',
            );
        }
        expect([
            shown(CSS_CODE_DOT_COUNT_MAP.low, bandDots),
            shown(CSS_CODE_DOT_COUNT_MAP.normal, bandDots),
            shown(CSS_CODE_DOT_COUNT_MAP.high, bandDots),
        ]).toEqual([2, 3, 4]);
    });
});

describe('the effects of 2026-11-19, written as CSS', () => {
    it('move what turns apart from what falls or rises, each its own property', () => {
        // A fall moves `translate` and a turn `rotate`, so neither animation
        // stops the other on the one box.
        for (const name of [
            'leaves',
            'petals',
            'confetti',
            'hearts',
        ] as const) {
            const rules = genRules(name);
            expect(rules, name).toMatch(
                /@keyframes (?:fall|rise)\s*\{[^@]*translate:/,
            );
            expect(rules, name).toMatch(
                /@keyframes (?:tumble|swing)\s*\{[^@]*rotate:/,
            );
            expect(rules, name).not.toMatch(
                /@keyframes (?:fall|rise)\s*\{[^@]*transform:/,
            );
        }
        // A candle is its body, its halo and its flame: one box and two of
        // its own pseudo-elements, not three boxes.
        expect(genRules('candles')).toContain('.dot::before');
        expect(genRules('candles')).toContain('.dot::after');
        expect(genRules('candles')).toContain("content: '';");
    });

    it('show as many as the built-in, by Density', () => {
        const shown = (count: number, list: number[]) => {
            return list.filter((index) => {
                return index <= count;
            }).length;
        };
        const levels = (list: number[]) => {
            return [
                shown(CSS_CODE_DOT_COUNT_MAP.low, list),
                shown(CSS_CODE_DOT_COUNT_MAP.normal, list),
                shown(CSS_CODE_DOT_COUNT_MAP.high, list),
            ];
        };
        // Fireworks: dots 1-3, 7 and 8, 13 to 15 -- 3, 5 and 8 bursts.
        expect(CSS_EFFECT_CODE_MAP.fireworks).toContain(
            ':is(:nth-child(-n + 3), :nth-child(n + 7):nth-child(-n + 8), :nth-child(n + 13):nth-child(-n + 15))',
        );
        expect(levels([1, 2, 3, 7, 8, 13, 14, 15])).toEqual([3, 5, 8]);
        // Candles: dots 1-5, 7 to 9, 13 to 16 -- 5, 8 and 12.
        expect(CSS_EFFECT_CODE_MAP.candles).toContain(
            ':is(:nth-child(-n + 5), :nth-child(n + 7):nth-child(-n + 9), :nth-child(n + 13):nth-child(-n + 16))',
        );
        expect(levels([1, 2, 3, 4, 5, 7, 8, 9, 13, 14, 15, 16])).toEqual([
            5, 8, 12,
        ]);
    });
});

describe('genCssEffectCode', () => {
    it('is the picked effect, whatever its colours, speed or density', () => {
        const rays = genCssEffectCode(genAnimation());
        expect(rays).toContain('Light Rays, written as CSS.');
        expect(rays).not.toBe(CSS_CODE_STARTER);
        expect(
            genCssEffectCode(
                genAnimation({
                    colors: ['#000000'],
                    speed: 'fast',
                    density: 'high',
                }),
            ),
        ).toBe(rays);
        expect(genCssEffectCode(genAnimation({ name: 'snow' }))).toBe(
            CSS_EFFECT_CODE_MAP.snow,
        );
    });

    it('is a custom animation’s own code, else the starter', () => {
        expect(
            genCssEffectCode(
                genAnimation({ name: 'custom', code: '.scene {}' }),
            ),
        ).toBe('.scene {}');
        expect(genCssEffectCode(genAnimation({ name: 'custom' }))).toBe(
            CSS_CODE_STARTER,
        );
    });
});
