import { describe, expect, test } from 'vitest';

import {
    applyTextTransform,
    calcCoverRect,
    calcObjectFit,
    compositeOverBlack,
    extractScreenBodyFontFamily,
    fileUrlToPath,
    parseCssColor,
    parseDataUrl,
    toAlign,
    toBoxGeometry,
    toCollapsedText,
} from './pptxStyleHelpers';

function genRadiusStyle(value: string) {
    return {
        borderTopLeftRadius: value,
        borderTopRightRadius: value,
        borderBottomRightRadius: value,
        borderBottomLeftRadius: value,
    };
}

describe('parseCssColor', () => {
    test('reads what a computed style and a slide JSON hold', () => {
        expect(parseCssColor('rgb(0, 128, 128)')).toEqual({
            hex: '008080',
            alpha: 1,
        });
        expect(parseCssColor('rgba(0, 0, 0, 0.482)')).toEqual({
            hex: '000000',
            alpha: 0.482,
        });
        expect(parseCssColor('rgb(255 0 255 / 50%)')).toEqual({
            hex: 'FF00FF',
            alpha: 0.5,
        });
        expect(parseCssColor('#0080808B')).toEqual({
            hex: '008080',
            alpha: 0x8b / 255,
        });
        expect(parseCssColor('#fff')).toEqual({ hex: 'FFFFFF', alpha: 1 });
        expect(parseCssColor('color(srgb 1 0.5 0 / 0.25)')).toEqual({
            hex: 'FF8000',
            alpha: 0.25,
        });
    });

    test('has no color for transparent or garbage', () => {
        expect(parseCssColor('transparent')).toBeNull();
        expect(parseCssColor('')).toBeNull();
        expect(parseCssColor('#12')).toBeNull();
        expect(parseCssColor('hsl(0 0% 0%)')).toBeNull();
    });

    test('a translucent background shows the black of a screen through', () => {
        expect(compositeOverBlack({ hex: 'FF8000', alpha: 0.5 })).toEqual({
            hex: '804000',
            alpha: 1,
        });
    });
});

describe('parseDataUrl / fileUrlToPath', () => {
    test('decodes base64 and percent-encoded data', () => {
        const base64 = parseDataUrl('data:image/png;base64,iVBORw0K');
        expect(base64?.mime).toBe('image/png');
        expect(Array.from(base64?.bytes ?? []).slice(0, 4)).toEqual([
            0x89, 0x50, 0x4e, 0x47,
        ]);
        const svg = parseDataUrl(
            'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E',
        );
        expect(svg?.mime).toBe('image/svg+xml');
        expect(new TextDecoder().decode(svg?.bytes)).toBe('<svg/>');
        expect(parseDataUrl('file:///x.png')).toBeNull();
    });

    test('turns a file URL back into a path on any OS', () => {
        expect(fileUrlToPath('file:///C:/Users/me/My%20Pictures/8.jpg')).toBe(
            'C:/Users/me/My Pictures/8.jpg',
        );
        expect(fileUrlToPath('file:///home/me/8.jpg')).toBe('/home/me/8.jpg');
        expect(fileUrlToPath('file://server/share/8.jpg')).toBe(
            '//server/share/8.jpg',
        );
    });
});

describe('calcObjectFit / calcCoverRect', () => {
    const box = { x: 0, y: 0, width: 1920, height: 1080 };
    const center = { x: 0.5, y: 0.5 };

    test('fill stretches, with nothing cut', () => {
        expect(calcObjectFit(box, 800, 600, 'fill', center)).toEqual({
            box,
            crop: null,
        });
    });

    test('cover cuts the overflow evenly off both sides', () => {
        const { box: painted, crop } = calcObjectFit(
            box,
            800,
            600,
            'cover',
            center,
        );
        expect(painted).toEqual(box);
        expect(crop?.left).toBe(0);
        expect(crop?.top).toBeCloseTo(0.125, 6);
        expect(crop?.bottom).toBeCloseTo(0.125, 6);
    });

    test('contain letterboxes and cuts nothing', () => {
        const { box: painted, crop } = calcObjectFit(
            box,
            800,
            600,
            'contain',
            center,
        );
        expect(crop).toBeNull();
        expect(painted).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
    });

    test('a screen covers with whole pixels, centered', () => {
        expect(calcCoverRect(1920, 1080, 1280, 720)).toEqual({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
        expect(calcCoverRect(1920, 1080, 1000, 1000)).toEqual({
            x: 0,
            y: -420,
            width: 1920,
            height: 1920,
        });
    });
});

describe('toBoxGeometry', () => {
    test('no radius is a plain rectangle', () => {
        expect(toBoxGeometry(genRadiusStyle('0px'), 100, 50)).toEqual({
            kind: 'rect',
        });
    });

    test('a pixel radius is circular and shrinks to fit like CSS', () => {
        expect(toBoxGeometry(genRadiusStyle('100px'), 1721, 343)).toEqual({
            kind: 'roundRect',
            radius: 100,
        });
        expect(toBoxGeometry(genRadiusStyle('100px'), 400, 60)).toEqual({
            kind: 'roundRect',
            radius: 30,
        });
    });

    test('a percentage radius rounds a long box elliptically', () => {
        expect(toBoxGeometry(genRadiusStyle('10%'), 400, 100)).toEqual({
            kind: 'ellipticRoundRect',
            radiusX: 40,
            radiusY: 10,
        });
    });
});

describe('text helpers', () => {
    test('whitespace collapses unless it is preserved', () => {
        expect(toCollapsedText('a \n\t b', 'normal')).toBe('a b');
        expect(toCollapsedText('a \n b', 'pre-wrap')).toBe('a \n b');
    });

    test('text-transform is applied to the words written out', () => {
        expect(applyTextTransform('amazing grace', 'uppercase')).toBe(
            'AMAZING GRACE',
        );
        expect(applyTextTransform('amazing grace', 'capitalize')).toBe(
            'Amazing Grace',
        );
    });

    test('text-align maps onto PowerPoint alignment', () => {
        expect(toAlign('center')).toBe('ctr');
        expect(toAlign('right')).toBe('r');
        expect(toAlign('end')).toBe('r');
        expect(toAlign('justify')).toBe('just');
        expect(toAlign('start')).toBe('l');
    });

    test('the screen`s body font is read from its stylesheet', () => {
        expect(
            extractScreenBodyFontFamily(
                'body {\n  font-family: system-ui, "Segoe UI", sans-serif;\n}\n' +
                    'html,\nbody,\ndiv {\n  margin: 0;\n}',
            ),
        ).toBe('system-ui, "Segoe UI", sans-serif');
        expect(
            extractScreenBodyFontFamily(
                'body{font-family:system-ui,Arial}html,body,div{margin:0}',
            ),
        ).toBe('system-ui,Arial');
        expect(extractScreenBodyFontFamily('div{color:red}')).toBe(
            'system-ui, sans-serif',
        );
    });
});
