/**
 * Lays the foreground messages ONE session put up one under another, by the
 * heights the screen actually drew -- and shrinks a stack that would run off
 * the screen until it fits.
 *
 * The presenter can only estimate a stack: it counts the lines a person TYPED,
 * and a line the screen wraps is one it cannot see. Measured live, a message
 * that wrapped to seven lines had the next message laid two lines under its
 * top, over its third to sixth lines. And a message too big for the screen
 * simply ran off the bottom, taking every message after it with it.
 *
 * Runs on a list change and when a font finishes loading -- never per frame,
 * and with every write batched ahead of every read, so one pass is one layout.
 */

/** Marks the element a message's style is on (see `genHtmlForegroundMessage`). */
export const FOREGROUND_MESSAGE_CLASS = 'foreground-message';

/** A stack is never shrunk below this share of the font size it was given. */
const MIN_FIT_FACTOR = 0.3;
/** Wrapping changes with the font size, so the fit is re-measured this often. */
const MAX_FIT_PASS = 4;
/** Fitted a little under the edge, so a rounding pixel does not clip a line. */
const FIT_MARGIN_FACTOR = 0.97;

type StackAnchorType = 'top' | 'center' | 'bottom';

function readPixel(value: string) {
    const pixel = Number.parseFloat(value);
    return Number.isFinite(pixel) ? pixel : 0;
}

/**
 * Which edge the session's position pad pinned the stack to, off the style
 * `genTransformingExtraStyle` wrote: `top: 50%` is the vertical middle, a
 * `bottom` with no `top` is the bottom edge, anything else is the top.
 */
function readAnchor(style: CSSStyleDeclaration): StackAnchorType {
    if (style.top === '50%') {
        return 'center';
    }
    if (style.bottom !== '' && style.top === '') {
        return 'bottom';
    }
    return 'top';
}

/**
 * The widget's own Scale. An entrance never writes the element's inline
 * `transform` (fade animates opacity, move the `translate` property, zoom a
 * wrapper), so this reads the session's setting even mid-animation.
 */
function readScale(style: CSSStyleDeclaration) {
    const match = /scale\(\s*([\d.]+)/.exec(style.transform);
    const scale = match === null ? 1 : Number.parseFloat(match[1]);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * The font size the element was GIVEN, remembered on the element the first
 * time it is read so a fit is always taken from it, never from a previous fit.
 */
function readBaseFontSize(element: HTMLElement) {
    const { dataset } = element;
    if (dataset.owaBaseFontSize === undefined) {
        dataset.owaInlineFontSize = element.style.fontSize;
        dataset.owaBaseFontSize = String(
            readPixel(
                element.style.fontSize || getComputedStyle(element).fontSize,
            ),
        );
    }
    return Number.parseFloat(dataset.owaBaseFontSize);
}

function applyFontFactor(elementList: HTMLElement[], factor: number) {
    for (const element of elementList) {
        element.style.fontSize =
            factor < 1
                ? `${readBaseFontSize(element) * factor}px`
                : (element.dataset.owaInlineFontSize ?? '');
    }
}

function measureHeights(elementList: HTMLElement[]) {
    return elementList.map((element) => {
        return element.offsetHeight;
    });
}

/**
 * How tall the stack is against the room it has, in the screen's own pixels.
 * In the middle the FIRST message is centred, as one message always was, so
 * the stack has half the screen below that line and half above it.
 */
function genFit(
    anchor: StackAnchorType,
    heightList: number[],
    scale: number,
    screenHeight: number,
    edgeOffset: number,
) {
    const total = heightList.reduce((sum, height) => {
        return sum + height;
    }, 0);
    if (anchor === 'center') {
        const halfFirst = (heightList[0] ?? 0) / 2;
        return {
            needed: scale * Math.max(total - halfFirst, halfFirst),
            available: screenHeight / 2,
        };
    }
    return {
        needed: scale * total,
        available: screenHeight - edgeOffset,
    };
}

/**
 * Put `elementList` -- one session's messages, in session order, all dressed
 * by the same Properties -- one under another, and shrink them together when
 * they would not fit on a screen `screenHeight` pixels tall.
 *
 * Offsets are margins in the screen's layout pixels, multiplied by the
 * widget's Scale, because a scaled box takes Scale times its height on the
 * wall while a margin is not scaled at all. A stack pinned to the bottom grows
 * UPWARDS: margins on the earlier messages, so the last one sits on the edge.
 */
export function layOutMessageStack(
    elementList: HTMLElement[],
    screenHeight: number,
) {
    if (elementList.length === 0) {
        return;
    }
    const firstStyle = elementList[0].style;
    const anchor = readAnchor(firstStyle);
    const scale = readScale(firstStyle);
    let edgeOffset = 0;
    if (anchor === 'top') {
        edgeOffset = readPixel(firstStyle.top);
    } else if (anchor === 'bottom') {
        edgeOffset = readPixel(firstStyle.bottom);
    }
    // Remember each size it was GIVEN before anything is reset to it.
    for (const element of elementList) {
        readBaseFontSize(element);
    }
    let factor = 1;
    applyFontFactor(elementList, factor);
    let heightList = measureHeights(elementList);
    if (
        heightList.every((height) => {
            return height === 0;
        })
    ) {
        // Not laid out -- a mini preview whose panel is collapsed. The
        // presenter's estimate stays until the next change measures it.
        return;
    }
    const checkIsFitting = (heights: number[]) => {
        const { needed, available } = genFit(
            anchor,
            heights,
            scale,
            screenHeight,
            edgeOffset,
        );
        return { isFitting: needed <= available, needed, available };
    };
    // Down by the overflow until it fits...
    let fit = checkIsFitting(heightList);
    let failedFactor = 1;
    for (
        let pass = 0;
        pass < MAX_FIT_PASS && !fit.isFitting && factor > MIN_FIT_FACTOR;
        pass++
    ) {
        failedFactor = factor;
        factor = Math.max(
            MIN_FIT_FACTOR,
            factor * (fit.available / fit.needed) * FIT_MARGIN_FACTOR,
        );
        applyFontFactor(elementList, factor);
        heightList = measureHeights(elementList);
        fit = checkIsFitting(heightList);
    }
    // ...then back up as far as it still fits. A smaller font wraps into
    // fewer lines, so the step down overshoots: measured live, a message that
    // ran off the screen came back filling barely half of it.
    if (fit.isFitting && factor < 1) {
        let fittingHeights = heightList;
        for (let pass = 0; pass < MAX_FIT_PASS + 1; pass++) {
            const tryFactor = (factor + failedFactor) / 2;
            applyFontFactor(elementList, tryFactor);
            const tryHeights = measureHeights(elementList);
            if (checkIsFitting(tryHeights).isFitting) {
                factor = tryFactor;
                fittingHeights = tryHeights;
            } else {
                failedFactor = tryFactor;
            }
        }
        applyFontFactor(elementList, factor);
        heightList = fittingHeights;
    }
    const total = heightList.reduce((sum, height) => {
        return sum + height;
    }, 0);
    let above = 0;
    elementList.forEach((element, index) => {
        const height = heightList[index];
        if (anchor === 'bottom') {
            const below = total - above - height;
            element.style.marginTop = '';
            element.style.marginBottom = below > 0 ? `${scale * below}px` : '';
        } else {
            // Centred, each box is pulled up by half its OWN height, so the
            // offset makes up the difference to the first one.
            const offset =
                anchor === 'center'
                    ? above + (height - heightList[0]) / 2
                    : above;
            element.style.marginTop = index === 0 ? '' : `${scale * offset}px`;
            element.style.marginBottom = '';
        }
        above += height;
    });
}
