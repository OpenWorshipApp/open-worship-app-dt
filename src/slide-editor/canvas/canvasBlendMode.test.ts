// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

// `appProvider` reads `document` and its own provider source at module load,
// and `CanvasItem` reaches it through the progress bar and the app hooks.
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
// The real module reaches the drag helpers and from there
// `appDocumentHelpers`, which imports `CanvasController` and so closes a cycle
// back onto the class under test (memory `app-document-helpers-lyric-cycle`).
vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    HEX_COLOR_WHITE: '#ffffff',
}));
vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
    isSupportedExt: vi.fn(() => true),
}));

import {
    BLEND_MODE_GROUP_LIST,
    checkIsBlending,
    DEFAULT_BLEND_MODE,
    toValidBlendMode,
} from '../../helper/blendModeHelpers';
import CanvasItem, {
    cleanupBlendMode,
    genBoxBorderRadius,
    type CanvasItemPropsType,
} from './CanvasItem';
import { genTextDefaultBoxStyle } from './canvasHelpers';

function genProps(
    extra: Partial<CanvasItemPropsType> = {},
): CanvasItemPropsType {
    return {
        ...genTextDefaultBoxStyle(),
        type: 'text',
        ...extra,
    } as CanvasItemPropsType;
}

class TestCanvasItem extends CanvasItem<CanvasItemPropsType> {
    getStyle() {
        return {};
    }
}

describe('canvas item blend mode', () => {
    test('offers every mode the screen can paint, and no duplicates', () => {
        const values = BLEND_MODE_GROUP_LIST.flatMap((group) => {
            return group.modes.map((mode) => {
                return mode.value as string;
            });
        });
        expect(values).toHaveLength(new Set(values).size);
        expect(values).toContain('multiply');
        expect(values).toContain('screen');
        // Safari's alone: it would void the whole declaration in Chromium.
        expect(values).not.toContain('plus-darker');
        expect(values).not.toContain(DEFAULT_BLEND_MODE);
    });

    test('refuses a value no browser knows, so one cannot void the style', () => {
        expect(toValidBlendMode('multiply')).toBe('multiply');
        expect(toValidBlendMode('nonsense')).toBe(DEFAULT_BLEND_MODE);
        expect(toValidBlendMode(null)).toBe(DEFAULT_BLEND_MODE);
        expect(toValidBlendMode(undefined)).toBe(DEFAULT_BLEND_MODE);
        expect(checkIsBlending('multiply')).toBe(true);
        expect(checkIsBlending(DEFAULT_BLEND_MODE)).toBe(false);
        expect(checkIsBlending(undefined)).toBe(false);
    });

    test('stores a mode, and stores NOTHING at all for normal', () => {
        // The point of the absent key: a document written before blending
        // existed has to round-trip byte for byte.
        const plain = new TestCanvasItem(genProps());
        expect('blendMode' in plain.toJson()).toBe(false);

        const blended = new TestCanvasItem(genProps({ blendMode: 'multiply' }));
        expect(blended.toJson().blendMode).toBe('multiply');

        const bogus = new TestCanvasItem(
            genProps({ blendMode: 'nonsense' } as any),
        );
        expect('blendMode' in bogus.toJson()).toBe(false);
    });

    test('picking Normal back REMOVES the key rather than writing it', () => {
        const item = new TestCanvasItem(genProps({ blendMode: 'screen' }));
        item.applyProps({ blendMode: DEFAULT_BLEND_MODE });
        expect('blendMode' in item.props).toBe(false);

        item.applyProps({ blendMode: 'overlay' });
        expect(item.props.blendMode).toBe('overlay');
        // A patch that never mentions the blend leaves the stored one alone.
        item.applyProps({ rotate: 15 });
        expect(item.props.blendMode).toBe('overlay');
    });

    test('an unblended box carries no mix-blend-mode declaration', () => {
        const style = CanvasItem.genBoxStyle(genProps());
        expect('mixBlendMode' in style).toBe(false);
        expect(CanvasItem.genBlendStyle(genProps())).toEqual({});
    });

    test('a blended box reaches the screen markup with the declaration', () => {
        const props = genProps({ blendMode: 'screen' });
        expect(CanvasItem.genBoxStyle(props).mixBlendMode).toBe('screen');
        // Never on the shape style: that one also dresses the properties
        // panel's preview, where the item is shown alone over a plain well
        // and a blend would misreport what the slide does.
        expect('mixBlendMode' in CanvasItem.genShapeBoxStyle(props)).toBe(
            false,
        );
    });

    // `genSlideHtml` runs `SlideRendererComp` through `renderToStaticMarkup`
    // and that string is what the screen window, the print PDF and the PPTX
    // measurer mount -- so the declaration has to survive serialization, not
    // just exist as a React style object.
    test('the declaration survives into the screen/print markup', () => {
        const html = renderToStaticMarkup(
            createElement('div', {
                style: CanvasItem.genBoxStyle(
                    genProps({ blendMode: 'screen' }),
                ),
            }),
        );
        expect(html).toContain('mix-blend-mode:screen');
        const plainHtml = renderToStaticMarkup(
            createElement('div', { style: CanvasItem.genBoxStyle(genProps()) }),
        );
        expect(plainHtml).not.toContain('mix-blend-mode');
    });

    test('validate accepts an absent blend and refuses a non-string', () => {
        expect(() => {
            CanvasItem.validate(genProps() as any);
        }).not.toThrow();
        expect(() => {
            CanvasItem.validate(genProps({ blendMode: 'multiply' }) as any);
        }).not.toThrow();
        expect(() => {
            CanvasItem.validate(genProps({ blendMode: 7 } as any) as any);
        }).toThrow();
    });

    test('cleanupBlendMode and genBoxBorderRadius are the shared rules', () => {
        const props: any = { blendMode: 'NORMAL' };
        cleanupBlendMode(props);
        // Case matters: CSS keywords are lower-case, and anything else is
        // dropped rather than guessed at.
        expect('blendMode' in props).toBe(false);

        expect(genBoxBorderRadius({})).toBeUndefined();
        expect(genBoxBorderRadius({ roundSizePixel: 12 })).toBe(12);
        expect(genBoxBorderRadius({ roundSizePercentage: 50 })).toBe('25%');
        // Pixels win, the way the panel's own controls say they do.
        expect(
            genBoxBorderRadius({ roundSizePixel: 8, roundSizePercentage: 50 }),
        ).toBe(8);
    });
});
