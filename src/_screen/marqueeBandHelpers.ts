/**
 * Marquee sizing shared by the marquee itself and the Bible view that has to
 * make room for it. A leaf on purpose: `ScreenBibleComp` needs these few lines,
 * and importing them from `screenForegroundHelpers` pulled that module's whole
 * graph (FileSource, the app provider, server rendering) into it.
 */
import type { ForegroundMarqueeDataType } from './screenTypeHelpers';

export function genMarqueeFontSize(screenHeight: number) {
    return Math.round(75 * (screenHeight / 768));
}

/**
 * How tall a top marquee's band is on a screen, so the Bible view can start
 * below it instead of under it -- a verse's `KJV John 3:16` header sat exactly
 * where the band scrolls and neither could be read. An estimate from the same
 * font size the marquee uses (or the operator's own size, when the widget's
 * properties set one in px); `line-height: normal` is ~1.2.
 */
export function getMarqueeBandHeight(
    data: ForegroundMarqueeDataType,
    screenHeight: number,
) {
    const customFontSize = data.extraStyle?.fontSize;
    const customPixels =
        typeof customFontSize === 'number'
            ? customFontSize
            : typeof customFontSize === 'string' &&
                customFontSize.trim().endsWith('px')
              ? Number.parseFloat(customFontSize)
              : Number.NaN;
    const fontSize = Number.isFinite(customPixels)
        ? customPixels
        : genMarqueeFontSize(screenHeight);
    // The `p`'s own 3px top + bottom padding, plus a little air.
    return Math.ceil(fontSize * 1.25) + 6 + 4;
}
