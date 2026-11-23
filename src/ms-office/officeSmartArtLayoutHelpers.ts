/**
 * A SmartArt given another of PowerPoint's layouts and KEPT a SmartArt
 * (2026-11-21, `EC-784`, the goal _chatbot can change do everything on a
 * given pptx_: _Switching a SmartArt to a different layout (for example a
 * process into a cycle) still needs PowerPoint_). PowerPoint's SmartArt
 * Design → Layouts changes three parts: the layout definition, the data
 * model's presentation points (one per drawn shape, named after the
 * definition's layout nodes -- LibreOffice draws nothing without them) and
 * the drawing kept beside them for programs that do not lay a SmartArt out
 * themselves. This writes all three, and the colour and style labels the
 * new layout draws with when the file's own parts lack them.
 *
 * Five layouts -- a Basic Venn and a Hierarchy added after the first three
 * (`EC-785`) -- each checked twice (2026-11-21): LibreOffice's own SmartArt
 * engine lays the file out from the definition and the data alone (the
 * drawing taken away), and Microsoft's Open XML validator reads every part
 * without an error. A Hierarchy keeps boxes under boxes as a tree, joined
 * by elbow lines; the others lay out a diagram's boxes in one level.
 * PowerPoint itself was not tried: none on that machine. A Basic Block
 * List was left out: LibreOffice's engine ran its third block off the
 * slide, with its row length fixed as well. Pure.
 */

export const SMARTART_LAYOUT_LIST = [
    'cycle',
    'process',
    'pyramid',
    'venn',
    'hierarchy',
] as const;

export type SmartArtLayoutNameType = (typeof SMARTART_LAYOUT_LIST)[number];

/** The layouts as a call names them: "cycle" | "process" | … */
export const SMARTART_LAYOUT_CHOICES_TEXT = SMARTART_LAYOUT_LIST.map(
    (layout) => {
        return `"${layout}"`;
    },
).join(' | ');

export type SmartArtLayoutAreaType = {
    x: number;
    y: number;
    cx: number;
    cy: number;
};

type ArrowsType = 'wrap' | 'between' | null;

type LayoutSpecType = {
    uniqueId: string;
    category: string;
    // PowerPoint's own name for it, in the answer
    title: string;
    // what it lays its boxes out as, in the answer
    how: string;
    rootName: string;
    nodeName: string;
    arrows: ArrowsType;
    nodeShape: 'ellipse' | 'roundRect' | 'trapezoid';
    body: string;
};

const DGM_NAMESPACE =
    'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const URN = 'urn:microsoft.com/office/officeart/2005/8/layout/';

const NODE_MARGIN_XML =
    '<dgm:constr type="tMarg" refType="primFontSz" fact="0.3"/>' +
    '<dgm:constr type="bMarg" refType="primFontSz" fact="0.3"/>' +
    '<dgm:constr type="lMarg" refType="primFontSz" fact="0.3"/>' +
    '<dgm:constr type="rMarg" refType="primFontSz" fact="0.3"/>';

const FONT_RULE_XML =
    '<dgm:ruleLst><dgm:rule type="primFontSz" val="5" fact="NaN" ' +
    'max="NaN"/></dgm:ruleLst>';

const ROOT_VARS_XML =
    '<dgm:varLst><dgm:dir/><dgm:resizeHandles val="exact"/></dgm:varLst>';

const EMPTY_SHAPE_XML = '<dgm:shape r:blip=""><dgm:adjLst/></dgm:shape>';

// a box with words, and the arrow after it
function genNodesXml(
    nodeName: string,
    shape: string,
    heightFactor: string,
    arrows: ArrowsType,
) {
    return (
        '<dgm:forEach name="nodesForEach" axis="ch" ptType="node">' +
        `<dgm:layoutNode name="${nodeName}">` +
        '<dgm:varLst><dgm:bulletEnabled val="1"/></dgm:varLst>' +
        '<dgm:alg type="tx"/>' +
        `<dgm:shape type="${shape}" r:blip=""><dgm:adjLst/></dgm:shape>` +
        '<dgm:presOf axis="desOrSelf" ptType="node"/>' +
        '<dgm:constrLst>' +
        (heightFactor === ''
            ? ''
            : `<dgm:constr type="h" refType="w" fact="${heightFactor}"/>`) +
        NODE_MARGIN_XML +
        '</dgm:constrLst>' +
        FONT_RULE_XML +
        '</dgm:layoutNode>' +
        (arrows !== null
            ? '<dgm:forEach name="sibTransForEach" axis="followSib" ' +
              // a cycle's last box has its arrow too, back to the first, as
              // PowerPoint's own Basic Cycle says (EC-787 found it missing)
              `ptType="sibTrans"${arrows === 'wrap' ? ' hideLastTrans="0"' : ''} cnt="1">` +
              '<dgm:layoutNode name="sibTrans">' +
              '<dgm:alg type="conn"/>' +
              '<dgm:shape type="conn" r:blip=""><dgm:adjLst/></dgm:shape>' +
              '<dgm:presOf axis="self"/>' +
              '<dgm:constrLst>' +
              '<dgm:constr type="h" refType="w" fact="0.6"/>' +
              '<dgm:constr type="connDist"/>' +
              '<dgm:constr type="begPad" refType="connDist" fact="0.25"/>' +
              '<dgm:constr type="endPad" refType="connDist" fact="0.22"/>' +
              '</dgm:constrLst><dgm:ruleLst/>' +
              '</dgm:layoutNode></dgm:forEach>'
            : '') +
        '</dgm:forEach>'
    );
}

const BRANCH_ALG_XML =
    '<dgm:alg type="hierChild"><dgm:param type="linDir" val="fromL"/>' +
    '<dgm:param type="chAlign" val="t"/></dgm:alg>';

const ROOT_ALG_XML =
    '<dgm:alg type="hierRoot"><dgm:param type="hierAlign" val="tCtrCh"/>' +
    '</dgm:alg>';

const EMPTY_PARTS_XML = `${EMPTY_SHAPE_XML}<dgm:presOf/><dgm:constrLst/><dgm:ruleLst/>`;

// a hierarchy's box: its own words alone, never its children's
function genTreeTextXml(name: string) {
    return (
        `<dgm:layoutNode name="${name}"><dgm:alg type="tx"/>` +
        '<dgm:shape type="roundRect" r:blip=""><dgm:adjLst/></dgm:shape>' +
        '<dgm:presOf axis="self"/><dgm:constrLst>' +
        '<dgm:constr type="h" refType="w" fact="0.6"/>' +
        `${NODE_MARGIN_XML}</dgm:constrLst>${FONT_RULE_XML}` +
        '</dgm:layoutNode>'
    );
}

// the line from a box down to each box under it
const TREE_LINE_XML =
    '<dgm:forEach name="parTransForEach" axis="self" ptType="parTrans">' +
    '<dgm:layoutNode name="parTrans2"><dgm:alg type="conn">' +
    '<dgm:param type="dim" val="1D"/><dgm:param type="endSty" val="noArr"/>' +
    '<dgm:param type="connRout" val="bend"/>' +
    '<dgm:param type="begPts" val="bCtr"/>' +
    '<dgm:param type="endPts" val="tCtr"/></dgm:alg>' +
    '<dgm:shape type="conn" r:blip=""><dgm:adjLst/></dgm:shape>' +
    '<dgm:presOf axis="self"/><dgm:constrLst/><dgm:ruleLst/>' +
    '</dgm:layoutNode></dgm:forEach>';

// Each top box a root over the boxes under it; deeper levels repeat the
// second (`ref`), as deep as the diagram goes.
const HIERARCHY_BODY_XML =
    '<dgm:layoutNode name="hierChild1"><dgm:varLst><dgm:orgChart val="1"/>' +
    '<dgm:chPref val="1"/><dgm:dir/><dgm:resizeHandles/></dgm:varLst>' +
    `${BRANCH_ALG_XML}${EMPTY_PARTS_XML}` +
    '<dgm:forEach name="rootsForEach" axis="ch" ptType="node">' +
    `<dgm:layoutNode name="hierRoot1">${ROOT_ALG_XML}${EMPTY_PARTS_XML}` +
    genTreeTextXml('rootText1') +
    `<dgm:layoutNode name="hierChild2">${BRANCH_ALG_XML}${EMPTY_PARTS_XML}` +
    `<dgm:forEach name="repeat" axis="ch">${TREE_LINE_XML}` +
    '<dgm:forEach name="branchForEach" axis="self" ptType="node">' +
    `<dgm:layoutNode name="hierRoot2">${ROOT_ALG_XML}${EMPTY_PARTS_XML}` +
    genTreeTextXml('text2') +
    `<dgm:layoutNode name="hierChild3">${BRANCH_ALG_XML}${EMPTY_PARTS_XML}` +
    '<dgm:forEach name="deeperForEach" ref="repeat"/>' +
    '</dgm:layoutNode></dgm:layoutNode></dgm:forEach></dgm:forEach>' +
    '</dgm:layoutNode></dgm:layoutNode></dgm:forEach></dgm:layoutNode>';

const LAYOUT_SPEC_MAP: Record<SmartArtLayoutNameType, LayoutSpecType> = {
    cycle: {
        uniqueId: `${URN}cycle2`,
        category: 'cycle',
        title: 'Basic Cycle',
        how: 'its boxes round a circle, clockwise from the top, an arrow from each to the next',
        rootName: 'cycle',
        nodeName: 'node',
        arrows: 'wrap',
        nodeShape: 'ellipse',
        body:
            '<dgm:layoutNode name="cycle">' +
            ROOT_VARS_XML +
            '<dgm:alg type="cycle"><dgm:param type="stAng" val="0"/>' +
            '<dgm:param type="spanAng" val="360"/></dgm:alg>' +
            EMPTY_SHAPE_XML +
            '<dgm:presOf/><dgm:constrLst>' +
            '<dgm:constr type="w" for="ch" forName="node" refType="w"/>' +
            '<dgm:constr type="h" for="ch" forName="node" refType="w" ' +
            'refFor="ch" refForName="node"/>' +
            '<dgm:constr type="w" for="ch" forName="sibTrans" refType="w" ' +
            'refFor="ch" refForName="node" fact="0.4"/>' +
            '<dgm:constr type="sibSp" refType="w" refFor="ch" ' +
            'refForName="node" fact="0.15"/>' +
            '<dgm:constr type="primFontSz" for="ch" forName="node" ' +
            'op="equ" val="65"/>' +
            '</dgm:constrLst><dgm:ruleLst/>' +
            genNodesXml('node', 'ellipse', '1', 'wrap') +
            '</dgm:layoutNode>',
    },
    process: {
        uniqueId: `${URN}process1`,
        category: 'process',
        title: 'Basic Process',
        how: 'its boxes in a row, left to right, an arrow between each two',
        rootName: 'Name0',
        nodeName: 'node',
        arrows: 'between',
        nodeShape: 'roundRect',
        body:
            '<dgm:layoutNode name="Name0">' +
            ROOT_VARS_XML +
            '<dgm:alg type="lin"/>' +
            EMPTY_SHAPE_XML +
            '<dgm:presOf/><dgm:constrLst>' +
            '<dgm:constr type="w" for="ch" forName="node" refType="w"/>' +
            '<dgm:constr type="h" for="ch" forName="node" refType="w" ' +
            'refFor="ch" refForName="node" fact="0.6"/>' +
            '<dgm:constr type="w" for="ch" forName="sibTrans" refType="w" ' +
            'refFor="ch" refForName="node" fact="0.4"/>' +
            '<dgm:constr type="h" for="ch" forName="sibTrans" refType="h" ' +
            'refFor="ch" refForName="node" fact="0.4"/>' +
            '<dgm:constr type="primFontSz" for="ch" forName="node" ' +
            'op="equ" val="65"/>' +
            '</dgm:constrLst><dgm:ruleLst/>' +
            genNodesXml('node', 'roundRect', '0.6', 'between') +
            '</dgm:layoutNode>',
    },
    pyramid: {
        uniqueId: `${URN}pyramid1`,
        category: 'pyramid',
        title: 'Basic Pyramid',
        how: 'its boxes as the levels of a pyramid, the first at the top',
        rootName: 'Name0',
        nodeName: 'level',
        arrows: null,
        nodeShape: 'trapezoid',
        body:
            '<dgm:layoutNode name="Name0">' +
            ROOT_VARS_XML +
            // the schema's name for it: "pyramid" is refused
            '<dgm:alg type="pyra"/>' +
            EMPTY_SHAPE_XML +
            '<dgm:presOf/><dgm:constrLst>' +
            '<dgm:constr type="w" for="ch" forName="level" refType="w"/>' +
            '<dgm:constr type="h" for="ch" forName="level" refType="h"/>' +
            '<dgm:constr type="primFontSz" for="ch" forName="level" ' +
            'op="equ" val="65"/>' +
            '</dgm:constrLst><dgm:ruleLst/>' +
            genNodesXml('level', 'trapezoid', '', null) +
            '</dgm:layoutNode>',
    },
    venn: {
        uniqueId: `${URN}venn1`,
        category: 'relationship',
        title: 'Basic Venn',
        how: 'its boxes as circles that overlap round the middle, each half see-through',
        rootName: 'Name0',
        nodeName: 'circ',
        arrows: null,
        nodeShape: 'ellipse',
        body:
            '<dgm:layoutNode name="Name0">' +
            ROOT_VARS_XML +
            '<dgm:alg type="cycle"><dgm:param type="stAng" val="0"/>' +
            '<dgm:param type="spanAng" val="360"/></dgm:alg>' +
            EMPTY_SHAPE_XML +
            '<dgm:presOf/><dgm:constrLst>' +
            '<dgm:constr type="w" for="ch" forName="circ" refType="w"/>' +
            '<dgm:constr type="h" for="ch" forName="circ" refType="w" ' +
            'refFor="ch" refForName="circ"/>' +
            '<dgm:constr type="sibSp" refType="w" refFor="ch" ' +
            'refForName="circ" fact="-0.5"/>' +
            '<dgm:constr type="primFontSz" for="ch" forName="circ" ' +
            'op="equ" val="65"/>' +
            '</dgm:constrLst><dgm:ruleLst/>' +
            genNodesXml('circ', 'ellipse', '1', null) +
            '</dgm:layoutNode>',
    },
    hierarchy: {
        uniqueId: `${URN}hierarchy1`,
        category: 'hierarchy',
        title: 'Hierarchy',
        how: 'its boxes as a tree, each box over the boxes under it, joined by lines',
        rootName: 'hierChild1',
        nodeName: 'rootText1',
        arrows: null,
        nodeShape: 'roundRect',
        body: HIERARCHY_BODY_XML,
    },
};

/** PowerPoint's own name for a layout, and what it lays its boxes out as. */
export function describeSmartArtLayout(layout: SmartArtLayoutNameType) {
    const spec = LAYOUT_SPEC_MAP[layout];
    return `PowerPoint's ${spec.title} (${spec.how})`;
}

/** The layout definition PowerPoint keeps for it. */
export function genSmartArtLayoutDefXml(layout: SmartArtLayoutNameType) {
    const spec = LAYOUT_SPEC_MAP[layout];
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<dgm:layoutDef ${DGM_NAMESPACE} uniqueId="${spec.uniqueId}">` +
        '<dgm:title val=""/><dgm:desc val=""/>' +
        `<dgm:catLst><dgm:cat type="${spec.category}" pri="1000"/>` +
        `</dgm:catLst>${spec.body}</dgm:layoutDef>`
    );
}

/**
 * A flat place grown round its middle, inside the slide, for a layout that
 * needs height: a cycle or a pyramid in a strip 1.4 inches tall is drawn
 * with words too small to read (seen 2026-11-21, `EC-780`).
 */
export function toSmartArtLayoutRoom(
    layout: SmartArtLayoutNameType,
    area: SmartArtLayoutAreaType,
    slideSize: { cx: number; cy: number } | null,
): SmartArtLayoutAreaType {
    if (layout === 'process' || slideSize === null) {
        return area;
    }
    const wanted = Math.round(
        Math.min(Math.max(area.cy, area.cx * 0.45), slideSize.cy * 0.6),
    );
    if (wanted <= area.cy) {
        return area;
    }
    const middle = area.y + area.cy / 2;
    const y = Math.round(
        Math.min(Math.max(middle - wanted / 2, 0), slideSize.cy - wanted),
    );
    return { ...area, y, cy: wanted };
}

export type PointType = {
    xml: string;
    modelId: string;
    type: string;
};

export type ConnectionType = {
    xml: string;
    modelId: string;
    type: string;
    srcId: string;
    destId: string;
    srcOrd: number;
    parTransId: string | null;
    sibTransId: string | null;
};

export function readAttribute(xml: string, name: string) {
    return new RegExp(`^<[^>]*?\\s${name}="([^"]*)"`).exec(xml)?.[1] ?? null;
}

export function setAttribute(tagXml: string, name: string, value: string) {
    const pattern = new RegExp(`(\\s${name}=")[^"]*(")`);
    if (pattern.test(tagXml)) {
        return tagXml.replace(pattern, `$1${value}$2`);
    }
    return tagXml.replace(/(\/?>)$/, ` ${name}="${value}"$1`);
}

export function listPoints(dataXml: string): PointType[] {
    return [
        ...dataXml.matchAll(/<dgm:pt\b[^>]*?(?:\/>|>[\s\S]*?<\/dgm:pt>)/g),
    ].map((match) => {
        return {
            xml: match[0],
            modelId: readAttribute(match[0], 'modelId') ?? '',
            type: readAttribute(match[0], 'type') ?? 'node',
        };
    });
}

export function listConnections(dataXml: string): ConnectionType[] {
    return [
        ...dataXml.matchAll(/<dgm:cxn\b[^>]*?(?:\/>|>[\s\S]*?<\/dgm:cxn>)/g),
    ].map((match) => {
        const xml = match[0];
        return {
            xml,
            modelId: readAttribute(xml, 'modelId') ?? '',
            type: readAttribute(xml, 'type') ?? 'parOf',
            srcId: readAttribute(xml, 'srcId') ?? '',
            destId: readAttribute(xml, 'destId') ?? '',
            srcOrd: Number(readAttribute(xml, 'srcOrd') ?? '0'),
            parTransId: readAttribute(xml, 'parTransId'),
            sibTransId: readAttribute(xml, 'sibTransId'),
        };
    });
}

export function readWordsText(pointXml: string) {
    return [...pointXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
        .map((match) => {
            return match[1];
        })
        .join('')
        .trim();
}

export const EMPTY_WORDS_XML =
    '<dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/>' +
    '</a:p></dgm:t>';

// the colour and style labels the new layout draws with, as PowerPoint's
// Colorful and Simple sets give them, for parts that lack them
const COLOR_LABEL_MAP: Record<string, string> = {
    node1:
        '<dgm:styleLbl name="node1"><dgm:fillClrLst meth="repeat">' +
        '<a:schemeClr val="accent1"/></dgm:fillClrLst>' +
        '<dgm:linClrLst meth="repeat"><a:schemeClr val="lt1"/>' +
        '</dgm:linClrLst><dgm:effectClrLst/><dgm:txLinClrLst/>' +
        '<dgm:txFillClrLst meth="repeat"><a:schemeClr val="lt1"/>' +
        '</dgm:txFillClrLst><dgm:txEffectClrLst/></dgm:styleLbl>',
    sibTrans2D1:
        '<dgm:styleLbl name="sibTrans2D1"><dgm:fillClrLst meth="repeat">' +
        '<a:schemeClr val="accent1"><a:tint val="60000"/></a:schemeClr>' +
        '</dgm:fillClrLst><dgm:linClrLst meth="repeat">' +
        '<a:schemeClr val="accent1"><a:tint val="60000"/></a:schemeClr>' +
        '</dgm:linClrLst><dgm:effectClrLst/><dgm:txLinClrLst/>' +
        '<dgm:txFillClrLst meth="repeat"><a:schemeClr val="lt1"/>' +
        '</dgm:txFillClrLst><dgm:txEffectClrLst/></dgm:styleLbl>',
    parChTrans1D2:
        '<dgm:styleLbl name="parChTrans1D2"><dgm:fillClrLst meth="repeat">' +
        '<a:schemeClr val="accent1"/></dgm:fillClrLst>' +
        '<dgm:linClrLst meth="repeat"><a:schemeClr val="accent1">' +
        '<a:shade val="60000"/></a:schemeClr></dgm:linClrLst>' +
        '<dgm:effectClrLst/><dgm:txLinClrLst/><dgm:txFillClrLst meth="repeat">' +
        '<a:schemeClr val="tx1"/></dgm:txFillClrLst><dgm:txEffectClrLst/>' +
        '</dgm:styleLbl>',
};

const STYLE_LABEL_SCENE_XML =
    '<dgm:scene3d><a:camera prst="orthographicFront"/>' +
    '<a:lightRig rig="threePt" dir="t"/></dgm:scene3d><dgm:sp3d/><dgm:txPr/>';

function genStyleLabelXml(name: string, lineIndex: number) {
    return (
        `<dgm:styleLbl name="${name}">${STYLE_LABEL_SCENE_XML}<dgm:style>` +
        `<a:lnRef idx="${lineIndex}"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>` +
        '<a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef>' +
        '<a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef>' +
        '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>' +
        '</dgm:style></dgm:styleLbl>'
    );
}

const STYLE_LABEL_MAP: Record<string, string> = {
    node1: genStyleLabelXml('node1', 2),
    sibTrans2D1: genStyleLabelXml('sibTrans2D1', 0),
    parChTrans1D2: genStyleLabelXml('parChTrans1D2', 2),
};

export function addMissingLabels(
    xml: string | null,
    closeTag: string,
    labelMap: Record<string, string>,
    nameList: string[],
) {
    if (xml === null || !xml.includes(closeTag)) {
        return xml;
    }
    const missing = nameList.filter((name) => {
        return !xml.includes(`<dgm:styleLbl name="${name}"`);
    });
    if (missing.length === 0) {
        return xml;
    }
    const added = missing
        .map((name) => {
            return labelMap[name];
        })
        .join('');
    return xml.replace(closeTag, `${added}${closeTag}`);
}

/** A model id no point or connection of the SmartArt has yet. */
export function genModelIdMaker(takenIds: Set<string>) {
    let count = 0;
    return () => {
        while (true) {
            count += 1;
            const tail = count.toString(16).toUpperCase().padStart(12, '0');
            const id = `{5A17A900-0000-4000-8000-${tail}}`;
            if (!takenIds.has(id)) {
                takenIds.add(id);
                return id;
            }
        }
    };
}

type BoxPlaceType = {
    x: number;
    y: number;
    cx: number;
    cy: number;
    rot?: number;
    adj?: number;
};

const DEGREE = 60000;

// Where each box and arrow goes in the frame, for the drawing kept beside
// the SmartArt -- PowerPoint lays it out again itself.
function placeShapes(
    layout: SmartArtLayoutNameType,
    count: number,
    size: { cx: number; cy: number },
) {
    const { cx: width, cy: height } = size;
    const boxes: BoxPlaceType[] = [];
    const arrows: BoxPlaceType[] = [];
    if (layout === 'process') {
        let boxWidth = width / (count + 0.4 * (count - 1));
        let boxHeight = boxWidth * 0.6;
        if (boxHeight > height) {
            boxHeight = height;
            boxWidth = boxHeight / 0.6;
        }
        const used = boxWidth * (count + 0.4 * (count - 1));
        const left = (width - used) / 2;
        const top = (height - boxHeight) / 2;
        for (let index = 0; index < count; index += 1) {
            const x = left + index * boxWidth * 1.4;
            boxes.push({ x, y: top, cx: boxWidth, cy: boxHeight });
            if (index < count - 1) {
                const arrowWidth = boxWidth * 0.4 * 0.7;
                const arrowHeight = Math.min(boxHeight * 0.4, arrowWidth);
                arrows.push({
                    x: x + boxWidth + (boxWidth * 0.4 - arrowWidth) / 2,
                    y: (height - arrowHeight) / 2,
                    cx: arrowWidth,
                    cy: arrowHeight,
                });
            }
        }
    } else if (layout === 'cycle') {
        const half = Math.min(width, height) / 2;
        const sine = Math.sin(Math.PI / count);
        const diameter = (2 * half * sine) / (1.3 + sine);
        const radius = half - diameter / 2;
        const centreX = width / 2;
        const centreY = height / 2;
        const toPoint = (turn: number) => {
            const angle = -Math.PI / 2 + turn;
            return {
                x: centreX + radius * Math.cos(angle),
                y: centreY + radius * Math.sin(angle),
                angle,
            };
        };
        for (let index = 0; index < count; index += 1) {
            const at = toPoint((2 * Math.PI * index) / count);
            boxes.push({
                x: at.x - diameter / 2,
                y: at.y - diameter / 2,
                cx: diameter,
                cy: diameter,
            });
            const mid = toPoint((2 * Math.PI * (index + 0.5)) / count);
            const arrowWidth = diameter * 0.3;
            const arrowHeight = diameter * 0.2;
            // pointing on round the circle: its way, clockwise
            const degrees =
                ((((mid.angle * 180) / Math.PI + 90) % 360) + 360) % 360;
            arrows.push({
                x: mid.x - arrowWidth / 2,
                y: mid.y - arrowHeight / 2,
                cx: arrowWidth,
                cy: arrowHeight,
                rot: Math.round(degrees * DEGREE),
            });
        }
    } else if (layout === 'venn') {
        // two side by side, more round the middle, each over its neighbours
        const share = count === 2 ? 0.32 : 0.38;
        const diameter =
            count === 2
                ? Math.min(width / (1 + 2 * share), height)
                : Math.min(width, height) / (1 + 2 * share);
        const radius = diameter * share;
        for (let index = 0; index < count; index += 1) {
            const angle =
                count === 2
                    ? Math.PI * (1 - index)
                    : -Math.PI / 2 + (2 * Math.PI * index) / count;
            boxes.push({
                x: width / 2 + radius * Math.cos(angle) - diameter / 2,
                y: height / 2 + radius * Math.sin(angle) - diameter / 2,
                cx: diameter,
                cy: diameter,
            });
        }
    } else {
        const baseWidth = Math.min(width, height * 1.6);
        const levelHeight = height / count;
        for (let index = 0; index < count; index += 1) {
            const bottom = (baseWidth * (index + 1)) / count;
            const inset = baseWidth / (2 * count);
            const shortSide = Math.min(bottom, levelHeight);
            boxes.push({
                x: (width - bottom) / 2,
                y: index * levelHeight,
                cx: bottom,
                cy: levelHeight,
                adj: Math.round((inset / shortSide) * 100000),
            });
        }
    }
    return { boxes: boxes.map(roundPlace), arrows: arrows.map(roundPlace) };
}

function roundPlace(place: BoxPlaceType): BoxPlaceType {
    return {
        ...place,
        x: Math.round(place.x),
        y: Math.round(place.y),
        cx: Math.max(1, Math.round(place.cx)),
        cy: Math.max(1, Math.round(place.cy)),
    };
}

type TreeNodeType = {
    point: PointType;
    connection: ConnectionType;
    children: TreeNodeType[];
};

function listTreeNodes(roots: TreeNodeType[]): TreeNodeType[] {
    return roots.flatMap((node) => {
        return [node, ...listTreeNodes(node.children)];
    });
}

function countTreeLeaves(node: TreeNodeType): number {
    return node.children.length === 0
        ? 1
        : node.children.reduce((sum, child) => {
              return sum + countTreeLeaves(child);
          }, 0);
}

function measureTreeDepth(node: TreeNodeType): number {
    return (
        1 +
        Math.max(
            0,
            ...node.children.map((child) => {
                return measureTreeDepth(child);
            }),
        )
    );
}

// Each box over the middle of the boxes under it, a level a row, the
// boxes at the bottom of each branch side by side; and the elbow line from
// a box down to each box under it.
function placeTree(roots: TreeNodeType[], size: { cx: number; cy: number }) {
    const leaves = roots.reduce((sum, root) => {
        return sum + countTreeLeaves(root);
    }, 0);
    const depth = Math.max(
        ...roots.map((root) => {
            return measureTreeDepth(root);
        }),
    );
    const gap = 0.25;
    const levelShare = 0.6;
    const boxWidth = size.cx / (leaves + gap * (leaves - 1));
    let boxHeight = boxWidth * 0.6;
    if (depth * boxHeight + (depth - 1) * levelShare * boxHeight > size.cy) {
        boxHeight = size.cy / (depth + levelShare * (depth - 1));
    }
    const levelGap = boxHeight * levelShare;
    const left =
        (size.cx - (leaves * boxWidth + (leaves - 1) * gap * boxWidth)) / 2;
    const top = (size.cy - (depth * boxHeight + (depth - 1) * levelGap)) / 2;
    const placeMap = new Map<TreeNodeType, BoxPlaceType>();
    const lineMap = new Map<TreeNodeType, BoxPlaceType & { path: string }>();
    let slot = 0;
    const place = (node: TreeNodeType, level: number): number => {
        let centre: number;
        if (node.children.length === 0) {
            centre = left + slot * boxWidth * (1 + gap) + boxWidth / 2;
            slot += 1;
        } else {
            const centreList = node.children.map((child) => {
                return place(child, level + 1);
            });
            centre = (centreList[0] + centreList[centreList.length - 1]) / 2;
        }
        placeMap.set(
            node,
            roundPlace({
                x: centre - boxWidth / 2,
                y: top + level * (boxHeight + levelGap),
                cx: boxWidth,
                cy: boxHeight,
            }),
        );
        return centre;
    };
    roots.forEach((root) => {
        place(root, 0);
    });
    for (const node of listTreeNodes(roots)) {
        const from = placeMap.get(node) as BoxPlaceType;
        for (const child of node.children) {
            const to = placeMap.get(child) as BoxPlaceType;
            const fromX = from.x + from.cx / 2;
            const toX = to.x + to.cx / 2;
            const x = Math.min(fromX, toX);
            const cx = Math.max(1, Math.abs(toX - fromX));
            const cy = Math.max(1, to.y - (from.y + from.cy));
            const half = Math.round(cy / 2);
            const fromAt = Math.round(fromX - x);
            const toAt = Math.round(toX - x);
            lineMap.set(child, {
                ...roundPlace({ x, y: from.y + from.cy, cx, cy }),
                path:
                    `<a:moveTo><a:pt x="${fromAt}" y="0"/></a:moveTo>` +
                    `<a:lnTo><a:pt x="${fromAt}" y="${half}"/></a:lnTo>` +
                    `<a:lnTo><a:pt x="${toAt}" y="${half}"/></a:lnTo>` +
                    `<a:lnTo><a:pt x="${toAt}" y="${Math.round(cy)}"/></a:lnTo>`,
            });
        }
    }
    return { placeMap, lineMap };
}

// the words' size, in hundredths of a point, that every box's words fit
function toWordSize(
    layout: SmartArtLayoutNameType,
    boxes: BoxPlaceType[],
    wordsList: string[],
) {
    const widthShare = {
        cycle: 0.7,
        process: 0.85,
        pyramid: 0.5,
        venn: 0.55,
        hierarchy: 0.85,
    }[layout];
    const sizeList = boxes.map((box, index) => {
        const longest = Math.max(
            1,
            ...wordsList[index].split(/\s+/).map((word) => {
                return [...word].length;
            }),
        );
        const letters = Math.max(1, [...wordsList[index]].length);
        // a line of its longest word, at most three lines of all of it
        const byWidth = Math.min(
            (box.cx * widthShare) / (longest * 0.6),
            (box.cx * widthShare * 3) / (letters * 0.6),
        );
        const byHeight = box.cy * 0.4;
        return Math.min(byWidth, byHeight) / 127;
    });
    return Math.round(Math.max(800, Math.min(6500, ...sizeList)) / 100) * 100;
}

// the paragraphs of a point's words, centred, each run at `size`
function toShownParagraphs(pointXml: string, size: number) {
    const inner = /<dgm:t>([\s\S]*?)<\/dgm:t>/.exec(pointXml)?.[1] ?? '';
    const paragraphs = inner.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) ?? [
        '<a:p/>',
    ];
    return paragraphs
        .map((paragraph) => {
            let xml = paragraph === '<a:p/>' ? '<a:p></a:p>' : paragraph;
            xml = xml.replace(
                /<a:pPr\b[^>]*?\/>|<a:pPr\b[^>]*?>[\s\S]*?<\/a:pPr>/,
                '',
            );
            xml = xml.replace(/^<a:p>/, '<a:p><a:pPr algn="ctr"/>');
            xml = xml.replace(
                /<a:rPr\b([^>]*?)(\/?)>/g,
                (_whole, attributes, close) => {
                    const rest = String(attributes).replace(/\ssz="[^"]*"/, '');
                    return `<a:rPr${rest} sz="${size}"${close}>`;
                },
            );
            return xml.replace(
                /<a:r>(?!<a:rPr)/g,
                `<a:r><a:rPr lang="en-US" sz="${size}"/>`,
            );
        })
        .join('');
}

// the look a box had in the drawing before, kept: its fill and outline
function findOldLook(drawingXml: string | null, words: string) {
    if (drawingXml === null) {
        return null;
    }
    const shape = [...drawingXml.matchAll(/<dsp:sp\b[\s\S]*?<\/dsp:sp>/g)].find(
        (match) => {
            return readWordsText(match[0]) === words && words !== '';
        },
    )?.[0];
    if (shape === undefined) {
        return null;
    }
    const props = /<dsp:spPr>([\s\S]*?)<\/dsp:spPr>/.exec(shape)?.[1] ?? '';
    const look = props
        .replace(/<a:xfrm\b[\s\S]*?<\/a:xfrm>/, '')
        .replace(
            /<a:prstGeom\b[\s\S]*?<\/a:prstGeom>|<a:custGeom\b[\s\S]*?<\/a:custGeom>/,
            '',
        );
    const style = /<dsp:style>[\s\S]*?<\/dsp:style>/.exec(shape)?.[0] ?? '';
    const color =
        /<a:rPr\b[^>]*>(<a:solidFill>[\s\S]*?<\/a:solidFill>)/.exec(
            shape,
        )?.[1] ?? null;
    return { look, style, color };
}

function genXfrmXml(place: BoxPlaceType) {
    return (
        `<a:xfrm${place.rot === undefined || place.rot === 0 ? '' : ` rot="${place.rot}"`}>` +
        `<a:off x="${place.x}" y="${place.y}"/>` +
        `<a:ext cx="${place.cx}" cy="${place.cy}"/></a:xfrm>`
    );
}

function genGeometryXml(shape: string, adj?: number) {
    return (
        `<a:prstGeom prst="${shape}"><a:avLst>` +
        (adj === undefined ? '' : `<a:gd name="adj" fmla="val ${adj}"/>`) +
        '</a:avLst></a:prstGeom>'
    );
}

const DEFAULT_BOX_LOOK_XML =
    '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>' +
    '<a:ln w="12700"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln>';

const ARROW_LOOK_XML =
    '<a:solidFill><a:schemeClr val="accent1"><a:tint val="60000"/>' +
    '</a:schemeClr></a:solidFill><a:ln><a:noFill/></a:ln>';

// the first fill made half see-through, as a Venn's circles are
function toSeeThroughLook(look: string) {
    return look.replace(
        /<a:solidFill><a:(\w+) val="([^"]*)"(\/>|>([\s\S]*?)<\/a:\1>)/,
        (_whole, kind: string, value: string, _rest, inner?: string) => {
            const kept = String(inner ?? '').replace(/<a:alpha\b[^>]*\/>/g, '');
            return (
                `<a:solidFill><a:${kind} val="${value}">` +
                `<a:alpha val="50000"/>${kept}</a:${kind}>`
            );
        },
    );
}

// one box of the drawing: its words at `size`, the look it had kept
function genBoxShapeXml(
    drawingXml: string,
    presId: string,
    place: BoxPlaceType,
    shape: string,
    point: PointType,
    size: number,
    isSeeThrough: boolean,
) {
    const words = readWordsText(point.xml);
    const old = findOldLook(drawingXml, words);
    let look = old?.look.trim() || DEFAULT_BOX_LOOK_XML;
    if (isSeeThrough) {
        look = toSeeThroughLook(look);
    }
    const wordsFill =
        old?.color ?? '<a:solidFill><a:schemeClr val="lt1"/></a:solidFill>';
    const paragraphs = toShownParagraphs(point.xml, size).replace(
        /<a:rPr\b([^>]*?)\/>/g,
        (_whole, attributes) => {
            return `<a:rPr${attributes}>${wordsFill}</a:rPr>`;
        },
    );
    return (
        `<dsp:sp modelId="${presId}"><dsp:nvSpPr>` +
        '<dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>' +
        `<dsp:spPr>${genXfrmXml(place)}` +
        `${genGeometryXml(shape, place.adj)}${look}</dsp:spPr>` +
        (old?.style ?? '') +
        '<dsp:txBody><a:bodyPr spcFirstLastPara="0" vert="horz" ' +
        'wrap="square" lIns="76200" tIns="76200" rIns="76200" ' +
        'bIns="76200" anchor="ctr" anchorCtr="0"><a:noAutofit/>' +
        `</a:bodyPr><a:lstStyle/>${paragraphs}</dsp:txBody>` +
        `<dsp:txXfrm><a:off x="${place.x}" y="${place.y}"/>` +
        `<a:ext cx="${place.cx}" cy="${place.cy}"/></dsp:txXfrm>` +
        '</dsp:sp>'
    );
}

// the drawing's own head: everything up to its first shape
function readDrawingHead(drawingXml: string) {
    return /^[\s\S]*?<dsp:spTree>[\s\S]*?<dsp:grpSpPr\b[^>]*?(?:\/>|>[\s\S]*?<\/dsp:grpSpPr>)/.exec(
        drawingXml,
    )?.[0];
}

function genDrawingXml(
    drawingXml: string,
    layout: SmartArtLayoutNameType,
    nodeList: { point: PointType; presId: string }[],
    arrowPresIdList: string[],
    size: { cx: number; cy: number },
) {
    const spec = LAYOUT_SPEC_MAP[layout];
    const wordsList = nodeList.map(({ point }) => {
        return readWordsText(point.xml);
    });
    const { boxes, arrows } = placeShapes(layout, nodeList.length, size);
    const wordSize = toWordSize(layout, boxes, wordsList);
    const shapeList: string[] = [];
    nodeList.forEach(({ point, presId }, index) => {
        shapeList.push(
            genBoxShapeXml(
                drawingXml,
                presId,
                boxes[index],
                spec.nodeShape,
                point,
                wordSize,
                layout === 'venn',
            ),
        );
        const arrow = arrows[index];
        const arrowPresId = arrowPresIdList[index];
        if (arrow !== undefined && arrowPresId !== undefined) {
            shapeList.push(
                `<dsp:sp modelId="${arrowPresId}"><dsp:nvSpPr>` +
                    '<dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>' +
                    `<dsp:spPr>${genXfrmXml(arrow)}` +
                    `${genGeometryXml('rightArrow')}${ARROW_LOOK_XML}` +
                    '</dsp:spPr></dsp:sp>',
            );
        }
    });
    const head = readDrawingHead(drawingXml);
    if (head === undefined) {
        return null;
    }
    return `${head}${shapeList.join('')}</dsp:spTree></dsp:drawing>`;
}

const TREE_LINE_LOOK_XML =
    '<a:noFill/><a:ln w="12700"><a:solidFill><a:schemeClr val="accent1">' +
    '<a:shade val="60000"/></a:schemeClr></a:solidFill></a:ln>';

function genTreeDrawingXml(
    drawingXml: string,
    roots: TreeNodeType[],
    presIdMap: Map<TreeNodeType, { textId: string; lineId: string | null }>,
    size: { cx: number; cy: number },
) {
    const nodeList = listTreeNodes(roots);
    const { placeMap, lineMap } = placeTree(roots, size);
    const wordSize = toWordSize(
        'hierarchy',
        nodeList.map((node) => {
            return placeMap.get(node) as BoxPlaceType;
        }),
        nodeList.map((node) => {
            return readWordsText(node.point.xml);
        }),
    );
    const lineList: string[] = [];
    const boxList: string[] = [];
    for (const node of nodeList) {
        const ids = presIdMap.get(node);
        if (ids === undefined) {
            continue;
        }
        const line = lineMap.get(node);
        if (line !== undefined && ids.lineId !== null) {
            lineList.push(
                `<dsp:sp modelId="${ids.lineId}"><dsp:nvSpPr>` +
                    '<dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>' +
                    `<dsp:spPr>${genXfrmXml(line)}<a:custGeom><a:avLst/>` +
                    '<a:gdLst/><a:ahLst/><a:cxnLst/>' +
                    '<a:rect l="0" t="0" r="0" b="0"/><a:pathLst>' +
                    `<a:path w="${line.cx}" h="${line.cy}" fill="none">` +
                    `${line.path}</a:path></a:pathLst></a:custGeom>` +
                    `${TREE_LINE_LOOK_XML}</dsp:spPr></dsp:sp>`,
            );
        }
        boxList.push(
            genBoxShapeXml(
                drawingXml,
                ids.textId,
                placeMap.get(node) as BoxPlaceType,
                'roundRect',
                node.point,
                wordSize,
                false,
            ),
        );
    }
    const head = readDrawingHead(drawingXml);
    if (head === undefined) {
        return null;
    }
    return (
        `${head}${lineList.join('')}${boxList.join('')}` +
        '</dsp:spTree></dsp:drawing>'
    );
}

export type SmartArtLayoutChangeType = {
    dataXml: string;
    layoutXml: string;
    colorsXml: string | null;
    styleXml: string | null;
    drawingXml: string | null;
    words: string[];
};

/**
 * The SmartArt's parts with another layout: its data's presentation points
 * made again for it, its definition, labels its colours and style lack, and
 * its drawing (in a frame of `size`) drawn again.
 */
export function changeSmartArtLayoutXml(
    parts: {
        dataXml: string;
        drawingXml: string | null;
        colorsXml: string | null;
        styleXml: string | null;
    },
    layout: SmartArtLayoutNameType,
    size: { cx: number; cy: number },
): SmartArtLayoutChangeType | { reason: string } {
    const spec = LAYOUT_SPEC_MAP[layout];
    const isTree = layout === 'hierarchy';
    const { dataXml } = parts;
    const pointList = listPoints(dataXml);
    const connectionList = listConnections(dataXml);
    const doc = pointList.find((point) => {
        return point.type === 'doc';
    });
    if (doc === undefined) {
        return { reason: 'its data part names no diagram.' };
    }
    const parentList = connectionList.filter((connection) => {
        return connection.type === 'parOf';
    });
    const pointMap = new Map(
        pointList.map((point) => {
            return [point.modelId, point];
        }),
    );
    const listChildLinks = (modelId: string) => {
        return parentList
            .filter((connection) => {
                return connection.srcId === modelId;
            })
            .sort((one, other) => {
                return one.srcOrd - other.srcOrd;
            });
    };
    // the boxes as the diagram holds them, each with the boxes under it
    const seenIdSet = new Set<string>();
    let isOddBox = false;
    const toTreeNode = (connection: ConnectionType): TreeNodeType[] => {
        const point = pointMap.get(connection.destId);
        if (
            point === undefined ||
            point.type !== 'node' ||
            seenIdSet.has(point.modelId)
        ) {
            isOddBox = true;
            return [];
        }
        seenIdSet.add(point.modelId);
        return [
            {
                point,
                connection,
                children: listChildLinks(point.modelId).flatMap(toTreeNode),
            },
        ];
    };
    const roots = listChildLinks(doc.modelId).flatMap(toTreeNode);
    if (isOddBox) {
        return {
            reason:
                'it has a box of a kind (an assistant, or one with no ' +
                "words' place) that only PowerPoint lays out again.",
        };
    }
    const treeNodeList = listTreeNodes(roots);
    if (
        !isTree &&
        roots.some((node) => {
            return node.children.length > 0;
        })
    ) {
        return {
            reason:
                'its boxes have boxes of their own under them, which ' +
                `PowerPoint's ${spec.title} shows its own way, so ` +
                'nothing changed. Say so and ask: as a Hierarchy -- a ' +
                'tree, each box over the boxes under it -- it is done ' +
                'here ({slide, box, smartArtLayout: "hierarchy"}); as a ' +
                `${spec.title} it is changed in PowerPoint (SmartArt ` +
                'Design → Layouts).',
        };
    }
    if (treeNodeList.length < 2) {
        return {
            reason:
                'it has fewer than two boxes to lay out as ' +
                `PowerPoint's ${spec.title}.`,
        };
    }
    const takenIds = new Set([
        ...pointList.map((point) => {
            return point.modelId;
        }),
        ...connectionList.map((connection) => {
            return connection.modelId;
        }),
    ]);
    const makeId = genModelIdMaker(takenIds);
    // each box's transitions before and after it in the data, made when
    // missing
    const addedPointList: string[] = [];
    const connectionXmlMap = new Map<string, string>();
    const transitionMap = new Map<
        TreeNodeType,
        { sibTransId: string; parTransId: string }
    >();
    const addTransition = (
        connection: ConnectionType,
        name: 'sibTransId' | 'parTransId',
    ) => {
        const kept = connection[name];
        if (kept !== null && pointMap.has(kept)) {
            return kept;
        }
        const id = kept ?? makeId();
        addedPointList.push(
            `<dgm:pt modelId="${id}" ` +
                `type="${name === 'sibTransId' ? 'sibTrans' : 'parTrans'}" ` +
                `cxnId="${connection.modelId}"><dgm:prSet/><dgm:spPr/>` +
                `${EMPTY_WORDS_XML}</dgm:pt>`,
        );
        const xml = connectionXmlMap.get(connection.modelId) ?? connection.xml;
        connectionXmlMap.set(
            connection.modelId,
            xml.replace(/^<dgm:cxn\b[^>]*?(?=\/?>)/, (tag) => {
                return setAttribute(`${tag}>`, name, id).slice(0, -1);
            }),
        );
        return id;
    };
    for (const node of treeNodeList) {
        transitionMap.set(node, {
            sibTransId: addTransition(node.connection, 'sibTransId'),
            parTransId: addTransition(node.connection, 'parTransId'),
        });
    }
    // the presentation points PowerPoint writes for this layout
    const presList: string[] = [];
    const presConnectionList: string[] = [];
    const parentOrderMap = new Map<string, number>();
    const addPres = (
        presId: string,
        assocId: string,
        name: string,
        style: { label: string; index: number; count: number } | null,
        inner = '',
    ) => {
        presList.push(
            `<dgm:pt modelId="${presId}" type="pres"><dgm:prSet ` +
                `presAssocID="${assocId}" presName="${name}" ` +
                (style === null
                    ? 'presStyleCnt="0"'
                    : `presStyleLbl="${style.label}" ` +
                      `presStyleIdx="${style.index}" ` +
                      `presStyleCnt="${style.count}"`) +
                (inner === '' ? '/>' : `>${inner}</dgm:prSet>`) +
                '<dgm:spPr/></dgm:pt>',
        );
    };
    const addPresOf = (dataId: string, presId: string) => {
        presConnectionList.push(
            `<dgm:cxn modelId="${makeId()}" type="presOf" ` +
                `srcId="${dataId}" destId="${presId}" srcOrd="0" ` +
                `destOrd="0" presId="${spec.uniqueId}"/>`,
        );
    };
    const addPresParOf = (parentPresId: string, presId: string) => {
        const order = parentOrderMap.get(parentPresId) ?? 0;
        parentOrderMap.set(parentPresId, order + 1);
        presConnectionList.push(
            `<dgm:cxn modelId="${makeId()}" type="presParOf" ` +
                `srcId="${parentPresId}" destId="${presId}" ` +
                `srcOrd="${order}" destOrd="0" presId="${spec.uniqueId}"/>`,
        );
    };
    const rootId = makeId();
    addPres(
        rootId,
        doc.modelId,
        spec.rootName,
        null,
        '<dgm:presLayoutVars><dgm:dir/><dgm:resizeHandles val="exact"/>' +
            '</dgm:presLayoutVars>',
    );
    addPresOf(doc.modelId, rootId);
    const count = treeNodeList.length;
    const drawnNodeList: { point: PointType; presId: string }[] = [];
    const arrowPresIdList: string[] = [];
    const treePresIdMap = new Map<
        TreeNodeType,
        { textId: string; lineId: string | null }
    >();
    if (isTree) {
        let textIndex = 0;
        let lineIndex = 0;
        const lineCount = count - roots.length;
        const walk = (node: TreeNodeType, branchId: string, level: number) => {
            const [rootName, textName, childName] =
                level === 0
                    ? ['hierRoot1', 'rootText1', 'hierChild2']
                    : ['hierRoot2', 'text2', 'hierChild3'];
            const { parTransId } = transitionMap.get(node) as {
                parTransId: string;
            };
            let lineId: string | null = null;
            if (level > 0) {
                lineId = makeId();
                addPres(lineId, parTransId, 'parTrans2', {
                    label: 'parChTrans1D2',
                    index: lineIndex,
                    count: lineCount,
                });
                lineIndex += 1;
                addPresOf(parTransId, lineId);
                addPresParOf(branchId, lineId);
            }
            const nodeId = node.point.modelId;
            const ownRootId = makeId();
            addPres(ownRootId, nodeId, rootName, null);
            addPresParOf(branchId, ownRootId);
            const textId = makeId();
            addPres(textId, nodeId, textName, {
                label: 'node1',
                index: textIndex,
                count,
            });
            textIndex += 1;
            addPresOf(nodeId, textId);
            addPresParOf(ownRootId, textId);
            const ownBranchId = makeId();
            addPres(ownBranchId, nodeId, childName, null);
            addPresParOf(ownRootId, ownBranchId);
            treePresIdMap.set(node, { textId, lineId });
            drawnNodeList.push({ point: node.point, presId: textId });
            for (const child of node.children) {
                walk(child, ownBranchId, level + 1);
            }
        };
        for (const root of roots) {
            walk(root, rootId, 0);
        }
    } else {
        const arrowCount =
            spec.arrows === null
                ? 0
                : spec.arrows === 'wrap'
                  ? count
                  : count - 1;
        roots.forEach((node, index) => {
            const presId = makeId();
            drawnNodeList.push({ point: node.point, presId });
            addPres(
                presId,
                node.point.modelId,
                spec.nodeName,
                { label: 'node1', index, count },
                '<dgm:presLayoutVars><dgm:bulletEnabled val="1"/>' +
                    '</dgm:presLayoutVars>',
            );
            addPresOf(node.point.modelId, presId);
            addPresParOf(rootId, presId);
            const { sibTransId } = transitionMap.get(node) as {
                sibTransId: string;
            };
            if (index < arrowCount) {
                const arrowId = makeId();
                arrowPresIdList.push(arrowId);
                addPres(arrowId, sibTransId, 'sibTrans', {
                    label: 'sibTrans2D1',
                    index,
                    count: arrowCount,
                });
                addPresOf(sibTransId, arrowId);
                addPresParOf(rootId, arrowId);
            }
        });
    }
    // the data: the old layout's presentation points and their links out
    const keptPoints = pointList
        .filter((point) => {
            return point.type !== 'pres';
        })
        .map((point) => {
            if (point.type !== 'doc') {
                return point.xml;
            }
            return point.xml.replace(/<dgm:prSet\b[^>]*?(?=\/?>)/, (tag) => {
                let set = setAttribute(`${tag}>`, 'loTypeId', spec.uniqueId);
                set = setAttribute(set, 'loCatId', spec.category);
                return set.slice(0, -1);
            });
        });
    const keptConnections = connectionList
        .filter((connection) => {
            return (
                connection.type !== 'presOf' && connection.type !== 'presParOf'
            );
        })
        .map((connection) => {
            return connectionXmlMap.get(connection.modelId) ?? connection.xml;
        });
    const pointsXml = [...keptPoints, ...addedPointList, ...presList].join('');
    const connectionsXml = [...keptConnections, ...presConnectionList].join('');
    const newDataXml = dataXml
        .replace(
            /<dgm:ptLst>[\s\S]*?<\/dgm:ptLst>|<dgm:ptLst\/>/,
            `<dgm:ptLst>${pointsXml}</dgm:ptLst>`,
        )
        .replace(
            /<dgm:cxnLst>[\s\S]*?<\/dgm:cxnLst>|<dgm:cxnLst\/>/,
            `<dgm:cxnLst>${connectionsXml}</dgm:cxnLst>`,
        );
    const labelNameList = isTree
        ? ['node1', 'parChTrans1D2']
        : spec.arrows === null
          ? ['node1']
          : ['node1', 'sibTrans2D1'];
    let drawingXml: string | null = null;
    if (parts.drawingXml !== null) {
        drawingXml = isTree
            ? genTreeDrawingXml(parts.drawingXml, roots, treePresIdMap, size)
            : genDrawingXml(
                  parts.drawingXml,
                  layout,
                  drawnNodeList,
                  arrowPresIdList,
                  size,
              );
        if (drawingXml === null) {
            return {
                reason: 'the drawing PowerPoint kept of it could not be read.',
            };
        }
    }
    return {
        dataXml: newDataXml,
        layoutXml: genSmartArtLayoutDefXml(layout),
        colorsXml: addMissingLabels(
            parts.colorsXml,
            '</dgm:colorsDef>',
            COLOR_LABEL_MAP,
            labelNameList,
        ),
        styleXml: addMissingLabels(
            parts.styleXml,
            '</dgm:styleDef>',
            STYLE_LABEL_MAP,
            labelNameList,
        ),
        drawingXml,
        words: drawnNodeList.map(({ point }) => {
            return readWordsText(point.xml);
        }),
    };
}
