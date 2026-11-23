import { describe, expect, test } from 'vitest';

import {
    type OfficeAskedChangeType,
    applyOfficeChanges,
    readOfficeDocument,
} from './officePackageEditHelpers';
import {
    openOfficePackage,
    writeOfficePackage,
} from './officePackageIoHelpers';
import {
    changeSmartArtLayoutXml,
    genSmartArtLayoutDefXml,
    type SmartArtLayoutNameType,
    toSmartArtLayoutRoom,
} from './officeSmartArtLayoutHelpers';
import { concatBytes, toZipBytes } from './officeZipHelpers';

// A SmartArt given another of PowerPoint's layouts and kept a SmartArt
// (2026-11-21, EC-784: _Switching a SmartArt to a different layout (for
// example a process into a cycle) still needs PowerPoint_). The parts these
// tests write were also laid out by LibreOffice's own SmartArt engine with
// the drawing taken away, and read by Microsoft's Open XML validator.

const DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const DSP_NS =
    'xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"';
const PROCESS = 'urn:microsoft.com/office/officeart/2005/8/layout/process1';

function genPoint(id: string, words: string) {
    return (
        `<dgm:pt modelId="${id}"><dgm:prSet phldrT="[Text]"/><dgm:spPr/>` +
        `<dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" ` +
        `dirty="0"/><a:t>${words}</a:t></a:r></a:p></dgm:t></dgm:pt>`
    );
}

// Plan's link to the diagram carries its arrows' ids, as PowerPoint writes
// it; Pray's and Go's carry none, as a hand-made file may
const DATA =
    `${HEADER}<dgm:dataModel xmlns:dgm="${DGM}" ${A_NS}><dgm:ptLst>` +
    `<dgm:pt modelId="{D}" type="doc"><dgm:prSet loTypeId="${PROCESS}" ` +
    'loCatId="process" qsTypeId="q" csTypeId="c"/><dgm:spPr/></dgm:pt>' +
    genPoint('{N1}', 'Plan') +
    genPoint('{N2}', 'Pray') +
    genPoint('{N3}', 'Go') +
    '<dgm:pt modelId="{P1}" type="parTrans" cxnId="{C1}"><dgm:prSet/>' +
    '<dgm:spPr/></dgm:pt><dgm:pt modelId="{S1}" type="sibTrans" ' +
    'cxnId="{C1}"><dgm:prSet/><dgm:spPr/></dgm:pt>' +
    '<dgm:pt modelId="{OLD}" type="pres"><dgm:prSet presAssocID="{N1}" ' +
    'presName="node" presStyleLbl="node1"/><dgm:spPr/></dgm:pt>' +
    '</dgm:ptLst><dgm:cxnLst>' +
    '<dgm:cxn modelId="{C1}" srcId="{D}" destId="{N1}" srcOrd="0" ' +
    'destOrd="0" parTransId="{P1}" sibTransId="{S1}"/>' +
    '<dgm:cxn modelId="{C3}" srcId="{D}" destId="{N3}" srcOrd="2" ' +
    'destOrd="0"/>' +
    '<dgm:cxn modelId="{C2}" srcId="{D}" destId="{N2}" srcOrd="1" ' +
    'destOrd="0"/>' +
    '<dgm:cxn modelId="{X1}" type="presOf" srcId="{N1}" destId="{OLD}" ' +
    `srcOrd="0" destOrd="0" presId="${PROCESS}"/>` +
    '</dgm:cxnLst><dgm:bg/><dgm:whole/><dgm:extLst><a:ext uri="d">' +
    `<dsp:dataModelExt ${DSP_NS} relId="rId6"/></a:ext></dgm:extLst>` +
    '</dgm:dataModel>';

function genDrawingNode(x: number, words: string, fill: string) {
    return (
        '<dsp:sp modelId="{OLD}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/>' +
        '<dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off ' +
        `x="${x}" y="0"/><a:ext cx="2400000" cy="1400000"/></a:xfrm>` +
        '<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill>' +
        `<a:srgbClr val="${fill}"/></a:solidFill></dsp:spPr><dsp:txBody>` +
        '<a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3600">' +
        '<a:solidFill><a:srgbClr val="FFFF00"/></a:solidFill></a:rPr>' +
        `<a:t>${words}</a:t></a:r></a:p></dsp:txBody></dsp:sp>`
    );
}

const DRAWING =
    `${HEADER}<dsp:drawing xmlns:dgm="${DGM}" ${DSP_NS} ${A_NS}>` +
    '<dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/>' +
    '<dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>' +
    genDrawingNode(0, 'Plan', '4F81BD') +
    genDrawingNode(3000000, 'Pray', '00B050') +
    genDrawingNode(6000000, 'Go', '4F81BD') +
    '</dsp:spTree></dsp:drawing>';

const COLORS =
    `${HEADER}<dgm:colorsDef xmlns:dgm="${DGM}" ${A_NS} uniqueId="c">` +
    '<dgm:title val=""/><dgm:desc val=""/><dgm:styleLbl name="node1">' +
    '<dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"/>' +
    '</dgm:fillClrLst></dgm:styleLbl></dgm:colorsDef>';

const STYLE =
    `${HEADER}<dgm:styleDef xmlns:dgm="${DGM}" ${A_NS} uniqueId="q">` +
    '<dgm:title val=""/><dgm:desc val=""/><dgm:scene3d><a:camera ' +
    'prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/>' +
    '</dgm:scene3d><dgm:styleLbl name="node1"><dgm:scene3d><a:camera ' +
    'prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/>' +
    '</dgm:scene3d><dgm:sp3d/><dgm:txPr/></dgm:styleLbl></dgm:styleDef>';

// Pray under Plan; Go beside Plan
const NESTED_DATA = DATA.replace(
    '<dgm:cxn modelId="{C2}" srcId="{D}" destId="{N2}" srcOrd="1" ',
    '<dgm:cxn modelId="{C2}" srcId="{N1}" destId="{N2}" srcOrd="0" ',
);

const PARTS = {
    dataXml: DATA,
    drawingXml: DRAWING,
    colorsXml: COLORS,
    styleXml: STYLE,
};

function listTagged(xml: string, pattern: RegExp) {
    return [...xml.matchAll(pattern)].map((match) => {
        return match[0];
    });
}

function readAttr(tag: string, name: string) {
    return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function listPres(dataXml: string) {
    return listTagged(dataXml, /<dgm:pt\b[^>]*type="pres"[\s\S]*?<\/dgm:pt>/g);
}

function listShapes(drawingXml: string) {
    return listTagged(drawingXml, /<dsp:sp\b[\s\S]*?<\/dsp:sp>/g).map(
        (shape) => {
            const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(shape);
            const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape);
            return {
                modelId: readAttr(shape, 'modelId'),
                geometry: /prst="(\w+)"/.exec(shape)?.[1] ?? null,
                rot: Number(/<a:xfrm rot="(\d+)"/.exec(shape)?.[1] ?? 0),
                adj: /fmla="val (\d+)"/.exec(shape)?.[1] ?? null,
                x: Number(off?.[1]),
                y: Number(off?.[2]),
                cx: Number(ext?.[1]),
                cy: Number(ext?.[2]),
                words: /<a:t>([^<]*)<\/a:t>/.exec(shape)?.[1] ?? '',
                size: /<a:rPr\b[^>]*\ssz="(\d+)"/.exec(shape)?.[1] ?? null,
                fill:
                    /<dsp:spPr>[\s\S]*?<a:srgbClr val="(\w+)"/.exec(
                        shape,
                    )?.[1] ?? null,
                wordsColor:
                    /<a:rPr\b[^>]*><a:solidFill><a:srgbClr val="(\w+)"/.exec(
                        shape,
                    )?.[1] ?? null,
            };
        },
    );
}

function changeOk(
    layout: SmartArtLayoutNameType,
    size = { cx: 6000000, cy: 6000000 },
    parts: Parameters<typeof changeSmartArtLayoutXml>[0] = PARTS,
) {
    const result = changeSmartArtLayoutXml(parts, layout, size);
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

describe('changeSmartArtLayoutXml', () => {
    test("a cycle: PowerPoint's Basic Cycle, its points made again for it", () => {
        const result = changeOk('cycle');
        expect(result.words).toEqual(['Plan', 'Pray', 'Go']);
        // the diagram names its new layout
        expect(result.dataXml).toContain(
            'loTypeId="urn:microsoft.com/office/officeart/2005/8/layout/cycle2"',
        );
        expect(result.dataXml).toContain('loCatId="cycle"');
        // the old layout's presentation point and its link are gone
        expect(result.dataXml).not.toContain('{OLD}');
        expect(result.dataXml).not.toContain('{X1}');
        // one for the diagram, one a box, one an arrow after each box (the
        // last back to the first)
        const pres = listPres(result.dataXml);
        expect(
            pres.map((one) => {
                return [
                    readAttr(one, 'presName'),
                    readAttr(one, 'presAssocID')?.startsWith('{N') ||
                        readAttr(one, 'presAssocID') === '{D}' ||
                        readAttr(one, 'presAssocID') === '{S1}' ||
                        readAttr(one, 'presAssocID')?.startsWith('{5A17A900'),
                ];
            }),
        ).toEqual([
            ['cycle', true],
            ['node', true],
            ['sibTrans', true],
            ['node', true],
            ['sibTrans', true],
            ['node', true],
            ['sibTrans', true],
        ]);
        // the boxes in their order, Pray's link read by its srcOrd
        expect(
            pres
                .filter((one) => {
                    return readAttr(one, 'presName') === 'node';
                })
                .map((one) => {
                    return readAttr(one, 'presAssocID');
                }),
        ).toEqual(['{N1}', '{N2}', '{N3}']);
        // Plan's arrow kept its id; Pray's and Go's links were given theirs
        expect(result.dataXml.match(/type="sibTrans"/g)).toHaveLength(3);
        expect(result.dataXml.match(/type="parTrans"/g)).toHaveLength(3);
        expect(result.dataXml).toMatch(
            /<dgm:cxn modelId="\{C2\}"[^>]*parTransId="\{5A17A900-[^"]+\}"[^>]*sibTransId|<dgm:cxn modelId="\{C2\}"[^>]*sibTransId="\{5A17A900-[^"]+\}"[^>]*parTransId/,
        );
        expect(result.dataXml.match(/presParOf/g)).toHaveLength(6);
        expect(
            listTagged(result.dataXml, /<dgm:cxn\b[^>]*presParOf[^>]*>/g).map(
                (one) => {
                    return readAttr(one, 'srcOrd');
                },
            ),
        ).toEqual(['0', '1', '2', '3', '4', '5']);
        // the definition, and the arrows' colour and style added once
        expect(result.layoutXml).toBe(genSmartArtLayoutDefXml('cycle'));
        expect(result.layoutXml).toContain('<dgm:alg type="cycle">');
        expect(result.colorsXml?.match(/name="sibTrans2D1"/g)).toHaveLength(1);
        expect(result.styleXml?.match(/name="sibTrans2D1"/g)).toHaveLength(1);
        expect(result.colorsXml?.match(/name="node1"/g)).toHaveLength(1);
        expect(
            changeOk('cycle', undefined, {
                ...PARTS,
                colorsXml: result.colorsXml,
            }).colorsXml,
        ).toBe(result.colorsXml);
    });

    test("a cycle's drawing: circles round from the top, each arrow turned on", () => {
        const result = changeOk('cycle');
        const shapes = listShapes(result.drawingXml ?? '');
        expect(
            shapes.map((one) => {
                return [one.geometry, one.words, one.rot];
            }),
        ).toEqual([
            ['ellipse', 'Plan', 0],
            ['rightArrow', '', 60 * 60000],
            ['ellipse', 'Pray', 0],
            ['rightArrow', '', 180 * 60000],
            ['ellipse', 'Go', 0],
            ['rightArrow', '', 300 * 60000],
        ]);
        const [plan, , pray, , go] = shapes;
        // Plan at the top in the middle; Pray lower right, Go lower left
        expect(plan.x + plan.cx / 2).toBe(3000000);
        expect(plan.y).toBe(0);
        expect(pray.x).toBeGreaterThan(plan.x);
        expect(go.x).toBeLessThan(plan.x);
        expect(pray.y).toBe(go.y);
        expect(plan.cx).toBe(plan.cy);
        // each drawn shape is the presentation point that draws it
        const presIds = listPres(result.dataXml)
            .slice(1)
            .map((one) => {
                return readAttr(one, 'modelId');
            });
        expect(
            shapes.map((one) => {
                return one.modelId;
            }),
        ).toEqual(presIds);
        // the look each box had stays: Pray was green, words yellow
        expect(
            shapes
                .filter((one) => {
                    return one.words !== '';
                })
                .map((one) => {
                    return [one.fill, one.wordsColor, one.size];
                }),
        ).toEqual([
            ['4F81BD', 'FFFF00', '5500'],
            ['00B050', 'FFFF00', '5500'],
            ['4F81BD', 'FFFF00', '5500'],
        ]);
    });

    test('a process: a row left to right, an arrow between each two', () => {
        const result = changeOk('process', { cx: 8400000, cy: 1400000 });
        expect(result.dataXml).toContain(`loTypeId="${PROCESS}"`);
        expect(
            listPres(result.dataXml).map((one) => {
                return readAttr(one, 'presName');
            }),
        ).toEqual(['Name0', 'node', 'sibTrans', 'node', 'sibTrans', 'node']);
        expect(
            listShapes(result.drawingXml ?? '').map((one) => {
                return [one.geometry, one.x, one.y, one.cx, one.cy];
            }),
        ).toEqual([
            ['roundRect', 0, 36842, 2210526, 1326316],
            ['rightArrow', 2343158, 434737, 618947, 530526],
            ['roundRect', 3094737, 36842, 2210526, 1326316],
            ['rightArrow', 5437895, 434737, 618947, 530526],
            ['roundRect', 6189474, 36842, 2210526, 1326316],
        ]);
    });

    test('a pyramid: levels from the top, narrowest first, no arrows', () => {
        const result = changeOk('pyramid', { cx: 6000000, cy: 3000000 });
        expect(result.layoutXml).toContain('<dgm:alg type="pyra"/>');
        expect(
            listPres(result.dataXml).map((one) => {
                return readAttr(one, 'presName');
            }),
        ).toEqual(['Name0', 'level', 'level', 'level']);
        expect(result.colorsXml).not.toContain('sibTrans2D1');
        expect(
            listShapes(result.drawingXml ?? '').map((one) => {
                return [
                    one.geometry,
                    one.words,
                    one.x,
                    one.y,
                    one.cx,
                    one.cy,
                    one.adj,
                ];
            }),
        ).toEqual([
            ['trapezoid', 'Plan', 2200000, 0, 1600000, 1000000, '80000'],
            ['trapezoid', 'Pray', 1400000, 1000000, 3200000, 1000000, '80000'],
            ['trapezoid', 'Go', 600000, 2000000, 4800000, 1000000, '80000'],
        ]);
    });

    test('what only PowerPoint lays out again is said, and nothing made', () => {
        const nested = NESTED_DATA;
        expect(
            changeSmartArtLayoutXml({ ...PARTS, dataXml: nested }, 'cycle', {
                cx: 1,
                cy: 1,
            }),
        ).toEqual({
            reason:
                'its boxes have boxes of their own under them, which ' +
                "PowerPoint's Basic Cycle shows its own way, so nothing " +
                'changed. Say so and ask: as a Hierarchy -- a tree, each ' +
                'box over the boxes under it -- it is done here ({slide, ' +
                'box, smartArtLayout: "hierarchy"}); as a Basic Cycle it is ' +
                'changed in PowerPoint (SmartArt Design → Layouts).',
        });
        const lonely = DATA.replace(
            /<dgm:cxn modelId="\{C[23]\}"[^>]*\/>/g,
            '',
        );
        expect(
            changeSmartArtLayoutXml({ ...PARTS, dataXml: lonely }, 'pyramid', {
                cx: 1,
                cy: 1,
            }),
        ).toEqual({
            reason:
                "it has fewer than two boxes to lay out as PowerPoint's " +
                'Basic Pyramid.',
        });
        const assistant = DATA.replace(
            '<dgm:pt modelId="{N2}">',
            '<dgm:pt modelId="{N2}" type="asst">',
        );
        expect(
            changeSmartArtLayoutXml({ ...PARTS, dataXml: assistant }, 'cycle', {
                cx: 1,
                cy: 1,
            }),
        ).toEqual({
            reason:
                "it has a box of a kind (an assistant, or one with no words' " +
                'place) that only PowerPoint lays out again.',
        });
        expect(
            changeSmartArtLayoutXml(
                { ...PARTS, dataXml: DATA.replace(' type="doc"', '') },
                'cycle',
                { cx: 1, cy: 1 },
            ),
        ).toEqual({ reason: 'its data part names no diagram.' });
        // no drawing kept: none written
        expect(
            changeOk('cycle', undefined, { ...PARTS, drawingXml: null })
                .drawingXml,
        ).toBeNull();
    });
});

describe('a Venn and a Hierarchy', () => {
    test('a Venn: circles over each other round the middle, half see-through', () => {
        const result = changeOk('venn', { cx: 6000000, cy: 6000000 });
        expect(result.dataXml).toContain(
            'loTypeId="urn:microsoft.com/office/officeart/2005/8/layout/venn1"',
        );
        expect(result.layoutXml).toContain('<dgm:alg type="cycle">');
        expect(
            listPres(result.dataXml).map((one) => {
                return readAttr(one, 'presName');
            }),
        ).toEqual(['Name0', 'circ', 'circ', 'circ']);
        const shapes = listShapes(result.drawingXml ?? '');
        expect(
            shapes.map((one) => {
                return [one.geometry, one.words, one.cx === one.cy];
            }),
        ).toEqual([
            ['ellipse', 'Plan', true],
            ['ellipse', 'Pray', true],
            ['ellipse', 'Go', true],
        ]);
        // each overlaps the next, and is seen through, its own colour kept
        const [plan, pray] = shapes;
        expect(pray.x).toBeLessThan(plan.x + plan.cx);
        expect(pray.y).toBeLessThan(plan.y + plan.cy);
        expect(
            result.drawingXml?.match(/<a:alpha val="50000"\/>/g),
        ).toHaveLength(3);
        expect(result.drawingXml).toContain(
            '<a:srgbClr val="00B050"><a:alpha val="50000"/></a:srgbClr>',
        );
    });

    test('a Hierarchy keeps each box over the boxes under it, joined by lines', () => {
        const result = changeOk(
            'hierarchy',
            { cx: 8000000, cy: 4000000 },
            {
                ...PARTS,
                dataXml: NESTED_DATA,
            },
        );
        expect(result.words).toEqual(['Plan', 'Pray', 'Go']);
        expect(result.layoutXml).toContain(
            '<dgm:forEach name="deeperForEach" ref="repeat"/>',
        );
        // the diagram, then each box's root, words and branch; a line before
        // a box under another
        expect(
            listPres(result.dataXml).map((one) => {
                return readAttr(one, 'presName');
            }),
        ).toEqual([
            'hierChild1',
            'hierRoot1',
            'rootText1',
            'hierChild2',
            'parTrans2',
            'hierRoot2',
            'text2',
            'hierChild3',
            'hierRoot1',
            'rootText1',
            'hierChild2',
        ]);
        // Pray's link to Plan was given its transitions
        expect(result.dataXml).toMatch(
            /<dgm:cxn modelId="\{C2\}" srcId="\{N1\}"[^>]*parTransId="\{5A17A900-/,
        );
        expect(result.colorsXml).toContain('name="parChTrans1D2"');
        expect(result.styleXml).toContain('name="parChTrans1D2"');
        const shapes = listShapes(result.drawingXml ?? '');
        const box = (words: string) => {
            return shapes.find((one) => {
                return one.words === words;
            }) as (typeof shapes)[number];
        };
        // Pray under Plan, Plan and Go side by side on top
        expect(box('Pray').y).toBeGreaterThan(box('Plan').y + box('Plan').cy);
        expect(box('Plan').y).toBe(box('Go').y);
        expect(box('Plan').x + box('Plan').cx / 2).toBe(
            box('Pray').x + box('Pray').cx / 2,
        );
        // one line, drawn before the boxes, from Plan down to Pray
        expect(result.drawingXml?.match(/<a:custGeom>/g)).toHaveLength(1);
        expect(result.drawingXml?.indexOf('<a:custGeom>')).toBeLessThan(
            result.drawingXml?.indexOf('<a:t>Plan</a:t>') ?? 0,
        );
    });

    test('a box under two others, or one of another kind, is said', () => {
        const twice = DATA.replace(
            '</dgm:cxnLst>',
            '<dgm:cxn modelId="{C9}" srcId="{N1}" destId="{N2}" srcOrd="0" ' +
                'destOrd="0"/></dgm:cxnLst>',
        );
        expect(
            changeSmartArtLayoutXml({ ...PARTS, dataXml: twice }, 'hierarchy', {
                cx: 1,
                cy: 1,
            }),
        ).toEqual({
            reason:
                "it has a box of a kind (an assistant, or one with no words' " +
                'place) that only PowerPoint lays out again.',
        });
    });
});

describe('toSmartArtLayoutRoom', () => {
    const strip = { x: 1000000, y: 3000000, cx: 8400000, cy: 1400000 };
    const slide = { cx: 12192000, cy: 6858000 };
    test('a flat strip grows round its middle for a cycle or a pyramid', () => {
        expect(toSmartArtLayoutRoom('cycle', strip, slide)).toEqual({
            ...strip,
            y: 1810000,
            cy: 3780000,
        });
        expect(toSmartArtLayoutRoom('pyramid', strip, slide)).toEqual({
            ...strip,
            y: 1810000,
            cy: 3780000,
        });
    });
    test('a row keeps its place; so does a place tall enough; inside the slide', () => {
        expect(toSmartArtLayoutRoom('process', strip, slide)).toBe(strip);
        const tall = { ...strip, cy: 4000000 };
        expect(toSmartArtLayoutRoom('cycle', tall, slide)).toBe(tall);
        expect(
            toSmartArtLayoutRoom('cycle', { ...strip, y: 6000000 }, slide),
        ).toEqual({ ...strip, y: 3078000, cy: 3780000 });
        expect(toSmartArtLayoutRoom('cycle', strip, null)).toBe(strip);
    });
});

// a deck whose slide holds the SmartArt, with every part PowerPoint writes
const REL =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const NS =
    `${A_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/` +
    '2006/relationships" xmlns:p="http://schemas.openxmlformats.org/' +
    'presentationml/2006/main"';

function genRels(rels: [string, string, string][]) {
    return (
        HEADER +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels
            .map(([id, type, target]) => {
                return `<Relationship Id="${id}" Type="${REL}${type}" Target="${target}"/>`;
            })
            .join('') +
        '</Relationships>'
    );
}

const SLIDE =
    `${HEADER}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr ` +
    'id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr>' +
    '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>' +
    '<a:p><a:r><a:t>Mission</a:t></a:r></a:p></p:txBody></p:sp>' +
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="90" name="Steps ' +
    'Diagram"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>' +
    '<p:xfrm><a:off x="1000000" y="3000000"/><a:ext cx="8400000" ' +
    'cy="1400000"/></p:xfrm><a:graphic><a:graphicData uri="' +
    `${DGM}"><dgm:relIds xmlns:dgm="${DGM}" r:dm="rId2" r:lo="rId3" ` +
    'r:qs="rId4" r:cs="rId5"/></a:graphicData></a:graphic>' +
    '</p:graphicFrame></p:spTree></p:cSld></p:sld>';

async function genDeckBytes() {
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data:
                HEADER +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '</Types>',
        },
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
        },
        {
            fileName: 'ppt/presentation.xml',
            data:
                HEADER +
                `<p:presentation ${NS}><p:sldIdLst>` +
                '<p:sldId id="256" r:id="rId2"/></p:sldIdLst>' +
                '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([['rId2', 'slide', 'slides/slide1.xml']]),
        },
        { fileName: 'ppt/slides/slide1.xml', data: SLIDE },
        {
            fileName: 'ppt/slides/_rels/slide1.xml.rels',
            data: genRels([
                ['rId2', 'diagramData', '../diagrams/data1.xml'],
                ['rId3', 'diagramLayout', '../diagrams/layout1.xml'],
                ['rId4', 'diagramQuickStyle', '../diagrams/quickStyle1.xml'],
                ['rId5', 'diagramColors', '../diagrams/colors1.xml'],
                ['rId6', 'diagramDrawing', '../diagrams/drawing1.xml'],
            ]),
        },
        { fileName: 'ppt/diagrams/data1.xml', data: DATA },
        {
            fileName: 'ppt/diagrams/layout1.xml',
            data:
                `${HEADER}<dgm:layoutDef xmlns:dgm="${DGM}" ` +
                `uniqueId="${PROCESS}"/>`,
        },
        { fileName: 'ppt/diagrams/quickStyle1.xml', data: STYLE },
        { fileName: 'ppt/diagrams/colors1.xml', data: COLORS },
        { fileName: 'ppt/diagrams/drawing1.xml', data: DRAWING },
    ]);
}

async function readDeck(bytes: Uint8Array) {
    const opened = openOfficePackage(bytes);
    if ('reason' in opened) {
        throw new Error(opened.reason);
    }
    const document = await readOfficeDocument(opened.pkg, 'pptx');
    if ('reason' in document || document.kind !== 'pptx') {
        throw new Error('not a deck');
    }
    return { opened, document };
}

async function runOnDeck(
    changes: OfficeAskedChangeType[],
    bytes?: Uint8Array,
    replaces: { from: string; to: string }[] = [],
) {
    const { opened, document } = await readDeck(
        bytes ?? (await genDeckBytes()),
    );
    const result = await applyOfficeChanges(
        opened.pkg,
        document,
        changes,
        replaces,
        new Map(),
    );
    if ('reason' in result) {
        return { reason: result.reason };
    }
    const chunks: Uint8Array[] = [];
    await writeOfficePackage(opened, result.parts, (chunk) => {
        chunks.push(chunk);
    });
    const written = concatBytes(chunks);
    const after = await readDeck(written);
    const read = async (name: string) => {
        return (await after.opened.pkg.readText(name)) ?? '';
    };
    return {
        changed: result.changed,
        document: after.document,
        slide: await read('ppt/slides/slide1.xml'),
        data: await read('ppt/diagrams/data1.xml'),
        layout: await read('ppt/diagrams/layout1.xml'),
        colors: await read('ppt/diagrams/colors1.xml'),
        drawing: await read('ppt/diagrams/drawing1.xml'),
        partNames: [...result.parts.keys()].sort(),
        written,
    };
}

async function runOk(
    changes: OfficeAskedChangeType[],
    bytes?: Uint8Array,
    replaces: { from: string; to: string }[] = [],
) {
    const out = await runOnDeck(changes, bytes, replaces);
    if ('reason' in out) {
        throw new Error(out.reason);
    }
    return out;
}

describe('a SmartArt given another layout in a deck', () => {
    test('a process made a cycle: still a SmartArt, grown to fit, said', async () => {
        const out = await runOk([
            { slide: 1, box: 'Steps Diagram', smartArtLayout: 'cycle' },
        ]);
        expect(out.changed).toEqual([
            'The SmartArt "Steps Diagram" on slide 1 has PowerPoint\'s ' +
                'Basic Cycle (its boxes round a circle, clockwise from the ' +
                'top, an arrow from each to the next) as its layout now, and ' +
                'is still a SmartArt, in at [8, 26, 69, 55] of the slide ' +
                '(another `at` lays it out bigger): “Plan”, “Pray”, “Go”. ' +
                'PowerPoint lays it out again its own way as it opens it; ' +
                'its words and the colours of its boxes stay.',
        ]);
        expect(out.partNames).toEqual([
            'ppt/diagrams/colors1.xml',
            'ppt/diagrams/data1.xml',
            'ppt/diagrams/drawing1.xml',
            'ppt/diagrams/layout1.xml',
            'ppt/diagrams/quickStyle1.xml',
            'ppt/slides/slide1.xml',
        ]);
        // the frame grown round its middle; still a SmartArt on the slide
        expect(out.slide).toContain(
            '<a:off x="1000000" y="1810000"/><a:ext cx="8400000" cy="3780000"/>',
        );
        expect(out.slide).toContain('<dgm:relIds');
        expect(out.layout).toBe(genSmartArtLayoutDefXml('cycle'));
        // read again, it is the same SmartArt with the same words
        const box = out.document.slides[0].boxes.find((one) => {
            return one.name === 'Steps Diagram';
        });
        expect(box?.kind).toBe('smartart');
        expect(box?.smartArt?.words).toEqual(['Plan', 'Pray', 'Go']);
        // its drawing is the circle the parts were written for
        expect(
            listShapes(out.drawing).map((one) => {
                return one.geometry;
            }),
        ).toEqual([
            'ellipse',
            'rightArrow',
            'ellipse',
            'rightArrow',
            'ellipse',
            'rightArrow',
        ]);
    });

    test('a layout and a turn into shapes in one call: one is asked for', async () => {
        expect(
            await runOnDeck([
                { slide: 1, box: 'Steps Diagram', smartArtLayout: 'cycle' },
                { slide: 1, box: 'steps diagram', toShapes: true },
            ]),
        ).toEqual({
            reason:
                '`smartArtLayout` keeps it a SmartArt and `toShapes` turns ' +
                'it into shapes: send the one they asked for.',
        });
    });

    test('given a layout, its words then change, and it turns into the shapes drawn', async () => {
        const cycle = await runOk([
            { slide: 1, box: 'Steps Diagram', smartArtLayout: 'cycle' },
        ]);
        const worded = await runOk([], cycle.written, [
            { from: 'Pray', to: 'Worship' },
        ]);
        expect(worded.data).toContain('<a:t>Worship</a:t>');
        expect(worded.drawing).toContain('<a:t>Worship</a:t>');
        const shapes = await runOk(
            [{ slide: 1, box: 'Steps Diagram', toShapes: true }],
            worded.written,
        );
        expect(shapes.changed[0]).toContain(
            '"Plan", "Worship", "Go", and 3 without words',
        );
        expect(shapes.slide).not.toContain('<dgm:relIds');
        expect(shapes.slide.match(/prst="ellipse"/g)).toHaveLength(3);
    });

    test('a row keeps its place; `at` gives another', async () => {
        const row = await runOk([
            { slide: 1, box: 'Steps Diagram', smartArtLayout: 'process' },
        ]);
        expect(row.changed[0]).toContain(
            'is still a SmartArt: “Plan”, “Pray”, “Go”.',
        );
        expect(row.slide).toContain(
            '<a:off x="1000000" y="3000000"/><a:ext cx="8400000" cy="1400000"/>',
        );
        const placed = await runOk([
            {
                slide: 1,
                box: 'Steps Diagram',
                smartArtLayout: 'pyramid',
                at: [25, 10, 50, 80],
            },
        ]);
        expect(placed.slide).toContain(
            '<a:off x="3048000" y="685800"/><a:ext cx="6096000" cy="5486400"/>',
        );
        expect(placed.changed[0]).toContain(
            "PowerPoint's Basic Pyramid (its boxes as the levels of a " +
                'pyramid, the first at the top)',
        );
    });

    test('another layout, another key, or no SmartArt is said and nothing changes', async () => {
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    smartArtLayout: 'orgChart',
                },
            ]),
        ).toEqual({
            // a layout no SmartArt of the deck has (EC-787)
            reason:
                'The SmartArt "Steps Diagram" on slide 1: no SmartArt of ' +
                'this deck has the layout "orgChart" (theirs: "process1"). ' +
                'Here it is "cycle" | "process" | "pyramid" | "venn" | ' +
                '"hierarchy" or one of theirs; any other is PowerPoint\'s ' +
                '(SmartArt Design → Layouts). A column of plain shapes is ' +
                '{slide, box, toShapes: true, arrange: "column"}, after ' +
                'which it is no longer a SmartArt (ask first).',
        });
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    smartArtLayout: 'cycle',
                    fill: 'green',
                },
            ]),
        ).toEqual({
            reason:
                '`smartArtLayout` takes `slide`, `box` and `at` alone; send ' +
                '`fill` apart, in a change of its own after it.',
        });
        expect(
            await runOnDeck([
                { slide: 1, box: 'Title 1', smartArtLayout: 'cycle' },
            ]),
        ).toEqual({
            reason:
                '"Title 1" on slide 1 is a box of words, no SmartArt: only ' +
                'a SmartArt takes a SmartArt layout.',
        });
        expect(
            await runOnDeck([{ slide: 1, smartArtLayout: 'cycle' }]),
        ).toEqual({
            reason:
                '`smartArtLayout` gives the SmartArt named by `box` another ' +
                "of PowerPoint's layouts: {slide, box, smartArtLayout}.",
        });
    });
});
