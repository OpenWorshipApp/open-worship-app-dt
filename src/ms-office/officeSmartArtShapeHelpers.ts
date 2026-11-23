import { escapeXmlAttribute } from './pptxXmlHelpers';
import { unescapeXml } from './officeXmlEditHelpers';

/**
 * A SmartArt turned into the shapes it is drawn with, as PowerPoint's
 * SmartArt → Convert → Convert to Shapes does (2026-11-21, the goal _chatbot
 * can change do everything on a given pptx_: a SmartArt's shape, colour and
 * place had been PowerPoint's). A SmartArt is laid out by PowerPoint from
 * its data, its layout and its colour style; the drawing PowerPoint keeps
 * beside them (`ppt/diagrams/drawingN.xml`, `dsp:` shapes) is what a slide
 * shows. Those shapes become the slide's own `p:sp` boxes where the SmartArt
 * stood, in its order, moved by its place, so every change a box takes
 * (`fill`, `outline`, `at`, `rotate`, words and their look) reaches them.
 * The words stay; it is no longer a SmartArt -- the answer says so. Pure.
 */

const DRAWINGML_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
// the most characters of a shape's words its new name keeps
const MAX_NAME_WORDS = 40;

export type SmartArtShapeType = { name: string; words: string };

/**
 * How its boxes may be laid out as they become shapes (2026-11-21, the
 * goal's last SmartArt refusal: _a process made a cycle_ is another
 * SmartArt LAYOUT, which only PowerPoint's layout engine draws): in a
 * circle, a row or a column, the shapes placed here -- plain shapes, never
 * a SmartArt of that layout.
 */
export type SmartArtArrangeType = 'cycle' | 'row' | 'column';
export type SmartArtLayoutType = {
    arrange: SmartArtArrangeType;
    // the place to lay them out in, when not the SmartArt's own
    area?: { x: number; y: number; cx: number; cy: number };
    // the slide's size, for a cycle to grow inside
    slideSize?: { cx: number; cy: number };
};
export const SMARTART_ARRANGE_LIST: readonly SmartArtArrangeType[] = [
    'cycle',
    'row',
    'column',
];
// the least a word is made when its box is made smaller (8 points)
const MIN_WORD_SIZE = 800;
// one degree, as DrawingML turns a shape
const DEGREE = 60000;

type DrawnShapeType = {
    props: string;
    style: string | null;
    body: string | null;
    words: string;
};
type BoxType = { x: number; y: number; cx: number; cy: number };
type PlacedShapeType = {
    shape: DrawnShapeType;
    props: string;
    body: string | null;
};

function readFrameOffset(frameXml: string) {
    const matched = /<p:xfrm\b[^>]*>\s*<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/.exec(
        frameXml,
    );
    return matched === null
        ? null
        : { x: Number(matched[1]), y: Number(matched[2]) };
}

function readFrameSize(frameXml: string) {
    const matched =
        /<p:xfrm\b[^>]*>[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/.exec(
            frameXml,
        );
    return matched === null
        ? null
        : { cx: Number(matched[1]), cy: Number(matched[2]) };
}

// a shape's own place and size in the drawing, before it is moved
function readShapeBox(propsXml: string): BoxType | null {
    const matched =
        /<a:xfrm\b[^>]*>\s*<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"\s*\/>\s*<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/.exec(
            propsXml,
        );
    return matched === null
        ? null
        : {
              x: Number(matched[1]),
              y: Number(matched[2]),
              cx: Number(matched[3]),
              cy: Number(matched[4]),
          };
}

// a shape put at a place of its own; a turn given replaces its turn and
// flips (an arrow made to point the way it is turned)
function toPlacedProps(propsXml: string, box: BoxType, rot?: number) {
    return propsXml.replace(
        /<a:xfrm\b([^>]*)>[\s\S]*?<\/a:xfrm>/,
        (_match, attributes: string) => {
            const head =
                rot === undefined
                    ? attributes
                    : rot === 0
                      ? ''
                      : ` rot="${rot}"`;
            return (
                `<a:xfrm${head}><a:off x="${Math.round(box.x)}" ` +
                `y="${Math.round(box.y)}"/><a:ext ` +
                `cx="${Math.max(1, Math.round(box.cx))}" ` +
                `cy="${Math.max(1, Math.round(box.cy))}"/></a:xfrm>`
            );
        },
    );
}

// a box's words made smaller with it, never under 8 points
function toScaledWords(bodyXml: string | null, scale: number) {
    if (bodyXml === null || scale >= 0.95) {
        return bodyXml;
    }
    return bodyXml.replace(
        /(<a:(?:rPr|endParaRPr|defRPr)\b[^>]*?\ssz=")(\d+)"/g,
        (_match, head: string, size: string) => {
            const scaled = Math.round((Number(size) * scale) / 100) * 100;
            return `${head}${Math.max(MIN_WORD_SIZE, scaled)}"`;
        },
    );
}

function toTurn(dx: number, dy: number) {
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.round((((degrees % 360) + 360) % 360) * DEGREE);
}

/**
 * Its boxes with words laid out in the frame's place -- round a circle
 * from the top, clockwise; in a row, left to right; in a column, top to
 * bottom -- made smaller to fit (their words with them), and its first
 * shape with no words, its arrow, put between each two, pointing on (one
 * copied when a circle needs one more, the rest left out).
 */
function layOutShapes(
    drawn: DrawnShapeType[],
    size: { cx: number; cy: number },
    offset: { x: number; y: number },
    arrange: SmartArtArrangeType,
): PlacedShapeType[] | { reason: string } {
    const nodes = drawn.filter((shape) => {
        return shape.words !== '';
    });
    const arrows = drawn.filter((shape) => {
        return shape.words === '';
    });
    if (nodes.length < 2) {
        return {
            reason: `it has fewer than two boxes with words to lay out in a ${arrange}.`,
        };
    }
    const nodeBoxes = nodes.map((node) => {
        return readShapeBox(node.props);
    });
    if (
        nodeBoxes.some((box) => {
            return box === null;
        })
    ) {
        return { reason: 'its boxes have no place of their own to lay out.' };
    }
    const boxes = nodeBoxes as BoxType[];
    const arrowBox = arrows.length === 0 ? null : readShapeBox(arrows[0].props);
    const count = nodes.length;
    const widest = Math.max(
        ...boxes.map((box) => {
            return box.cx;
        }),
    );
    const tallest = Math.max(
        ...boxes.map((box) => {
            return box.cy;
        }),
    );
    const { cx: width, cy: height } = size;
    const centres: Array<[number, number]> = [];
    const arrowPlaces: Array<{ x: number; y: number; rot: number }> = [];
    let scale: number;
    let room: number;
    if (arrange === 'cycle') {
        // a circle in the middle of its place, as wide as the place is
        // short -- PowerPoint keeps a SmartArt's place when its layout
        // changes -- its boxes small enough to leave an arrow's room
        const half = Math.min(width, height) / 2;
        const sine = Math.sin(Math.PI / count);
        const most = (2 * half * sine) / (1.3 + sine);
        scale = Math.min(1, most / Math.max(widest, tallest));
        const radius = half - (Math.max(widest, tallest) * scale) / 2;
        const toPoint = (angle: number): [number, number] => {
            return [
                width / 2 + radius * Math.cos(angle),
                height / 2 + radius * Math.sin(angle),
            ];
        };
        for (let index = 0; index < count; index++) {
            centres.push(toPoint(-Math.PI / 2 + (2 * Math.PI * index) / count));
            const angle = -Math.PI / 2 + (2 * Math.PI * (index + 0.5)) / count;
            const [x, y] = toPoint(angle);
            arrowPlaces.push({
                x,
                y,
                rot: toTurn(-Math.sin(angle), Math.cos(angle)),
            });
        }
        const [ax, ay] = centres[0];
        const [bx, by] = centres[1];
        room = Math.hypot(bx - ax, by - ay) - Math.max(widest, tallest) * scale;
    } else {
        const isRow = arrange === 'row';
        const along = isRow ? width : height;
        const slot = along / count;
        const most = slot * (arrowBox === null ? 0.9 : 0.7);
        scale = Math.min(
            1,
            most / (isRow ? widest : tallest),
            (isRow ? height : width) / (isRow ? tallest : widest),
        );
        for (let index = 0; index < count; index++) {
            const at = slot * (index + 0.5);
            centres.push(isRow ? [at, height / 2] : [width / 2, at]);
            if (index < count - 1) {
                const between = slot * (index + 1);
                arrowPlaces.push(
                    isRow
                        ? { x: between, y: height / 2, rot: 0 }
                        : { x: width / 2, y: between, rot: 90 * DEGREE },
                );
            }
        }
        room = slot - (isRow ? widest : tallest) * scale;
    }
    const arrowLength =
        arrowBox === null ? 0 : Math.min(arrowBox.cx, room * 0.7);
    const isArrowed = arrowBox !== null && arrowLength > 0;
    const placed: PlacedShapeType[] = [];
    nodes.forEach((node, index) => {
        const box = boxes[index];
        const [x, y] = centres[index];
        const cx = box.cx * scale;
        const cy = box.cy * scale;
        placed.push({
            shape: node,
            props: toPlacedProps(node.props, {
                x: offset.x + x - cx / 2,
                y: offset.y + y - cy / 2,
                cx,
                cy,
            }),
            body: toScaledWords(node.body, scale),
        });
        const place = arrowPlaces[index];
        if (!isArrowed || arrowBox === null || place === undefined) {
            return;
        }
        const arrow = arrows[index] ?? arrows[0];
        const arrowHeight = (arrowBox.cy * arrowLength) / arrowBox.cx;
        placed.push({
            shape: arrow,
            props: toPlacedProps(
                arrow.props,
                {
                    x: offset.x + place.x - arrowLength / 2,
                    y: offset.y + place.y - arrowHeight / 2,
                    cx: arrowLength,
                    cy: arrowHeight,
                },
                place.rot,
            ),
            body: arrow.body,
        });
    });
    return placed;
}

/**
 * The place a cycle is laid out in when none is asked for: its own, grown
 * up and down (or across) round its middle, inside the slide, until its
 * boxes are at least half their size -- a process is a flat strip, and a
 * circle as tall as the strip had words of 8 points (seen live
 * 2026-11-21, "make the steps a cycle").
 */
function toCycleRoom(
    drawn: DrawnShapeType[],
    own: BoxType,
    arrange: SmartArtArrangeType,
    slideSize?: { cx: number; cy: number },
): BoxType {
    const sizes = drawn
        .filter((shape) => {
            return shape.words !== '';
        })
        .map((shape) => {
            const box = readShapeBox(shape.props);
            return box === null ? 0 : Math.max(box.cx, box.cy);
        });
    if (arrange !== 'cycle' || slideSize === undefined || sizes.length < 2) {
        return own;
    }
    const sine = Math.sin(Math.PI / sizes.length);
    const needed = (0.5 * Math.max(...sizes) * (1.3 + sine)) / sine;
    if (Math.min(own.cx, own.cy) >= needed) {
        return own;
    }
    const side = Math.min(needed, slideSize.cx, slideSize.cy);
    const cx = Math.max(own.cx, side);
    const cy = Math.max(own.cy, side);
    const clamp = (start: number, length: number, room: number) => {
        return Math.min(Math.max(0, start), Math.max(0, room - length));
    };
    return {
        x: clamp(own.x + own.cx / 2 - cx / 2, cx, slideSize.cx),
        y: clamp(own.y + own.cy / 2 - cy / 2, cy, slideSize.cy),
        cx,
        cy,
    };
}

function readInner(xml: string, tagName: string) {
    const matched = new RegExp(
        `<${tagName}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${tagName}>)`,
    ).exec(xml);
    return matched === null ? null : (matched[1] ?? '');
}

// a shape's own place, moved by where the SmartArt stood on the slide
function toMovedProps(propsXml: string, offset: { x: number; y: number }) {
    return propsXml.replace(
        /(<a:xfrm\b[^>]*>\s*<a:off\s+)x="(-?\d+)"\s+y="(-?\d+)"/,
        (_match, head: string, x: string, y: string) => {
            return (
                `${head}x="${Number(x) + offset.x}" ` +
                `y="${Number(y) + offset.y}"`
            );
        },
    );
}

// DrawingML only: a tag or an attribute of any other namespace (a picture's
// `r:embed`, an extension's `a14:`) means nothing on the slide it would land
// on, or names a part the slide has no link to
function checkIsPlainDrawing(xml: string) {
    return (
        !/<\/?(?!a:)[A-Za-z][\w.-]*:/.test(xml) &&
        !/\s(?!xml:)[A-Za-z][\w.-]*:[\w.-]+\s*=/.test(xml)
    );
}

// an extension list: what a newer PowerPoint adds, never needed to draw
function stripExtensions(xml: string) {
    return xml.replace(/<a:extLst>[\s\S]*?<\/a:extLst>/g, '');
}

function readWords(shapeXml: string) {
    return [...shapeXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
        .map((matched) => {
            return unescapeXml(matched[1]);
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toFreeName(name: string, taken: Set<string>) {
    let free = name;
    for (let index = 2; taken.has(free.toLowerCase()); index++) {
        free = `${name} (${index})`;
    }
    taken.add(free.toLowerCase());
    return free;
}

/**
 * The slide with the SmartArt frame at `frame` (its `p:graphicFrame`) put
 * back as the drawing's shapes, each named by its words -- one with none
 * by the SmartArt's name and its number -- under ids after the slide's
 * highest; with `layout.arrange`, laid out that way in `layout.area`, else
 * in its place (`laidIn` says where). Or why not, in words after the
 * SmartArt's name.
 */
export function convertSmartArtToShapesXml(
    slideXml: string,
    frame: { start: number; end: number; name: string },
    drawingXml: string,
    takenNames: readonly string[],
    layout?: SmartArtLayoutType,
):
    | { xml: string; shapes: SmartArtShapeType[]; laidIn?: BoxType }
    | { reason: string } {
    const arrange = layout?.arrange;
    const frameXml = slideXml.slice(frame.start, frame.end);
    const offset = readFrameOffset(frameXml);
    if (offset === null) {
        return { reason: 'it has no place of its own on the slide.' };
    }
    const namespace = /\sxmlns:a="([^"]*)"/.exec(drawingXml)?.[1];
    const tree = readInner(drawingXml, 'dsp:spTree');
    if (namespace !== DRAWINGML_NS || tree === null) {
        return {
            reason:
                'its drawing could not be read: PowerPoint turns it into ' +
                'shapes (SmartArt → Convert → Convert to Shapes).',
        };
    }
    if (/<dsp:grpSp\b/.test(tree)) {
        return {
            reason:
                'its shapes are drawn in groups: PowerPoint turns it into ' +
                'shapes (SmartArt → Convert → Convert to Shapes).',
        };
    }
    const shapeXmlList = tree.match(/<dsp:sp\b[\s\S]*?<\/dsp:sp>/g) ?? [];
    if (shapeXmlList.length === 0) {
        return { reason: 'it draws no shapes.' };
    }
    let nextId =
        Math.max(
            0,
            ...[...slideXml.matchAll(/<p:cNvPr\b[^>]*?\sid="(\d+)"/g)].map(
                (matched) => {
                    return Number(matched[1]);
                },
            ),
        ) + 1;
    const taken = new Set(
        takenNames
            .filter((name) => {
                return name !== frame.name;
            })
            .map((name) => {
                return name.toLowerCase();
            }),
    );
    const drawn: DrawnShapeType[] = [];
    for (const shapeXml of shapeXmlList) {
        const [props, style, body] = (
            ['dsp:spPr', 'dsp:style', 'dsp:txBody'] as const
        ).map((tagName) => {
            const inner = readInner(shapeXml, tagName);
            return inner === null ? null : stripExtensions(inner);
        });
        if (
            props === null ||
            !checkIsPlainDrawing([props, style ?? '', body ?? ''].join(''))
        ) {
            return {
                reason:
                    'it holds a picture or a part this cannot carry onto ' +
                    'the slide: PowerPoint turns it into shapes (SmartArt ' +
                    '→ Convert → Convert to Shapes).',
            };
        }
        drawn.push({ props, style, body, words: readWords(shapeXml) });
    }
    let placed: PlacedShapeType[];
    let laidIn: BoxType | undefined;
    if (arrange === undefined) {
        placed = drawn.map((shape) => {
            return {
                shape,
                props: toMovedProps(shape.props, offset),
                body: shape.body,
            };
        });
    } else {
        const size = readFrameSize(frameXml);
        if (layout?.area === undefined && size === null) {
            return { reason: 'it has no size of its own on the slide.' };
        }
        laidIn =
            layout?.area ??
            toCycleRoom(
                drawn,
                { ...offset, ...(size as { cx: number; cy: number }) },
                arrange,
                layout?.slideSize,
            );
        const laid = layOutShapes(drawn, laidIn, laidIn, arrange);
        if ('reason' in laid) {
            return laid;
        }
        placed = laid;
    }
    const shapes: SmartArtShapeType[] = [];
    const boxXmlList: string[] = [];
    let wordlessCount = 0;
    for (const { shape, props, body } of placed) {
        const { style, words } = shape;
        wordlessCount += words === '' ? 1 : 0;
        const name = toFreeName(
            words === ''
                ? `${frame.name} shape ${wordlessCount}`
                : words.slice(0, MAX_NAME_WORDS).trim(),
            taken,
        );
        boxXmlList.push(
            '<p:sp><p:nvSpPr>' +
                `<p:cNvPr id="${nextId}" name="${escapeXmlAttribute(name)}"/>` +
                '<p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
                `<p:spPr>${props}</p:spPr>` +
                (style === null ? '' : `<p:style>${style}</p:style>`) +
                (body === null ? '' : `<p:txBody>${body}</p:txBody>`) +
                '</p:sp>',
        );
        shapes.push({ name, words });
        nextId++;
    }
    return {
        xml:
            slideXml.slice(0, frame.start) +
            boxXmlList.join('') +
            slideXml.slice(frame.end),
        shapes,
        ...(laidIn === undefined ? {} : { laidIn }),
    };
}

/** The shapes said back: words first, then how many more. */
export function describeSmartArtShapes(shapes: SmartArtShapeType[]) {
    const worded = shapes.filter((shape) => {
        return shape.words !== '';
    });
    const others = shapes.length - worded.length;
    return (
        worded
            .map((shape) => {
                return `"${shape.name}"`;
            })
            .join(', ') +
        (others === 0
            ? ''
            : `${worded.length === 0 ? '' : ', and '}${others} without ` +
              `words (${shapes
                  .filter((shape) => {
                      return shape.words === '';
                  })
                  .map((shape) => {
                      return `"${shape.name}"`;
                  })
                  .join(', ')})`)
    );
}
