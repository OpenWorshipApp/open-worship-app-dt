/**
 * A PowerPoint slide, as the app's own converter draws it
 * (`<name>.pptx-htmls/slideN.html`, the page the Documents list previews),
 * turned into the boxes of a slide document (2026-11-20, `EC-763`; the user:
 * _chatbot help convert .pptx to .ows file with 95% alike_).
 *
 * The converter draws a slide as ONE svg: a background, then a `<g
 * data-id>` a shape, in the order PowerPoint stacks them. Each shape becomes
 * a box of its own, in that order, at its own place and turn, so the slide
 * can be edited box by box afterwards:
 *
 * - a picture alone becomes a picture box;
 * - anything else -- a text box, a shape, a framed or shadowed picture --
 *   becomes an HTML box holding the converter's OWN markup: its svg for the
 *   drawing, and the text it had put in a `foreignObject` as positioned HTML
 *   beside it (the app's sanitizer takes a `foreignObject` out, and the
 *   text in it is the slide);
 * - the background becomes a locked box under them all.
 *
 * Nothing here reads a file or runs the converter: the caller hands over the
 * slide's HTML and how to draw each picture, so every rule runs in a test.
 */
import type { AnyObjectType } from './typeHelpers';

export type PptxMatrixType = [number, number, number, number, number, number];

export type PptxImageUseType = {
    href: string;
    // The largest size it is drawn at on the slide, in slide pixels.
    width: number;
    height: number;
};

export type PptxResolvedImageType = {
    src: string;
    width: number;
    height: number;
};

export type PptxSlideItemsOptionsType = {
    width: number;
    height: number;
    // Every id in the markup gets it in front, so two boxes -- or two slides
    // drawn on one page -- never answer to each other's gradient or filter.
    idPrefix: string;
    resolveImage: (href: string) => PptxResolvedImageType | null;
};

export type PptxSlideItemsType = {
    canvasItems: AnyObjectType[];
    // The pictures that could not be drawn, by their file name.
    missingImages: string[];
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const IDENTITY_MATRIX: PptxMatrixType = [1, 0, 0, 1, 0, 0];
const EPSILON = 1e-4;
const TRANSPARENT_COLOR = '#00000000';
// A picture's name inside the converted folder, never a path out of it.
const IMAGE_HREF_PATTERN = /^images\/[^/\\]+$/;
const URL_REFERENCE_PATTERN = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// The converter's page resets these for every element (`* { margin: 0;
// padding: 0; box-sizing: border-box; }`), and the app's pages do not: put
// FIRST in each element's own style, so a margin the slide set still wins.
const ELEMENT_RESET_STYLE = 'margin:0;padding:0;box-sizing:border-box;';
const TAG_RESET_STYLE_MAP: Record<string, string> = {
    table: 'border-collapse:collapse;width:100%;height:100%;',
    td: 'border:1px solid #999;padding:4px;vertical-align:top;',
};
// What a box's text starts from on the converter's page: the page's own
// defaults, never the box the app wraps it in.
const ROOT_RESET_STYLE =
    'font-size:16px;line-height:normal;font-weight:normal;' +
    'font-style:normal;color:#000000;text-align:left;direction:ltr;' +
    'white-space:normal;letter-spacing:normal;';
// Drawing that is no shape of its own: a definition, read by reference.
const NON_DRAWING_TAG_SET = new Set([
    'defs',
    'clippath',
    'mask',
    'pattern',
    'filter',
    'lineargradient',
    'radialgradient',
    'marker',
    'symbol',
    'style',
    'title',
    'desc',
    'metadata',
]);
const FRAME_TAG_SET = new Set(['rect', 'image', 'foreignobject']);

function toNumber(value: string | null | undefined, fallback = 0) {
    const number = Number.parseFloat(value ?? '');
    return Number.isFinite(number) ? number : fallback;
}

function roundNumber(value: number) {
    return Math.round(value * 100) / 100;
}

export function multiplyPptxMatrix(
    m: PptxMatrixType,
    n: PptxMatrixType,
): PptxMatrixType {
    const [a1, b1, c1, d1, e1, f1] = m;
    const [a2, b2, c2, d2, e2, f2] = n;
    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    ];
}

function applyMatrix(m: PptxMatrixType, x: number, y: number) {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function toTranslateMatrix(x: number, y: number): PptxMatrixType {
    return [1, 0, 0, 1, x, y];
}

function toRotateMatrix(degrees: number): PptxMatrixType {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [cos, sin, -sin, cos, 0, 0];
}

/**
 * An svg `transform` attribute as one matrix, or null for one this does not
 * read (it is then kept as it is, and the box covers the slide).
 */
export function parsePptxTransform(
    text: string | null | undefined,
): PptxMatrixType | null {
    if (text === null || text === undefined || text.trim() === '') {
        return IDENTITY_MATRIX;
    }
    const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    if (text.replaceAll(pattern, '').replaceAll(/[\s,]/g, '') !== '') {
        return null;
    }
    let matrix = IDENTITY_MATRIX;
    for (const match of text.matchAll(pattern)) {
        const numbers = match[2]
            .split(/[\s,]+/)
            .filter((one) => {
                return one !== '';
            })
            .map(Number);
        if (
            numbers.some((one) => {
                return !Number.isFinite(one);
            })
        ) {
            return null;
        }
        let next: PptxMatrixType;
        const name = match[1];
        if (name === 'translate') {
            next = toTranslateMatrix(numbers[0] ?? 0, numbers[1] ?? 0);
        } else if (name === 'scale') {
            const scaleX = numbers[0] ?? 1;
            next = [scaleX, 0, 0, numbers[1] ?? scaleX, 0, 0];
        } else if (name === 'rotate') {
            const rotation = toRotateMatrix(numbers[0] ?? 0);
            next =
                numbers.length >= 3
                    ? multiplyPptxMatrix(
                          multiplyPptxMatrix(
                              toTranslateMatrix(numbers[1], numbers[2]),
                              rotation,
                          ),
                          toTranslateMatrix(-numbers[1], -numbers[2]),
                      )
                    : rotation;
        } else if (name === 'matrix' && numbers.length === 6) {
            next = numbers as PptxMatrixType;
        } else if (name === 'skewX') {
            next = [
                1,
                0,
                Math.tan(((numbers[0] ?? 0) * Math.PI) / 180),
                1,
                0,
                0,
            ];
        } else if (name === 'skewY') {
            next = [
                1,
                Math.tan(((numbers[0] ?? 0) * Math.PI) / 180),
                0,
                1,
                0,
                0,
            ];
        } else {
            return null;
        }
        matrix = multiplyPptxMatrix(matrix, next);
    }
    return matrix;
}

/**
 * A CSS `transform` (`translate(609.7px,1.7px)`) as a matrix, or null for
 * one not read here (3D, `rad`, `%`).
 */
function parseCssTransform(text: string) {
    const plain = text
        .replaceAll(/(-?\d*\.?\d+(?:e-?\d+)?)(px|deg)\b/gi, '$1')
        .replaceAll(/translateX\(([^)]*)\)/g, 'translate($1,0)')
        .replaceAll(/translateY\(([^)]*)\)/g, 'translate(0,$1)');
    return parsePptxTransform(plain);
}

// The style names a step's motion leaves on a shape; what they move is read
// into the box's place, and a copy drawn in the box keeps none of them.
const MOTION_STYLE_NAME_LIST = [
    'transform',
    'transform-origin',
    'transform-box',
    'transform-style',
    'backface-visibility',
    'will-change',
    'animation',
];

function checkIsIdentity(m: PptxMatrixType) {
    return (
        Math.abs(m[0] - 1) < EPSILON &&
        Math.abs(m[1]) < EPSILON &&
        Math.abs(m[2]) < EPSILON &&
        Math.abs(m[3] - 1) < EPSILON &&
        Math.abs(m[4]) < EPSILON &&
        Math.abs(m[5]) < EPSILON
    );
}

function checkIsTranslation(m: PptxMatrixType) {
    return checkIsIdentity([m[0], m[1], m[2], m[3], 0, 0]);
}

// A turn and a move, nothing stretched or mirrored: what a box's own
// `rotate` can say.
function checkIsRigid(m: PptxMatrixType) {
    return (
        Math.abs(m[0] - m[3]) < EPSILON &&
        Math.abs(m[1] + m[2]) < EPSILON &&
        Math.abs(m[0] * m[0] + m[1] * m[1] - 1) < EPSILON
    );
}

function toMatrixText(m: PptxMatrixType) {
    return `matrix(${m
        .map((one) => {
            return Number(one.toFixed(5));
        })
        .join(',')})`;
}

function readScale(m: PptxMatrixType) {
    return {
        x: Math.hypot(m[0], m[1]),
        y: Math.hypot(m[2], m[3]),
    };
}

function toLocalName(element: Element) {
    return element.localName.toLowerCase();
}

function checkIsInsideDefinition(element: Element, stopAt: Element) {
    let parent = element.parentElement;
    while (parent !== null && parent !== stopAt) {
        if (NON_DRAWING_TAG_SET.has(toLocalName(parent))) {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

function listElements(root: Element) {
    return Array.from(root.getElementsByTagName('*'));
}

function readHref(element: Element) {
    return (
        element.getAttribute('href') ??
        element.getAttribute('xlink:href') ??
        element.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    );
}

function setHref(element: Element, value: string) {
    element.removeAttribute('xlink:href');
    element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
    element.setAttribute('href', value);
}

/** The converter's slide layer: the one svg the slide is drawn in. */
/**
 * The slide's own drawing. A page with a transition draws the slide BEFORE
 * it too: under it (`z-index:0`) for the new one to cover or push away --
 * the worship deck's slide 32 came out as slide 31 -- or, for curtains, in
 * every strip of the curtain over it. The slide's is the LAST layer the
 * slide holds itself.
 */
export function findPptxSlideLayer(document: Document) {
    for (const selector of [
        '.slide > svg.pptx-slide-layer',
        'svg.pptx-slide-layer',
    ]) {
        const layerList = document.querySelectorAll(selector);
        if (layerList.length > 0) {
            return layerList[layerList.length - 1];
        }
    }
    return (
        document.querySelector('.slide > svg') ?? document.querySelector('svg')
    );
}

export function parsePptxSlideDocument(html: string) {
    return new DOMParser().parseFromString(html, 'text/html');
}

// The matrix from an element's own coordinates to the slide's.
function readMatrixToLayer(element: Element, layer: Element) {
    let matrix = IDENTITY_MATRIX;
    let current: Element | null = element.parentElement;
    while (current !== null && current !== layer) {
        const own = readOwnTransform(current);
        matrix = multiplyPptxMatrix(own ?? IDENTITY_MATRIX, matrix);
        current = current.parentElement;
    }
    return matrix;
}

/**
 * Every picture the slide draws, at the largest size it is drawn: the caller
 * makes each picture no bigger than that before it goes into the document.
 */
export function listPptxSlideImageUses(html: string): PptxImageUseType[] {
    const layer = findPptxSlideLayer(parsePptxSlideDocument(html));
    if (layer === null) {
        return [];
    }
    const useMap = new Map<string, PptxImageUseType>();
    for (const element of listElements(layer)) {
        if (toLocalName(element) !== 'image') {
            continue;
        }
        const href = readHref(element);
        if (href === null || !IMAGE_HREF_PATTERN.test(href)) {
            continue;
        }
        const own = readOwnTransform(element);
        const scale = readScale(
            multiplyPptxMatrix(
                readMatrixToLayer(element, layer),
                own ?? IDENTITY_MATRIX,
            ),
        );
        const width = toNumber(element.getAttribute('width')) * scale.x;
        const height = toNumber(element.getAttribute('height')) * scale.y;
        const old = useMap.get(href);
        useMap.set(href, {
            href,
            width: Math.max(old?.width ?? 0, width),
            height: Math.max(old?.height ?? 0, height),
        });
    }
    return Array.from(useMap.values());
}

type FrameType = { x: number; y: number; width: number; height: number };

function readNumbersBox(numbers: number[]) {
    if (numbers.length < 2) {
        return null;
    }
    const xList: number[] = [];
    const yList: number[] = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
        xList.push(numbers[index]);
        yList.push(numbers[index + 1]);
    }
    return {
        x: Math.min(...xList),
        y: Math.min(...yList),
        width: Math.max(...xList) - Math.min(...xList),
        height: Math.max(...yList) - Math.min(...yList),
    };
}

// The box an element covers in its own coordinates, roughly: enough to place
// a shape that has no frame of its own.
function readElementBox(element: Element): FrameType | null {
    const name = toLocalName(element);
    if (FRAME_TAG_SET.has(name)) {
        return {
            x: toNumber(element.getAttribute('x')),
            y: toNumber(element.getAttribute('y')),
            width: toNumber(element.getAttribute('width')),
            height: toNumber(element.getAttribute('height')),
        };
    }
    if (name === 'line') {
        return readNumbersBox(
            ['x1', 'y1', 'x2', 'y2'].map((key) => {
                return toNumber(element.getAttribute(key));
            }),
        );
    }
    if (name === 'circle' || name === 'ellipse') {
        const rx = toNumber(
            element.getAttribute(name === 'circle' ? 'r' : 'rx'),
        );
        const ry = toNumber(
            element.getAttribute(name === 'circle' ? 'r' : 'ry'),
        );
        return {
            x: toNumber(element.getAttribute('cx')) - rx,
            y: toNumber(element.getAttribute('cy')) - ry,
            width: rx * 2,
            height: ry * 2,
        };
    }
    const pointsText =
        name === 'path'
            ? element.getAttribute('d')
            : name === 'polygon' || name === 'polyline'
              ? element.getAttribute('points')
              : null;
    if (pointsText === null) {
        return null;
    }
    // The converter writes a path in absolute commands, so its numbers are
    // pairs of points (an arc's radii aside, close enough to place a box).
    const numbers = Array.from(
        pointsText.matchAll(/-?\d*\.?\d+(?:e-?\d+)?/gi),
    ).map((match) => {
        return Number(match[0]);
    });
    return readNumbersBox(numbers);
}

/**
 * The shape's frame in its own coordinates: the largest rectangle, picture
 * or text box drawn at its origin -- the converter draws every shape from
 * there -- else the box round all it draws.
 */
function readGroupFrame(group: Element): FrameType {
    let best: FrameType | null = null;
    let union: FrameType | null = null;
    for (const element of listElements(group)) {
        if (
            NON_DRAWING_TAG_SET.has(toLocalName(element)) ||
            checkIsInsideDefinition(element, group)
        ) {
            continue;
        }
        const box = readElementBox(element);
        if (box === null || box.width <= 0 || box.height <= 0) {
            continue;
        }
        const offset = readMatrixToLayer(element, group);
        const isPlain = checkIsTranslation(offset);
        const x = box.x + (isPlain ? offset[4] : 0);
        const y = box.y + (isPlain ? offset[5] : 0);
        if (
            FRAME_TAG_SET.has(toLocalName(element)) &&
            Math.abs(x) < 0.5 &&
            Math.abs(y) < 0.5 &&
            (best === null || box.width * box.height > best.width * best.height)
        ) {
            best = { x: 0, y: 0, width: box.width, height: box.height };
        }
        union =
            union === null
                ? { x, y, width: box.width, height: box.height }
                : {
                      x: Math.min(union.x, x),
                      y: Math.min(union.y, y),
                      width:
                          Math.max(union.x + union.width, x + box.width) -
                          Math.min(union.x, x),
                      height:
                          Math.max(union.y + union.height, y + box.height) -
                          Math.min(union.y, y),
                  };
    }
    const frame = best ?? union ?? { x: 0, y: 0, width: 1, height: 1 };
    return {
        ...frame,
        width: Math.max(frame.width, 1),
        height: Math.max(frame.height, 1),
    };
}

type PlacementType = {
    box: {
        left: number;
        top: number;
        width: number;
        height: number;
        rotate: number;
    };
    // From the shape's own coordinates to the box's.
    inner: PptxMatrixType;
};

function placeGroup(
    matrix: PptxMatrixType | null,
    frame: FrameType,
    slide: { width: number; height: number },
): PlacementType {
    if (matrix !== null && checkIsRigid(matrix)) {
        const centre = applyMatrix(
            matrix,
            frame.x + frame.width / 2,
            frame.y + frame.height / 2,
        );
        const degrees = (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI;
        return {
            box: {
                left: roundNumber(centre.x - frame.width / 2),
                top: roundNumber(centre.y - frame.height / 2),
                width: roundNumber(frame.width),
                height: roundNumber(frame.height),
                rotate: Math.abs(degrees) < EPSILON ? 0 : roundNumber(degrees),
            },
            inner: toTranslateMatrix(-frame.x, -frame.y),
        };
    }
    // Stretched, mirrored or skewed: the box is the slide, the drawing keeps
    // its own matrix.
    return {
        box: {
            left: 0,
            top: 0,
            width: slide.width,
            height: slide.height,
            rotate: 0,
        },
        inner: matrix ?? IDENTITY_MATRIX,
    };
}

function genBoxProps(id: number, box: PlacementType['box']) {
    return {
        id,
        top: box.top,
        left: box.left,
        rotate: box.rotate,
        width: box.width,
        height: box.height,
        backgroundColor: TRANSPARENT_COLOR,
        backdropFilter: 0,
        roundSizePercentage: 0,
        roundSizePixel: 0,
    };
}

function genHtmlItem(
    id: number,
    box: PlacementType['box'],
    html: string,
    isLocked = false,
) {
    return {
        ...genBoxProps(id, box),
        ...(isLocked ? { locked: true } : {}),
        type: 'html',
        html,
        color: '#000000',
        fontSize: 16,
        fontFamily: null,
        fontWeight: null,
        textHorizontalAlignment: 'left',
        textVerticalAlignment: 'start',
    };
}

type BuildContextType = {
    document: Document;
    layer: Element;
    definitionMap: Map<string, Element>;
    options: PptxSlideItemsOptionsType;
    missingImageSet: Set<string>;
};

function listTextReferencedIds(text: string) {
    return Array.from(text.matchAll(URL_REFERENCE_PATTERN)).map((match) => {
        return match[1];
    });
}

function checkIsHrefAttribute(attribute: Attr) {
    return attribute.localName === 'href' || attribute.name === 'xlink:href';
}

function listReferencedIds(element: Element) {
    const idList: string[] = [];
    for (const one of [element, ...listElements(element)]) {
        for (const attribute of Array.from(one.attributes)) {
            idList.push(...listTextReferencedIds(attribute.value));
            if (
                checkIsHrefAttribute(attribute) &&
                attribute.value.startsWith('#')
            ) {
                idList.push(attribute.value.slice(1));
            }
        }
    }
    return idList;
}

function renameTextReferences(text: string, idMap: Map<string, string>) {
    return text.replaceAll(URL_REFERENCE_PATTERN, (whole, id: string) => {
        const newId = idMap.get(id);
        return newId === undefined ? whole : `url(#${newId})`;
    });
}

function renameReferences(element: Element, idMap: Map<string, string>) {
    for (const one of [element, ...listElements(element)]) {
        for (const attribute of Array.from(one.attributes)) {
            let value = renameTextReferences(attribute.value, idMap);
            if (checkIsHrefAttribute(attribute) && value.startsWith('#')) {
                value = `#${idMap.get(value.slice(1)) ?? value.slice(1)}`;
            }
            if (attribute.localName === 'id') {
                value = idMap.get(value) ?? value;
            }
            if (value !== attribute.value) {
                one.setAttribute(attribute.name, value);
            }
        }
    }
}

// Each picture's file name for the picture itself, or the picture taken out.
function resolveImages(root: Element, context: BuildContextType) {
    for (const element of [root, ...listElements(root)]) {
        if (toLocalName(element) !== 'image') {
            continue;
        }
        const href = readHref(element);
        if (href === null || href.startsWith('data:')) {
            continue;
        }
        const resolved = IMAGE_HREF_PATTERN.test(href)
            ? context.options.resolveImage(href)
            : null;
        if (resolved === null) {
            context.missingImageSet.add(href);
            element.remove();
            continue;
        }
        setHref(element, resolved.src);
    }
}

/**
 * The definitions a box's markup points at -- and the ones THEY point at --
 * copied under ids of the box's own; the caller points its markup at them.
 */
function collectDefinitions(
    referencedIdList: string[],
    idPrefix: string,
    context: BuildContextType,
) {
    const idMap = new Map<string, string>();
    const pending = [...referencedIdList];
    const definitionList: Element[] = [];
    while (pending.length > 0) {
        const id = pending.shift() as string;
        if (idMap.has(id)) {
            continue;
        }
        const definition = context.definitionMap.get(id);
        if (definition === undefined) {
            continue;
        }
        idMap.set(id, `${idPrefix}${id}`);
        const copy = definition.cloneNode(true) as Element;
        for (const inner of listElements(copy)) {
            const innerId = inner.getAttribute('id');
            if (innerId !== null && !idMap.has(innerId)) {
                idMap.set(innerId, `${idPrefix}${innerId}`);
            }
        }
        definitionList.push(copy);
        pending.push(...listReferencedIds(copy));
    }
    for (const copy of definitionList) {
        renameReferences(copy, idMap);
        resolveImages(copy, context);
    }
    return { idMap, definitionList };
}

function toFixedPx(value: number) {
    return `${roundNumber(value)}px`;
}

// A `style` attribute's declarations of the names asked for, in order.
function pickStyleDeclarations(style: string | null, nameList: string[]) {
    if (style === null) {
        return [];
    }
    return style
        .split(';')
        .map((one) => {
            const [name, ...rest] = one.split(':');
            return {
                name: name.trim().toLowerCase(),
                value: rest.join(':').trim(),
            };
        })
        .filter(({ name, value }) => {
            return nameList.includes(name) && value !== '';
        });
}

/**
 * Where an element is moved to: its CSS `transform` when it has one -- a
 * build step's motion path is written there, over the shape's own move
 * (worship deck, slide 44: a picture and its words came out off the slide)
 * -- else its `transform` attribute. Null for one not read here, or one
 * turned or stretched about its own centre.
 */
function readOwnTransform(element: Element): PptxMatrixType | null {
    const style = element.getAttribute('style');
    const declared = pickStyleDeclarations(style, ['transform']).at(-1);
    if (declared === undefined) {
        return parsePptxTransform(element.getAttribute('transform'));
    }
    const value = declared.value.replace(/!important$/i, '').trim();
    if (value.toLowerCase() === 'none') {
        return IDENTITY_MATRIX;
    }
    const matrix = parseCssTransform(value);
    if (matrix === null) {
        return null;
    }
    const hasOwnOrigin =
        pickStyleDeclarations(style, ['transform-origin', 'transform-box'])
            .length > 0;
    return checkIsTranslation(matrix) || !hasOwnOrigin ? matrix : null;
}

/** A shape's copy without the motion its place was read from. */
function removeMotionStyle(element: Element) {
    const style = element.getAttribute('style');
    if (style === null) {
        return;
    }
    const kept = style
        .split(';')
        .filter((one) => {
            const name = one.split(':')[0].trim().toLowerCase();
            return (
                name !== '' &&
                !name.startsWith('--pptx-') &&
                !MOTION_STYLE_NAME_LIST.some((motionName) => {
                    return (
                        name === motionName || name.startsWith(`${motionName}-`)
                    );
                })
            );
        })
        .join(';');
    if (kept.trim() === '') {
        element.removeAttribute('style');
    } else {
        element.setAttribute('style', kept);
    }
}

/**
 * A shape the page does not draw: one a build step shows later (the
 * converter writes the slide's first look with it `display:none`, each step
 * as a page of its own) or one PowerPoint hides. Left out, never shown.
 */
function checkIsHiddenElement(element: Element) {
    if (
        element.getAttribute('display') === 'none' ||
        element.getAttribute('visibility') === 'hidden'
    ) {
        return true;
    }
    return pickStyleDeclarations(element.getAttribute('style'), [
        'display',
        'visibility',
    ]).some(({ name, value }) => {
        const word = value
            .replace(/!important$/i, '')
            .trim()
            .toLowerCase();
        return name === 'display' ? word === 'none' : word === 'hidden';
    });
}

function genResetStyle(element: Element) {
    return (
        ELEMENT_RESET_STYLE + (TAG_RESET_STYLE_MAP[toLocalName(element)] ?? '')
    );
}

type TextLayerType = {
    copy: Element;
    // From the text box's own coordinates to the shape's.
    matrix: PptxMatrixType;
    opacity: number;
    filterText: string;
    clipPathText: string;
};

/**
 * What the groups between a shape and one of its text boxes do to it: their
 * matrix, opacity and filter -- the shape's own included, its place aside --
 * and the text box's own clip.
 */
function readTextLayer(foreignObject: Element, group: Element): TextLayerType {
    let matrix = IDENTITY_MATRIX;
    let opacity = 1;
    const filterList: string[] = [];
    let current: Element | null = foreignObject;
    while (current !== null) {
        if (current !== foreignObject && current !== group) {
            matrix = multiplyPptxMatrix(
                readOwnTransform(current) ?? IDENTITY_MATRIX,
                matrix,
            );
        }
        opacity *= toNumber(current.getAttribute('opacity'), 1);
        const filter = current.getAttribute('filter');
        if (filter !== null && filter !== 'none') {
            filterList.unshift(filter);
        }
        for (const { name, value } of pickStyleDeclarations(
            current.getAttribute('style'),
            ['filter', 'opacity'],
        )) {
            if (name === 'opacity') {
                opacity *= toNumber(value, 1);
            } else if (value !== 'none') {
                filterList.unshift(value);
            }
        }
        if (current === group) {
            break;
        }
        current = current.parentElement;
    }
    const x = toNumber(foreignObject.getAttribute('x'));
    const y = toNumber(foreignObject.getAttribute('y'));
    const clipPath = foreignObject.getAttribute('clip-path');
    return {
        copy: foreignObject.cloneNode(true) as Element,
        matrix: multiplyPptxMatrix(matrix, toTranslateMatrix(x, y)),
        opacity,
        filterText: filterList.join(' '),
        clipPathText: clipPath === null || clipPath === 'none' ? '' : clipPath,
    };
}

/**
 * A text box's words as HTML placed where they were drawn, every element
 * given the converter page's own reset.
 */
function genTextLayerMarkup(
    layer: TextLayerType,
    inner: PptxMatrixType,
    idMap: Map<string, string>,
) {
    const full = multiplyPptxMatrix(inner, layer.matrix);
    const isMoveOnly = checkIsTranslation(full);
    const styleList = [
        'position:absolute',
        `left:${isMoveOnly ? toFixedPx(full[4]) : '0px'}`,
        `top:${isMoveOnly ? toFixedPx(full[5]) : '0px'}`,
        `width:${toFixedPx(toNumber(layer.copy.getAttribute('width')))}`,
        `height:${toFixedPx(toNumber(layer.copy.getAttribute('height')))}`,
        'overflow:visible',
        'margin:0',
        'padding:0',
        'box-sizing:border-box',
    ];
    if (!isMoveOnly) {
        styleList.push(
            `transform:${toMatrixText(full)}`,
            'transform-origin:0 0',
        );
    }
    if (layer.opacity < 1) {
        styleList.push(`opacity:${roundNumber(layer.opacity)}`);
    }
    if (layer.filterText !== '') {
        styleList.push(
            `filter:${renameTextReferences(layer.filterText, idMap)}`,
        );
    }
    if (layer.clipPathText !== '') {
        styleList.push(
            `clip-path:${renameTextReferences(layer.clipPathText, idMap)}`,
        );
    }
    for (const element of listElements(layer.copy)) {
        element.removeAttribute('xmlns');
        const style = element.getAttribute('style') ?? '';
        element.setAttribute('style', genResetStyle(element) + style);
    }
    // Double quotes inside a style (a font name) are written as `&quot;`
    // by the serializer; ours carries none but a url's, made safe here.
    const styleText = styleList.join(';').replaceAll('"', "'");
    return `<div style="${styleText}">${layer.copy.innerHTML}</div>`;
}

type LayerType =
    { kind: 'svg'; copy: Element } | { kind: 'text'; layer: TextLayerType };

// The definitions a copy carries itself: they go to the box's own list.
function removeOwnDefinitions(copy: Element) {
    for (const element of listElements(copy)) {
        if (
            copy.contains(element) &&
            NON_DRAWING_TAG_SET.has(toLocalName(element)) &&
            !checkIsInsideDefinition(element, copy)
        ) {
            element.remove();
        }
    }
}

/**
 * One shape's layers in their stacking order: runs of drawing as copies of
 * the shape holding only that run, each text box between them.
 */
function listGroupLayers(group: Element, inner: PptxMatrixType) {
    type SegmentType =
        | { kind: 'svg'; indexList: number[] }
        | { kind: 'text'; element: Element };
    const leafList: Element[] = [];
    const segmentList: SegmentType[] = [];
    const walk = (parent: Element) => {
        for (const child of Array.from(parent.children)) {
            const name = toLocalName(child);
            if (checkIsHiddenElement(child)) {
                continue;
            }
            if (name === 'foreignobject') {
                segmentList.push({ kind: 'text', element: child });
                continue;
            }
            if (NON_DRAWING_TAG_SET.has(name)) {
                continue;
            }
            if (
                name === 'g' &&
                child.getElementsByTagName('foreignObject').length > 0
            ) {
                walk(child);
                continue;
            }
            leafList.push(child);
            const last = segmentList.at(-1);
            if (last?.kind === 'svg') {
                last.indexList.push(leafList.length - 1);
            } else {
                segmentList.push({
                    kind: 'svg',
                    indexList: [leafList.length - 1],
                });
            }
        }
    };
    walk(group);
    leafList.forEach((leaf, index) => {
        leaf.setAttribute('data-owa-leaf', String(index));
    });
    const layerList: LayerType[] = [];
    for (const segment of segmentList) {
        if (segment.kind === 'text') {
            layerList.push({
                kind: 'text',
                layer: readTextLayer(segment.element, group),
            });
            continue;
        }
        const keepSet = new Set(segment.indexList.map(String));
        const copy = group.cloneNode(true) as Element;
        for (const element of listElements(copy)) {
            const leafIndex = element.getAttribute('data-owa-leaf');
            if (
                toLocalName(element) === 'foreignobject' ||
                (leafIndex !== null && !keepSet.has(leafIndex))
            ) {
                element.remove();
            }
        }
        // A hidden child was never made a leaf; the page does not draw it,
        // and neither does the copy.
        for (const element of listElements(copy)) {
            if (copy.contains(element) && checkIsHiddenElement(element)) {
                element.remove();
            }
        }
        removeOwnDefinitions(copy);
        for (const element of [copy, ...listElements(copy)]) {
            element.removeAttribute('data-owa-leaf');
        }
        copy.removeAttribute('data-id');
        copy.removeAttribute('data-pptx-id');
        removeMotionStyle(copy);
        if (checkIsIdentity(inner)) {
            copy.removeAttribute('transform');
        } else {
            copy.setAttribute('transform', toMatrixText(inner));
        }
        layerList.push({ kind: 'svg', copy });
    }
    for (const leaf of leafList) {
        leaf.removeAttribute('data-owa-leaf');
    }
    return layerList;
}

function genSvgMarkup(
    content: string,
    size: { width: number; height: number },
    style: string,
) {
    const width = roundNumber(size.width);
    const height = roundNumber(size.height);
    return (
        `<svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${height}" ` +
        `viewBox="0 0 ${width} ${height}" overflow="visible" ` +
        `style="${style}">${content}</svg>`
    );
}

/**
 * A shape as the markup of one HTML box: the page's defaults, the
 * definitions it points at, then its layers in order.
 */
function genGroupHtml(
    group: Element,
    placement: PlacementType,
    idPrefix: string,
    context: BuildContextType,
) {
    const layerList = listGroupLayers(group, placement.inner);
    const referencedIdList = layerList.flatMap((one) => {
        return one.kind === 'svg'
            ? listReferencedIds(one.copy)
            : [
                  ...listReferencedIds(one.layer.copy),
                  ...listTextReferencedIds(one.layer.filterText),
                  ...listTextReferencedIds(one.layer.clipPathText),
              ];
    });
    const { idMap, definitionList } = collectDefinitions(
        referencedIdList,
        idPrefix,
        context,
    );
    const markupList = layerList.map((one) => {
        if (one.kind === 'text') {
            renameReferences(one.layer.copy, idMap);
            resolveImages(one.layer.copy, context);
            return genTextLayerMarkup(one.layer, placement.inner, idMap);
        }
        renameReferences(one.copy, idMap);
        resolveImages(one.copy, context);
        return genSvgMarkup(
            one.copy.outerHTML,
            placement.box,
            'position:absolute;left:0;top:0;overflow:visible',
        );
    });
    const definitionsMarkup =
        definitionList.length === 0
            ? ''
            : genSvgMarkup(
                  `<defs>${definitionList
                      .map((one) => {
                          return one.outerHTML;
                      })
                      .join('')}</defs>`,
                  { width: 0, height: 0 },
                  'position:absolute;left:0;top:0;width:0;height:0;' +
                      'overflow:hidden',
              );
    return (
        `<div style="position:absolute;left:0;top:0;` +
        `width:${toFixedPx(placement.box.width)};` +
        `height:${toFixedPx(placement.box.height)};${ROOT_RESET_STYLE}">` +
        definitionsMarkup +
        markupList.join('') +
        '</div>'
    );
}

// A picture alone, stretched to its frame: a picture box can say all of it.
function readLoneImage(group: Element) {
    const children = Array.from(group.children);
    if (children.length !== 1 || toLocalName(children[0]) !== 'image') {
        return null;
    }
    const image = children[0];
    const extraAttributeList = Array.from(image.attributes).filter(
        (attribute) => {
            return ![
                'href',
                'xlink:href',
                'width',
                'height',
                'preserveaspectratio',
            ].includes(attribute.name.toLowerCase());
        },
    );
    const groupExtraList = Array.from(group.attributes).filter((attribute) => {
        return !['data-id', 'data-pptx-id', 'transform'].includes(
            attribute.name.toLowerCase(),
        );
    });
    if (
        extraAttributeList.length > 0 ||
        groupExtraList.length > 0 ||
        image.getAttribute('preserveAspectRatio') !== 'none'
    ) {
        return null;
    }
    return image;
}

/**
 * The run of drawing before the first shape -- the slide's background -- as
 * a box: a plain colour as the box's own colour, else its drawing.
 */
function genLooseItem(
    id: number,
    elementList: Element[],
    isBackground: boolean,
    idPrefix: string,
    context: BuildContextType,
) {
    const { width, height } = context.options;
    const slideBox = { left: 0, top: 0, width, height, rotate: 0 };
    if (elementList.length === 1 && isBackground) {
        const only = elementList[0];
        const fill = only.getAttribute('fill') ?? '';
        const nameList = Array.from(only.attributes).map((attribute) => {
            return attribute.name.toLowerCase();
        });
        if (
            toLocalName(only) === 'rect' &&
            HEX_COLOR_PATTERN.test(fill) &&
            nameList.every((name) => {
                return ['width', 'height', 'fill', 'x', 'y'].includes(name);
            }) &&
            toNumber(only.getAttribute('x')) <= 0 &&
            toNumber(only.getAttribute('y')) <= 0 &&
            toNumber(only.getAttribute('width')) >= width &&
            toNumber(only.getAttribute('height')) >= height
        ) {
            const item = genHtmlItem(id, slideBox, '', true);
            const color =
                fill.length === 4
                    ? `#${fill[1]}${fill[1]}${fill[2]}${fill[2]}${fill[3]}${fill[3]}`
                    : fill;
            return { ...item, backgroundColor: color.toLowerCase() };
        }
    }
    const group = context.document.createElementNS(SVG_NAMESPACE, 'g');
    for (const element of elementList) {
        group.append(element.cloneNode(true));
    }
    const html = genGroupHtml(
        group,
        { box: slideBox, inner: IDENTITY_MATRIX },
        idPrefix,
        context,
    );
    const item = genHtmlItem(id, slideBox, html, isBackground);
    // PowerPoint paints a slide on white: a background it lets show through
    // (bg-test's gradient starts 38% opaque) is white below, where a slide
    // here would show the screen's black.
    return isBackground ? { ...item, backgroundColor: '#ffffff' } : item;
}

function genGroupItems(
    group: Element,
    parentMatrix: PptxMatrixType | null,
    context: BuildContextType,
    nextId: () => number,
): AnyObjectType[] {
    if (checkIsHiddenElement(group)) {
        return [];
    }
    const own = readOwnTransform(group);
    const matrix =
        own === null || parentMatrix === null
            ? null
            : multiplyPptxMatrix(parentMatrix, own);
    const children = Array.from(group.children);
    // A group of shapes and nothing else: each shape a box of its own.
    if (
        children.length > 0 &&
        matrix !== null &&
        children.every((child) => {
            return child.hasAttribute('data-id');
        }) &&
        Array.from(group.attributes).every((attribute) => {
            return ['data-id', 'data-pptx-id', 'transform'].includes(
                attribute.name.toLowerCase(),
            );
        })
    ) {
        return children.flatMap((child) => {
            return genGroupItems(child, matrix, context, nextId);
        });
    }
    const frame = readGroupFrame(group);
    const placement = placeGroup(matrix, frame, context.options);
    const id = nextId();
    const lone = readLoneImage(group);
    if (
        lone !== null &&
        checkIsIdentity(
            placement.inner.map((one, index) => {
                return index < 4 ? one : 0;
            }) as PptxMatrixType,
        )
    ) {
        const href = readHref(lone) ?? '';
        const resolved = IMAGE_HREF_PATTERN.test(href)
            ? context.options.resolveImage(href)
            : null;
        if (resolved === null) {
            context.missingImageSet.add(href);
            return [];
        }
        return [
            {
                ...genBoxProps(id, placement.box),
                type: 'image',
                srcData: resolved.src,
                mediaWidth: resolved.width,
                mediaHeight: resolved.height,
            },
        ];
    }
    const idPrefix = `${context.options.idPrefix}${id}-`;
    const html = genGroupHtml(group, placement, idPrefix, context);
    return [genHtmlItem(id, placement.box, html)];
}

/**
 * The boxes of one converted slide, bottom first, or null when the page is
 * not one the converter drew.
 */
export function toPptxSlideCanvasItems(
    html: string,
    options: PptxSlideItemsOptionsType,
): PptxSlideItemsType | null {
    const document = parsePptxSlideDocument(html);
    const layer = findPptxSlideLayer(document);
    if (layer === null) {
        return null;
    }
    const definitionMap = new Map<string, Element>();
    for (const element of listElements(layer)) {
        const id = element.getAttribute('id');
        if (
            id !== null &&
            (NON_DRAWING_TAG_SET.has(toLocalName(element)) ||
                checkIsInsideDefinition(element, layer))
        ) {
            definitionMap.set(id, element);
        }
    }
    const context: BuildContextType = {
        document,
        layer,
        definitionMap,
        options,
        missingImageSet: new Set(),
    };
    let lastId = -1;
    const nextId = () => {
        lastId += 1;
        return lastId;
    };
    const canvasItems: AnyObjectType[] = [];
    let looseList: Element[] = [];
    let hasShape = false;
    const flushLoose = () => {
        if (looseList.length === 0) {
            return;
        }
        const id = nextId();
        canvasItems.push(
            genLooseItem(
                id,
                looseList,
                !hasShape,
                `${options.idPrefix}${id}-`,
                context,
            ),
        );
        looseList = [];
    };
    for (const child of Array.from(layer.children)) {
        const name = toLocalName(child);
        if (NON_DRAWING_TAG_SET.has(name) || checkIsHiddenElement(child)) {
            continue;
        }
        if (name === 'g' && child.hasAttribute('data-id')) {
            flushLoose();
            hasShape = true;
            canvasItems.push(
                ...genGroupItems(child, IDENTITY_MATRIX, context, nextId),
            );
            continue;
        }
        looseList.push(child);
    }
    flushLoose();
    return {
        canvasItems,
        missingImages: Array.from(context.missingImageSet),
    };
}
