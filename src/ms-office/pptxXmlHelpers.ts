// The PresentationML side of "Export to PPTX": pure functions from a measured
// slide model (`PptxSlideModelType`, in slide pixels) to the XML parts of a
// `.pptx` package. Nothing here touches the DOM or the disk, so every part can
// be checked in a test without a browser.
//
// Units: a slide pixel is 9525 EMU (96 DPI), the same mapping PowerPoint uses
// for a 1920x1080 slide of 20in x 11.25in. Slides too large or too small for
// PowerPoint's limits are scaled uniformly (see `genPptxUnits`).

export type PptxColorType = {
    // `RRGGBB`, upper case
    hex: string;
    // 0..1
    alpha: number;
};

export type PptxGeometryType =
    | { kind: 'rect' }
    // circular corners, the radius in slide pixels
    | { kind: 'roundRect'; radius: number }
    // CSS percentage radii round a non-square box elliptically, which the
    // preset `roundRect` cannot draw; this is written as a custom path
    | { kind: 'ellipticRoundRect'; radiusX: number; radiusY: number };

export type PptxBoxType = {
    x: number;
    y: number;
    width: number;
    height: number;
    // degrees, clockwise, around the box center
    rotation: number;
};

export type PptxRunType = {
    text: string;
    fontFamily: string;
    // px
    fontSize: number;
    color: PptxColorType;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    isStrike: boolean;
    // px
    letterSpacing: number;
    // percent of the font size, positive raises (superscript)
    baselineShift: number;
    lang: string;
};

export type PptxLineType = {
    runs: PptxRunType[];
    // a hard break (`<br>`) came before this line; soft wraps stay `false`
    isNewParagraph: boolean;
};

export type PptxTextAlignType = 'l' | 'ctr' | 'r' | 'just';

export type PptxTextBodyType = {
    lines: PptxLineType[];
    align: PptxTextAlignType;
    // exact line pitch, px
    lineSpacing: number;
    // px; may be negative when the text overflows its frame
    insets: { left: number; top: number; right: number; bottom: number };
};

export type PptxMediaType = {
    // `media/<fileName>` inside `ppt/`, e.g. `image3.png`
    fileName: string;
};

export type PptxCropType = {
    // fractions of the picture, 0..1, cut from each side (negative extends)
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type PptxLineStyleType = {
    // px
    width: number;
    color: PptxColorType;
};

export type PptxShapeElementType = {
    kind: 'shape';
    name: string;
    box: PptxBoxType;
    geometry: PptxGeometryType;
    fill: PptxColorType | null;
    // an outline centered on the shape's edge, as DrawingML draws one
    line?: PptxLineStyleType | null;
    textBody: PptxTextBodyType | null;
};

export type PptxPictureElementType = {
    kind: 'picture';
    name: string;
    box: PptxBoxType;
    geometry: PptxGeometryType;
    fill: PptxColorType | null;
    media: PptxMediaType;
    crop: PptxCropType | null;
    // 0..1
    opacity: number;
};

export type PptxLeafElementType = PptxShapeElementType | PptxPictureElementType;

export type PptxGroupElementType = {
    kind: 'group';
    name: string;
    box: PptxBoxType;
    // positioned in slide coordinates, unrotated; the group turns them all
    children: PptxLeafElementType[];
};

export type PptxElementType = PptxLeafElementType | PptxGroupElementType;

export type PptxBackgroundType =
    | { kind: 'color'; color: PptxColorType }
    | { kind: 'picture'; media: PptxMediaType; crop: PptxCropType | null };

export type PptxSlideModelType = {
    width: number;
    height: number;
    background: PptxBackgroundType | null;
    elements: PptxElementType[];
    note: string;
    isHidden: boolean;
};

export type PptxUnitsType = {
    emuPerPx: number;
    offsetX: number;
    offsetY: number;
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_PACKAGE_RELS =
    'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPE = `${NS_R}/`;
const PML_NS_ATTRIBUTES = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;

const CONTENT_TYPE_PREFIX = 'application/vnd.openxmlformats-officedocument.';

export const PX_TO_EMU = 9525;
// PowerPoint's own bounds for `p:sldSz`
const MIN_SLIDE_EMU = 914400;
const MAX_SLIDE_EMU = 51206400;
const NOTES_WIDTH_EMU = 6858000;
const NOTES_HEIGHT_EMU = 9144000;
const FIRST_SLIDE_ID = 256;
const MASTER_ID = 2147483648;
const LAYOUT_ID = 2147483649;

export const PPTX_MEDIA_CONTENT_TYPE_MAP = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
} as const;
export type PptxMediaExtensionType = keyof typeof PPTX_MEDIA_CONTENT_TYPE_MAP;

// XML 1.0 cannot represent these at all, not even as entities. Slide text is
// typed by the user (and pasted from anywhere), and one of these makes the
// part unreadable to PowerPoint.
const INVALID_XML_CHAR_REGEX =
    // eslint-disable-next-line no-control-regex -- matching them is the point
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;

export function escapeXmlText(value: string) {
    return value
        .replaceAll(INVALID_XML_CHAR_REGEX, '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function escapeXmlAttribute(value: string) {
    return escapeXmlText(value).replaceAll('"', '&quot;');
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function toInt(value: number) {
    return Number.isFinite(value) ? Math.round(value) : 0;
}

// One slide size for the whole deck (PowerPoint has no per-slide size). A slide
// of a different size than the deck's is fitted into it, centered, the way a
// screen shows a slide of another aspect ratio.
export function genPptxSlideSize(width: number, height: number) {
    const safeWidth = width > 0 ? width : 1920;
    const safeHeight = height > 0 ? height : 1080;
    let emuPerPx = PX_TO_EMU;
    const maxSide = Math.max(safeWidth, safeHeight);
    const minSide = Math.min(safeWidth, safeHeight);
    if (maxSide * emuPerPx > MAX_SLIDE_EMU) {
        emuPerPx = MAX_SLIDE_EMU / maxSide;
    }
    if (minSide * emuPerPx < MIN_SLIDE_EMU) {
        emuPerPx = Math.min(MIN_SLIDE_EMU / minSide, MAX_SLIDE_EMU / maxSide);
    }
    return {
        emuPerPx,
        widthEmu: clamp(
            toInt(safeWidth * emuPerPx),
            MIN_SLIDE_EMU,
            MAX_SLIDE_EMU,
        ),
        heightEmu: clamp(
            toInt(safeHeight * emuPerPx),
            MIN_SLIDE_EMU,
            MAX_SLIDE_EMU,
        ),
    };
}

export function genPptxUnits(
    deck: { emuPerPx: number; widthEmu: number; heightEmu: number },
    slideWidth: number,
    slideHeight: number,
): PptxUnitsType {
    if (slideWidth <= 0 || slideHeight <= 0) {
        return { emuPerPx: deck.emuPerPx, offsetX: 0, offsetY: 0 };
    }
    const emuPerPx = Math.min(
        deck.widthEmu / slideWidth,
        deck.heightEmu / slideHeight,
    );
    return {
        emuPerPx,
        offsetX: (deck.widthEmu - slideWidth * emuPerPx) / 2,
        offsetY: (deck.heightEmu - slideHeight * emuPerPx) / 2,
    };
}

function toEmuLength(px: number, units: PptxUnitsType) {
    return toInt(px * units.emuPerPx);
}

function toEmuX(px: number, units: PptxUnitsType) {
    return toInt(units.offsetX + px * units.emuPerPx);
}

function toEmuY(px: number, units: PptxUnitsType) {
    return toInt(units.offsetY + px * units.emuPerPx);
}

// Hundredths of a point for a length given in slide pixels, honoring the deck
// scale: 1px is 0.75pt at 9525 EMU per pixel.
function toCentiPoints(px: number, units: PptxUnitsType) {
    return toInt(((px * units.emuPerPx) / PX_TO_EMU) * 75);
}

function toAngle(degrees: number) {
    const normalized = ((degrees % 360) + 360) % 360;
    return toInt(normalized * 60000) % 21600000;
}

function toPercentValue(fraction: number) {
    return toInt(fraction * 100000);
}

function genColorXml(color: PptxColorType) {
    const alpha = clamp(color.alpha, 0, 1);
    if (alpha >= 1) {
        return `<a:srgbClr val="${color.hex}"/>`;
    }
    return (
        `<a:srgbClr val="${color.hex}">` +
        `<a:alpha val="${toPercentValue(alpha)}"/></a:srgbClr>`
    );
}

function genSolidFillXml(color: PptxColorType | null) {
    if (color === null || color.alpha <= 0) {
        return '<a:noFill/>';
    }
    return `<a:solidFill>${genColorXml(color)}</a:solidFill>`;
}

function genXfrmXml(box: PptxBoxType, units: PptxUnitsType, extra = '') {
    const rotation = toAngle(box.rotation);
    const rotationAttribute = rotation === 0 ? '' : ` rot="${rotation}"`;
    return (
        `<a:xfrm${rotationAttribute}>` +
        `<a:off x="${toEmuX(box.x, units)}" y="${toEmuY(box.y, units)}"/>` +
        `<a:ext cx="${Math.max(0, toEmuLength(box.width, units))}" ` +
        `cy="${Math.max(0, toEmuLength(box.height, units))}"/>` +
        extra +
        '</a:xfrm>'
    );
}

function genEllipticRoundRectPathXml(
    width: number,
    height: number,
    radiusX: number,
    radiusY: number,
) {
    // path coordinates are in the path's own space, here the shape's EMU size
    const rx = toInt(clamp(radiusX, 0, width / 2));
    const ry = toInt(clamp(radiusY, 0, height / 2));
    const w = toInt(width);
    const h = toInt(height);
    const arc = (stAng: number) => {
        return (
            `<a:arcTo wR="${rx}" hR="${ry}" stAng="${stAng}" ` +
            'swAng="5400000"/>'
        );
    };
    return (
        '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>' +
        '<a:rect l="0" t="0" r="r" b="b"/>' +
        `<a:pathLst><a:path w="${w}" h="${h}">` +
        `<a:moveTo><a:pt x="${rx}" y="0"/></a:moveTo>` +
        `<a:lnTo><a:pt x="${w - rx}" y="0"/></a:lnTo>` +
        arc(16200000) +
        `<a:lnTo><a:pt x="${w}" y="${h - ry}"/></a:lnTo>` +
        arc(0) +
        `<a:lnTo><a:pt x="${rx}" y="${h}"/></a:lnTo>` +
        arc(5400000) +
        `<a:lnTo><a:pt x="0" y="${ry}"/></a:lnTo>` +
        arc(10800000) +
        '<a:close/></a:path></a:pathLst></a:custGeom>'
    );
}

// `hasText`: PowerPoint lays a preset rounded rectangle's text out inside its
// own text rectangle, inset from the edges by 29.3% of the corner radius (the
// preset's `il`/`it` guides) — 30px of shift under a 100px corner, measured
// against PowerPoint 16. A box that holds text is drawn as the same outline
// with a custom path instead, whose text rectangle is the whole box, so its
// insets mean what a browser's padding means.
function genGeometryXml(
    geometry: PptxGeometryType,
    box: PptxBoxType,
    units: PptxUnitsType,
    hasText = false,
) {
    if (geometry.kind === 'roundRect' && hasText && geometry.radius > 0) {
        return genEllipticRoundRectPathXml(
            toEmuLength(box.width, units),
            toEmuLength(box.height, units),
            toEmuLength(geometry.radius, units),
            toEmuLength(geometry.radius, units),
        );
    }
    if (geometry.kind === 'roundRect') {
        const shortSide = Math.min(box.width, box.height);
        if (shortSide > 0 && geometry.radius > 0) {
            // `adj` is the radius as a share of the SHORT side, capped at half
            // of it — the same clamp CSS applies to an oversized radius
            const adj = clamp(geometry.radius / shortSide, 0, 0.5);
            return (
                '<a:prstGeom prst="roundRect"><a:avLst>' +
                `<a:gd name="adj" fmla="val ${toPercentValue(adj)}"/>` +
                '</a:avLst></a:prstGeom>'
            );
        }
    } else if (geometry.kind === 'ellipticRoundRect') {
        if (geometry.radiusX > 0 && geometry.radiusY > 0) {
            return genEllipticRoundRectPathXml(
                toEmuLength(box.width, units),
                toEmuLength(box.height, units),
                toEmuLength(geometry.radiusX, units),
                toEmuLength(geometry.radiusY, units),
            );
        }
    }
    return '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
}

function genRunPropertiesXml(
    run: PptxRunType,
    units: PptxUnitsType,
    tagName: 'a:rPr' | 'a:endParaRPr' = 'a:rPr',
) {
    const size = clamp(toCentiPoints(run.fontSize, units), 100, 400000);
    const attributes = [
        `lang="${escapeXmlAttribute(run.lang)}"`,
        `sz="${size}"`,
        `b="${run.isBold ? 1 : 0}"`,
        `i="${run.isItalic ? 1 : 0}"`,
    ];
    if (run.isUnderline) {
        attributes.push('u="sng"');
    }
    if (run.isStrike) {
        attributes.push('strike="sngStrike"');
    }
    const spacing = clamp(
        toCentiPoints(run.letterSpacing, units),
        -400000,
        400000,
    );
    if (spacing !== 0) {
        attributes.push(`spc="${spacing}"`);
    }
    const baseline = toInt(clamp(run.baselineShift, -100, 100) * 1000);
    if (baseline !== 0) {
        attributes.push(`baseline="${baseline}"`);
    }
    attributes.push('dirty="0"');
    // `CT_TextCharacterProperties` fixes the child order: the fill comes
    // before the typefaces. All three typefaces name the same font so the
    // character's script cannot send PowerPoint to a different one — the run
    // was already split wherever the browser itself switched fonts.
    const typeface = escapeXmlAttribute(run.fontFamily);
    return (
        `<${tagName} ${attributes.join(' ')}>` +
        genSolidFillXml(run.color) +
        `<a:latin typeface="${typeface}"/>` +
        `<a:ea typeface="${typeface}"/>` +
        `<a:cs typeface="${typeface}"/>` +
        `</${tagName}>`
    );
}

function genRunXml(run: PptxRunType, units: PptxUnitsType) {
    return (
        `<a:r>${genRunPropertiesXml(run, units)}` +
        `<a:t>${escapeXmlText(run.text)}</a:t></a:r>`
    );
}

function genParagraphPropertiesXml(
    textBody: PptxTextBodyType,
    units: PptxUnitsType,
) {
    const spacing = clamp(
        toCentiPoints(textBody.lineSpacing, units),
        0,
        158400,
    );
    return (
        `<a:pPr marL="0" marR="0" indent="0" algn="${textBody.align}">` +
        (spacing > 0 ? `<a:lnSpc><a:spcPts val="${spacing}"/></a:lnSpc>` : '') +
        '<a:spcBef><a:spcPts val="0"/></a:spcBef>' +
        '<a:spcAft><a:spcPts val="0"/></a:spcAft>' +
        '<a:buNone/></a:pPr>'
    );
}

function genParagraphXml(
    lines: PptxLineType[],
    textBody: PptxTextBodyType,
    units: PptxUnitsType,
) {
    const bodyXmlList: string[] = [];
    let lastRun: PptxRunType | null = null;
    for (const [index, line] of lines.entries()) {
        if (index > 0 && lastRun !== null) {
            // a soft wrap in the browser, pinned so PowerPoint breaks the line
            // at exactly the same place
            bodyXmlList.push(
                `<a:br>${genRunPropertiesXml(lastRun, units)}</a:br>`,
            );
        }
        for (const run of line.runs) {
            bodyXmlList.push(genRunXml(run, units));
            lastRun = run;
        }
    }
    const endRun: PptxRunType | null =
        lastRun ??
        textBody.lines.find((line) => {
            return line.runs.length > 0;
        })?.runs[0] ??
        null;
    return (
        '<a:p>' +
        genParagraphPropertiesXml(textBody, units) +
        bodyXmlList.join('') +
        (endRun === null
            ? ''
            : genRunPropertiesXml(endRun, units, 'a:endParaRPr')) +
        '</a:p>'
    );
}

export function splitPptxParagraphs(lines: PptxLineType[]) {
    const paragraphList: PptxLineType[][] = [];
    for (const line of lines) {
        if (line.isNewParagraph || paragraphList.length === 0) {
            paragraphList.push([]);
        }
        paragraphList[paragraphList.length - 1].push(line);
    }
    return paragraphList;
}

function genTextBodyXml(
    textBody: PptxTextBodyType | null,
    units: PptxUnitsType,
) {
    if (textBody === null) {
        return (
            '<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/>' +
            '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody>'
        );
    }
    const { insets } = textBody;
    const paragraphsXml = splitPptxParagraphs(textBody.lines)
        .map((lines) => {
            return genParagraphXml(lines, textBody, units);
        })
        .join('');
    // `wrap="none"`: every line break the browser made is already written out,
    // so PowerPoint must not wrap a line again just because its own glyph
    // widths came out a hair wider.
    return (
        '<p:txBody>' +
        '<a:bodyPr wrap="none" ' +
        `lIns="${toEmuLength(insets.left, units)}" ` +
        `tIns="${toEmuLength(insets.top, units)}" ` +
        `rIns="${toEmuLength(insets.right, units)}" ` +
        `bIns="${toEmuLength(insets.bottom, units)}" ` +
        'anchor="t" anchorCtr="0" rtlCol="0">' +
        '<a:noAutofit/></a:bodyPr><a:lstStyle/>' +
        (paragraphsXml || '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>') +
        '</p:txBody>'
    );
}

function genLineXml(line: PptxLineStyleType | null, units: PptxUnitsType) {
    if (line === null || line.width <= 0 || line.color.alpha <= 0) {
        return '<a:ln><a:noFill/></a:ln>';
    }
    return (
        `<a:ln w="${toEmuLength(line.width, units)}">` +
        genSolidFillXml(line.color) +
        '</a:ln>'
    );
}

type ShapeIdGeneratorType = { next: () => number };

function genShapeXml(
    element: PptxShapeElementType,
    units: PptxUnitsType,
    ids: ShapeIdGeneratorType,
) {
    const id = ids.next();
    return (
        '<p:sp><p:nvSpPr>' +
        `<p:cNvPr id="${id}" name="${escapeXmlAttribute(element.name)}"/>` +
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
        '<p:spPr>' +
        genXfrmXml(element.box, units) +
        genGeometryXml(
            element.geometry,
            element.box,
            units,
            element.textBody !== null,
        ) +
        genSolidFillXml(element.fill) +
        genLineXml(element.line ?? null, units) +
        '</p:spPr>' +
        genTextBodyXml(element.textBody, units) +
        '</p:sp>'
    );
}

function genCropXml(crop: PptxCropType | null) {
    if (crop === null) {
        return '';
    }
    const attributes = (
        [
            ['l', crop.left],
            ['t', crop.top],
            ['r', crop.right],
            ['b', crop.bottom],
        ] as const
    )
        .map(([name, value]) => {
            return [name, toPercentValue(value)] as const;
        })
        .filter(([, value]) => {
            return value !== 0;
        })
        .map(([name, value]) => {
            return `${name}="${value}"`;
        });
    if (attributes.length === 0) {
        return '';
    }
    return `<a:srcRect ${attributes.join(' ')}/>`;
}

function genPictureXml(
    element: PptxPictureElementType,
    relationshipId: string,
    units: PptxUnitsType,
    ids: ShapeIdGeneratorType,
) {
    const id = ids.next();
    const opacity = clamp(element.opacity, 0, 1);
    const alphaXml =
        opacity >= 1 ? '' : `<a:alphaModFix amt="${toPercentValue(opacity)}"/>`;
    return (
        '<p:pic><p:nvPicPr>' +
        `<p:cNvPr id="${id}" name="${escapeXmlAttribute(element.name)}"/>` +
        '<p:cNvPicPr/><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill>' +
        `<a:blip r:embed="${relationshipId}">${alphaXml}</a:blip>` +
        genCropXml(element.crop) +
        '<a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        '<p:spPr>' +
        genXfrmXml(element.box, units) +
        genGeometryXml(element.geometry, element.box, units) +
        (element.fill === null ? '' : genSolidFillXml(element.fill)) +
        '</p:spPr></p:pic>'
    );
}

export type PptxSlideRelsType = {
    // media file name -> relationship id, in first-use order
    mediaRelationshipMap: Map<string, string>;
    notesSlideIndex: number | null;
};

function genRelationshipIdForMedia(
    rels: PptxSlideRelsType,
    media: PptxMediaType,
) {
    let relationshipId = rels.mediaRelationshipMap.get(media.fileName);
    if (relationshipId === undefined) {
        // rId1 is the layout
        relationshipId = `rId${rels.mediaRelationshipMap.size + 2}`;
        rels.mediaRelationshipMap.set(media.fileName, relationshipId);
    }
    return relationshipId;
}

function genLeafXml(
    element: PptxLeafElementType,
    units: PptxUnitsType,
    ids: ShapeIdGeneratorType,
    rels: PptxSlideRelsType,
) {
    if (element.kind === 'shape') {
        return genShapeXml(element, units, ids);
    }
    return genPictureXml(
        element,
        genRelationshipIdForMedia(rels, element.media),
        units,
        ids,
    );
}

function genElementXml(
    element: PptxElementType,
    units: PptxUnitsType,
    ids: ShapeIdGeneratorType,
    rels: PptxSlideRelsType,
) {
    if (element.kind !== 'group') {
        return genLeafXml(element, units, ids, rels);
    }
    const id = ids.next();
    // The child space equals the group box, so children keep plain slide
    // coordinates and only the group carries the rotation, turning everything
    // around the item's own center as CSS does.
    const childSpaceXml =
        `<a:chOff x="${toEmuX(element.box.x, units)}" ` +
        `y="${toEmuY(element.box.y, units)}"/>` +
        `<a:chExt cx="${Math.max(0, toEmuLength(element.box.width, units))}" ` +
        `cy="${Math.max(0, toEmuLength(element.box.height, units))}"/>`;
    return (
        '<p:grpSp><p:nvGrpSpPr>' +
        `<p:cNvPr id="${id}" name="${escapeXmlAttribute(element.name)}"/>` +
        '<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
        `<p:grpSpPr>${genXfrmXml(element.box, units, childSpaceXml)}</p:grpSpPr>` +
        element.children
            .map((child) => {
                return genLeafXml(child, units, ids, rels);
            })
            .join('') +
        '</p:grpSp>'
    );
}

function genBackgroundXml(
    background: PptxBackgroundType | null,
    rels: PptxSlideRelsType,
) {
    if (background === null) {
        // what a screen shows behind a slide with nothing attached
        return (
            '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill>' +
            '<a:effectLst/></p:bgPr></p:bg>'
        );
    }
    if (background.kind === 'color') {
        return (
            '<p:bg><p:bgPr>' +
            `<a:solidFill>${genColorXml({ ...background.color, alpha: 1 })}</a:solidFill>` +
            '<a:effectLst/></p:bgPr></p:bg>'
        );
    }
    return (
        '<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1">' +
        `<a:blip r:embed="${genRelationshipIdForMedia(rels, background.media)}"/>` +
        genCropXml(background.crop) +
        '<a:stretch><a:fillRect/></a:stretch></a:blipFill>' +
        '<a:effectLst/></p:bgPr></p:bg>'
    );
}

const EMPTY_GROUP_PROPERTIES_XML =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
    '</p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/>' +
    '<a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/>' +
    '</a:xfrm></p:grpSpPr>';

export function genSlideXml(
    model: PptxSlideModelType,
    units: PptxUnitsType,
    rels: PptxSlideRelsType,
) {
    let lastId = 1;
    const ids: ShapeIdGeneratorType = {
        next: () => {
            lastId++;
            return lastId;
        },
    };
    // the background claims its relationship first, so a picture shared with
    // an element keeps one id
    const backgroundXml = genBackgroundXml(model.background, rels);
    const elementsXml = model.elements
        .map((element) => {
            return genElementXml(element, units, ids, rels);
        })
        .join('');
    return (
        XML_HEADER +
        `<p:sld ${PML_NS_ATTRIBUTES}${model.isHidden ? ' show="0"' : ''}>` +
        `<p:cSld>${backgroundXml}<p:spTree>` +
        EMPTY_GROUP_PROPERTIES_XML +
        elementsXml +
        '</p:spTree></p:cSld>' +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
        '</p:sld>'
    );
}

function genRelationshipsXml(
    relationshipList: {
        id: string;
        type: string;
        target: string;
    }[],
) {
    return (
        XML_HEADER +
        `<Relationships xmlns="${NS_PACKAGE_RELS}">` +
        relationshipList
            .map(({ id, type, target }) => {
                return (
                    `<Relationship Id="${id}" Type="${type}" ` +
                    `Target="${escapeXmlAttribute(target)}"/>`
                );
            })
            .join('') +
        '</Relationships>'
    );
}

export function genSlideRelsXml(rels: PptxSlideRelsType) {
    const relationshipList = [
        {
            id: 'rId1',
            type: `${REL_TYPE}slideLayout`,
            target: '../slideLayouts/slideLayout1.xml',
        },
        ...Array.from(rels.mediaRelationshipMap.entries()).map(
            ([fileName, id]) => {
                return {
                    id,
                    type: `${REL_TYPE}image`,
                    target: `../media/${fileName}`,
                };
            },
        ),
    ];
    if (rels.notesSlideIndex !== null) {
        relationshipList.push({
            id: `rId${rels.mediaRelationshipMap.size + 2}`,
            type: `${REL_TYPE}notesSlide`,
            target: `../notesSlides/notesSlide${rels.notesSlideIndex}.xml`,
        });
    }
    return genRelationshipsXml(relationshipList);
}

export function genNotesSlideXml(note: string) {
    const paragraphsXml = note
        .split(/\r?\n/)
        .map((line) => {
            if (line === '') {
                return '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>';
            }
            return (
                '<a:p><a:r><a:rPr lang="en-US" dirty="0"/>' +
                `<a:t>${escapeXmlText(line)}</a:t></a:r></a:p>`
            );
        })
        .join('');
    return (
        XML_HEADER +
        `<p:notes ${PML_NS_ATTRIBUTES}><p:cSld><p:spTree>` +
        EMPTY_GROUP_PROPERTIES_XML +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>' +
        '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/>' +
        '</p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr/></p:sp>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/>' +
        '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
        '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
        paragraphsXml +
        '</p:txBody></p:sp>' +
        '</p:spTree></p:cSld>' +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>'
    );
}

export function genNotesSlideRelsXml(slideIndex: number) {
    return genRelationshipsXml([
        {
            id: 'rId1',
            type: `${REL_TYPE}notesMaster`,
            target: '../notesMasters/notesMaster1.xml',
        },
        {
            id: 'rId2',
            type: `${REL_TYPE}slide`,
            target: `../slides/slide${slideIndex}.xml`,
        },
    ]);
}

export type PptxDeckInfoType = {
    title: string;
    slideCount: number;
    // 1-based indexes of the slides that carry a speaker note
    notesSlideIndexes: number[];
    hiddenSlideCount: number;
    widthEmu: number;
    heightEmu: number;
    createdAt: Date;
    applicationName: string;
};

export function genContentTypesXml(info: PptxDeckInfoType) {
    const overrideList: [string, string][] = [
        ['/ppt/presentation.xml', 'presentationml.presentation.main+xml'],
        [
            '/ppt/slideMasters/slideMaster1.xml',
            'presentationml.slideMaster+xml',
        ],
        [
            '/ppt/slideLayouts/slideLayout1.xml',
            'presentationml.slideLayout+xml',
        ],
        ['/ppt/theme/theme1.xml', 'theme+xml'],
        ['/ppt/presProps.xml', 'presentationml.presProps+xml'],
        ['/ppt/viewProps.xml', 'presentationml.viewProps+xml'],
        ['/ppt/tableStyles.xml', 'presentationml.tableStyles+xml'],
        ['/docProps/app.xml', 'extended-properties+xml'],
    ];
    for (let index = 1; index <= info.slideCount; index++) {
        overrideList.push([
            `/ppt/slides/slide${index}.xml`,
            'presentationml.slide+xml',
        ]);
    }
    if (info.notesSlideIndexes.length > 0) {
        overrideList.push(
            [
                '/ppt/notesMasters/notesMaster1.xml',
                'presentationml.notesMaster+xml',
            ],
            ['/ppt/theme/theme2.xml', 'theme+xml'],
        );
        for (const index of info.notesSlideIndexes) {
            overrideList.push([
                `/ppt/notesSlides/notesSlide${index}.xml`,
                'presentationml.notesSlide+xml',
            ]);
        }
    }
    return (
        XML_HEADER +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        Object.entries(PPTX_MEDIA_CONTENT_TYPE_MAP)
            .map(([extension, contentType]) => {
                return `<Default Extension="${extension}" ContentType="${contentType}"/>`;
            })
            .join('') +
        overrideList
            .map(([partName, contentType]) => {
                return (
                    `<Override PartName="${partName}" ` +
                    `ContentType="${CONTENT_TYPE_PREFIX}${contentType}"/>`
                );
            })
            .join('') +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>'
    );
}

export function genRootRelsXml() {
    return genRelationshipsXml([
        {
            id: 'rId1',
            type: `${REL_TYPE}officeDocument`,
            target: 'ppt/presentation.xml',
        },
        {
            id: 'rId2',
            type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
            target: 'docProps/core.xml',
        },
        {
            id: 'rId3',
            type: `${REL_TYPE}extended-properties`,
            target: 'docProps/app.xml',
        },
    ]);
}

function toW3CDate(date: Date) {
    // seconds precision, as `dcterms:W3CDTF` examples in Office files have it
    return `${date.toISOString().slice(0, 19)}Z`;
}

export function genCorePropsXml(info: PptxDeckInfoType) {
    const date = toW3CDate(info.createdAt);
    return (
        XML_HEADER +
        '<cp:coreProperties ' +
        'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${escapeXmlText(info.title)}</dc:title>` +
        `<dc:creator>${escapeXmlText(info.applicationName)}</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${date}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${date}</dcterms:modified>` +
        '</cp:coreProperties>'
    );
}

export function genAppPropsXml(info: PptxDeckInfoType) {
    return (
        XML_HEADER +
        '<Properties ' +
        'xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        `<Application>${escapeXmlText(info.applicationName)}</Application>` +
        `<Slides>${info.slideCount}</Slides>` +
        `<Notes>${info.notesSlideIndexes.length}</Notes>` +
        `<HiddenSlides>${info.hiddenSlideCount}</HiddenSlides>` +
        '</Properties>'
    );
}

export function genPresentationXml(info: PptxDeckInfoType) {
    const hasNotes = info.notesSlideIndexes.length > 0;
    // rId1 master, rId2.. slides, then the notes master (see
    // `genPresentationRelsXml`, which numbers them the same way)
    const slideIdsXml = Array.from({ length: info.slideCount }, (_, index) => {
        return `<p:sldId id="${FIRST_SLIDE_ID + index}" r:id="rId${index + 2}"/>`;
    }).join('');
    return (
        XML_HEADER +
        `<p:presentation ${PML_NS_ATTRIBUTES} saveSubsetFonts="1">` +
        `<p:sldMasterIdLst><p:sldMasterId id="${MASTER_ID}" r:id="rId1"/></p:sldMasterIdLst>` +
        (hasNotes
            ? '<p:notesMasterIdLst><p:notesMasterId ' +
              `r:id="rId${info.slideCount + 2}"/></p:notesMasterIdLst>`
            : '') +
        // an empty list is left out rather than written empty: a document
        // with no slides still opens, as an empty presentation
        (slideIdsXml === '' ? '' : `<p:sldIdLst>${slideIdsXml}</p:sldIdLst>`) +
        `<p:sldSz cx="${info.widthEmu}" cy="${info.heightEmu}"/>` +
        `<p:notesSz cx="${NOTES_WIDTH_EMU}" cy="${NOTES_HEIGHT_EMU}"/>` +
        '</p:presentation>'
    );
}

export function genPresentationRelsXml(info: PptxDeckInfoType) {
    const relationshipList = [
        {
            id: 'rId1',
            type: `${REL_TYPE}slideMaster`,
            target: 'slideMasters/slideMaster1.xml',
        },
    ];
    for (let index = 1; index <= info.slideCount; index++) {
        relationshipList.push({
            id: `rId${index + 1}`,
            type: `${REL_TYPE}slide`,
            target: `slides/slide${index}.xml`,
        });
    }
    let nextId = info.slideCount + 2;
    if (info.notesSlideIndexes.length > 0) {
        relationshipList.push({
            id: `rId${nextId}`,
            type: `${REL_TYPE}notesMaster`,
            target: 'notesMasters/notesMaster1.xml',
        });
        nextId++;
    }
    for (const [type, target] of [
        ['presProps', 'presProps.xml'],
        ['viewProps', 'viewProps.xml'],
        ['theme', 'theme/theme1.xml'],
        ['tableStyles', 'tableStyles.xml'],
    ]) {
        relationshipList.push({
            id: `rId${nextId}`,
            type: `${REL_TYPE}${type}`,
            target,
        });
        nextId++;
    }
    return genRelationshipsXml(relationshipList);
}

// Black behind everything and white text by default: a slide deck made for a
// projector. `bg1`/`tx1` are mapped to the dark/light pair accordingly, so a
// text box someone adds later in PowerPoint is readable on these slides.
const COLOR_MAP_XML =
    '<p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" ' +
    'accent2="accent2" accent3="accent3" accent4="accent4" ' +
    'accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

export function genSlideMasterXml() {
    return (
        XML_HEADER +
        `<p:sldMaster ${PML_NS_ATTRIBUTES}>` +
        '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/>' +
        '</a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>' +
        EMPTY_GROUP_PROPERTIES_XML +
        '</p:spTree></p:cSld>' +
        COLOR_MAP_XML +
        `<p:sldLayoutIdLst><p:sldLayoutId id="${LAYOUT_ID}" r:id="rId1"/>` +
        '</p:sldLayoutIdLst>' +
        '<p:txStyles>' +
        '<p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>' +
        '<p:bodyStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:bodyStyle>' +
        '<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>' +
        '</p:txStyles></p:sldMaster>'
    );
}

export function genSlideMasterRelsXml() {
    return genRelationshipsXml([
        {
            id: 'rId1',
            type: `${REL_TYPE}slideLayout`,
            target: '../slideLayouts/slideLayout1.xml',
        },
        {
            id: 'rId2',
            type: `${REL_TYPE}theme`,
            target: '../theme/theme1.xml',
        },
    ]);
}

export function genSlideLayoutXml() {
    return (
        XML_HEADER +
        `<p:sldLayout ${PML_NS_ATTRIBUTES} type="blank" preserve="1">` +
        `<p:cSld name="Blank"><p:spTree>${EMPTY_GROUP_PROPERTIES_XML}` +
        '</p:spTree></p:cSld>' +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
    );
}

export function genSlideLayoutRelsXml() {
    return genRelationshipsXml([
        {
            id: 'rId1',
            type: `${REL_TYPE}slideMaster`,
            target: '../slideMasters/slideMaster1.xml',
        },
    ]);
}

export function genNotesMasterXml() {
    // the two placeholders a notes page is laid out from: the slide picture
    // above, the speaker's words below
    return (
        XML_HEADER +
        `<p:notesMaster ${PML_NS_ATTRIBUTES}>` +
        '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef>' +
        '</p:bg><p:spTree>' +
        EMPTY_GROUP_PROPERTIES_XML +
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>' +
        '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/>' +
        '</p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr><a:xfrm><a:off x="685800" y="1143000"/>' +
        '<a:ext cx="5486400" cy="3086100"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>' +
        '<a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill>' +
        '</a:ln></p:spPr></p:sp>' +
        '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/>' +
        '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
        '<p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr><a:xfrm><a:off x="685800" y="4400550"/>' +
        '<a:ext cx="5486400" cy="3600450"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
        '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" ' +
        'rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/>' +
        '<a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>' +
        '</p:spTree></p:cSld>' +
        '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
        'accent2="accent2" accent3="accent3" accent4="accent4" ' +
        'accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
        '<p:notesStyle><a:lvl1pPr marL="0" algn="l" rtl="0">' +
        '<a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/>' +
        '</a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/>' +
        '<a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle>' +
        '</p:notesMaster>'
    );
}

export function genNotesMasterRelsXml() {
    return genRelationshipsXml([
        {
            id: 'rId1',
            type: `${REL_TYPE}theme`,
            target: '../theme/theme2.xml',
        },
    ]);
}

export function genThemeXml(name: string) {
    const colorXml = (tagName: string, hex: string) => {
        return `<a:${tagName}><a:srgbClr val="${hex}"/></a:${tagName}>`;
    };
    const solidFillXml =
        '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    const lineXml = (width: number) => {
        return (
            `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr">${solidFillXml}` +
            '<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>'
        );
    };
    const fontXml = (tagName: string) => {
        return (
            `<a:${tagName}><a:latin typeface="Arial"/><a:ea typeface=""/>` +
            `<a:cs typeface=""/></a:${tagName}>`
        );
    };
    return (
        XML_HEADER +
        `<a:theme xmlns:a="${NS_A}" name="${escapeXmlAttribute(name)}">` +
        '<a:themeElements>' +
        `<a:clrScheme name="${escapeXmlAttribute(name)}">` +
        colorXml('dk1', '000000') +
        colorXml('lt1', 'FFFFFF') +
        colorXml('dk2', '1F2937') +
        colorXml('lt2', 'E7E6E6') +
        colorXml('accent1', '4472C4') +
        colorXml('accent2', 'ED7D31') +
        colorXml('accent3', 'A5A5A5') +
        colorXml('accent4', 'FFC000') +
        colorXml('accent5', '5B9BD5') +
        colorXml('accent6', '70AD47') +
        colorXml('hlink', '0563C1') +
        colorXml('folHlink', '954F72') +
        '</a:clrScheme>' +
        `<a:fontScheme name="${escapeXmlAttribute(name)}">` +
        fontXml('majorFont') +
        fontXml('minorFont') +
        '</a:fontScheme>' +
        `<a:fmtScheme name="${escapeXmlAttribute(name)}">` +
        `<a:fillStyleLst>${solidFillXml.repeat(3)}</a:fillStyleLst>` +
        `<a:lnStyleLst>${lineXml(6350)}${lineXml(12700)}${lineXml(19050)}</a:lnStyleLst>` +
        '<a:effectStyleLst>' +
        '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) +
        '</a:effectStyleLst>' +
        `<a:bgFillStyleLst>${solidFillXml.repeat(3)}</a:bgFillStyleLst>` +
        '</a:fmtScheme></a:themeElements>' +
        '<a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
    );
}

export function genPresPropsXml() {
    return XML_HEADER + `<p:presentationPr ${PML_NS_ATTRIBUTES}/>`;
}

export function genViewPropsXml() {
    return (
        XML_HEADER +
        `<p:viewPr ${PML_NS_ATTRIBUTES}>` +
        '<p:gridSpacing cx="76200" cy="76200"/></p:viewPr>'
    );
}

export function genTableStylesXml() {
    return (
        XML_HEADER +
        `<a:tblStyleLst xmlns:a="${NS_A}" ` +
        'def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>'
    );
}
