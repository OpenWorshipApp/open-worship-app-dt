// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

// Same mocks as `canvasBlendMode.test.ts`, and for the same reasons:
// `appProvider` reads `document` at module load, and the real colour helpers
// close an import cycle back onto the class under test.
vi.mock('../../server/appProvider', () => ({
    default: {
        isPageReader: false,
        systemUtils: { isDev: true },
        messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
        appUtils: { base64Encode: vi.fn(), base64Decode: vi.fn() },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) => filePath.split('/').pop() ?? '',
            dirname: (filePath: string) =>
                filePath.split('/').slice(0, -1).join('/'),
            resolve: (...parts: string[]) => parts.join('/'),
        },
        fileUtils: {},
        appInfo: { titleFull: 'Open Worship app' },
    },
}));
vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    HEX_COLOR_WHITE: '#ffffff',
}));
vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
    isSupportedExt: vi.fn(() => true),
}));

import CanvasItem, { type CanvasItemPropsType } from './CanvasItem';
import { genTextDefaultBoxStyle } from './canvasHelpers';
import {
    CANVAS_SHADOW_BLUR_LIMIT,
    CANVAS_SHADOW_OFFSET_LIMIT,
    DEFAULT_CANVAS_SHADOW,
    cleanupCanvasShadow,
    genCanvasShadowStyle,
    toValidCanvasShadow,
} from './canvasShadowHelpers';

function genProps(
    extra: Partial<CanvasItemPropsType> = {},
): CanvasItemPropsType {
    return {
        ...genTextDefaultBoxStyle(),
        type: 'text',
        ...extra,
    } as CanvasItemPropsType;
}

const SOFT_SHADOW = {
    kind: 'box',
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    color: '#000000A6',
} as const;

class TestCanvasItem extends CanvasItem<CanvasItemPropsType> {
    getStyle() {
        return {};
    }
}

describe('canvas item shadow', () => {
    test('a kind no browser knows is no shadow, not a broken declaration', () => {
        expect(toValidCanvasShadow(SOFT_SHADOW)).toEqual(SOFT_SHADOW);
        expect(toValidCanvasShadow({ ...SOFT_SHADOW, kind: 'inner' })).toBe(
            null,
        );
        expect(toValidCanvasShadow({ ...SOFT_SHADOW, kind: 'BOX' })).toBe(null);
        expect(toValidCanvasShadow(null)).toBe(null);
        expect(toValidCanvasShadow(undefined)).toBe(null);
        expect(toValidCanvasShadow('0 8px 24px black')).toBe(null);
        expect(toValidCanvasShadow([SOFT_SHADOW])).toBe(null);
    });

    test('every other field is repaired rather than dropped', () => {
        // One unparseable token voids the whole CSS declaration, so a
        // hand-edited document must never reach the screen as written -- but a
        // wild number is a value to clamp, not a reason to throw away the
        // shadow the operator asked for.
        const repaired = toValidCanvasShadow({
            kind: 'drop',
            offsetX: 9999,
            offsetY: -9999,
            blur: -5,
            color: 'rgba(0,0,0,.5)',
        });
        expect(repaired).toEqual({
            kind: 'drop',
            offsetX: CANVAS_SHADOW_OFFSET_LIMIT,
            offsetY: -CANVAS_SHADOW_OFFSET_LIMIT,
            blur: 0,
            color: DEFAULT_CANVAS_SHADOW.color,
        });
        expect(
            toValidCanvasShadow({ kind: 'box', blur: Number.NaN })?.blur,
        ).toBe(0);
        // Whole pixels: a fraction only makes the document longer.
        expect(
            toValidCanvasShadow({ kind: 'box', offsetY: 7.6 })?.offsetY,
        ).toBe(8);
        expect(
            toValidCanvasShadow({ kind: 'box', blur: CANVAS_SHADOW_BLUR_LIMIT })
                ?.blur,
        ).toBe(CANVAS_SHADOW_BLUR_LIMIT);
    });

    test('stores a shadow, and stores NOTHING at all for none', () => {
        // The point of the absent key: a document written before shadows
        // existed has to round-trip byte for byte.
        const plain = new TestCanvasItem(genProps());
        expect('shadow' in plain.toJson()).toBe(false);

        const shadowed = new TestCanvasItem(
            genProps({ shadow: { ...SOFT_SHADOW } }),
        );
        expect(shadowed.toJson().shadow).toEqual(SOFT_SHADOW);

        const bogus = new TestCanvasItem(
            genProps({ shadow: { kind: 'none' } } as any),
        );
        expect('shadow' in bogus.toJson()).toBe(false);
    });

    test('picking No Shadow back REMOVES the key rather than writing it', () => {
        const item = new TestCanvasItem(
            genProps({ shadow: { ...SOFT_SHADOW } }),
        );
        item.applyProps({ shadow: null });
        expect('shadow' in item.props).toBe(false);

        item.applyProps({ shadow: { ...SOFT_SHADOW, kind: 'drop' } });
        expect(item.props.shadow?.kind).toBe('drop');
        // A patch that never mentions the shadow leaves the stored one alone.
        item.applyProps({ rotate: 15 });
        expect(item.props.shadow?.kind).toBe('drop');
    });

    test('a box with no shadow carries no declaration at all', () => {
        const style = CanvasItem.genShapeBoxStyle(genProps());
        expect('boxShadow' in style).toBe(false);
        expect('filter' in style).toBe(false);
        expect(genCanvasShadowStyle({})).toEqual({});
    });

    test('box is the rectangle, drop is what is painted', () => {
        expect(genCanvasShadowStyle({ shadow: { ...SOFT_SHADOW } })).toEqual({
            boxShadow: '0px 8px 24px #000000A6',
        });
        expect(
            genCanvasShadowStyle({
                shadow: { ...SOFT_SHADOW, kind: 'drop', offsetX: -12 },
            }),
        ).toEqual({ filter: 'drop-shadow(-12px 8px 24px #000000A6)' });
    });

    // Unlike the blend, the shadow IS the box's own dressing, so it belongs to
    // the shape style -- which is what the editor box and the properties
    // panel's preview well draw with. The operator has to see what the
    // projector will.
    test('the editor and the preview read the same shape style', () => {
        const props = genProps({ shadow: { ...SOFT_SHADOW } });
        expect(CanvasItem.genShapeBoxStyle(props).boxShadow).toBe(
            '0px 8px 24px #000000A6',
        );
        expect(CanvasItem.genBoxStyle(props).boxShadow).toBe(
            '0px 8px 24px #000000A6',
        );
    });

    // `genSlideHtml` runs `SlideRendererComp` through `renderToStaticMarkup`
    // and that string is what the screen window and the print PDF mount, so
    // the declaration has to survive serialization.
    test('the declaration survives into the screen/print markup', () => {
        const html = renderToStaticMarkup(
            createElement('div', {
                style: CanvasItem.genBoxStyle(
                    genProps({ shadow: { ...SOFT_SHADOW, kind: 'drop' } }),
                ),
            }),
        );
        expect(html).toContain('filter:drop-shadow(0px 8px 24px #000000A6)');
        const plainHtml = renderToStaticMarkup(
            createElement('div', { style: CanvasItem.genBoxStyle(genProps()) }),
        );
        expect(plainHtml).not.toContain('box-shadow');
        expect(plainHtml).not.toContain('drop-shadow');
    });

    test('validate accepts an absent shadow and refuses a non-object', () => {
        expect(() => {
            CanvasItem.validate(genProps() as any);
        }).not.toThrow();
        expect(() => {
            CanvasItem.validate(
                genProps({ shadow: { ...SOFT_SHADOW } }) as any,
            );
        }).not.toThrow();
        expect(() => {
            CanvasItem.validate(
                genProps({ shadow: '0 8px 24px' } as any) as any,
            );
        }).toThrow();
    });

    test('cleanupCanvasShadow writes back the repaired shadow', () => {
        const props: any = { shadow: { kind: 'box', blur: 1000 } };
        cleanupCanvasShadow(props);
        expect(props.shadow.blur).toBe(CANVAS_SHADOW_BLUR_LIMIT);
        expect(props.shadow.color).toBe(DEFAULT_CANVAS_SHADOW.color);

        const none: any = { shadow: {} };
        cleanupCanvasShadow(none);
        expect('shadow' in none).toBe(false);
    });
});
