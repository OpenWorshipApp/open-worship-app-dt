import { SCRIPT_SAFE_LINE_HEIGHT } from './canvasHelpers';

export type BoxLayoutType = {
    left: number;
    top: number;
    width: number;
    height: number;
};
export type BoxPointType = {
    x: number;
    y: number;
};
export type HtmlBoxStyleType = {
    html: string;
    fontSize: number;
    fontFamily: string | null;
};

// Keep the box clear of the canvas edges.
const BOX_MARGIN_RATIO = 0.04;
// Narrowest first: the box only grows wider when the text cannot fit.
const BOX_WIDTH_RATIOS = [0.5, 0.6, 0.7, 0.8, 0.9, 1];

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

// Lays the markup out off-screen with the styles the box will render with,
// mirroring `genTextStyle`; its scroll height at a given width is the height
// the text needs.
function createMeasuringElement({
    html,
    fontSize,
    fontFamily,
}: HtmlBoxStyleType) {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '-99999px';
    element.style.visibility = 'hidden';
    element.style.boxSizing = 'border-box';
    element.style.padding = `${fontSize / 10}px`;
    element.style.fontSize = `${fontSize}px`;
    element.style.lineHeight = `${SCRIPT_SAFE_LINE_HEIGHT}`;
    element.style.fontFamily = fontFamily ?? '';
    element.innerHTML = html;
    return element;
}

export function genFittedHtmlBoxLayout(
    style: HtmlBoxStyleType,
    canvasWidth: number,
    canvasHeight: number,
    point: BoxPointType | null,
): BoxLayoutType | null {
    if (typeof document === 'undefined') {
        return null;
    }
    const margin = Math.round(
        Math.min(canvasWidth, canvasHeight) * BOX_MARGIN_RATIO,
    );
    const maxWidth = canvasWidth - margin * 2;
    const maxHeight = canvasHeight - margin * 2;
    // A box that cannot show everything still shows as much as the canvas
    // allows, so fall back to the biggest box that fits the canvas.
    let width = maxWidth;
    let height = maxHeight;
    const element = createMeasuringElement(style);
    document.body.appendChild(element);
    try {
        for (const ratio of BOX_WIDTH_RATIOS) {
            const nextWidth = Math.round(maxWidth * ratio);
            element.style.width = `${nextWidth}px`;
            const nextHeight = element.scrollHeight;
            if (nextHeight <= maxHeight) {
                width = nextWidth;
                // Never collapse to nothing when the text cannot be measured,
                // e.g. before the language's font has loaded.
                height = Math.max(nextHeight, style.fontSize * 2);
                break;
            }
        }
    } finally {
        element.remove();
    }
    const left =
        point === null ? (canvasWidth - width) / 2 : point.x - width / 2;
    const top =
        point === null ? (canvasHeight - height) / 2 : point.y - height / 2;
    return {
        left: clamp(Math.round(left), margin, canvasWidth - width - margin),
        top: clamp(Math.round(top), margin, canvasHeight - height - margin),
        width,
        height,
    };
}
