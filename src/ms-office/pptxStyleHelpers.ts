// Pure helpers of "Export to PPTX" that need no browser: reading computed
// CSS values (colors, radii, alignment) and working out where a picture is
// drawn. Kept apart from `pptxSlideMeasureHelpers` so they can be tested
// without the renderer.

import type {
    PptxColorType,
    PptxCropType,
    PptxGeometryType,
    PptxRunType,
    PptxTextAlignType,
} from './pptxXmlHelpers';

// The screen window's `body` font, read out of the same stylesheet the screen
// loads, so the default font of a text item cannot drift from the screen's.
export function extractScreenBodyFontFamily(css: string) {
    const match = /(?:^|[}\s])body\s*\{[^}]*?font-family\s*:\s*([^;}]+)/.exec(
        css,
    );
    return match?.[1].trim() ?? 'system-ui, sans-serif';
}

export function parseCssColor(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    const text = value.trim().toLowerCase();
    if (text === 'transparent' || text === 'none') {
        return null;
    }
    const hexMatch = /^#([0-9a-f]{3,8})$/.exec(text);
    if (hexMatch !== null) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = Array.from(hex, (char) => {
                return char + char;
            }).join('');
        }
        if (hex.length !== 6 && hex.length !== 8) {
            return null;
        }
        const alpha =
            hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { hex: hex.slice(0, 6).toUpperCase(), alpha };
    }
    const functionMatch = /^(rgba?|color)\(\s*(?:srgb\s+)?([^)]*)\)$/.exec(
        text,
    );
    if (functionMatch === null) {
        return null;
    }
    const isSrgbFunction = functionMatch[1] === 'color';
    const partList = functionMatch[2].split(/[\s,/]+/).filter((part) => {
        return part !== '';
    });
    if (partList.length < 3) {
        return null;
    }
    const toChannel = (part: string) => {
        if (part.endsWith('%')) {
            return (Number.parseFloat(part) / 100) * 255;
        }
        const number = Number.parseFloat(part);
        return isSrgbFunction ? number * 255 : number;
    };
    const channelList = partList.slice(0, 3).map((part) => {
        return Math.round(Math.min(Math.max(toChannel(part), 0), 255));
    });
    if (channelList.some(Number.isNaN)) {
        return null;
    }
    let alpha = 1;
    if (partList[3] !== undefined) {
        alpha = partList[3].endsWith('%')
            ? Number.parseFloat(partList[3]) / 100
            : Number.parseFloat(partList[3]);
    }
    return {
        hex: channelList
            .map((channel) => {
                return channel.toString(16).padStart(2, '0');
            })
            .join('')
            .toUpperCase(),
        alpha: Number.isNaN(alpha) ? 1 : Math.min(Math.max(alpha, 0), 1),
    };
}

// What a translucent color looks like on the black a screen shows behind a
// slide: a slide background in PowerPoint has no transparency to show through.
export function compositeOverBlack(color: PptxColorType): PptxColorType {
    const scale = Math.min(Math.max(color.alpha, 0), 1);
    const hex = [0, 2, 4]
        .map((offset) => {
            const channel = Number.parseInt(
                color.hex.slice(offset, offset + 2),
                16,
            );
            return Math.round(channel * scale)
                .toString(16)
                .padStart(2, '0');
        })
        .join('')
        .toUpperCase();
    return { hex, alpha: 1 };
}

export function parseDataUrl(dataUrl: string) {
    const commaIndex = dataUrl.indexOf(',');
    if (!dataUrl.startsWith('data:') || commaIndex < 0) {
        return null;
    }
    const header = dataUrl.slice(5, commaIndex);
    const body = dataUrl.slice(commaIndex + 1);
    const mime = (header.split(';')[0] || 'text/plain').toLowerCase();
    if (header.split(';').includes('base64')) {
        const binary = atob(body.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
}

export function toFileExtension(pathOrUrl: string) {
    const cleaned = pathOrUrl.split(/[?#]/)[0];
    const dotIndex = cleaned.lastIndexOf('.');
    if (dotIndex < 0) {
        return '';
    }
    return cleaned.slice(dotIndex + 1).toLowerCase();
}

export function fileUrlToPath(fileUrl: string) {
    const url = new URL(fileUrl);
    let pathname = decodeURIComponent(url.pathname);
    // `file:///C:/x` -> `C:/x`; a UNC share keeps its host
    if (/^\/[a-zA-Z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
    }
    if (url.host !== '') {
        pathname = `//${url.host}${pathname}`;
    }
    return pathname;
}

export type ObjectFitType =
    'fill' | 'contain' | 'cover' | 'none' | 'scale-down';

export function parseObjectPosition(value: string) {
    const [x = '50%', y = '50%'] = value.split(/\s+/);
    const toFraction = (part: string, fallback: number) => {
        if (part === 'left' || part === 'top') {
            return 0;
        }
        if (part === 'right' || part === 'bottom') {
            return 1;
        }
        if (part === 'center') {
            return 0.5;
        }
        if (part.endsWith('%')) {
            return Number.parseFloat(part) / 100;
        }
        return fallback;
    };
    return { x: toFraction(x, 0.5), y: toFraction(y, 0.5) };
}

// Where a replaced element (`<img>`, `<video>`) paints its picture inside its
// content box for a given `object-fit`, and how much of the picture each side
// loses doing it — the `srcRect` crop PowerPoint takes.
export function calcObjectFit(
    box: { x: number; y: number; width: number; height: number },
    naturalWidth: number,
    naturalHeight: number,
    objectFit: ObjectFitType,
    position: { x: number; y: number },
): { box: typeof box; crop: PptxCropType | null } {
    if (
        objectFit === 'fill' ||
        naturalWidth <= 0 ||
        naturalHeight <= 0 ||
        box.width <= 0 ||
        box.height <= 0
    ) {
        return { box, crop: null };
    }
    let scale: number;
    if (objectFit === 'cover') {
        scale = Math.max(box.width / naturalWidth, box.height / naturalHeight);
    } else if (objectFit === 'contain') {
        scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
    } else if (objectFit === 'none') {
        scale = 1;
    } else {
        scale = Math.min(
            1,
            box.width / naturalWidth,
            box.height / naturalHeight,
        );
    }
    const paintedWidth = naturalWidth * scale;
    const paintedHeight = naturalHeight * scale;
    const paintedX = box.x + (box.width - paintedWidth) * position.x;
    const paintedY = box.y + (box.height - paintedHeight) * position.y;
    // clip the painted picture to the box
    const visibleLeft = Math.max(paintedX, box.x);
    const visibleTop = Math.max(paintedY, box.y);
    const visibleRight = Math.min(paintedX + paintedWidth, box.x + box.width);
    const visibleBottom = Math.min(
        paintedY + paintedHeight,
        box.y + box.height,
    );
    const crop: PptxCropType = {
        left: (visibleLeft - paintedX) / paintedWidth,
        top: (visibleTop - paintedY) / paintedHeight,
        right: (paintedX + paintedWidth - visibleRight) / paintedWidth,
        bottom: (paintedY + paintedHeight - visibleBottom) / paintedHeight,
    };
    const hasCrop = Object.values(crop).some((value) => {
        return value > 0.00001;
    });
    return {
        box: {
            x: visibleLeft,
            y: visibleTop,
            width: Math.max(0, visibleRight - visibleLeft),
            height: Math.max(0, visibleBottom - visibleTop),
        },
        crop: hasCrop ? crop : null,
    };
}

// Where a screen draws a background: scaled to cover, centered, its size
// rounded to whole pixels (`calMediaSizes`).
export function calcCoverRect(
    parentWidth: number,
    parentHeight: number,
    naturalWidth: number,
    naturalHeight: number,
) {
    const scale = Math.max(
        parentWidth / naturalWidth,
        parentHeight / naturalHeight,
    );
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);
    return {
        x: (parentWidth - width) / 2,
        y: (parentHeight - height) / 2,
        width,
        height,
    };
}

export function parseRadius(value: string, width: number, height: number) {
    const [first = '0', second] = value.trim().split(/\s+/);
    const toLength = (part: string, base: number) => {
        if (part.endsWith('%')) {
            return (Number.parseFloat(part) / 100) * base;
        }
        return Number.parseFloat(part) || 0;
    };
    return {
        x: toLength(first, width),
        y: toLength(second ?? first, height),
    };
}

// A box's `border-radius`, the way CSS draws it: an oversized radius shrinks
// until the corners of a side fit, percentages round elliptically.
export function toBoxGeometry(
    style: Pick<
        CSSStyleDeclaration,
        | 'borderTopLeftRadius'
        | 'borderTopRightRadius'
        | 'borderBottomRightRadius'
        | 'borderBottomLeftRadius'
    >,
    width: number,
    height: number,
): PptxGeometryType {
    const cornerList = [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
    ].map((value) => {
        return parseRadius(value || '0', width, height);
    });
    // one radius for all four corners: the app only ever sets a uniform one
    const radiusX = Math.max(...cornerList.map(({ x }) => x));
    const radiusY = Math.max(...cornerList.map(({ y }) => y));
    if (radiusX <= 0 || radiusY <= 0 || width <= 0 || height <= 0) {
        return { kind: 'rect' };
    }
    const factor = Math.min(1, width / (2 * radiusX), height / (2 * radiusY));
    const fittedX = radiusX * factor;
    const fittedY = radiusY * factor;
    if (Math.abs(fittedX - fittedY) < 0.5) {
        return { kind: 'roundRect', radius: fittedX };
    }
    return { kind: 'ellipticRoundRect', radiusX: fittedX, radiusY: fittedY };
}

export type RectType = { x: number; y: number; width: number; height: number };

export function toCollapsedText(text: string, whiteSpace: string) {
    if (whiteSpace.startsWith('pre') || whiteSpace === 'break-spaces') {
        return text;
    }
    return text.replace(/[\t\n\r\f ]+/g, ' ');
}

export function applyTextTransform(text: string, transform: string) {
    if (transform === 'uppercase') {
        return text.toUpperCase();
    }
    if (transform === 'lowercase') {
        return text.toLowerCase();
    }
    if (transform === 'capitalize') {
        return text.replace(/(^|\s)(\S)/g, (_match, space, char) => {
            return `${space}${char.toUpperCase()}`;
        });
    }
    return text;
}

export function parsePx(value: string) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
}

export function toAlign(textAlign: string): PptxTextAlignType {
    if (textAlign === 'center' || textAlign === '-webkit-center') {
        return 'ctr';
    }
    if (
        textAlign === 'right' ||
        textAlign === 'end' ||
        textAlign === '-webkit-right'
    ) {
        return 'r';
    }
    if (textAlign === 'justify') {
        return 'just';
    }
    return 'l';
}

export function checkIsSameRect(rectA: RectType, rectB: RectType) {
    return (
        Math.abs(rectA.x - rectB.x) < 0.5 &&
        Math.abs(rectA.y - rectB.y) < 0.5 &&
        Math.abs(rectA.width - rectB.width) < 0.5 &&
        Math.abs(rectA.height - rectB.height) < 0.5
    );
}

export function checkIsSameRunStyle(runA: PptxRunType, runB: PptxRunType) {
    return (
        runA.fontFamily === runB.fontFamily &&
        runA.fontSize === runB.fontSize &&
        runA.color.hex === runB.color.hex &&
        runA.color.alpha === runB.color.alpha &&
        runA.isBold === runB.isBold &&
        runA.isItalic === runB.isItalic &&
        runA.isUnderline === runB.isUnderline &&
        runA.isStrike === runB.isStrike &&
        runA.letterSpacing === runB.letterSpacing &&
        runA.baselineShift === runB.baselineShift &&
        runA.lang === runB.lang
    );
}
