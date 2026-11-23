// The BOXES of a PowerPoint slide -- its pictures, text boxes, tables,
// groups -- listed by name and taken out (2026-11-20, `owa_office_edit`).
//
// Measured on the user's own hymn deck the same day: each of its seven
// slides is a red curtain PICTURE (`Picture 2`, "curtan15.jpg") the size of
// the slide with the words over it, so a slide's background coloured navy
// changed nothing anyone could see, and an answer saying "the background
// is now navy" would have been false. So the read names a slide's pictures
// and says which one fills it, an edit that colours a background says when
// a picture covers it (on the slide, or on its layout or master), and a box
// can be taken out by its name -- the curtain off, the colour behind it.
//
// Pure, strings in and out, the same tag scanner as the words.

import {
    type ElementType,
    listChildElements,
    scanTags,
    unescapeXml,
} from './officeXmlEditHelpers';

export type SlideBoxKindType =
    | 'picture'
    | 'video'
    | 'text'
    | 'shape'
    | 'table'
    | 'chart'
    | 'smartart'
    | 'group'
    | 'line';

export type SlideBoxType = {
    name: string;
    kind: SlideBoxKindType;
    start: number;
    end: number;
    // inside a group
    isGrouped: boolean;
    // it covers (nearly) the whole slide
    isFilling: boolean;
};

export type SlideSizeType = { cx: number; cy: number };

// PowerPoint's 16:9 default, for a deck that does not say its size.
export const DEFAULT_SLIDE_SIZE: SlideSizeType = { cx: 12192000, cy: 6858000 };

const BOX_NAME_SET = new Set([
    'p:sp',
    'p:pic',
    'p:graphicFrame',
    'p:grpSp',
    'p:cxnSp',
]);

/** `<p:sldSz cx=… cy=…>` of `ppt/presentation.xml`, or the default. */
export function readSlideSize(presentationXml: string): SlideSizeType {
    const tag = /<p:sldSz\b[^>]*>/.exec(presentationXml)?.[0] ?? '';
    const cx = Number(/\scx="(\d+)"/.exec(tag)?.[1] ?? 0);
    const cy = Number(/\scy="(\d+)"/.exec(tag)?.[1] ?? 0);
    return cx > 0 && cy > 0 ? { cx, cy } : DEFAULT_SLIDE_SIZE;
}

function toKind(name: string, xml: string): SlideBoxKindType {
    if (name === 'p:pic') {
        return /<a:(?:videoFile|audioFile)\b|<p14:media\b/.test(xml)
            ? 'video'
            : 'picture';
    }
    if (name === 'p:grpSp') {
        return 'group';
    }
    if (name === 'p:cxnSp') {
        return 'line';
    }
    if (name === 'p:graphicFrame') {
        if (/<a:tbl\b/.test(xml)) {
            return 'table';
        }
        return /<dgm:relIds\b/.test(xml) ? 'smartart' : 'chart';
    }
    return /<a:t\b/.test(xml) ? 'text' : 'shape';
}

function readName(xml: string, element: ElementType) {
    for (const tag of scanTags(xml, element.start, element.end)) {
        if (tag.name === 'p:cNvPr' && !tag.isClose) {
            const matched = /\sname\s*=\s*("([^"]*)"|'([^']*)')/.exec(
                tag.attributes,
            );
            return unescapeXml(matched?.[2] ?? matched?.[3] ?? '');
        }
    }
    return '';
}

/** Whether a box's own place (its first `a:off` / `a:ext`) covers the slide. */
function checkIsFilling(boxXml: string, size: SlideSizeType) {
    const off = /<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/.exec(boxXml);
    const ext = /<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/.exec(boxXml);
    if (off === null || ext === null) {
        return false;
    }
    const [x, y, cx, cy] = [off[1], off[2], ext[1], ext[2]].map(Number);
    return (
        x <= size.cx * 0.05 &&
        y <= size.cy * 0.05 &&
        x + cx >= size.cx * 0.95 &&
        y + cy >= size.cy * 0.95
    );
}

/**
 * Every box of a slide (or a layout, or a master) in its order, a group's
 * own boxes after it. A box only in the copy Office keeps for old readers
 * (`mc:AlternateContent`) is not listed.
 */
export function listSlideBoxes(
    slideXml: string,
    size: SlideSizeType = DEFAULT_SLIDE_SIZE,
): SlideBoxType[] {
    const open = /<p:spTree\b[^>]*>/.exec(slideXml);
    if (open === null) {
        return [];
    }
    const treeStart = open.index + open[0].length;
    const treeEnd = slideXml.indexOf('</p:spTree>', treeStart);
    if (treeEnd < 0) {
        return [];
    }
    const out: SlideBoxType[] = [];
    const visit = (from: number, to: number, isGrouped: boolean) => {
        for (const child of listChildElements(slideXml, from, to)) {
            if (!BOX_NAME_SET.has(child.name)) {
                continue;
            }
            const boxXml = slideXml.slice(child.start, child.end);
            out.push({
                name: readName(slideXml, child),
                kind: toKind(child.name, boxXml),
                start: child.start,
                end: child.end,
                isGrouped,
                isFilling: !isGrouped && checkIsFilling(boxXml, size),
            });
            if (child.name === 'p:grpSp' && child.closeStart !== child.end) {
                visit(child.openEnd, child.closeStart, true);
            }
        }
    };
    visit(treeStart, treeEnd, false);
    return out;
}

/** A slide's pictures as the model reads them: names, the one filling it. */
export function listSlidePictures(slideXml: string, size: SlideSizeType) {
    return listSlideBoxes(slideXml, size)
        .filter((box) => {
            return box.kind === 'picture';
        })
        .map((box) => {
            return box.isFilling
                ? { name: box.name, fills: true }
                : { name: box.name };
        });
}

/**
 * A slide with the box called `name` taken out -- every box of that name,
 * and `count` says how many -- or why not.
 */
export function removeSlideBoxXml(
    slideXml: string,
    name: string,
): { xml: string; count: number; kind: SlideBoxKindType } | { reason: string } {
    const boxes = listSlideBoxes(slideXml);
    const wanted = name.trim();
    let found = boxes.filter((box) => {
        return box.name === wanted;
    });
    if (found.length === 0) {
        found = boxes.filter((box) => {
            return box.name.toLowerCase() === wanted.toLowerCase();
        });
    }
    if (found.length === 0) {
        const names = boxes
            .map((box) => {
                return `"${box.name}" (${box.kind})`;
            })
            .join(', ');
        return {
            reason:
                `There is no box "${wanted}" there. ` +
                (names === '' ? 'It has no boxes.' : `Its boxes: ${names}.`),
        };
    }
    // a box inside a group taken out with it is not taken out twice
    const outer = found.filter((box) => {
        return !found.some((other) => {
            return (
                other !== box &&
                other.start <= box.start &&
                box.end <= other.end
            );
        });
    });
    let xml = slideXml;
    for (const box of [...outer].sort((a, b) => {
        return b.start - a.start;
    })) {
        xml = xml.slice(0, box.start) + xml.slice(box.end);
    }
    return { xml, count: outer.length, kind: outer[0].kind };
}

/**
 * The name of a picture that fills the slide in front of its background --
 * on the slide itself, or on the layout or master it shows -- or null.
 * `layoutXml` / `masterXml` are left out when not read.
 */
export function findCoveringPicture(
    slideXml: string,
    size: SlideSizeType,
    layoutXml: string | null = null,
    masterXml: string | null = null,
) {
    const hidesMaster = (xml: string) => {
        return /^<p:(?:sld|sldLayout)\b[^>]*\sshowMasterSp="(?:0|false)"/.test(
            xml.replace(/^<\?xml[^>]*>\s*/, ''),
        );
    };
    const parts: { xml: string; where: string }[] = [
        { xml: slideXml, where: '' },
    ];
    if (layoutXml !== null && !hidesMaster(slideXml)) {
        parts.push({ xml: layoutXml, where: ' on its layout' });
        if (masterXml !== null && !hidesMaster(layoutXml)) {
            parts.push({ xml: masterXml, where: ' on its master' });
        }
    }
    for (const part of parts) {
        const picture = listSlideBoxes(part.xml, size).find((box) => {
            return box.kind === 'picture' && box.isFilling;
        });
        if (picture !== undefined) {
            return { name: picture.name, where: part.where };
        }
    }
    return null;
}

// --- where a box is, and moving it (2026-11-20, the goal _chatbot can
// change do everything on a given pptx_: _move the title on slide 2 to the
// bottom_ had been done by deleting the title and writing its words into
// the verse's box, and _make the box wider_ was "done in PowerPoint") ------

// A box's place in EMU: its left, top, width and height.
export type BoxPlaceType = { x: number; y: number; cx: number; cy: number };

/** A placeholder box's type ("body" for one named by its index alone). */
export function readBoxPlaceholder(boxXml: string) {
    const nonVisual = /<p:nv\w+Pr\b[\s\S]*?<\/p:nv\w+Pr>/.exec(boxXml)?.[0];
    const tag =
        nonVisual === undefined
            ? undefined
            : /<p:ph\b[^>]*>/.exec(nonVisual)?.[0];
    if (tag === undefined) {
        return null;
    }
    return {
        type: /\stype="([^"]*)"/.exec(tag)?.[1] ?? 'body',
        idx: /\sidx="([^"]*)"/.exec(tag)?.[1] ?? null,
    };
}

function readNumberAttribute(tag: string, name: string) {
    const value = new RegExp(`\\s${name}="(-?\\d+)"`).exec(tag)?.[1];
    return value === undefined ? null : Number(value);
}

// The box's own `a:xfrm` (`p:xfrm` on a table or chart): the first one in
// it -- its properties come before anything it holds.
function findOwnXfrm(boxXml: string) {
    const open = /<(a|p):xfrm\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/.exec(boxXml);
    if (open === null) {
        return null;
    }
    const start = open.index;
    if (open[2] === '/') {
        return {
            start,
            end: start + open[0].length,
            inner: '',
            prefix: open[1],
        };
    }
    const close = `</${open[1]}:xfrm>`;
    const closeStart = boxXml.indexOf(close, start);
    if (closeStart < 0) {
        return null;
    }
    return {
        start,
        end: closeStart + close.length,
        inner: boxXml.slice(start + open[0].length, closeStart),
        openTag: open[0],
        prefix: open[1],
    };
}

/** A box's own place, or null when it takes it from its layout. */
export function readBoxPlace(boxXml: string): BoxPlaceType | null {
    const xfrm = findOwnXfrm(boxXml);
    if (xfrm === null) {
        return null;
    }
    const off = /<a:off\b[^>]*>/.exec(xfrm.inner)?.[0] ?? '';
    const ext = /<a:ext\b[^>]*>/.exec(xfrm.inner)?.[0] ?? '';
    const x = readNumberAttribute(off, 'x');
    const y = readNumberAttribute(off, 'y');
    const cx = readNumberAttribute(ext, 'cx');
    const cy = readNumberAttribute(ext, 'cy');
    if (x === null || y === null || cx === null || cy === null) {
        return null;
    }
    return { x, y, cx, cy };
}

const MASTER_TYPE_MAP: Record<string, string> = {
    ctrTitle: 'title',
    subTitle: 'body',
    obj: 'body',
};

/** The box of a layout or master a placeholder takes its place from. */
function findPlaceholderSource(
    partXml: string,
    placeholder: { type: string; idx: string | null },
    isMaster: boolean,
) {
    const boxes = listSlideBoxes(partXml).filter((box) => {
        return !box.isGrouped && box.kind !== 'group';
    });
    const read = boxes.map((box) => {
        const xml = partXml.slice(box.start, box.end);
        return { box, xml, placeholder: readBoxPlaceholder(xml) };
    });
    const wantedType = isMaster
        ? (MASTER_TYPE_MAP[placeholder.type] ?? placeholder.type)
        : placeholder.type;
    // a layout's placeholder is the one of the same index -- none, and
    // the slide's goes to the master, as PowerPoint draws it; a master's
    // is the one of the same type
    if (!isMaster && placeholder.idx !== null) {
        return (
            read.find((one) => {
                return one.placeholder?.idx === placeholder.idx;
            }) ?? null
        );
    }
    return (
        read.find((one) => {
            const type = one.placeholder?.type;
            return (
                type !== undefined &&
                (isMaster ? (MASTER_TYPE_MAP[type] ?? type) : type) ===
                    wantedType
            );
        }) ?? null
    );
}

/**
 * Where a box is drawn: its own place, else -- a placeholder -- its
 * layout's, else its master's. Null when none says.
 */
export function findBoxPlace(
    boxXml: string,
    layoutXml: string | null,
    masterXml: string | null,
): BoxPlaceType | null {
    const own = readBoxPlace(boxXml);
    if (own !== null) {
        return own;
    }
    const placeholder = readBoxPlaceholder(boxXml);
    if (placeholder === null) {
        return null;
    }
    for (const [partXml, isMaster] of [
        [layoutXml, false],
        [masterXml, true],
    ] as const) {
        if (partXml === null) {
            continue;
        }
        const source = findPlaceholderSource(partXml, placeholder, isMaster);
        const place = source === null ? null : readBoxPlace(source.xml);
        if (place !== null) {
            return place;
        }
    }
    return null;
}

function toTenth(value: number) {
    return Math.round(value * 10) / 10;
}

/** A place as the model reads it: `[x, y, width, height]` in % of the slide. */
export function toPercentPlace(place: BoxPlaceType, size: SlideSizeType) {
    return [
        toTenth((place.x / size.cx) * 100),
        toTenth((place.y / size.cy) * 100),
        toTenth((place.cx / size.cx) * 100),
        toTenth((place.cy / size.cy) * 100),
    ];
}

/**
 * `[x, y, width, height]` in % of the slide -- a null keeps that one as
 * `current` has it -- in EMU, or why it cannot be. A line may have no
 * width (upright) or no height (level), never neither.
 */
export function toBoxPlace(
    at: unknown,
    size: SlideSizeType,
    current: BoxPlaceType | null,
    isLine = false,
): BoxPlaceType | { reason: string } {
    const reason =
        '`at` is [x, y, width, height] in % of the slide (0-100, as a ' +
        "box's `at` reads); null keeps one as it is.";
    if (!Array.isArray(at) || at.length !== 4) {
        return { reason };
    }
    const keys = ['x', 'y', 'cx', 'cy'] as const;
    const out: Partial<BoxPlaceType> = {};
    for (let index = 0; index < 4; index++) {
        const value = at[index];
        const key = keys[index];
        if (value === null || value === undefined) {
            if (current === null) {
                return {
                    reason:
                        'The box has no place of its own to keep: give all ' +
                        'four of `at`.',
                };
            }
            out[key] = current[key];
            continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { reason };
        }
        const isWidth = index >= 2;
        const isTooSmall = isLine ? value < 0 : value <= 0;
        if (isWidth ? isTooSmall || value > 500 : value < -200 || value > 300) {
            return { reason };
        }
        out[key] = Math.round(
            (value / 100) * (index % 2 === 0 ? size.cx : size.cy),
        );
    }
    if (out.cx === 0 && out.cy === 0) {
        return { reason: 'A line needs a width or a height.' };
    }
    return out as BoxPlaceType;
}

const PLACE_HOLDER_MAP: Record<string, string> = {
    'p:sp': 'p:spPr',
    'p:cxnSp': 'p:spPr',
    'p:pic': 'p:spPr',
    'p:grpSp': 'p:grpSpPr',
};

/** A box given a new place: its own `xfrm` written, or made. */
export function setBoxPlaceXml(boxXml: string, place: BoxPlaceType) {
    const off = `<a:off x="${place.x}" y="${place.y}"/>`;
    const ext = `<a:ext cx="${place.cx}" cy="${place.cy}"/>`;
    const xfrm = findOwnXfrm(boxXml);
    if (xfrm !== null && xfrm.openTag !== undefined) {
        let inner = xfrm.inner;
        inner = /<a:off\b[^>]*>/.test(inner)
            ? inner.replace(/<a:off\b[^>]*>/, off)
            : off + inner;
        inner = /<a:ext\b[^>]*>/.test(inner)
            ? inner.replace(/<a:ext\b[^>]*>/, ext)
            : inner.replace(off, off + ext);
        return (
            boxXml.slice(0, xfrm.start) +
            xfrm.openTag +
            inner +
            `</${xfrm.prefix}:xfrm>` +
            boxXml.slice(xfrm.end)
        );
    }
    if (xfrm !== null) {
        // `<a:xfrm/>`: opened to hold the place
        return (
            boxXml.slice(0, xfrm.start) +
            `<${xfrm.prefix}:xfrm>${off}${ext}</${xfrm.prefix}:xfrm>` +
            boxXml.slice(xfrm.end)
        );
    }
    const boxName = /^<([\w:]+)/.exec(boxXml)?.[1] ?? '';
    const propsName = PLACE_HOLDER_MAP[boxName];
    if (propsName === undefined) {
        return null;
    }
    const made = `<a:xfrm>${off}${ext}</a:xfrm>`;
    const selfClosing = new RegExp(`<${propsName}(\\s[^>]*)?/>`);
    if (selfClosing.test(boxXml)) {
        return boxXml.replace(selfClosing, (_whole, attributes = '') => {
            return `<${propsName}${attributes}>${made}</${propsName}>`;
        });
    }
    const open = new RegExp(`<${propsName}\\b[^>]*>`).exec(boxXml);
    if (open === null) {
        return null;
    }
    // the place is the properties' first child
    const at = open.index + open[0].length;
    return boxXml.slice(0, at) + made + boxXml.slice(at);
}

/**
 * The boxes of a slide `name` means: by name as read (any case), else a
 * placeholder's type as a line's `box` reads ("title", "body"). Top-level
 * boxes only: one inside a group moves with the group.
 */
export function findNamedBoxes(slideXml: string, name: string) {
    const wanted = name.trim();
    const boxes = listSlideBoxes(slideXml).filter((box) => {
        return !box.isGrouped;
    });
    const byName = boxes.filter((box) => {
        return box.name === wanted;
    });
    if (byName.length > 0) {
        return byName;
    }
    const byCase = boxes.filter((box) => {
        return box.name.toLowerCase() === wanted.toLowerCase();
    });
    if (byCase.length > 0) {
        return byCase;
    }
    return boxes.filter((box) => {
        return (
            box.kind !== 'group' &&
            readBoxPlaceholder(slideXml.slice(box.start, box.end))?.type ===
                wanted
        );
    });
}

/**
 * A new text box on a slide, in front of every other box: its lines, its
 * words written in `runPropsXml` (the look of the slide's first words, so
 * it looks like the deck), at `place`. Its name says what it is called.
 */
/**
 * A new box's id -- one past the slide's highest -- and its name as
 * PowerPoint names one (`TextBox 3`, `Picture 5`), made unique.
 */
export function findFreeBoxName(slideXml: string, prefix: string) {
    const ids = [...slideXml.matchAll(/<p:cNvPr\b[^>]*\sid="(\d+)"/g)].map(
        (match) => {
            return Number(match[1]);
        },
    );
    const id = Math.max(1, ...ids) + 1;
    const names = new Set(
        listSlideBoxes(slideXml).map((box) => {
            return box.name;
        }),
    );
    let name = `${prefix} ${id - 1}`;
    for (let index = 2; names.has(name); index++) {
        name = `${prefix} ${id - 1} (${index})`;
    }
    return { id, name };
}

export function addSlideTextBoxXml(
    slideXml: string,
    lines: string[],
    place: BoxPlaceType,
    runPropsXml: string,
) {
    const treeEnd = slideXml.lastIndexOf('</p:spTree>');
    if (treeEnd < 0) {
        return null;
    }
    const { id, name } = findFreeBoxName(slideXml, 'TextBox');
    const props = runPropsXml === '' ? '<a:rPr/>' : runPropsXml;
    const endProps = props
        .replace(/^<a:rPr\b/, '<a:endParaRPr')
        .replace(/<\/a:rPr>$/, '</a:endParaRPr>');
    const paragraphs = lines
        .map((line) => {
            return line === ''
                ? `<a:p>${endProps}</a:p>`
                : `<a:p><a:r>${props}<a:t>${line}</a:t></a:r></a:p>`;
        })
        .join('');
    const boxXml =
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>` +
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>' +
        `<a:off x="${place.x}" y="${place.y}"/>` +
        `<a:ext cx="${place.cx}" cy="${place.cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>' +
        '</p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0">' +
        `<a:spAutoFit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
    return {
        xml: slideXml.slice(0, treeEnd) + boxXml + slideXml.slice(treeEnd),
        name,
    };
}

// --- a new shape: an arrow, a circle, a star (2026-11-21) -------------------

// The shapes people ask for by name, as PowerPoint's presets and the names
// PowerPoint gives a new one.
const SHAPE_LIST = [
    {
        words: ['rectangle', 'rect', 'square', 'box'],
        prst: 'rect',
        name: 'Rectangle',
    },
    {
        words: ['rounded rectangle', 'rounded', 'round rect', 'rounded box'],
        prst: 'roundRect',
        name: 'Rounded Rectangle',
    },
    { words: ['oval', 'circle', 'ellipse'], prst: 'ellipse', name: 'Oval' },
    { words: ['triangle'], prst: 'triangle', name: 'Isosceles Triangle' },
    { words: ['diamond'], prst: 'diamond', name: 'Diamond' },
    { words: ['star', 'star5'], prst: 'star5', name: '5-Point Star' },
    { words: ['heart'], prst: 'heart', name: 'Heart' },
    {
        words: ['right arrow', 'arrow'],
        prst: 'rightArrow',
        name: 'Right Arrow',
    },
    { words: ['left arrow'], prst: 'leftArrow', name: 'Left Arrow' },
    { words: ['up arrow'], prst: 'upArrow', name: 'Up Arrow' },
    { words: ['down arrow'], prst: 'downArrow', name: 'Down Arrow' },
    { words: ['cross', 'plus'], prst: 'plus', name: 'Cross' },
    {
        words: ['speech bubble', 'callout', 'bubble'],
        prst: 'wedgeRoundRectCallout',
        name: 'Rounded Rectangular Callout',
    },
    { words: ['cloud'], prst: 'cloud', name: 'Cloud' },
    { words: ['chevron'], prst: 'chevron', name: 'Chevron' },
    { words: ['pentagon'], prst: 'pentagon', name: 'Regular Pentagon' },
    { words: ['hexagon'], prst: 'hexagon', name: 'Hexagon' },
    { words: ['sun'], prst: 'sun', name: 'Sun' },
    {
        words: ['line', 'straight line'],
        prst: 'line',
        name: 'Straight Connector',
    },
] as const;

export type OfficeShapeType = (typeof SHAPE_LIST)[number];

/**
 * A box given another shape -- a box of words made a circle, a SmartArt's
 * box once it is shapes made a star, a picture cut round (PowerPoint's
 * Shape Format → Edit Shape → Change Shape, a picture's Crop to Shape;
 * 2026-11-21) -- its geometry in `spPr` swapped for the preset's, its place,
 * fill and words kept. Null when the box has no `spPr` to hold one.
 */
export function setBoxShapeXml(boxXml: string, prst: string) {
    const props = /<p:spPr\b[^>]*?(?:\/>|>([\s\S]*?)<\/p:spPr>)/.exec(boxXml);
    if (props === null) {
        return null;
    }
    const geometry = `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`;
    const inner = props[1] ?? '';
    const swapped = /<a:(?:prstGeom|custGeom)\b/.test(inner)
        ? inner.replace(
              /<a:(prstGeom|custGeom)\b[^>]*?(?:\/>|>[\s\S]*?<\/a:\1>)/,
              geometry,
          )
        : // after its place, as a shape's properties are ordered
          inner.replace(
              /^(\s*<a:xfrm\b[^>]*?(?:\/>|>[\s\S]*?<\/a:xfrm>))?/,
              (place) => {
                  return `${place}${geometry}`;
              },
          );
    const open = /^<p:spPr\b[^>]*?(?=\/?>)/.exec(props[0])?.[0] ?? '<p:spPr';
    return (
        boxXml.slice(0, props.index) +
        `${open}>${swapped}</p:spPr>` +
        boxXml.slice(props.index + props[0].length)
    );
}

/** The shapes a change can name, in words. */
export const OFFICE_SHAPE_WORD_LIST = SHAPE_LIST.map((shape) => {
    return shape.words[0];
});

/** "Right Arrow", "rightArrow", "a circle shape" -> its shape; or null. */
export function toOfficeShape(value: unknown): OfficeShapeType | null {
    if (typeof value !== 'string') {
        return null;
    }
    const words = value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[-_]+/g, ' ')
        .replace(/\b(?:an?|the|shape)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (
        SHAPE_LIST.find((shape) => {
            return (
                (shape.words as readonly string[]).includes(words) ||
                shape.prst.toLowerCase() === words.replace(/ /g, '')
            );
        }) ?? null
    );
}

// The theme's look PowerPoint gives a new shape: filled and outlined in
// the first accent colour, its words in the light text colour.
const SHAPE_STYLE_XML =
    '<p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade ' +
    'val="50000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr ' +
    'val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr ' +
    'val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr ' +
    'val="lt1"/></a:fontRef></p:style>';
const LINE_STYLE_XML =
    '<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>' +
    '<a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef>' +
    '<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>' +
    '<a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></p:style>';

/**
 * The slide with a new shape at `place`, in front of every box, its words
 * (escaped already; none: an empty shape) centred in it. A line takes no
 * words. Null when the slide has no shape tree.
 */
export function addSlideShapeXml(
    slideXml: string,
    shape: OfficeShapeType,
    place: BoxPlaceType,
    lines: string[],
    lang: string | null = null,
) {
    const treeEnd = slideXml.lastIndexOf('</p:spTree>');
    if (treeEnd < 0) {
        return null;
    }
    const { id, name } = findFreeBoxName(slideXml, shape.name);
    const xfrm =
        `<a:xfrm><a:off x="${place.x}" y="${place.y}"/>` +
        `<a:ext cx="${place.cx}" cy="${place.cy}"/></a:xfrm>` +
        `<a:prstGeom prst="${shape.prst}"><a:avLst/></a:prstGeom>`;
    let boxXml: string;
    if (shape.prst === 'line') {
        boxXml =
            `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/>` +
            '<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>' +
            `${xfrm}<a:ln w="28575"/></p:spPr>${LINE_STYLE_XML}</p:cxnSp>`;
    } else {
        const props = lang === null ? '<a:rPr/>' : `<a:rPr lang="${lang}"/>`;
        const endProps = props.replace('<a:rPr', '<a:endParaRPr');
        const paragraphs = (lines.length === 0 ? [''] : lines)
            .map((line) => {
                return line === ''
                    ? `<a:p><a:pPr algn="ctr"/>${endProps}</a:p>`
                    : `<a:p><a:pPr algn="ctr"/><a:r>${props}<a:t>${line}` +
                          '</a:t></a:r></a:p>';
            })
            .join('');
        boxXml =
            `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>` +
            `<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm}</p:spPr>` +
            `${SHAPE_STYLE_XML}<p:txBody><a:bodyPr rtlCol="0" ` +
            `anchor="ctr"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
    }
    return {
        xml: slideXml.slice(0, treeEnd) + boxXml + slideXml.slice(treeEnd),
        name,
    };
}

// --- the size words are drawn at when a run says none ------------------------

const STYLE_BY_TYPE_MAP: Record<string, string> = {
    title: 'p:titleStyle',
    ctrTitle: 'p:titleStyle',
};

function readLevelSize(listXml: string, level: number) {
    const pattern = new RegExp(
        `<a:lvl${level}pPr\\b[^>]*>(?:(?!</a:lvl${level}pPr>)[\\s\\S])*?` +
            '<a:defRPr\\b[^>]*\\ssz="(\\d+)"',
    );
    const value = pattern.exec(listXml)?.[1];
    return value === undefined ? null : Number(value) / 100;
}

function readListStyle(boxXml: string) {
    return /<a:lstStyle>[\s\S]*?<\/a:lstStyle>/.exec(boxXml)?.[0] ?? '';
}

/**
 * The size, in points, a line's runs with no size of their own are drawn
 * at: the box's own list style, its layout's and master's placeholder, the
 * master's text styles -- PowerPoint's order -- or null.
 */
export function readInheritedSize(
    slideXml: string,
    paragraphStart: number,
    layoutXml: string | null,
    masterXml: string | null,
) {
    const box = listSlideBoxes(slideXml)
        .filter((one) => {
            return (
                one.kind !== 'group' &&
                one.start <= paragraphStart &&
                paragraphStart < one.end
            );
        })
        .sort((a, b) => {
            return a.end - a.start - (b.end - b.start);
        })[0];
    if (box === undefined) {
        return null;
    }
    const boxXml = slideXml.slice(box.start, box.end);
    const paragraphTag = /^<a:p\b[^>]*>\s*(<a:pPr\b[^>]*>)?/.exec(
        slideXml.slice(paragraphStart),
    );
    const level =
        Number(/\slvl="(\d)"/.exec(paragraphTag?.[1] ?? '')?.[1] ?? 0) + 1;
    const own = readLevelSize(readListStyle(boxXml), level);
    if (own !== null) {
        return own;
    }
    const placeholder = readBoxPlaceholder(boxXml);
    if (placeholder !== null) {
        for (const [partXml, isMaster] of [
            [layoutXml, false],
            [masterXml, true],
        ] as const) {
            if (partXml === null) {
                continue;
            }
            const source = findPlaceholderSource(
                partXml,
                placeholder,
                isMaster,
            );
            const size =
                source === null
                    ? null
                    : readLevelSize(readListStyle(source.xml), level);
            if (size !== null) {
                return size;
            }
        }
    }
    if (masterXml === null) {
        return null;
    }
    const styleName =
        placeholder === null
            ? 'p:otherStyle'
            : (STYLE_BY_TYPE_MAP[placeholder.type] ?? 'p:bodyStyle');
    const style = new RegExp(`<${styleName}>[\\s\\S]*?</${styleName}>`).exec(
        masterXml,
    )?.[0];
    return style === undefined ? null : readLevelSize(style, level);
}
