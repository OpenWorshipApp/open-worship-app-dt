import { describe, expect, test } from 'vitest';

import {
    genWebsiteCaptureSize,
    parseWebsiteCaptureSize,
    WEBSITE_CAPTURE_MAX_SIDE,
} from './websiteCaptureHelpers';

describe('parseWebsiteCaptureSize', () => {
    test('reads back a stamped size', () => {
        expect(parseWebsiteCaptureSize('800x600')).toEqual({
            width: 800,
            height: 600,
        });
    });

    test.each([
        null,
        '',
        '800',
        '800x',
        'x600',
        '800 x 600',
        '800x600px',
        '-800x600',
        '80.5x60',
    ])('%j is not a size', (value) => {
        expect(parseWebsiteCaptureSize(value)).toBeNull();
    });

    test.each(['0x600', '800x0', '0x0', '000x5'])(
        '%j has a side of zero pixels',
        (value) => {
            expect(parseWebsiteCaptureSize(value)).toBeNull();
        },
    );

    test('round-trips what genWebsiteCaptureSize stamps', () => {
        const size = genWebsiteCaptureSize(1920, 1080);
        expect(size).toEqual({ width: WEBSITE_CAPTURE_MAX_SIDE, height: 540 });
        expect(parseWebsiteCaptureSize(`${size.width}x${size.height}`)).toEqual(
            size,
        );
    });
});

describe('genWebsiteCaptureSize', () => {
    test('a box within the cap is captured at its own size', () => {
        expect(genWebsiteCaptureSize(800, 600)).toEqual({
            width: 800,
            height: 600,
        });
    });

    test('no side is ever below one pixel', () => {
        expect(genWebsiteCaptureSize(0, 0)).toEqual({ width: 1, height: 1 });
        expect(genWebsiteCaptureSize(5000, 1)).toEqual({
            width: WEBSITE_CAPTURE_MAX_SIDE,
            height: 1,
        });
    });
});
