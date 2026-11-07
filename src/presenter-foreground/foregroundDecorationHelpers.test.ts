import { beforeEach, describe, expect, test, vi } from 'vitest';

// How an overlay is dressed: read back from a file a person can edit, field
// by field, and turned into the inline style a projector draws.

const { state } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => {
        return state.settings.get(name) ?? null;
    },
}));

import type { ForegroundDecorationType } from './foregroundDecorationHelpers';
import {
    DEFAULT_FOREGROUND_DECORATION,
    checkIsDecorationEngaged,
    genDecorationDefault,
    genDecorationSettingName,
    genForegroundBoxShadow,
    genForegroundDecorationStyle,
    genForegroundTextShadow,
    getDecorationBorderWidth,
    getForegroundDecoration,
    toForegroundDecoration,
} from './foregroundDecorationHelpers';

function genDecoration(
    data: Partial<ForegroundDecorationType> = {},
): ForegroundDecorationType {
    return { ...DEFAULT_FOREGROUND_DECORATION, ...data };
}

beforeEach(() => {
    state.settings.clear();
});

describe('reading a dressing back', () => {
    test('nothing, a blank, broken JSON or a bare value is the fallback itself', () => {
        const fallback = genDecoration({ padding: 0 });
        for (const storedText of [
            null,
            '   ',
            '{"borderStyle":',
            'null',
            '5',
            '"solid"',
        ]) {
            expect(
                toForegroundDecoration(storedText, fallback),
                `${storedText}`,
            ).toBe(fallback);
        }
        expect(toForegroundDecoration(null)).toBe(
            DEFAULT_FOREGROUND_DECORATION,
        );
    });

    test('a junk field falls back alone, and a number is held to its range', () => {
        const decoration = toForegroundDecoration(
            JSON.stringify({
                borderStyle: 'groove',
                borderWidth: 400,
                borderColor: 'red',
                shadow: 'glow',
                shadowColor: '#ABC',
                padding: '0.5',
                textAlign: 'justify',
                lineHeight: -1,
                letterSpacing: 'wide',
                textShadow: 'outline',
                textShadowColor: '#11223344',
                isItalic: 'true',
                isUnderline: true,
                isUppercase: 1,
            }),
        );
        expect(decoration).toEqual({
            borderStyle: 'none',
            borderWidth: 40,
            borderColor: '#FFFFFF',
            shadow: 'glow',
            shadowColor: '#ABC',
            padding: 0.5,
            textAlign: 'left',
            lineHeight: 0,
            letterSpacing: 0,
            textShadow: 'outline',
            textShadowColor: '#11223344',
            // Only a real `true` turns a style on.
            isItalic: false,
            isUnderline: true,
            isUppercase: false,
        });
    });

    test('a widget reads its own setting, and a picture starts with no padding', () => {
        state.settings.set(
            genDecorationSettingName('message-a'),
            JSON.stringify({ borderStyle: 'dashed' }),
        );
        expect(genDecorationSettingName('message-a')).toBe(
            'message-a-setting-show-widget-decoration',
        );
        expect(getForegroundDecoration('message-a', true)).toEqual(
            genDecoration({ borderStyle: 'dashed' }),
        );
        expect(getForegroundDecoration('video-b', false)).toEqual(
            genDecoration({ padding: 0 }),
        );
        expect(genDecorationDefault(true)).toBe(DEFAULT_FOREGROUND_DECORATION);
    });

    test('a dressing is engaged once any field differs from where it started', () => {
        const fallback = genDecorationDefault(false);
        expect(
            checkIsDecorationEngaged(genDecoration({ padding: 0 }), fallback),
        ).toBe(false);
        expect(
            checkIsDecorationEngaged(
                genDecoration({ padding: 0, isUppercase: true }),
                fallback,
            ),
        ).toBe(true);
    });
});

describe('a dressing as CSS', () => {
    test('every box shadow preset, in the colour chosen', () => {
        const toShadow = (shadow: ForegroundDecorationType['shadow']) => {
            return genForegroundBoxShadow(
                genDecoration({ shadow, shadowColor: '#112233' }),
            );
        };
        expect(toShadow('none')).toBe('none');
        expect(toShadow('soft')).toBe('0 4px 12px #112233');
        expect(toShadow('medium')).toBe('0 10px 30px #112233');
        expect(toShadow('strong')).toBe('0 18px 50px #112233');
        expect(toShadow('glow')).toBe('0 0 20px #112233, 0 0 45px #112233');
    });

    test('every text shadow preset, sized to the letters', () => {
        const toShadow = (
            textShadow: ForegroundDecorationType['textShadow'],
        ) => {
            return genForegroundTextShadow(
                genDecoration({ textShadow, textShadowColor: '#445566' }),
            );
        };
        expect(toShadow('none')).toBe('none');
        expect(toShadow('soft')).toBe('0 0.03em 0.06em #445566');
        expect(toShadow('glow')).toBe('0 0 0.12em #445566, 0 0 0.25em #445566');
        expect(toShadow('outline')).toBe(
            '-0.03em -0.03em 0 #445566, 0.03em -0.03em 0 #445566,' +
                ' -0.03em 0.03em 0 #445566, 0.03em 0.03em 0 #445566',
        );
    });

    test('words are set as chosen, each style only when it is on', () => {
        const style = genForegroundDecorationStyle(
            genDecoration({
                padding: 0,
                textAlign: 'center',
                lineHeight: 1.5,
                letterSpacing: 0.1,
                textShadow: 'glow',
                textShadowColor: '#000000',
                isItalic: true,
                isUnderline: true,
                isUppercase: true,
            }),
            { isText: true, isBlending: false },
        );
        expect(style).toEqual({
            boxShadow: '0 10px 30px #00000040',
            textAlign: 'center',
            lineHeight: 1.5,
            letterSpacing: '0.1em',
            textShadow: '0 0 0.12em #000000, 0 0 0.25em #000000',
            fontStyle: 'italic',
            textDecoration: 'underline',
            textTransform: 'uppercase',
        });
        // Plain words carry only their alignment.
        expect(
            genForegroundDecorationStyle(genDecoration({ padding: 0 }), {
                isText: true,
                isBlending: false,
            }),
        ).toEqual({ boxShadow: '0 10px 30px #00000040', textAlign: 'left' });
    });

    test('a frame fits inside the width asked for, and a picture has no text styles', () => {
        const decoration = genDecoration({
            borderStyle: 'double',
            borderWidth: 6,
            borderColor: '#FF0000',
            isUnderline: true,
        });
        expect(getDecorationBorderWidth(decoration)).toBe(6);
        expect(
            genForegroundDecorationStyle(decoration, {
                isText: false,
                isBlending: false,
            }),
        ).toEqual({
            border: '6px double #FF0000',
            padding: '0.25em',
            boxSizing: 'border-box',
            boxShadow: '0 10px 30px #00000040',
        });
        // A width with the style off is no frame at all.
        expect(
            getDecorationBorderWidth(genDecoration({ borderWidth: 6 })),
        ).toBe(0);
    });

    test('blending drops only the shadow nobody chose', () => {
        const blending = { isText: false, isBlending: true };
        expect(
            genForegroundDecorationStyle(
                genDecoration({ padding: 0 }),
                blending,
            ),
        ).toEqual({});
        expect(
            genForegroundDecorationStyle(
                genDecoration({ padding: 0, shadow: 'soft' }),
                blending,
            ),
        ).toEqual({ boxShadow: '0 4px 12px #00000040' });
        expect(
            genForegroundDecorationStyle(
                genDecoration({ padding: 0, shadowColor: '#FF000080' }),
                blending,
            ),
        ).toEqual({ boxShadow: '0 10px 30px #FF000080' });
    });
});
