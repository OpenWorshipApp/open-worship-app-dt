import { describe, expect, test } from 'vitest';

import {
    genBibleTextShadow,
    toBibleTextStyleView,
} from '../_screen/bibleTextStyleHelpers';
import {
    BIBLE_TEXT_LOOK_ID_LIST,
    findBibleTextLookId,
    genBibleBackdropPatch,
    genBibleTextEffectPatch,
    genBibleTextLookEffect,
    genBibleTextLookList,
    genBibleTextResetPatch,
    toBibleBackdrop,
    toBibleTextPanelEffect,
    toPreviewTextShadow,
} from './bibleTextLookHelpers';

describe('toBibleBackdrop', () => {
    test('light words are for a dark background, dark words for a light one', () => {
        expect(toBibleBackdrop('#FFFFFF')).toBe('dark');
        expect(toBibleBackdrop('#ffe680')).toBe('dark');
        expect(toBibleBackdrop('#000000')).toBe('light');
        expect(toBibleBackdrop('#16235F')).toBe('light');
        // What the first presets stored.
        expect(toBibleBackdrop('rgb(0, 0, 0)')).toBe('light');
    });
});

describe('the looks', () => {
    test.each(['dark', 'light'] as const)(
        'no two looks draw the same thing on a %s background',
        (backdrop) => {
            const lookList = genBibleTextLookList(backdrop);
            expect(lookList.map((look) => look.id)).toEqual([
                ...BIBLE_TEXT_LOOK_ID_LIST,
            ]);
            expect(new Set(lookList.map((look) => look.textShadow)).size).toBe(
                lookList.length,
            );
        },
    );

    test('a look is edged in what shows against its words', () => {
        expect(genBibleTextLookEffect('outline', 'dark').outlineColor).toBe(
            '#000000',
        );
        expect(genBibleTextLookEffect('outline', 'light').outlineColor).toBe(
            '#FFFFFF',
        );
    });

    test('the look the screen wears is found by what is drawn', () => {
        const lookList = genBibleTextLookList('dark');
        expect(findBibleTextLookId(lookList, 'none')).toBe('normal');
        expect(
            findBibleTextLookId(
                lookList,
                genBibleTextShadow(genBibleTextLookEffect('halo', 'dark')),
            ),
        ).toBe('halo');
        // The same look for the other background is not this one...
        expect(
            findBibleTextLookId(
                lookList,
                genBibleTextShadow(genBibleTextLookEffect('halo', 'light')),
            ),
        ).toBeNull();
        // ...and neither is anything made by hand.
        expect(findBibleTextLookId(lookList, '2px 2px 0 #000')).toBeNull();
    });
});

describe('toBibleTextPanelEffect', () => {
    test('a layer that is off comes on in a colour that shows', () => {
        // Stored while the words were white, so every colour is black.
        const stored = genBibleTextLookEffect('normal', 'dark');
        const effect = toBibleTextPanelEffect(stored, 'light');
        expect(effect.outlineColor).toBe('#FFFFFF');
        expect(effect.shadowColor).toBe('#FFFFFF');
        expect(effect.glowColor).toBe('#FFFFFF');
    });

    test('a layer that is on keeps the colour somebody chose', () => {
        const effect = toBibleTextPanelEffect(
            {
                ...genBibleTextLookEffect('normal', 'dark'),
                outlineWidth: 0.03,
                outlineColor: '#000080',
                shadowY: 0.04,
                shadowColor: '#112233CC',
            },
            'light',
        );
        expect(effect.outlineColor).toBe('#000080');
        expect(effect.shadowColor).toBe('#112233CC');
        expect(effect.glowColor).toBe('#FFFFFF');
    });

    test('CSS written by hand opens the sliders on nothing', () => {
        const effect = toBibleTextPanelEffect(null, 'dark');
        expect(genBibleTextShadow(effect)).toBe('none');
        expect(effect.outlineColor).toBe('#000000');
    });
});

describe('genBibleBackdropPatch', () => {
    test('carries a look across, words and edge together', () => {
        const view = toBibleTextStyleView({
            color: '#FFFFFF',
            ...genBibleTextEffectPatch(
                genBibleTextLookEffect('lifted', 'dark'),
            ),
        });
        const patch = genBibleBackdropPatch(view, 'light');
        expect(patch.color).toBe('#000000');
        expect(patch.effect).toEqual(genBibleTextLookEffect('lifted', 'light'));
        expect(patch.textShadow).toBe(
            genBibleTextShadow(genBibleTextLookEffect('lifted', 'light')),
        );
    });

    test('flips the black or white of a hand-made effect and keeps a chosen colour', () => {
        const effect = {
            ...genBibleTextLookEffect('normal', 'dark'),
            outlineWidth: 0.045,
            outlineColor: '#000080',
            shadowY: 0.06,
            shadowBlur: 0.03,
            shadowColor: '#000000B3',
        };
        const view = toBibleTextStyleView({
            color: '#FFFFFF',
            ...genBibleTextEffectPatch(effect),
        });
        const patch = genBibleBackdropPatch(view, 'light');
        expect(patch.color).toBe('#000000');
        expect(patch.effect.outlineColor).toBe('#000080');
        // The alpha rides along.
        expect(patch.effect.shadowColor).toBe('#FFFFFFB3');
        expect(patch.effect.outlineWidth).toBe(0.045);
        expect(patch.textShadow).toBe(genBibleTextShadow(patch.effect));
    });

    test('leaves CSS written by hand as written', () => {
        const view = toBibleTextStyleView({
            color: '#FFFFFF',
            textShadow: '2px 2px 0 #000',
        });
        expect(genBibleBackdropPatch(view, 'light')).toEqual({
            color: '#000000',
        });
    });
});

describe('genBibleTextResetPatch', () => {
    test('clears the look and keeps the size', () => {
        const patch = genBibleTextResetPatch('light');
        expect(patch).not.toHaveProperty('fontSize');
        const view = toBibleTextStyleView({
            fontFamily: 'Georgia',
            fontSize: 101,
            color: '#ff0000',
            isBold: true,
            isItalic: true,
            lineHeight: 2,
            letterSpacing: 0.1,
            textAlign: 'center',
            ...genBibleTextEffectPatch(genBibleTextLookEffect('halo', 'dark')),
            ...patch,
        });
        expect(view).toEqual({
            ...toBibleTextStyleView({}),
            fontSize: 101,
            color: '#000000',
        });
    });
});

describe('toPreviewTextShadow', () => {
    test('a look in em is the same look at any size', () => {
        const textShadow = genBibleTextShadow(
            genBibleTextLookEffect('halo', 'dark'),
        );
        expect(toPreviewTextShadow(textShadow, 101)).toBe(textShadow);
    });

    test('pixels are scaled to the sample, so an old preset is not drawn four times as heavy', () => {
        expect(toPreviewTextShadow('2px -2px 0 #000, 0 0 5PX red', 100)).toBe(
            '0.02em -0.02em 0 #000, 0 0 0.05em red',
        );
    });
});
