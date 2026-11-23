// A BOX's own look on a PowerPoint slide (2026-11-21, `owa_office_edit`):
// its fill and outline, how see-through it is, a picture's brightness, its
// turn, where its words sit inside it, and whether it is in front of or
// behind the boxes around it. The goal was _the chatbot can change
// everything on a given pptx_, and after the words these are a worship
// deck's commonest asks: a dark box behind the words so they read, the
// background picture darker, the words brought in front of a picture.
//
// Pure, strings in and out, the same tag scanner as the words.

import { type SlideBoxKindType } from './officeSlideBoxHelpers';
import { type ElementType, listChildElements } from './officeXmlEditHelpers';
import {
    type ChildSetType,
    checkIsOfficeColorOff,
    genOfficeFillXml,
    patchElement,
    setAttribute,
    toOfficeColor,
    toOfficeColorWords,
    toOfficeFill,
    toOfficeFillWords,
} from './officeXmlLookHelpers';

export const OFFICE_BOX_ORDER_LIST = [
    'front',
    'back',
    'forward',
    'backward',
] as const;
export type OfficeBoxOrderType = (typeof OFFICE_BOX_ORDER_LIST)[number];

export const OFFICE_BOX_VALIGN_LIST = ['top', 'middle', 'bottom'] as const;
export type OfficeBoxValignType = (typeof OFFICE_BOX_VALIGN_LIST)[number];

export const OFFICE_BOX_FLIP_LIST = [
    'horizontal',
    'vertical',
    'both',
    'none',
] as const;
export type OfficeBoxFlipType = (typeof OFFICE_BOX_FLIP_LIST)[number];

export type OfficeBoxLookType = {
    // `RRGGBB`, or null: no fill
    fill?: string | null;
    // `RRGGBB`, or null: no outline
    outline?: string | null;
    // 0 to 100: how see-through its fill, or a picture, is
    transparency?: number;
    // -100 to 100: a picture darker or lighter
    brightness?: number;
    // degrees clockwise, 0 to 359.99
    rotate?: number;
    // mirrored left to right, upside down, both, or as it was made
    flip?: OfficeBoxFlipType;
    valign?: OfficeBoxValignType;
    order?: OfficeBoxOrderType;
};

export const OFFICE_BOX_LOOK_KEY_LIST = [
    'fill',
    'outline',
    'transparency',
    'brightness',
    'rotate',
    'flip',
    'valign',
    'order',
] as const;

const ORDER_WORD_MAP: Record<string, OfficeBoxOrderType> = {
    front: 'front',
    'to front': 'front',
    'to the front': 'front',
    'bring to front': 'front',
    top: 'front',
    back: 'back',
    'to back': 'back',
    'to the back': 'back',
    'send to back': 'back',
    behind: 'back',
    bottom: 'back',
    forward: 'forward',
    'bring forward': 'forward',
    backward: 'backward',
    backwards: 'backward',
    'send backward': 'backward',
};
const FLIP_WORD_MAP: Record<string, OfficeBoxFlipType> = {
    horizontal: 'horizontal',
    horizontally: 'horizontal',
    h: 'horizontal',
    mirror: 'horizontal',
    'left to right': 'horizontal',
    vertical: 'vertical',
    vertically: 'vertical',
    v: 'vertical',
    'upside down': 'vertical',
    both: 'both',
    none: 'none',
    no: 'none',
    off: 'none',
};
const VALIGN_WORD_MAP: Record<string, OfficeBoxValignType> = {
    top: 'top',
    middle: 'middle',
    center: 'middle',
    centre: 'middle',
    bottom: 'bottom',
};
const BRIGHTNESS_WORD_MAP: Record<string, number> = {
    darker: -30,
    lighter: 30,
    brighter: 30,
    normal: 0,
    none: 0,
};
const VALIGN_ANCHOR_MAP: Record<OfficeBoxValignType, string> = {
    top: 't',
    middle: 'ctr',
    bottom: 'b',
};

/** "40%", "40", 40 -> 40; null when it is no number. */
function readNumber(value: unknown) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().replace(/\s*(?:%|percent|deg|degrees?|°)$/i, '');
    if (text === '' || !/^[-+]?\d*\.?\d+$/.test(text)) {
        return null;
    }
    return Number(text);
}

function readColor(key: 'fill' | 'outline', value: unknown) {
    if (checkIsOfficeColorOff(value)) {
        return { color: null };
    }
    // a fill may be a gradient or a pattern too: "dark blue to purple",
    // "navy stripes on white"
    const color = key === 'fill' ? toOfficeFill(value) : toOfficeColor(value);
    if (color === null) {
        return {
            reason:
                `\`${key}\` is a colour (#RRGGBB or an English name, ` +
                'e.g. "black")' +
                (key === 'fill'
                    ? ', a gradient ("dark blue to purple", "black to ' +
                      'navy, left to right"), a pattern ("navy stripes on ' +
                      'white": stripes, dots, checks, grid, crosshatch, ' +
                      'bricks, diamonds, waves, zigzag, plaid …)'
                    : '') +
                ', or "none" to take it off.',
        };
    }
    return { color };
}

/**
 * A change's box look -- its `fill`, `outline`, `transparency`,
 * `brightness`, `rotate`, `valign` and `order` -- or why it cannot be read.
 * Null when it gives none.
 */
export function readOfficeBoxLook(
    change: Record<string, unknown>,
): { look: OfficeBoxLookType | null } | { reason: string } {
    const look: OfficeBoxLookType = {};
    for (const key of ['fill', 'outline'] as const) {
        if (change[key] === undefined) {
            continue;
        }
        const read = readColor(key, change[key]);
        if ('reason' in read) {
            return { reason: read.reason as string };
        }
        look[key] = read.color;
    }
    if (change.transparency !== undefined) {
        const transparency = readNumber(change.transparency);
        if (transparency === null || transparency < 0 || transparency > 100) {
            return {
                reason:
                    '`transparency` is how see-through it is, 0 (solid) to ' +
                    '100 (not seen): 40 lets a picture show through.',
            };
        }
        look.transparency = Math.round(transparency);
    }
    if (change.brightness !== undefined) {
        const word = String(change.brightness).trim().toLowerCase();
        const brightness = BRIGHTNESS_WORD_MAP[word] ?? readNumber(word);
        if (brightness === null || brightness < -100 || brightness > 100) {
            return {
                reason:
                    "`brightness` is a picture's, -100 to 100: -30 darker, " +
                    '30 lighter, 0 as it was.',
            };
        }
        look.brightness = Math.round(brightness);
    }
    if (change.rotate !== undefined) {
        const rotate = readNumber(change.rotate);
        if (rotate === null || rotate < -360 || rotate > 360) {
            return {
                reason:
                    '`rotate` is the turn in degrees, clockwise: 90, -15, ' +
                    '0 for straight.',
            };
        }
        look.rotate = Math.round((((rotate % 360) + 360) % 360) * 100) / 100;
    }
    if (change.flip !== undefined) {
        const flip =
            FLIP_WORD_MAP[
                String(change.flip).trim().toLowerCase().replace(/\s+/g, ' ')
            ];
        if (flip === undefined) {
            return {
                reason:
                    '`flip` mirrors a box: ' +
                    `${OFFICE_BOX_FLIP_LIST.join(', ')} (as it was made).`,
            };
        }
        look.flip = flip;
    }
    if (change.valign !== undefined) {
        const valign =
            VALIGN_WORD_MAP[String(change.valign).trim().toLowerCase()];
        if (valign === undefined) {
            return {
                reason:
                    '`valign` is where the words sit in their box: ' +
                    `${OFFICE_BOX_VALIGN_LIST.join(', ')}.`,
            };
        }
        look.valign = valign;
    }
    if (change.order !== undefined) {
        const order =
            ORDER_WORD_MAP[
                String(change.order).trim().toLowerCase().replace(/\s+/g, ' ')
            ];
        if (order === undefined) {
            return {
                reason:
                    '`order` puts a box in front of or behind the others: ' +
                    `${OFFICE_BOX_ORDER_LIST.join(', ')}.`,
            };
        }
        look.order = order;
    }
    return { look: Object.keys(look).length === 0 ? null : look };
}

/** A box look said back: "filled black (#000000), 40% see-through". */
export function describeOfficeBoxLook(look: OfficeBoxLookType) {
    const words: string[] = [];
    if (look.fill !== undefined) {
        words.push(
            look.fill === null
                ? 'no fill'
                : `filled ${toOfficeFillWords(look.fill)}`,
        );
    }
    if (look.transparency !== undefined) {
        words.push(
            look.transparency === 0
                ? 'solid'
                : `${look.transparency}% see-through`,
        );
    }
    if (look.outline !== undefined) {
        words.push(
            look.outline === null
                ? 'no outline'
                : `outlined ${toOfficeColorWords(look.outline)}`,
        );
    }
    if (look.brightness !== undefined) {
        words.push(
            look.brightness === 0
                ? 'its own brightness'
                : `${Math.abs(look.brightness)}% ` +
                      (look.brightness < 0 ? 'darker' : 'lighter'),
        );
    }
    if (look.rotate !== undefined) {
        words.push(
            look.rotate === 0 ? 'straight' : `turned ${look.rotate} degrees`,
        );
    }
    if (look.flip !== undefined) {
        words.push(
            {
                horizontal: 'flipped left to right',
                vertical: 'flipped upside down',
                both: 'flipped both ways',
                none: 'not flipped',
            }[look.flip],
        );
    }
    if (look.valign !== undefined) {
        words.push(`its words at the ${look.valign}`);
    }
    if (look.order !== undefined) {
        words.push(
            {
                front: 'brought to the front',
                back: 'sent to the back',
                forward: 'brought one forward',
                backward: 'sent one back',
            }[look.order],
        );
    }
    return words.join(', ');
}

// CT_ShapeProperties' children, in the schema's order.
const SHAPE_PROPS_ORDER_LIST = [
    'a:xfrm',
    'a:custGeom',
    'a:prstGeom',
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
    'a:ln',
    'a:effectLst',
    'a:effectDag',
    'a:scene3d',
    'a:sp3d',
    'a:extLst',
];
const FILL_LIST = [
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
];
// CT_LineProperties' children, in the schema's order.
const LINE_PROPS_ORDER_LIST = [
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:pattFill',
    'a:prstDash',
    'a:custDash',
    'a:round',
    'a:bevel',
    'a:miter',
    'a:headEnd',
    'a:tailEnd',
    'a:extLst',
];
// CT_Blip's effects, then its own extension list last
const BLIP_ORDER_LIST = [
    'a:alphaBiLevel',
    'a:alphaCeiling',
    'a:alphaFloor',
    'a:alphaInv',
    'a:alphaMod',
    'a:alphaModFix',
    'a:alphaOutset',
    'a:alphaRepl',
    'a:biLevel',
    'a:blur',
    'a:clrChange',
    'a:clrRepl',
    'a:duotone',
    'a:fillOverlay',
    'a:grayscl',
    'a:hsl',
    'a:lum',
    'a:tint',
    'a:extLst',
];
const COLOR_NAME_SET = new Set([
    'a:srgbClr',
    'a:schemeClr',
    'a:scrgbClr',
    'a:prstClr',
    'a:sysClr',
    'a:hslClr',
]);
// a 2 pt line: seen on a projector, never heavy
const OUTLINE_WIDTH = 25400;
const FILL_KIND_SET = new Set<SlideBoxKindType>(['text', 'shape']);
const OUTLINE_KIND_SET = new Set<SlideBoxKindType>([
    'text',
    'shape',
    'picture',
    'line',
]);
const ROTATE_KIND_SET = new Set<SlideBoxKindType>([
    'text',
    'shape',
    'picture',
    'video',
    'group',
    'line',
]);

function findChild(xml: string, parent: ElementType, name: string) {
    if (parent.closeStart === parent.end) {
        return null;
    }
    return (
        listChildElements(xml, parent.openEnd, parent.closeStart).find(
            (child) => {
                return child.name === name;
            },
        ) ?? null
    );
}

function replaceElement(xml: string, element: ElementType, made: string) {
    return xml.slice(0, element.start) + made + xml.slice(element.end);
}

/** 0-100 see-through as an `alpha`'s value; null when solid. */
function toAlphaValue(transparency: number) {
    return transparency === 0 ? null : String((100 - transparency) * 1000);
}

/** A fill's colour made see-through (or solid again), its colour kept. */
function setFillAlpha(fillXml: string, transparency: number) {
    const fill = listChildElements(fillXml, 0, fillXml.length)[0];
    if (fill === undefined || fill.closeStart === fill.end) {
        return null;
    }
    const color = listChildElements(
        fillXml,
        fill.openEnd,
        fill.closeStart,
    ).find((child) => {
        return COLOR_NAME_SET.has(child.name);
    });
    if (color === undefined) {
        return null;
    }
    const alpha = toAlphaValue(transparency);
    const made = patchElement(
        fillXml.slice(color.start, color.end),
        {},
        [
            {
                name: 'a:alpha',
                xml: alpha === null ? null : `<a:alpha val="${alpha}"/>`,
            },
        ],
        ['a:alpha'],
    );
    return made === null ? null : replaceElement(fillXml, color, made);
}

function patchShapeProps(
    boxXml: string,
    box: ElementType,
    look: OfficeBoxLookType,
    kind: SlideBoxKindType,
): { xml: string } | { reason: string } {
    const props = findChild(boxXml, box, 'p:spPr');
    if (props === null) {
        return { reason: 'it has no look of its own to change.' };
    }
    const propsXml = boxXml.slice(props.start, props.end);
    const propsElement = listChildElements(propsXml, 0, propsXml.length)[0];
    const children: ChildSetType[] = [];
    const isFillSeen = look.transparency !== undefined && kind !== 'picture';
    if (look.fill !== undefined) {
        const fillXml =
            look.fill === null
                ? '<a:noFill/>'
                : genOfficeFillXml(look.fill, look.transparency);
        children.push({
            name: /^<(a:\w+)/.exec(fillXml)?.[1] ?? 'a:solidFill',
            xml: fillXml,
            alsoRemove: FILL_LIST,
        });
    } else if (isFillSeen) {
        const fill = findChild(propsXml, propsElement, 'a:solidFill');
        const made =
            fill === null
                ? null
                : setFillAlpha(
                      propsXml.slice(fill.start, fill.end),
                      look.transparency as number,
                  );
        if (made === null) {
            return {
                reason:
                    'it has no colour of its own to see through: give a ' +
                    '`fill` with the `transparency`.',
            };
        }
        children.push({ name: 'a:solidFill', xml: made });
    }
    if (look.outline !== undefined) {
        const line = findChild(propsXml, propsElement, 'a:ln');
        let made: string | null;
        if (look.outline === null) {
            made = '<a:ln><a:noFill/></a:ln>';
        } else {
            const fill = `<a:solidFill><a:srgbClr val="${look.outline}"/></a:solidFill>`;
            made =
                line === null
                    ? `<a:ln w="${OUTLINE_WIDTH}">${fill}</a:ln>`
                    : patchElement(
                          propsXml.slice(line.start, line.end),
                          // a line drawn hairline-thin is given a width seen
                          /\sw="[1-9]\d{4,}"/.test(
                              propsXml.slice(line.start, line.end),
                          )
                              ? {}
                              : { w: String(OUTLINE_WIDTH) },
                          [
                              {
                                  name: 'a:solidFill',
                                  xml: fill,
                                  alsoRemove: FILL_LIST,
                              },
                          ],
                          LINE_PROPS_ORDER_LIST,
                      );
        }
        if (made === null) {
            return { reason: 'its outline could not be read.' };
        }
        children.push({ name: 'a:ln', xml: made });
    }
    if (children.length === 0) {
        return { xml: boxXml };
    }
    const made = patchElement(propsXml, {}, children, SHAPE_PROPS_ORDER_LIST);
    if (made === null) {
        return { reason: 'its look could not be read.' };
    }
    return { xml: replaceElement(boxXml, props, made) };
}

function patchPictureBlip(
    boxXml: string,
    box: ElementType,
    look: OfficeBoxLookType,
): { xml: string } | { reason: string } {
    const blipFill = findChild(boxXml, box, 'p:blipFill');
    const blip =
        blipFill === null ? null : findChild(boxXml, blipFill, 'a:blip');
    if (blip === null) {
        return { reason: 'its picture could not be read.' };
    }
    const blipXml = boxXml.slice(blip.start, blip.end);
    const blipElement = listChildElements(blipXml, 0, blipXml.length)[0];
    const children: ChildSetType[] = [];
    if (look.transparency !== undefined) {
        const alpha = toAlphaValue(look.transparency);
        children.push({
            name: 'a:alphaModFix',
            xml: alpha === null ? null : `<a:alphaModFix amt="${alpha}"/>`,
        });
    }
    if (look.brightness !== undefined) {
        // its contrast, when it has one, kept
        const lum = findChild(blipXml, blipElement, 'a:lum');
        let lumXml = setAttribute(
            lum === null ? '<a:lum/>' : blipXml.slice(lum.start, lum.end),
            'bright',
            look.brightness === 0 ? null : String(look.brightness * 1000),
        );
        if (/^<a:lum\s*\/>$/.test(lumXml)) {
            lumXml = '';
        }
        children.push({ name: 'a:lum', xml: lumXml === '' ? null : lumXml });
    }
    const made = patchElement(blipXml, {}, children, BLIP_ORDER_LIST);
    if (made === null) {
        return { reason: 'its picture could not be read.' };
    }
    return { xml: replaceElement(boxXml, blip, made) };
}

/** The box's own `xfrm` turned; null when it has none (its layout's place). */
export function setBoxRotationXml(boxXml: string, degrees: number) {
    const open = /<(?:a|p):xfrm\b(?:[^>"']|"[^"]*"|'[^']*')*?\/?>/.exec(boxXml);
    if (open === null) {
        return null;
    }
    const tag = setAttribute(
        open[0],
        'rot',
        degrees === 0 ? null : String(Math.round(degrees * 60000)),
    );
    return (
        boxXml.slice(0, open.index) +
        tag +
        boxXml.slice(open.index + open[0].length)
    );
}

/** The box's own `xfrm` mirrored (or not); null when it has none. */
export function setBoxFlipXml(boxXml: string, flip: OfficeBoxFlipType) {
    const open = /<(?:a|p):xfrm\b(?:[^>"']|"[^"]*"|'[^']*')*?\/?>/.exec(boxXml);
    if (open === null) {
        return null;
    }
    const isH = flip === 'horizontal' || flip === 'both';
    const isV = flip === 'vertical' || flip === 'both';
    const tag = setAttribute(
        setAttribute(open[0], 'flipH', isH ? '1' : null),
        'flipV',
        isV ? '1' : null,
    );
    return (
        boxXml.slice(0, open.index) +
        tag +
        boxXml.slice(open.index + open[0].length)
    );
}

/**
 * A box (the XML of one `p:sp`, `p:pic`, … as `kind` reads it) given its
 * look: fill, outline, see-through, brightness, turn, where its words sit.
 * `order` is the slide's (`moveSlideBoxXml`). A box given a turn has its
 * own place first (`setBoxPlaceXml`). Or why not, in words after its name.
 */
export function applyBoxLookXml(
    boxXml: string,
    look: OfficeBoxLookType,
    kind: SlideBoxKindType,
): { xml: string } | { reason: string } {
    const kindWords = kind === 'text' ? 'a box of words' : `a ${kind}`;
    if (
        kind === 'smartart' &&
        (look.fill !== undefined ||
            look.outline !== undefined ||
            look.transparency !== undefined ||
            look.rotate !== undefined ||
            look.flip !== undefined ||
            look.valign !== undefined)
    ) {
        // its shapes are PowerPoint's to lay out until they are the
        // slide's own (2026-11-21)
        return {
            reason:
                'it is a SmartArt, whose shapes PowerPoint lays out: ' +
                '{slide, box, toShapes: true} turns it into shapes first ' +
                "(PowerPoint's Convert to Shapes: its words and look stay, " +
                'it is no longer a SmartArt). Say so and ask; then give each ' +
                'shape its look by the name the answer gives.',
        };
    }
    if (look.fill !== undefined && !FILL_KIND_SET.has(kind)) {
        return {
            reason:
                kind === 'table'
                    ? "a table's cells are coloured with `tableLook`."
                    : `it is ${kindWords}: only a box of words or a shape takes a \`fill\`.`,
        };
    }
    if (look.outline !== undefined && !OUTLINE_KIND_SET.has(kind)) {
        return {
            reason:
                kind === 'table'
                    ? "a table's lines are its `tableLook` `borders`."
                    : `it is ${kindWords}: it takes no \`outline\`.`,
        };
    }
    if (
        look.transparency !== undefined &&
        !FILL_KIND_SET.has(kind) &&
        kind !== 'picture'
    ) {
        return {
            reason: `it is ${kindWords}: only a picture or a box's fill can be see-through.`,
        };
    }
    if (look.brightness !== undefined && kind !== 'picture') {
        return {
            reason: `it is ${kindWords}: only a picture is made darker or lighter.`,
        };
    }
    if (look.rotate !== undefined && !ROTATE_KIND_SET.has(kind)) {
        return {
            reason: `it is ${kindWords}: PowerPoint does not turn one.`,
        };
    }
    if (look.flip !== undefined && !ROTATE_KIND_SET.has(kind)) {
        return {
            reason: `it is ${kindWords}: PowerPoint does not flip one.`,
        };
    }
    if (look.valign !== undefined && !FILL_KIND_SET.has(kind)) {
        return {
            reason: `it is ${kindWords}: it holds no words to place.`,
        };
    }
    let xml = boxXml;
    const box = listChildElements(xml, 0, xml.length)[0];
    if (box === undefined) {
        return { reason: 'it could not be read.' };
    }
    if (
        look.fill !== undefined ||
        look.outline !== undefined ||
        (look.transparency !== undefined && kind !== 'picture')
    ) {
        const shaped = patchShapeProps(xml, box, look, kind);
        if ('reason' in shaped) {
            return shaped;
        }
        xml = shaped.xml;
    }
    if (
        kind === 'picture' &&
        (look.transparency !== undefined || look.brightness !== undefined)
    ) {
        const pictureBox = listChildElements(xml, 0, xml.length)[0];
        const pictured = patchPictureBlip(xml, pictureBox, look);
        if ('reason' in pictured) {
            return pictured;
        }
        xml = pictured.xml;
    }
    if (look.rotate !== undefined) {
        const turned = setBoxRotationXml(xml, look.rotate);
        if (turned === null) {
            return { reason: 'it has no place of its own to turn.' };
        }
        xml = turned;
    }
    if (look.flip !== undefined) {
        const flipped = setBoxFlipXml(xml, look.flip);
        if (flipped === null) {
            return { reason: 'it has no place of its own to flip.' };
        }
        xml = flipped;
    }
    if (look.valign !== undefined) {
        const open = /<a:bodyPr\b(?:[^>"']|"[^"]*"|'[^']*')*?\/?>/.exec(xml);
        if (open === null) {
            return { reason: 'it holds no words to place.' };
        }
        xml =
            xml.slice(0, open.index) +
            setAttribute(open[0], 'anchor', VALIGN_ANCHOR_MAP[look.valign]) +
            xml.slice(open.index + open[0].length);
    }
    return { xml };
}

const TREE_SKIPPED_SET = new Set(['p:nvGrpSpPr', 'p:grpSpPr', 'p:extLst']);

/**
 * The slide with the box at `[start, end)` -- a box of its shape tree's
 * own, not one inside a group -- put in front of or behind the others:
 * the tree draws its boxes in order, the last in front. `isMoved` false
 * when it already was where asked. Null when it is not in the tree.
 */
export function moveSlideBoxXml(
    slideXml: string,
    box: { start: number; end: number },
    order: OfficeBoxOrderType,
): { xml: string; isMoved: boolean } | null {
    const open = /<p:spTree\b[^>]*>/.exec(slideXml);
    const treeEnd = slideXml.lastIndexOf('</p:spTree>');
    if (open === null || treeEnd < 0) {
        return null;
    }
    const layers = listChildElements(
        slideXml,
        open.index + open[0].length,
        treeEnd,
    ).filter((child) => {
        return !TREE_SKIPPED_SET.has(child.name);
    });
    const index = layers.findIndex((layer) => {
        return layer.start === box.start && layer.end === box.end;
    });
    if (index < 0) {
        return null;
    }
    const target = {
        front: layers.length - 1,
        back: 0,
        forward: Math.min(layers.length - 1, index + 1),
        backward: Math.max(0, index - 1),
    }[order];
    if (target === index) {
        return { xml: slideXml, isMoved: false };
    }
    const boxXml = slideXml.slice(box.start, box.end);
    const without = slideXml.slice(0, box.start) + slideXml.slice(box.end);
    const width = box.end - box.start;
    // where it goes, read in the slide without it
    const anchor = layers[target];
    const at = target > index ? anchor.end - width : anchor.start;
    return {
        xml: without.slice(0, at) + boxXml + without.slice(at),
        isMoved: true,
    };
}
