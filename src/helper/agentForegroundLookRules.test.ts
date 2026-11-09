import { describe, expect, it } from 'vitest';

import {
    planForegroundLook,
    toForegroundAlignment,
    toForegroundHexColor,
    toForegroundPlaceWords,
    type ForegroundLookContextType,
} from './agentForegroundLookRules';

const TEXT_FLAGS = {
    isFontSize: true,
    isGeometry: true,
    isCommonStyle: true,
    isBlendMode: false,
};

function genContext(
    stored: Record<string, string> = {},
    extra: Partial<ForegroundLookContextType> = {},
): ForegroundLookContextType {
    return {
        widget: 'quick-text',
        prefix: 'quick-text-s1',
        suffix: '-s1',
        flags: TEXT_FLAGS,
        read: (key) => {
            return stored[key] ?? null;
        },
        ...extra,
    };
}

function toWriteMap(plan: ReturnType<typeof planForegroundLook>) {
    if ('reason' in plan) {
        throw new Error(plan.reason);
    }
    return Object.fromEntries(
        plan.writes.map((write) => {
            return [write.key, write.value];
        }),
    );
}

describe('a look in words, as the Properties panel writes it', () => {
    it('makes the words larger from what the session holds, or from 100', () => {
        expect(
            toWriteMap(planForegroundLook({ size: 'larger' }, genContext())),
        ).toEqual({ 'quick-text-s1-setting-show-widget-font-size': '125' });
        expect(
            toWriteMap(
                planForegroundLook(
                    { size: 'smaller' },
                    genContext({
                        'quick-text-s1-setting-show-widget-font-size': '40',
                    }),
                ),
            ),
        ).toEqual({ 'quick-text-s1-setting-show-widget-font-size': '32' });
    });

    it('writes colours as the panel stores them, a name read as hex', () => {
        const map = toWriteMap(
            planForegroundLook(
                { color: 'gold', background: '#123' },
                genContext(),
            ),
        );
        expect(map['quick-text-s1-common-color']).toBe('#FFD700');
        expect(map['quick-text-s1-common-background-color']).toBe('#112233');
    });

    it('puts it in a place and lets go of the old nudge', () => {
        const map = toWriteMap(
            planForegroundLook({ position: 'bottom left' }, genContext()),
        );
        expect(
            JSON.parse(
                String(map['quick-text-s1-setting-show-widget-alignment-data']),
            ),
        ).toEqual({ horizontalAlignment: 'left', verticalAlignment: 'end' });
        expect(map['quick-text-s1-setting-show-widget-offset-x']).toBeNull();
    });

    it('merges an Effects change into the ONE stored JSON, never over it', () => {
        const map = toWriteMap(
            planForegroundLook(
                { border: 'solid', textAlign: 'center' },
                genContext({
                    'quick-text-s1-setting-show-widget-decoration':
                        JSON.stringify({ shadow: 'glow', padding: 1 }),
                }),
            ),
        );
        expect(
            JSON.parse(
                String(map['quick-text-s1-setting-show-widget-decoration']),
            ),
        ).toEqual({
            shadow: 'glow',
            padding: 1,
            borderStyle: 'solid',
            textAlign: 'center',
        });
    });

    it('refuses a field the component has none of, naming what it takes', () => {
        const plan = planForegroundLook(
            { position: 'top' },
            genContext(
                {},
                {
                    widget: 'marquee-top',
                    prefix: 'marquee-top',
                    suffix: '',
                    flags: {
                        isFontSize: false,
                        isGeometry: false,
                        isCommonStyle: true,
                        isBlendMode: false,
                    },
                },
            ),
        );
        expect('reason' in plan && plan.reason).toContain('has no "position"');
        expect('reason' in plan && plan.reason).toContain('speed');
    });

    it('refuses the whole look when one field is wrong', () => {
        const plan = planForegroundLook(
            { size: 'larger', color: 'not a colour' },
            genContext(),
        );
        expect('reason' in plan).toBe(true);
    });

    it("a marquee's size is its own key, and Auto has no size to grow", () => {
        const context = genContext(
            { 'foreground-marquee-top-font-size-s1': '60' },
            {
                widget: 'marquee-top',
                prefix: 'marquee-top-s1',
                flags: {
                    isFontSize: false,
                    isGeometry: false,
                    isCommonStyle: true,
                    isBlendMode: false,
                },
            },
        );
        expect(
            toWriteMap(
                planForegroundLook({ size: 'larger', speed: 150 }, context),
            ),
        ).toEqual({
            'foreground-marquee-top-font-size-s1': '75',
            'foreground-marquee-top-speed-percentage-s1': '150',
        });
        const auto = planForegroundLook(
            { size: 'larger' },
            { ...context, read: () => null },
        );
        expect('reason' in auto && auto.reason).toContain('Auto size');
    });

    it('takes a blend mode only where the panel offers one', () => {
        const picture = genContext(
            {},
            {
                widget: 'image',
                prefix: 'image-show',
                flags: {
                    isFontSize: false,
                    isGeometry: true,
                    isCommonStyle: false,
                    isBlendMode: true,
                },
            },
        );
        expect(
            toWriteMap(planForegroundLook({ blend: 'Screen' }, picture)),
        ).toEqual({ 'image-show-setting-show-widget-blend-mode': 'screen' });
        expect(
            toWriteMap(planForegroundLook({ blend: 'normal' }, picture)),
        ).toEqual({ 'image-show-setting-show-widget-blend-mode': null });
        expect(
            'reason' in planForegroundLook({ blend: 'screen' }, genContext()),
        ).toBe(true);
    });
});

describe('the words a look is given in', () => {
    it('reads a place as the pad does', () => {
        expect(toForegroundAlignment('top')).toEqual({
            horizontalAlignment: 'center',
            verticalAlignment: 'start',
        });
        expect(toForegroundAlignment('the upper right')).toEqual({
            horizontalAlignment: 'right',
            verticalAlignment: 'start',
        });
        expect(toForegroundAlignment('somewhere nice')).toBeNull();
        expect(
            toForegroundPlaceWords(
                JSON.stringify({
                    horizontalAlignment: 'left',
                    verticalAlignment: 'end',
                }),
            ),
        ).toBe('bottom left');
        expect(toForegroundPlaceWords(null)).toBe('center');
    });

    it('reads a colour as hex, a resolver asked for the rest', () => {
        expect(toForegroundHexColor('#AbC')).toBe('#aabbcc');
        expect(toForegroundHexColor('Dark Blue')).toBe('#00008b');
        expect(
            toForegroundHexColor('rebeccapurple', () => {
                return '#663399';
            }),
        ).toBe('#663399');
        expect(toForegroundHexColor('rebeccapurple')).toBeNull();
        expect(toForegroundHexColor(42)).toBeNull();
    });
});
