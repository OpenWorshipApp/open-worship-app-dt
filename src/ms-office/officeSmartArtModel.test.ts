import { describe, expect, test } from 'vitest';

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
    SMARTART_LAYOUT_LIST,
    type SmartArtLayoutNameType,
    changeSmartArtLayoutXml,
    listConnections,
    listPoints,
} from './officeSmartArtLayoutHelpers';
import {
    checkSmartArtPresMatches,
    copyMissingStyleLabels,
    editSmartArtBoxesXml,
    genSmartArtPresXml,
    listSmartArtBoxWords,
    parseSmartArtXmlTree,
    readSmartArtLayoutId,
    removeSmartArtDrawingLink,
} from './officeSmartArtModelHelpers';
import { concatBytes, toZipBytes } from './officeZipHelpers';

// A SmartArt's boxes added, taken out or moved in ANY layout, and a layout
// taken from another SmartArt of the deck (2026-11-21, EC-787). The engine
// was measured against 55 SmartArts PowerPoint saved (LibreOffice's own test
// decks, 34 layouts): 54 came out as PowerPoint wrote them, the 55th a
// definition edited by hand, which `checkSmartArtPresMatches` refuses.

const DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const DSP_NS =
    'xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"';

function genPoint(id: string, words: string) {
    return (
        `<dgm:pt modelId="${id}"><dgm:prSet phldrT="[Text]"/><dgm:spPr/>` +
        '<dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" ' +
        `sz="2400" dirty="0"/><a:t>${words}</a:t></a:r></a:p></dgm:t></dgm:pt>`
    );
}

function genLink(id: string, src: string, dest: string, order: number) {
    return (
        `<dgm:cxn modelId="${id}" srcId="${src}" destId="${dest}" ` +
        `srcOrd="${order}" destOrd="0" parTransId="{P-${id}}" ` +
        `sibTransId="{S-${id}}"/>`
    );
}

function genTransitions(id: string) {
    return (
        `<dgm:pt modelId="{P-${id}}" type="parTrans" cxnId="${id}">` +
        '<dgm:prSet/><dgm:spPr/></dgm:pt>' +
        `<dgm:pt modelId="{S-${id}}" type="sibTrans" cxnId="${id}">` +
        '<dgm:prSet/><dgm:spPr/></dgm:pt>'
    );
}

// boxes as [id, words, parent id]; the doc is {D}
function genData(boxes: [string, string, string][], extra = '') {
    const orderMap = new Map<string, number>();
    const points = boxes
        .map(([id, words]) => {
            return genPoint(id, words) + genTransitions(`{C${id}}`);
        })
        .join('');
    const links = boxes
        .map(([id, , parent]) => {
            const order = orderMap.get(parent) ?? 0;
            orderMap.set(parent, order + 1);
            return genLink(`{C${id}}`, parent, id, order);
        })
        .join('');
    return (
        `${HEADER}<dgm:dataModel xmlns:dgm="${DGM}" ${A_NS}><dgm:ptLst>` +
        '<dgm:pt modelId="{D}" type="doc"><dgm:prSet loTypeId="x" ' +
        'loCatId="list"/><dgm:spPr/></dgm:pt>' +
        points +
        extra +
        `</dgm:ptLst><dgm:cxnLst>${links}</dgm:cxnLst><dgm:bg/><dgm:whole/>` +
        '<dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/' +
        `drawing/2008/diagram"><dsp:dataModelExt ${DSP_NS} relId="rId6" ` +
        'minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>' +
        '</a:ext></dgm:extLst></dgm:dataModel>'
    );
}

const DRAWING =
    `${HEADER}<dsp:drawing xmlns:dgm="${DGM}" ${DSP_NS} ${A_NS}>` +
    '<dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/>' +
    '<dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/></dsp:spTree>' +
    '</dsp:drawing>';

const COLORS =
    `${HEADER}<dgm:colorsDef xmlns:dgm="${DGM}" ${A_NS} uniqueId="c">` +
    '<dgm:styleLbl name="node1"><dgm:fillClrLst meth="repeat">' +
    '<a:schemeClr val="accent1"/></dgm:fillClrLst></dgm:styleLbl>' +
    '</dgm:colorsDef>';

const STYLE =
    `${HEADER}<dgm:styleDef xmlns:dgm="${DGM}" ${A_NS} uniqueId="q">` +
    '<dgm:styleLbl name="node1"><dgm:sp3d/><dgm:txPr/></dgm:styleLbl>' +
    '</dgm:styleDef>';

const FLAT: [string, string, string][] = [
    ['{N1}', 'Plan', '{D}'],
    ['{N2}', 'Pray', '{D}'],
    ['{N3}', 'Go', '{D}'],
];

const TREE: [string, string, string][] = [
    ['{N1}', 'Pastor', '{D}'],
    ['{N2}', 'Worship', '{N1}'],
    ['{N3}', 'Youth', '{N1}'],
    ['{N4}', 'Band', '{N2}'],
];

// a SmartArt as the app's own five layouts write it
function genSmartArt(
    layout: SmartArtLayoutNameType,
    boxes: [string, string, string][],
) {
    const result = changeSmartArtLayoutXml(
        {
            dataXml: genData(boxes),
            drawingXml: DRAWING,
            colorsXml: COLORS,
            styleXml: STYLE,
        },
        layout,
        { cx: 8000000, cy: 4000000 },
    );
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function listPresNames(dataXml: string) {
    return listPoints(dataXml)
        .filter((point) => {
            return point.type === 'pres';
        })
        .map((point) => {
            return /presName="([^"]*)"/.exec(point.xml)?.[1];
        });
}

function readPres(dataXml: string, name: string, assocId: string) {
    return (
        listPoints(dataXml).find((point) => {
            return (
                point.type === 'pres' &&
                point.xml.includes(`presName="${name}"`) &&
                point.xml.includes(`presAssocID="${assocId}"`)
            );
        })?.xml ?? null
    );
}

describe('the shapes a SmartArt definition draws over its boxes', () => {
    test('an XML part is read as its elements, prefixes and comments dropped', () => {
        const tree = parseSmartArtXmlTree(
            '<?xml version="1.0"?><!-- a note --><dgm:layoutDef ' +
                'xmlns:dgm="x" uniqueId="a&amp;b"><dgm:layoutNode ' +
                'name=\'one\'/><dgm:forEach axis="ch"></dgm:forEach>' +
                '</dgm:layoutDef>',
        );
        expect(tree?.name).toBe('layoutDef');
        expect(tree?.attrs.get('uniqueId')).toBe('a&b');
        expect(
            tree?.children.map((child) => {
                return [child.name, child.attrs.get('name') ?? null];
            }),
        ).toEqual([
            ['layoutNode', 'one'],
            ['forEach', null],
        ]);
    });

    // a definition of a few lines with what PowerPoint's own use: a
    // repeat by `ref`, a `choose` on the boxes under a box, a composite,
    // an arrow after each box but the last, and a variable
    const TREE_DEF =
        `<dgm:layoutDef xmlns:dgm="${DGM}" uniqueId="urn:test/layout/tree9">` +
        '<dgm:layoutNode name="root"><dgm:varLst><dgm:dir/>' +
        '<dgm:resizeHandles val="exact"/></dgm:varLst>' +
        '<dgm:alg type="hierChild"/><dgm:presOf/>' +
        '<dgm:forEach name="each" axis="ch" ptType="node">' +
        '<dgm:layoutNode name="branch"><dgm:alg type="composite"/>' +
        '<dgm:presOf axis="self"/>' +
        '<dgm:layoutNode name="text"><dgm:alg type="tx"/>' +
        '<dgm:presOf axis="desOrSelf" ptType="node"/></dgm:layoutNode>' +
        '<dgm:choose name="c"><dgm:if name="i" axis="ch" ptType="node" ' +
        'func="cnt" op="gte" val="1"><dgm:layoutNode name="kids">' +
        '<dgm:alg type="hierChild"/><dgm:presOf/>' +
        '<dgm:forEach name="again" ref="each"/></dgm:layoutNode></dgm:if>' +
        '<dgm:else name="e"/></dgm:choose></dgm:layoutNode>' +
        '<dgm:forEach name="gap" axis="followSib" ptType="sibTrans" cnt="1">' +
        '<dgm:layoutNode name="arrow"><dgm:alg type="conn"/>' +
        '<dgm:presOf axis="self"/></dgm:layoutNode></dgm:forEach>' +
        '</dgm:forEach>' +
        '<dgm:choose name="d"><dgm:if name="j" func="var" arg="dir" ' +
        'op="equ" val="norm"><dgm:layoutNode name="forward"/></dgm:if>' +
        '<dgm:else name="k"><dgm:layoutNode name="backward"/></dgm:else>' +
        '</dgm:choose></dgm:layoutNode></dgm:layoutDef>';

    const genTreeShapes = (extraPoints: string) => {
        const dataXml = genData(
            [
                ['{A}', 'Pastor', '{D}'],
                ['{B}', 'Worship', '{A}'],
                ['{C}', 'Youth', '{D}'],
            ],
            extraPoints,
        );
        const points = listPoints(dataXml);
        const written = genSmartArtPresXml(
            {
                points: points.filter((point) => {
                    return point.type !== 'pres';
                }),
                connections: listConnections(dataXml),
            },
            TREE_DEF,
            { points, connections: listConnections(dataXml) },
            new Set(),
        );
        if (written === null) {
            throw new Error('not drawn');
        }
        return `<dgm:ptLst>${written.pointsXml}</dgm:ptLst><dgm:cxnLst>${written.connectionsXml}</dgm:cxnLst>`;
    };

    test('every shape of the definition is written, joined as PowerPoint joins them', () => {
        const xml = genTreeShapes('');
        expect(listPresNames(xml)).toEqual([
            'root',
            'branch',
            'text',
            'kids',
            'branch',
            'text',
            'arrow',
            'branch',
            'text',
            'forward',
        ]);
        // the last box's arrow is left out, as is Worship's, alone under
        // Pastor
        expect(readPres(xml, 'arrow', '{S-{C{A}}}')).not.toBeNull();
        expect(readPres(xml, 'arrow', '{S-{C{C}}}')).toBeNull();
        // labels: by what a shape shows and how deep
        expect(readPres(xml, 'text', '{A}')).toContain(
            'presStyleLbl="node1" presStyleIdx="0" presStyleCnt="2"',
        );
        expect(readPres(xml, 'text', '{B}')).toContain(
            'presStyleLbl="node2" presStyleIdx="0" presStyleCnt="1"',
        );
        expect(readPres(xml, 'text', '{C}')).toContain(
            'presStyleLbl="node1" presStyleIdx="1" presStyleCnt="2"',
        );
        expect(readPres(xml, 'arrow', '{S-{C{A}}}')).toContain(
            'presStyleLbl="sibTrans2D1"',
        );
        // a composite shows nothing of its own
        expect(readPres(xml, 'branch', '{A}')).toContain('presStyleCnt="0"');
        // the root carries its definition's variables
        expect(readPres(xml, 'root', '{D}')).toContain(
            '<dgm:presLayoutVars><dgm:dir/><dgm:resizeHandles val="exact"/>' +
                '</dgm:presLayoutVars>',
        );
        // Pastor's text shows Pastor first and Worship under it after,
        // each text link numbered by what it shows and where
        const links = listConnections(xml).filter((link) => {
            return link.type === 'presOf' && link.srcId === '{B}';
        });
        expect(
            links.map((link) => {
                return /srcOrd="(\d+)" destOrd="(\d+)"/
                    .exec(link.xml)
                    ?.slice(1);
            }),
        ).toEqual([
            ['0', '1'],
            ['1', '0'],
        ]);
    });

    test("a person's own setting of a variable picks its branch", () => {
        const xml = genTreeShapes(
            '<dgm:pt modelId="{R}" type="pres"><dgm:prSet ' +
                'presAssocID="{D}" presName="root" presStyleCnt="0">' +
                '<dgm:presLayoutVars><dgm:dir val="rev"/>' +
                '</dgm:presLayoutVars></dgm:prSet><dgm:spPr/></dgm:pt>',
        );
        expect(listPresNames(xml).at(-1)).toBe('backward');
        // kept, with its id and its setting
        expect(readPres(xml, 'root', '{D}')).toContain('modelId="{R}"');
        expect(readPres(xml, 'root', '{D}')).toContain('<dgm:dir val="rev"/>');
    });

    test.each(SMARTART_LAYOUT_LIST)(
        "the app's own %s reads back as its definition draws it",
        (layout) => {
            const result = genSmartArt(
                layout,
                layout === 'hierarchy' ? TREE : FLAT,
            );
            expect(
                checkSmartArtPresMatches(result.dataXml, result.layoutXml),
            ).toBe(true);
        },
    );

    test('a shape missing from the file is told, so nothing is written', () => {
        const result = genSmartArt('process', FLAT);
        const point = listPoints(result.dataXml).find((one) => {
            return one.xml.includes('presName="sibTrans"');
        });
        expect(
            checkSmartArtPresMatches(
                result.dataXml.replace(point?.xml ?? '', ''),
                result.layoutXml,
            ),
        ).toBe(false);
    });
});

describe('a box of a SmartArt added, taken out or moved', () => {
    const editOk = (
        layout: SmartArtLayoutNameType,
        boxes: [string, string, string][],
        edit: Parameters<typeof editSmartArtBoxesXml>[2],
    ) => {
        const smartArt = genSmartArt(layout, boxes);
        const result = editSmartArtBoxesXml(
            smartArt.dataXml,
            smartArt.layoutXml,
            edit,
        );
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        // what was written reads back as its definition draws it
        expect(
            checkSmartArtPresMatches(result.dataXml, smartArt.layoutXml),
        ).toBe(true);
        return { before: smartArt, after: result };
    };

    test('added after a box: its place, its shapes, the look of the box it goes by', () => {
        const { before, after } = editOk('process', FLAT, {
            kind: 'add',
            words: 'Hope & Joy',
            place: 'after',
            target: 'pray',
        });
        expect(after.boxes).toEqual([
            { words: 'Plan', under: null },
            { words: 'Pray', under: null },
            { words: 'Hope & Joy', under: null },
            { words: 'Go', under: null },
        ]);
        expect(after.dataXml).toContain(
            '<a:r><a:rPr lang="en-GB" sz="2400"/><a:t>Hope &amp; Joy</a:t></a:r>',
        );
        // four boxes and three arrows, each numbered among its kind
        const names = listPresNames(after.dataXml);
        expect(
            names.filter((name) => {
                return name === 'node';
            }),
        ).toHaveLength(4);
        expect(
            names.filter((name) => {
                return name === 'sibTrans';
            }),
        ).toHaveLength(3);
        expect(after.dataXml).toContain('presStyleIdx="3" presStyleCnt="4"');
        // Plan's own shape kept with its id
        const planBefore = readPres(before.dataXml, 'node', '{N1}');
        const planId = /modelId="([^"]*)"/.exec(planBefore ?? '')?.[1];
        expect(readPres(after.dataXml, 'node', '{N1}')).toContain(
            `modelId="${planId}"`,
        );
    });

    test('added with no place goes last; under a box, in a hierarchy, under it', () => {
        expect(
            editOk('cycle', FLAT, {
                kind: 'add',
                words: 'Rest',
                place: null,
                target: null,
            }).after.boxes.at(-1),
        ).toEqual({ words: 'Rest', under: null });
        const { after } = editOk('hierarchy', TREE, {
            kind: 'add',
            words: 'Choir',
            place: 'under',
            target: 'Worship',
        });
        expect(after.boxes).toEqual([
            { words: 'Pastor', under: null },
            { words: 'Worship', under: 'Pastor' },
            { words: 'Band', under: 'Worship' },
            { words: 'Choir', under: 'Worship' },
            { words: 'Youth', under: 'Pastor' },
        ]);
    });

    test('taken out: the boxes under it move up into its place', () => {
        const { after } = editOk('hierarchy', TREE, {
            kind: 'remove',
            words: 'Worship',
        });
        expect(after.boxes).toEqual([
            { words: 'Pastor', under: null },
            { words: 'Band', under: 'Pastor' },
            { words: 'Youth', under: 'Pastor' },
        ]);
        expect(after.dataXml).not.toContain('>Worship<');
        expect(after.dataXml).not.toContain('{CN2}');
        expect(after.takenWith).toEqual([]);
    });

    test('taken out: its bullet lines, drawn inside it, go with it', () => {
        // a list drawing the boxes under a box inside it, as a Vertical
        // Bullet List does
        const listDef =
            `<dgm:layoutDef xmlns:dgm="${DGM}" uniqueId="urn:test/layout/list9">` +
            '<dgm:layoutNode name="root"><dgm:alg type="lin"/><dgm:presOf/>' +
            '<dgm:forEach name="each" axis="ch" ptType="node">' +
            '<dgm:layoutNode name="item"><dgm:alg type="tx"/>' +
            '<dgm:presOf axis="desOrSelf" ptType="node"/></dgm:layoutNode>' +
            '</dgm:forEach></dgm:layoutNode></dgm:layoutDef>';
        const bare = genData([
            ['{N1}', 'Plan', '{D}'],
            ['{N2}', 'Budget', '{N1}'],
            ['{N3}', 'Dates', '{N1}'],
            ['{N4}', 'Go', '{D}'],
        ]);
        const drawn = genSmartArtPresXml(
            { points: listPoints(bare), connections: listConnections(bare) },
            listDef,
            { points: [], connections: [] },
            new Set(),
        );
        const dataXml = bare
            .replace(
                /<dgm:ptLst>[\s\S]*<\/dgm:ptLst>/,
                `<dgm:ptLst>${drawn?.pointsXml}</dgm:ptLst>`,
            )
            .replace(
                /<dgm:cxnLst>[\s\S]*<\/dgm:cxnLst>/,
                `<dgm:cxnLst>${drawn?.connectionsXml}</dgm:cxnLst>`,
            );
        expect(checkSmartArtPresMatches(dataXml, listDef)).toBe(true);
        const after = editSmartArtBoxesXml(dataXml, listDef, {
            kind: 'remove',
            words: 'Plan',
        });
        if ('reason' in after) {
            throw new Error(after.reason);
        }
        expect(after.boxes).toEqual([{ words: 'Go', under: null }]);
        expect(after.takenWith).toEqual(['Budget', 'Dates']);
        expect(after.dataXml).not.toContain('>Budget<');
        expect(checkSmartArtPresMatches(after.dataXml, listDef)).toBe(true);
    });

    test('added with no place to a tree with one box at its top: under it', () => {
        expect(
            editOk('hierarchy', TREE, {
                kind: 'add',
                words: 'Ushers',
                place: null,
                target: null,
            }).after.boxes.at(-1),
        ).toEqual({ words: 'Ushers', under: 'Pastor' });
    });

    test('a box the layout would not draw there is refused, nothing changed', () => {
        // a layout drawing its first box alone, as a radial cycle's centre
        const oneDef =
            `<dgm:layoutDef xmlns:dgm="${DGM}" uniqueId="urn:test/layout/one9">` +
            '<dgm:layoutNode name="root"><dgm:alg type="lin"/><dgm:presOf/>' +
            '<dgm:forEach name="each" axis="ch" ptType="node" cnt="1">' +
            '<dgm:layoutNode name="centre"><dgm:alg type="tx"/>' +
            '<dgm:presOf axis="desOrSelf" ptType="node"/></dgm:layoutNode>' +
            '</dgm:forEach></dgm:layoutNode></dgm:layoutDef>';
        const bare = genData([['{N1}', 'God', '{D}']]);
        const drawn = genSmartArtPresXml(
            { points: listPoints(bare), connections: listConnections(bare) },
            oneDef,
            { points: [], connections: [] },
            new Set(),
        );
        const dataXml = bare
            .replace(
                /<dgm:ptLst>[\s\S]*<\/dgm:ptLst>/,
                `<dgm:ptLst>${drawn?.pointsXml}</dgm:ptLst>`,
            )
            .replace(
                /<dgm:cxnLst>[\s\S]*<\/dgm:cxnLst>/,
                `<dgm:cxnLst>${drawn?.connectionsXml}</dgm:cxnLst>`,
            );
        expect(
            editSmartArtBoxesXml(dataXml, oneDef, {
                kind: 'add',
                words: 'Love',
                place: 'before',
                target: 'God',
            }),
        ).toEqual({
            reason:
                'its layout would not draw "God" there, so nothing changed: ' +
                'put it beside or under a box it draws (`afterBox`, ' +
                '`beforeBox`, `underBox`).',
        });
    });

    test('moved before another box, and under another', () => {
        expect(
            editOk('process', FLAT, {
                kind: 'move',
                words: 'Go',
                place: 'before',
                target: 'Plan',
            }).after.boxes.map((box) => {
                return box.words;
            }),
        ).toEqual(['Go', 'Plan', 'Pray']);
        expect(
            editOk('hierarchy', TREE, {
                kind: 'move',
                words: 'Youth',
                place: 'under',
                target: 'Band',
            }).after.boxes,
        ).toEqual([
            { words: 'Pastor', under: null },
            { words: 'Worship', under: 'Pastor' },
            { words: 'Band', under: 'Worship' },
            { words: 'Youth', under: 'Band' },
        ]);
    });

    test.each([
        [
            { kind: 'remove', words: 'Rest' },
            'no box of it reads "Rest"; its boxes: "Plan", "Pray", "Go".',
        ],
        [
            {
                kind: 'move',
                words: 'Plan',
                place: 'after',
                target: 'Plan',
            },
            'a box cannot be put beside itself.',
        ],
    ] as const)('refused: %j', (edit, reason) => {
        const smartArt = genSmartArt('process', FLAT);
        expect(
            editSmartArtBoxesXml(smartArt.dataXml, smartArt.layoutXml, edit),
        ).toEqual({ reason });
    });

    test('refused: under its own boxes, the last box, two boxes alike', () => {
        const tree = genSmartArt('hierarchy', TREE);
        expect(
            editSmartArtBoxesXml(tree.dataXml, tree.layoutXml, {
                kind: 'move',
                words: 'Worship',
                place: 'under',
                target: 'Band',
            }),
        ).toEqual({
            reason:
                '"Band" is under "Worship": a box cannot be put under its ' +
                'own boxes.',
        });
        const one = genSmartArt('process', [
            ['{N1}', 'Plan', '{D}'],
            ['{N2}', 'Go', '{D}'],
        ]);
        const left = editSmartArtBoxesXml(one.dataXml, one.layoutXml, {
            kind: 'remove',
            words: 'Plan',
        });
        if ('reason' in left) {
            throw new Error(left.reason);
        }
        expect(
            editSmartArtBoxesXml(left.dataXml, one.layoutXml, {
                kind: 'remove',
                words: 'Go',
            }),
        ).toEqual({
            reason:
                'it has no other box: take the SmartArt itself away ' +
                '({slide, removeBox}).',
        });
        const twice = genSmartArt('process', [
            ['{N1}', 'Pray', '{D}'],
            ['{N2}', 'Pray', '{D}'],
        ]);
        expect(
            editSmartArtBoxesXml(twice.dataXml, twice.layoutXml, {
                kind: 'remove',
                words: 'Pray',
            }),
        ).toEqual({
            reason:
                '2 of its boxes read "Pray"; name one by the words of the ' +
                'box beside or over it.',
        });
    });

    test('a file holding no shapes (written by another program) has them drawn anew', () => {
        const smartArt = genSmartArt('process', FLAT);
        const bare = genData(FLAT);
        expect(listPresNames(bare)).toEqual([]);
        const result = editSmartArtBoxesXml(bare, smartArt.layoutXml, {
            kind: 'add',
            words: 'Rest',
            place: null,
            target: null,
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(
            checkSmartArtPresMatches(result.dataXml, smartArt.layoutXml),
        ).toBe(true);
        expect(
            result.boxes.map((box) => {
                return box.words;
            }),
        ).toEqual(['Plan', 'Pray', 'Go', 'Rest']);
    });

    test('a layout whose shapes do not come back from its definition is never written', () => {
        const smartArt = genSmartArt('process', FLAT);
        const result = editSmartArtBoxesXml(
            smartArt.dataXml,
            `<dgm:layoutDef xmlns:dgm="${DGM}" uniqueId="u"/>`,
            { kind: 'add', words: 'Rest', place: null, target: null },
        );
        expect(result).toEqual({
            reason:
                'its layout is one this app does not read rightly yet, so ' +
                'nothing changed: in PowerPoint, SmartArt Design → Add ' +
                'Shape, or select a box and press Delete.',
        });
    });

    test('the data part loses its link to the drawing, and nothing else', () => {
        const dataXml = genData(FLAT);
        const dropped = removeSmartArtDrawingLink(dataXml);
        expect(dropped).not.toContain('dataModelExt');
        expect(dropped).not.toContain('<dgm:extLst>');
        expect(dropped).toContain('<dgm:bg/><dgm:whole/></dgm:dataModel>');
        expect(listSmartArtBoxWords(dropped)).toEqual(
            listSmartArtBoxWords(dataXml),
        );
    });
});

// --- in a deck ----------------------------------------------------------------

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

function genSlide(name: string) {
    return (
        `${HEADER}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr ` +
        'id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="90" ' +
        `name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/>` +
        '</p:nvGraphicFramePr><p:xfrm><a:off x="1000000" y="1000000"/>' +
        '<a:ext cx="8000000" cy="4000000"/></p:xfrm><a:graphic>' +
        `<a:graphicData uri="${DGM}"><dgm:relIds xmlns:dgm="${DGM}" ` +
        'r:dm="rId2" r:lo="rId3" r:qs="rId4" r:cs="rId5"/></a:graphicData>' +
        '</a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>'
    );
}

const DIAGRAM_TYPES =
    'application/vnd.openxmlformats-officedocument.drawingml.diagram';

async function genDeckBytes() {
    const steps = genSmartArt('process', FLAT);
    const team = genSmartArt('hierarchy', TREE);
    const files: { fileName: string; data: string }[] = [
        {
            fileName: '[Content_Types].xml',
            data:
                HEADER +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                [1, 2]
                    .map((number) => {
                        return (
                            `<Override PartName="/ppt/diagrams/drawing${number}.xml" ` +
                            'ContentType="application/vnd.ms-office.drawingml.diagramDrawing+xml"/>' +
                            `<Override PartName="/ppt/diagrams/data${number}.xml" ` +
                            `ContentType="${DIAGRAM_TYPES}Data+xml"/>`
                        );
                    })
                    .join('') +
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
                '<p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/>' +
                '</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/>' +
                '</p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([
                ['rId2', 'slide', 'slides/slide1.xml'],
                ['rId3', 'slide', 'slides/slide2.xml'],
            ]),
        },
    ];
    [
        { number: 1, name: 'Steps', smartArt: steps },
        { number: 2, name: 'Team', smartArt: team },
    ].forEach(({ number, name, smartArt }) => {
        files.push(
            {
                fileName: `ppt/slides/slide${number}.xml`,
                data: genSlide(name),
            },
            {
                fileName: `ppt/slides/_rels/slide${number}.xml.rels`,
                data: genRels([
                    ['rId2', 'diagramData', `../diagrams/data${number}.xml`],
                    [
                        'rId3',
                        'diagramLayout',
                        `../diagrams/layout${number}.xml`,
                    ],
                    [
                        'rId4',
                        'diagramQuickStyle',
                        `../diagrams/quickStyle${number}.xml`,
                    ],
                    [
                        'rId5',
                        'diagramColors',
                        `../diagrams/colors${number}.xml`,
                    ],
                    [
                        'rId6',
                        'diagramDrawing',
                        `../diagrams/drawing${number}.xml`,
                    ],
                ]),
            },
            {
                fileName: `ppt/diagrams/data${number}.xml`,
                data: smartArt.dataXml,
            },
            {
                fileName: `ppt/diagrams/layout${number}.xml`,
                data: smartArt.layoutXml,
            },
            {
                fileName: `ppt/diagrams/quickStyle${number}.xml`,
                data: smartArt.styleXml ?? STYLE,
            },
            {
                fileName: `ppt/diagrams/colors${number}.xml`,
                data: smartArt.colorsXml ?? COLORS,
            },
            {
                fileName: `ppt/diagrams/drawing${number}.xml`,
                data: smartArt.drawingXml ?? DRAWING,
            },
        );
    });
    return await toZipBytes(files);
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

async function runOnDeck(changes: OfficeAskedChangeType[]) {
    const { opened, document } = await readDeck(await genDeckBytes());
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
    const after = await readDeck(concatBytes(chunks));
    const read = async (name: string) => {
        return await after.opened.pkg.readText(name);
    };
    return {
        changed: result.changed,
        document: after.document,
        read,
    };
}

async function runOk(changes: OfficeAskedChangeType[]) {
    const out = await runOnDeck(changes);
    if ('reason' in out) {
        throw new Error(out.reason);
    }
    return out;
}

describe('a SmartArt of a deck changed in any layout', () => {
    test("read names each SmartArt's layout and the boxes under boxes", async () => {
        const { document } = await readDeck(await genDeckBytes());
        const read = toOfficeReadResult(document, 0) as unknown as {
            slides: { boxes: Record<string, unknown>[] }[];
        };
        expect(read.slides[0].boxes[0]).toMatchObject({
            name: 'Steps',
            layout: 'process1',
            words: ['Plan', 'Pray', 'Go'],
        });
        expect(read.slides[1].boxes[0]).toMatchObject({
            layout: 'hierarchy1',
            under: { Worship: 'Pastor', Youth: 'Pastor', Band: 'Worship' },
        });
    });

    test('a box added: said, and the drawing kept beside it dropped whole', async () => {
        const out = await runOk([
            {
                slide: 1,
                box: 'Steps',
                smartArtAdd: 'Serve',
                afterBox: 'Pray',
            },
        ]);
        expect(out.changed).toEqual([
            'The SmartArt "Steps" on slide 1: added "Serve" after "Pray". ' +
                'Its boxes now: "Plan", "Pray", "Serve", "Go". Still a ' +
                'SmartArt in its own layout: PowerPoint and this app lay it ' +
                'out again as they open it.',
        ]);
        const data = (await out.read('ppt/diagrams/data1.xml')) ?? '';
        expect(data).not.toContain('dataModelExt');
        expect(await out.read('ppt/diagrams/drawing1.xml')).toBeNull();
        expect(
            await out.read('ppt/slides/_rels/slide1.xml.rels'),
        ).not.toContain('drawing1.xml');
        expect(await out.read('[Content_Types].xml')).not.toContain(
            'drawing1.xml',
        );
        // the other SmartArt's drawing untouched
        expect(await out.read('ppt/diagrams/drawing2.xml')).not.toBeNull();
        expect(
            checkSmartArtPresMatches(
                data,
                (await out.read('ppt/diagrams/layout1.xml')) ?? '',
            ),
        ).toBe(true);
    });

    test('read after a move lists the boxes in their new order', async () => {
        const out = await runOk([
            { slide: 1, box: 'Steps', smartArtMove: 'Go', beforeBox: 'Plan' },
        ]);
        const read = toOfficeReadResult(out.document, 0) as unknown as {
            slides: { boxes: Record<string, unknown>[] }[];
        };
        expect(read.slides[0].boxes[0]).toMatchObject({
            words: ['Go', 'Plan', 'Pray'],
        });
    });

    test('two changes to one SmartArt in one call build on each other', async () => {
        const out = await runOk([
            { slide: 2, box: 'Team', smartArtRemove: 'Youth' },
            {
                slide: 2,
                box: 'Team',
                smartArtMove: 'Band',
                underBox: 'Pastor',
            },
        ]);
        expect(
            listSmartArtBoxWords(
                (await out.read('ppt/diagrams/data2.xml')) ?? '',
            ),
        ).toEqual([
            { words: 'Pastor', under: null },
            { words: 'Worship', under: 'Pastor' },
            { words: 'Band', under: 'Pastor' },
        ]);
    });

    test("another SmartArt's layout, taken from the deck", async () => {
        const out = await runOk([
            { slide: 1, box: 'Steps', smartArtLayout: 'Hierarchy1' },
        ]);
        expect(out.changed).toEqual([
            'The SmartArt "Steps" on slide 1 has the layout "hierarchy1" ' +
                'of "Team" on slide 2 now, still a SmartArt: "Plan", ' +
                '"Pray", "Go". PowerPoint and this app lay it out again from ' +
                'that layout as they open it; its words stay.',
        ]);
        const layout = (await out.read('ppt/diagrams/layout1.xml')) ?? '';
        const data = (await out.read('ppt/diagrams/data1.xml')) ?? '';
        expect(readSmartArtLayoutId(layout)).toBe('hierarchy1');
        expect(readSmartArtLayoutId(data)).toBe('hierarchy1');
        expect(checkSmartArtPresMatches(data, layout)).toBe(true);
        expect(await out.read('ppt/diagrams/drawing1.xml')).toBeNull();
    });

    test("a label the new layout draws with is copied from the other SmartArt's part", () => {
        const source =
            '<dgm:colorsDef><dgm:styleLbl name="node1">A</dgm:styleLbl>' +
            '<dgm:styleLbl name="parChTrans1D2">B</dgm:styleLbl></dgm:colorsDef>';
        expect(
            copyMissingStyleLabels(
                '<dgm:colorsDef><dgm:styleLbl name="node1">C</dgm:styleLbl>' +
                    '</dgm:colorsDef>',
                source,
                '</dgm:colorsDef>',
                ['node1', 'parChTrans1D2', 'asst1'],
            ),
        ).toBe(
            '<dgm:colorsDef><dgm:styleLbl name="node1">C</dgm:styleLbl>' +
                '<dgm:styleLbl name="parChTrans1D2">B</dgm:styleLbl>' +
                '</dgm:colorsDef>',
        );
    });

    test('a layout no SmartArt of the deck has is named with the ones it has', async () => {
        expect(
            await runOnDeck([
                { slide: 1, box: 'Steps', smartArtLayout: 'chevron1' },
            ]),
        ).toEqual({
            reason:
                'The SmartArt "Steps" on slide 1: no SmartArt of this deck ' +
                'has the layout "chevron1" (theirs: "process1", ' +
                '"hierarchy1"). Here it is "cycle" | "process" | "pyramid" | ' +
                '"venn" | "hierarchy" or one of theirs; any other is ' +
                "PowerPoint's (SmartArt Design → Layouts). A column of plain " +
                'shapes is {slide, box, toShapes: true, arrange: "column"}, ' +
                'after which it is no longer a SmartArt (ask first).',
        });
    });

    test.each([
        [
            { slide: 1, box: 'Steps', smartArtRemove: 'Go', afterBox: 'Plan' },
            '`smartArtRemove` takes no place: the words drawn inside the ' +
                'box go with it, a box of its own under it moves up into its ' +
                'place.',
        ],
        [
            { slide: 1, box: 'Steps', smartArtMove: 'Go' },
            '`smartArtMove` takes `afterBox`, `beforeBox` or `underBox`: ' +
                'where it goes.',
        ],
        [
            { slide: 1, box: 'Steps', smartArtAdd: 'A', smartArtRemove: 'Go' },
            'A SmartArt named by `box` takes ONE of `smartArtAdd` (new ' +
                "words), `smartArtRemove` or `smartArtMove` (a box's " +
                'words), with at most one of `afterBox`, `beforeBox` or ' +
                '`underBox` (the words of the box it goes by): {slide, box, ' +
                'smartArtAdd: "Pray", afterBox: "Read"}.',
        ],
        [
            { slide: 1, box: 'Steps', smartArtAdd: 'A', color: 'red' },
            '`smartArtAdd` takes `slide`, `box` and a place alone; send ' +
                '`color` apart, in a change of its own.',
        ],
    ] as const)(
        'refused before anything is read: %j',
        async (change, reason) => {
            expect(
                await runOnDeck([change as unknown as OfficeAskedChangeType]),
            ).toEqual({ reason });
        },
    );
});
