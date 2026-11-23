import { describe, expect, test } from 'vitest';

import { concatBytes, toZipBytes } from './officeZipHelpers';
import {
    type OfficeAskedChangeType,
    applyOfficeChanges,
    readOfficeDocument,
    toOfficeReadResult,
} from './officePackageEditHelpers';
import {
    openOfficePackage,
    writeOfficePackage,
} from './officePackageIoHelpers';
import {
    convertSmartArtToShapesXml,
    describeSmartArtShapes,
} from './officeSmartArtShapeHelpers';
import { setBoxShapeXml } from './officeSlideBoxHelpers';

// A SmartArt turned into the shapes it is drawn with, then those shapes
// changed as any box is (2026-11-21, the goal "chatbot can change do
// everything on a given pptx": a SmartArt's shape and colour had been
// PowerPoint's).

const REL =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const NS =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const GROUP =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
    '</p:nvGrpSpPr><p:grpSpPr/>';
const DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';

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

const FRAME =
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="90" name="Steps ' +
    'Diagram"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>' +
    '<p:xfrm><a:off x="1000000" y="3000000"/><a:ext cx="8400000" ' +
    'cy="1400000"/></p:xfrm><a:graphic><a:graphicData uri="' +
    `${DGM}"><dgm:relIds xmlns:dgm="${DGM}" r:dm="rId2" r:lo="rId3" ` +
    'r:qs="rId4" r:cs="rId5"/></a:graphicData></a:graphic></p:graphicFrame>';

const SLIDE =
    `${HEADER}<p:sld ${NS}><p:cSld><p:spTree>${GROUP}` +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr>' +
    '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>' +
    '<a:p><a:r><a:t>Mission</a:t></a:r></a:p></p:txBody></p:sp>' +
    FRAME +
    '</p:spTree></p:cSld></p:sld>';

function genNode(x: number, words: string) {
    return (
        '<dsp:sp modelId="{1}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/>' +
        '<dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off ' +
        `x="${x}" y="0"/><a:ext cx="2400000" cy="1400000"/></a:xfrm>` +
        '<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill>' +
        '<a:srgbClr val="4F81BD"/></a:solidFill></dsp:spPr><dsp:style>' +
        '<a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>' +
        '</dsp:style><dsp:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p>' +
        `<a:r><a:rPr lang="en-US" sz="3600"/><a:t>${words}</a:t></a:r>` +
        '</a:p></dsp:txBody><dsp:txXfrm><a:off x="0" y="0"/><a:ext ' +
        'cx="1" cy="1"/></dsp:txXfrm></dsp:sp>'
    );
}

const ARROW =
    '<dsp:sp modelId="{9}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/>' +
    '<dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="2500000" ' +
    'y="500000"/><a:ext cx="400000" cy="400000"/></a:xfrm><a:prstGeom ' +
    'prst="rightArrow"><a:avLst/></a:prstGeom><a:extLst><a:ext uri="x">' +
    '<a14:hiddenFill xmlns:a14="y"/></a:ext></a:extLst></dsp:spPr></dsp:sp>';

function genDrawing(shapes: string) {
    return (
        `${HEADER}<dsp:drawing xmlns:dgm="${DGM}" xmlns:dsp="http://schemas.` +
        'microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.' +
        'openxmlformats.org/drawingml/2006/main"><dsp:spTree><dsp:nvGrpSpPr>' +
        '<dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr>' +
        `<dsp:grpSpPr/>${shapes}</dsp:spTree></dsp:drawing>`
    );
}

const DRAWING = genDrawing(
    genNode(0, 'Plan') + ARROW + genNode(3000000, 'Pray &amp; Go'),
);

const DATA =
    `${HEADER}<dgm:dataModel xmlns:dgm="${DGM}" ` +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<dgm:ptLst><dgm:pt modelId="{A}"><dgm:t><a:bodyPr/><a:p><a:r>' +
    '<a:t>Plan</a:t></a:r></a:p></dgm:t></dgm:pt><dgm:pt modelId="{B}">' +
    '<dgm:t><a:bodyPr/><a:p><a:r><a:t>Pray &amp; Go</a:t></a:r></a:p>' +
    '</dgm:t></dgm:pt></dgm:ptLst><dgm:extLst><a:ext uri="d"><dsp:' +
    'dataModelExt xmlns:dsp="http://schemas.microsoft.com/office/drawing/' +
    '2008/diagram" relId="rId6"/></a:ext></dgm:extLst></dgm:dataModel>';

async function genDeckBytes(drawing = DRAWING) {
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
        { fileName: 'ppt/diagrams/drawing1.xml', data: drawing },
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

async function runOnDeck(changes: OfficeAskedChangeType[], bytes?: Uint8Array) {
    const { opened, document } = await readDeck(
        bytes ?? (await genDeckBytes()),
    );
    const result = await applyOfficeChanges(
        opened.pkg,
        document,
        changes,
        [],
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
    return {
        written,
        changed: result.changed,
        document: after.document,
        slide: (await after.opened.pkg.readText('ppt/slides/slide1.xml')) ?? '',
    };
}

async function runOk(changes: OfficeAskedChangeType[], bytes?: Uint8Array) {
    const out = await runOnDeck(changes, bytes);
    if ('reason' in out) {
        throw new Error(out.reason);
    }
    return out;
}

describe('convertSmartArtToShapesXml', () => {
    const start = SLIDE.indexOf('<p:graphicFrame>');
    const end = SLIDE.indexOf('</p:graphicFrame>') + '</p:graphicFrame>'.length;
    const frame = { start, end, name: 'Steps Diagram' };

    test('each shape in its place on the slide, named by its words', () => {
        const out = convertSmartArtToShapesXml(SLIDE, frame, DRAWING, [
            'Title 1',
            'Steps Diagram',
        ]);
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.shapes).toEqual([
            { name: 'Plan', words: 'Plan' },
            { name: 'Steps Diagram shape 1', words: '' },
            { name: 'Pray & Go', words: 'Pray & Go' },
        ]);
        expect(out.xml).not.toContain('graphicFrame');
        expect(out.xml).not.toContain('dsp:');
        expect(out.xml).not.toContain('a14:');
        expect(out.xml).toContain(
            '<p:cNvPr id="91" name="Plan"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
                '<p:spPr><a:xfrm><a:off x="1000000" y="3000000"/>',
        );
        expect(out.xml).toContain('<a:off x="3500000" y="3500000"/>');
        expect(out.xml).toContain('name="Pray &amp; Go"');
        expect(out.xml).toContain('<a:off x="4000000" y="3000000"/>');
        // the title before it, in the order it was
        expect(out.xml.indexOf('Title 1')).toBeLessThan(
            out.xml.indexOf('name="Plan"'),
        );
        expect(describeSmartArtShapes(out.shapes)).toBe(
            '"Plan", "Pray & Go", and 1 without words ("Steps Diagram shape 1")',
        );
    });

    test('a name the slide already has gets a number', () => {
        const out = convertSmartArtToShapesXml(SLIDE, frame, DRAWING, ['plan']);
        expect('reason' in out ? [] : out.shapes[0].name).toBe('Plan (2)');
    });

    test('a picture, a group or no drawing to read is said', () => {
        const picture = genDrawing(
            genNode(0, 'x').replace(
                '<a:solidFill>',
                '<a:blipFill><a:blip r:embed="rId1"/></a:blipFill><a:solidFill>',
            ),
        );
        expect(convertSmartArtToShapesXml(SLIDE, frame, picture, [])).toEqual({
            reason:
                'it holds a picture or a part this cannot carry onto the ' +
                'slide: PowerPoint turns it into shapes (SmartArt → ' +
                'Convert → Convert to Shapes).',
        });
        expect(
            convertSmartArtToShapesXml(
                SLIDE,
                frame,
                genDrawing('<dsp:grpSp></dsp:grpSp>'),
                [],
            ),
        ).toMatchObject({
            reason: expect.stringMatching(/^its shapes are drawn in groups/),
        });
        expect(
            convertSmartArtToShapesXml(SLIDE, frame, '<x/>', []),
        ).toMatchObject({
            reason: expect.stringMatching(/^its drawing could not be read/),
        });
        expect(
            convertSmartArtToShapesXml(SLIDE, frame, genDrawing(''), []),
        ).toEqual({ reason: 'it draws no shapes.' });
    });
});

// where each shape went: its name, place, size, turn and words' size
function readPlaced(xml: string) {
    return [...xml.matchAll(/<p:sp>[^]*?<\/p:sp>/g)].flatMap((shape) => {
        const matched =
            /<p:cNvPr id="\d+" name="([^"]*)"\/>[^]*?<a:xfrm( rot="(\d+)")?><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(
                shape[0],
            );
        if (matched === null) {
            return [];
        }
        return [
            {
                name: matched[1].replace(/&amp;/g, '&'),
                rot: matched[3] === undefined ? 0 : Number(matched[3]),
                x: Number(matched[4]),
                y: Number(matched[5]),
                cx: Number(matched[6]),
                cy: Number(matched[7]),
                sz: /sz="(\d+)"/.exec(shape[0])?.[1] ?? null,
            },
        ];
    });
}

describe('a SmartArt laid out as it becomes shapes (arrange)', () => {
    const start = SLIDE.indexOf('<p:graphicFrame>');
    const end = SLIDE.indexOf('</p:graphicFrame>') + '</p:graphicFrame>'.length;
    const frame = { start, end, name: 'Steps Diagram' };
    const THREE = genDrawing(
        genNode(0, 'Plan') +
            ARROW +
            genNode(3000000, 'Pray') +
            ARROW +
            genNode(6000000, 'Go'),
    );

    function convert(drawing: string, arrange: 'cycle' | 'row' | 'column') {
        const out = convertSmartArtToShapesXml(SLIDE, frame, drawing, [], {
            arrange,
        });
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        return { ...out, placed: readPlaced(out.xml) };
    }

    test('a row: left to right in its place, an arrow between', () => {
        const { placed } = convert(DRAWING, 'row');
        expect(placed).toEqual([
            {
                name: 'Plan',
                rot: 0,
                x: 1900000,
                y: 3000000,
                cx: 2400000,
                cy: 1400000,
                sz: '3600',
            },
            {
                name: 'Steps Diagram shape 1',
                rot: 0,
                x: 5000000,
                y: 3500000,
                cx: 400000,
                cy: 400000,
                sz: null,
            },
            {
                name: 'Pray & Go',
                rot: 0,
                x: 6100000,
                y: 3000000,
                cx: 2400000,
                cy: 1400000,
                sz: '3600',
            },
        ]);
    });

    test('a column: top to bottom, smaller to fit, its arrow turned down', () => {
        const { placed } = convert(DRAWING, 'column');
        expect(placed.map((one) => one.name)).toEqual([
            'Plan',
            'Steps Diagram shape 1',
            'Pray & Go',
        ]);
        expect(placed[0]).toMatchObject({
            x: 4780000,
            y: 3105000,
            cx: 840000,
            cy: 490000,
            sz: '1300',
        });
        expect(placed[1]).toMatchObject({
            rot: 5400000,
            x: 5126500,
            y: 3626500,
            cx: 147000,
            cy: 147000,
        });
        expect(placed[2]).toMatchObject({ x: 4780000, y: 3805000 });
    });

    test('a cycle: round from the top, clockwise, the last arrow back to the first', () => {
        const { placed, shapes } = convert(THREE, 'cycle');
        // three boxes and three arrows: the third a copy of the first
        expect(shapes.map((one) => one.name)).toEqual([
            'Plan',
            'Steps Diagram shape 1',
            'Pray',
            'Steps Diagram shape 2',
            'Go',
            'Steps Diagram shape 3',
        ]);
        const [plan, toPray, pray, toGo, go, back] = placed;
        const centre = (one: (typeof placed)[number]) => {
            return [one.x + one.cx / 2, one.y + one.cy / 2];
        };
        // the frame's middle is (5 200 000, 3 700 000)
        expect(centre(plan)[0]).toBeCloseTo(5200000, -1);
        expect(centre(plan)[1]).toBeLessThan(3700000);
        expect(centre(pray)[0]).toBeGreaterThan(5200000);
        expect(centre(pray)[1]).toBeGreaterThan(3700000);
        expect(centre(go)[0]).toBeLessThan(5200000);
        expect(centre(go)[1]).toBeCloseTo(centre(pray)[1], -1);
        // down-right, then left, then up-right: each to the next
        expect([toPray.rot, toGo.rot, back.rot]).toEqual([
            3600000, 10800000, 18000000,
        ]);
        // small enough for the frame's 1 400 000 height, never under 8pt
        expect(plan.cy).toBeLessThan(700000);
        expect(plan.sz).toBe('800');
        // every shape inside the frame
        for (const one of placed) {
            expect(one.x).toBeGreaterThanOrEqual(1000000);
            expect(one.y).toBeGreaterThanOrEqual(3000000);
            expect(one.x + one.cx).toBeLessThanOrEqual(9400000);
            expect(one.y + one.cy).toBeLessThanOrEqual(4400000);
        }
    });

    test('fewer than two boxes with words, or no size, is said', () => {
        expect(
            convertSmartArtToShapesXml(
                SLIDE,
                frame,
                genDrawing(genNode(0, 'Plan') + ARROW),
                [],
                { arrange: 'cycle' },
            ),
        ).toEqual({
            reason: 'it has fewer than two boxes with words to lay out in a cycle.',
        });
        const sizeless = SLIDE.replace(
            /<a:ext cx="8400000" cy="1400000"\/>/,
            '',
        );
        expect(
            convertSmartArtToShapesXml(
                sizeless,
                {
                    start: sizeless.indexOf('<p:graphicFrame>'),
                    end:
                        sizeless.indexOf('</p:graphicFrame>') +
                        '</p:graphicFrame>'.length,
                    name: 'Steps Diagram',
                },
                DRAWING,
                [],
                { arrange: 'row' },
            ),
        ).toEqual({ reason: 'it has no size of its own on the slide.' });
    });

    test('in a deck: turned, laid out and filled in one change; said', async () => {
        const out = await runOk([
            {
                slide: 1,
                box: 'Steps Diagram',
                toShapes: true,
                arrange: 'row',
                fill: 'green',
            },
        ]);
        expect(out.changed[0]).toMatch(
            /^The SmartArt "Steps Diagram" on slide 1 is now shapes of the slide, as PowerPoint's Convert to Shapes makes it, laid out in a row, left to right, an arrow between each two, in at \[8, 44, 69, 20\] of the slide \(another `at` lays it out bigger\): "Plan", "Pray & Go", and 1 without words/,
        );
        expect(out.slide.match(/<a:srgbClr val="008000"\/>/g)).toHaveLength(2);
        const noArrow = await runOk(
            [
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    arrange: 'column',
                },
            ],
            await genDeckBytes(
                genDrawing(genNode(0, 'Plan') + genNode(3000000, 'Go')),
            ),
        );
        expect(noArrow.changed[0]).toContain(
            'laid out in a column, top to bottom, in at [8, 44, 69, 20] of ' +
                'the slide (another `at` lays it out bigger): "Plan", "Go".',
        );
    });

    test('a cycle in a flat strip grows round its middle to half-size boxes', async () => {
        const out = await runOk(
            [
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    arrange: 'cycle',
                },
            ],
            await genDeckBytes(
                genDrawing(
                    genNode(0, 'Plan') +
                        ARROW +
                        genNode(3000000, 'Pray') +
                        ARROW +
                        genNode(6000000, 'Go'),
                ),
            ),
        );
        // the strip was [8, 44, 69, 20]: as wide, taller, round its middle
        expect(out.changed[0]).toContain(
            'in at [8, 32, 69, 44] of the slide (another `at` lays it out bigger)',
        );
        const [plan] = readPlaced(out.slide).filter((one) => {
            return one.name === 'Plan';
        });
        expect(plan).toMatchObject({ cx: 1200000, cy: 700000, sz: '1800' });
    });

    test('a cycle given a bigger place by `at`, and `at` alone said', async () => {
        const out = await runOk(
            [
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    arrange: 'cycle',
                    at: [25, 10, 50, 80],
                },
            ],
            await genDeckBytes(
                genDrawing(
                    genNode(0, 'Plan') +
                        ARROW +
                        genNode(3000000, 'Pray') +
                        ARROW +
                        genNode(6000000, 'Go'),
                ),
            ),
        );
        expect(out.changed[0]).toContain(
            'in at [25, 10, 50, 80] of the slide (another `at` lays it out bigger)',
        );
        const placed = readPlaced(out.slide).filter((one) => {
            return one.name !== 'Title 1';
        });
        expect(placed).toHaveLength(6);
        for (const one of placed) {
            expect(one.x).toBeGreaterThanOrEqual(3048000);
            expect(one.y).toBeGreaterThanOrEqual(685800);
            expect(one.x + one.cx).toBeLessThanOrEqual(9144000);
            expect(one.y + one.cy).toBeLessThanOrEqual(6172200);
        }
        // a square of 5 486 400: boxes much bigger than the strip's
        expect(placed[0].cy).toBeGreaterThan(800000);
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    at: [25, 10, 50, 80],
                },
            ]),
        ).toEqual({
            reason:
                '`at` with `toShapes` is the place to lay its boxes out in: ' +
                'give `arrange` too, or send `at` apart, after it, to each ' +
                'shape by its name.',
        });
    });

    test('asked without the turn, or another layout, it is said and nothing changes', async () => {
        expect(
            await runOnDeck([
                { slide: 1, box: 'Steps Diagram', arrange: 'cycle' },
            ]),
        ).toEqual({
            reason:
                "`arrange` lays a SmartArt's boxes out as it is turned into " +
                'shapes, after which it is no longer a SmartArt: {slide, ' +
                'box, toShapes: true, arrange}. Say so and ask; on their ' +
                'yes send that.',
        });
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    arrange: 'pyramid' as 'cycle',
                },
            ]),
        ).toEqual({
            reason:
                '`arrange` is "cycle", "row" or "column"; a SmartArt kept ' +
                'a SmartArt is given another layout by {slide, box, ' +
                'smartArtLayout: "cycle" | "process" | "pyramid" | "venn" | ' +
                '"hierarchy"}, and any ' +
                "other layout is PowerPoint's (SmartArt Design → Layouts).",
        });
    });
});

describe('a SmartArt in a deck', () => {
    test('turned into shapes, which then take a fill and a shape place', async () => {
        const out = await runOk([
            { slide: 1, box: 'Steps Diagram', toShapes: true },
        ]);
        expect(out.changed).toEqual([
            'The SmartArt "Steps Diagram" on slide 1 is now shapes of the ' +
                "slide, as PowerPoint's Convert to Shapes makes it: " +
                '"Plan", "Pray & Go", and 1 without words ("Steps Diagram ' +
                'shape 1"). Its words and look stay; it no longer lays ' +
                'itself out as a SmartArt. Now make the change they asked for ' +
                'on these shapes, by their names, in the next call -- not ' +
                'asked again.',
        ]);
        const read = toOfficeReadResult(out.document);
        expect(JSON.stringify(read)).toContain('"name":"Pray & Go"');
        expect(JSON.stringify(read)).not.toContain('smartart');
        const green = await runOk(
            [
                { slide: 1, box: 'Plan', fill: 'green' },
                { slide: 1, box: 'Pray & Go', fill: 'green', rotate: 10 },
            ],
            out.written,
        );
        expect(green.slide.match(/<a:srgbClr val="008000"\/>/g)).toHaveLength(
            2,
        );
        expect(green.slide).not.toContain('4F81BD');
        expect(green.slide).toContain('rot="600000"');
    });

    test('turned with its boxes given the fill asked for, in one change', async () => {
        const out = await runOk([
            {
                slide: 1,
                box: 'Steps Diagram',
                toShapes: true,
                fill: 'green',
            },
        ]);
        // the two boxes with words, never the arrow between them
        expect(out.slide.match(/<a:srgbClr val="008000"\/>/g)).toHaveLength(2);
        expect(out.slide).not.toContain('4F81BD');
        expect(out.slide).toMatch(/name="Steps Diagram shape 1"[^]*rightArrow/);
        expect(out.changed[0]).toMatch(
            / Its boxes with words are now filled green[^.]*\.$/,
        );
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    fill: 'not a colour',
                },
            ]),
        ).toMatchObject({ reason: expect.stringMatching(/fill/) });
    });

    test('a look aimed at the SmartArt says how, and changes nothing', async () => {
        expect(
            await runOnDeck([
                { slide: 1, box: 'Steps Diagram', fill: 'green' },
            ]),
        ).toMatchObject({
            reason: expect.stringContaining(
                '{slide, box, toShapes: true} turns it into shapes first',
            ),
        });
    });

    test('toShapes alone, on a SmartArt alone', async () => {
        expect(
            await runOnDeck([
                {
                    slide: 1,
                    box: 'Steps Diagram',
                    toShapes: true,
                    rotate: 10,
                },
            ]),
        ).toEqual({
            reason:
                '`toShapes` takes the `fill`, `outline` and `transparency` ' +
                "of the SmartArt's boxes; send `rotate` apart, after it, to " +
                'the shapes by the names the answer gives.',
        });
        expect(
            await runOnDeck([{ slide: 1, box: 'Title 1', toShapes: true }]),
        ).toEqual({
            reason:
                '"Title 1" on slide 1 is a box of words, no SmartArt: it is ' +
                'changed as it is.',
        });
        expect(await runOnDeck([{ slide: 1, toShapes: true }])).toMatchObject({
            reason: expect.stringMatching(/^`toShapes: true` turns/),
        });
    });
});

describe('setBoxShapeXml', () => {
    test("a box's geometry swapped, its place and fill kept", () => {
        expect(
            setBoxShapeXml(
                '<p:sp><p:spPr><a:xfrm><a:off x="1" y="2"/></a:xfrm>' +
                    '<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>' +
                    '<a:solidFill/></p:spPr></p:sp>',
                'ellipse',
            ),
        ).toBe(
            '<p:sp><p:spPr><a:xfrm><a:off x="1" y="2"/></a:xfrm>' +
                '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>' +
                '<a:solidFill/></p:spPr></p:sp>',
        );
    });

    test('a placeholder with no geometry of its own gets one', () => {
        expect(
            setBoxShapeXml('<p:sp><p:spPr/><p:txBody/></p:sp>', 'star5'),
        ).toBe(
            '<p:sp><p:spPr><a:prstGeom prst="star5"><a:avLst/></a:prstGeom>' +
                '</p:spPr><p:txBody/></p:sp>',
        );
        expect(
            setBoxShapeXml(
                '<p:sp><p:spPr bwMode="auto"><a:xfrm><a:off x="1" y="2"/>' +
                    '</a:xfrm><a:solidFill/></p:spPr></p:sp>',
                'heart',
            ),
        ).toBe(
            '<p:sp><p:spPr bwMode="auto"><a:xfrm><a:off x="1" y="2"/>' +
                '</a:xfrm><a:prstGeom prst="heart"><a:avLst/></a:prstGeom>' +
                '<a:solidFill/></p:spPr></p:sp>',
        );
    });

    test("a picture's own outline (crop to shape), or none to hold it", () => {
        expect(
            setBoxShapeXml(
                '<p:pic><p:spPr><a:custGeom><a:pathLst/></a:custGeom>' +
                    '</p:spPr></p:pic>',
                'ellipse',
            ),
        ).toBe(
            '<p:pic><p:spPr><a:prstGeom prst="ellipse"><a:avLst/>' +
                '</a:prstGeom></p:spPr></p:pic>',
        );
        expect(setBoxShapeXml('<p:graphicFrame/>', 'ellipse')).toBeNull();
    });
});

describe("a box's shape changed in a deck", () => {
    test('a SmartArt turned, then one of its boxes a red circle', async () => {
        const turned = await runOk([
            { slide: 1, box: 'Steps Diagram', toShapes: true },
        ]);
        const out = await runOk(
            [{ slide: 1, box: 'Plan', shape: 'circle', fill: 'red' }],
            turned.written,
        );
        expect(out.slide).toMatch(
            /name="Plan"[^]*?<a:prstGeom prst="ellipse">[^]*?FF0000/,
        );
        expect(out.slide.match(/prst="roundRect"/g)).toHaveLength(1);
        expect(out.changed[0]).toBe(
            '"Plan" on slide 1 is now an oval, its place, colours and words ' +
                'as they were.',
        );
    });

    test('the title, a placeholder, made a star', async () => {
        const out = await runOk([{ slide: 1, box: 'Title 1', shape: 'star' }]);
        expect(out.slide).toMatch(
            /name="Title 1"[^]*?<p:spPr><a:prstGeom prst="star5">/,
        );
    });

    test('a line, a SmartArt or a new box beside it is said', async () => {
        expect(
            await runOnDeck([{ slide: 1, box: 'Title 1', shape: 'line' }]),
        ).toEqual({
            reason:
                'A box cannot become a line: add one with {slide, shape: ' +
                '"line", at}.',
        });
        expect(
            await runOnDeck([
                { slide: 1, box: 'Steps Diagram', shape: 'circle' },
            ]),
        ).toEqual({
            reason:
                '"Steps Diagram" on slide 1 is a smartart: only a box of ' +
                'words, a shape or a picture takes another shape. A SmartArt ' +
                'is given another layout, still a SmartArt, by {slide, box, ' +
                'smartArtLayout: "cycle" | "process" | "pyramid" | "venn" | ' +
                '"hierarchy"}, or turned ' +
                'into shapes first ({slide, box, toShapes: true}; arrange: ' +
                '"cycle", "row" or "column" lays its boxes out so).',
        });
        expect(
            await runOnDeck([
                { slide: 1, box: 'Title 1', shape: 'circle', textBox: 'x' },
            ]),
        ).toMatchObject({
            reason: expect.stringMatching(/^`shape` with `box` gives/),
        });
    });
});
