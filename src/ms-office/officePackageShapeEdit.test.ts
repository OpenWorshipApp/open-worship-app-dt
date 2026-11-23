import { describe, expect, test } from 'vitest';

import { concatBytes, toZipBytes } from './officeZipHelpers';
import {
    readOfficeZipEntries,
    readOfficeZipEntryBytes,
} from './officeZipReadHelpers';
import {
    type OfficeChangeType,
    type OfficeDocumentType,
    applyOfficeChanges,
    readOfficeDocument,
    toOfficeReadResult,
} from './officePackageEditHelpers';
import {
    openOfficePackage,
    writeOfficePackage,
} from './officePackageIoHelpers';

// A deck laid out the way PowerPoint (and python-pptx) writes one: three of
// the default layouts, a title slide, an order of service in a table, the
// year's giving in a chart with its own workbook (2026-11-20, EC-771: a new
// slide from a layout, a table's rows and columns, animations and a chart's
// numbers, the goal "chatbot can change everything on a given pptx").

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

function genPlaceholderBox(
    id: number,
    name: string,
    ph: string,
    words: string[],
) {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr>` +
        `<a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr>` +
        '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
        words
            .map((word) => {
                return `<a:p><a:r><a:rPr lang="en-US"/><a:t>${word}</a:t></a:r></a:p>`;
            })
            .join('') +
        '</p:txBody></p:sp>'
    );
}

function genLayout(name: string, boxes: string) {
    return (
        HEADER +
        `<p:sldLayout ${NS}><p:cSld name="${name}"><p:spTree>${GROUP}` +
        boxes +
        '</p:spTree></p:cSld></p:sldLayout>'
    );
}

function genSlide(boxes: string) {
    return (
        HEADER +
        `<p:sld ${NS}><p:cSld><p:spTree>${GROUP}${boxes}</p:spTree></p:cSld>` +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    );
}

function genCell(words: string) {
    return (
        '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>' +
        `<a:rPr lang="en-US"/><a:t>${words}</a:t></a:r></a:p></a:txBody>` +
        '<a:tcPr/></a:tc>'
    );
}

const TABLE_ROWS = [
    ['Time', 'Item'],
    ['9:00', 'Welcome'],
    ['9:10', 'Worship'],
    ['9:40', 'Sermon'],
];

const TABLE =
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="Table 2"/>' +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/>' +
    '</p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>' +
    '<a:off x="1371600" y="1645920"/><a:ext cx="9144000" cy="1483360"/>' +
    '</p:xfrm><a:graphic><a:graphicData ' +
    'uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>' +
    '<a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>' +
    '<a:gridCol w="4572000"/><a:gridCol w="4572000"/></a:tblGrid>' +
    TABLE_ROWS.map((row) => {
        return `<a:tr h="370840">${row.map(genCell).join('')}</a:tr>`;
    }).join('') +
    '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';

const CHART_FRAME =
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="Chart 2"/>' +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/>' +
    '</p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>' +
    '<a:off x="1371600" y="1463040"/><a:ext cx="9144000" cy="4754880"/>' +
    '</p:xfrm><a:graphic><a:graphicData ' +
    'uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
    '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
    'r:id="rId2"/></a:graphicData></a:graphic></p:graphicFrame>';

// python-pptx's own clustered column chart, as written into the fixture
const CHART =
    HEADER +
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<c:date1904 val="0"/><c:chart><c:autoTitleDeleted val="0"/><c:plotArea>' +
    '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser>' +
    '<c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>Sheet1!$B$1</c:f>' +
    '<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>2026</c:v></c:pt>' +
    '</c:strCache></c:strRef></c:tx><c:cat><c:strRef>' +
    '<c:f>Sheet1!$A$2:$A$4</c:f><c:strCache><c:ptCount val="3"/>' +
    '<c:pt idx="0"><c:v>Jan</c:v></c:pt><c:pt idx="1"><c:v>Feb</c:v></c:pt>' +
    '<c:pt idx="2"><c:v>Mar</c:v></c:pt></c:strCache></c:strRef></c:cat>' +
    '<c:val><c:numRef><c:f>Sheet1!$B$2:$B$4</c:f><c:numCache>' +
    '<c:formatCode>General</c:formatCode><c:ptCount val="3"/>' +
    '<c:pt idx="0"><c:v>120</c:v></c:pt><c:pt idx="1"><c:v>135</c:v></c:pt>' +
    '<c:pt idx="2"><c:v>150</c:v></c:pt></c:numCache></c:numRef></c:val>' +
    '</c:ser><c:axId val="1"/><c:axId val="2"/></c:barChart></c:plotArea>' +
    '<c:dispBlanksAs val="gap"/></c:chart><c:externalData r:id="rId1">' +
    '<c:autoUpdate val="0"/></c:externalData></c:chartSpace>';

const SHEET =
    HEADER +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:B4"/><sheetData><row r="1"><c r="B1" t="s"><v>3</v>' +
    '</c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>120</v>' +
    '</c></row><row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><v>135</v>' +
    '</c></row><row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4"><v>150</v>' +
    '</c></row></sheetData></worksheet>';

async function genWorkbookBytes(hasCalcChain = false) {
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data:
                HEADER +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                (hasCalcChain
                    ? '<Override PartName="/xl/calcChain.xml" ContentType="cc"/>'
                    : '') +
                '</Types>',
        },
        ...(hasCalcChain
            ? [
                  {
                      fileName: 'xl/calcChain.xml',
                      data: '<calcChain><c r="B5" i="1"/></calcChain>',
                  },
              ]
            : []),
        {
            fileName: 'xl/workbook.xml',
            data:
                HEADER +
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        },
        {
            fileName: 'xl/_rels/workbook.xml.rels',
            data: genRels([
                ['rId1', 'worksheet', 'worksheets/sheet1.xml'],
                ['rId2', 'sharedStrings', 'sharedStrings.xml'],
                ...(hasCalcChain
                    ? [
                          ['rId3', 'calcChain', 'calcChain.xml'] as [
                              string,
                              string,
                              string,
                          ],
                      ]
                    : []),
            ]),
        },
        { fileName: 'xl/worksheets/sheet1.xml', data: SHEET },
        {
            fileName: 'xl/sharedStrings.xml',
            data:
                HEADER +
                '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
                'count="4" uniqueCount="4"><si><t>Jan</t></si><si><t>Feb</t></si>' +
                '<si><t>Mar</t></si><si><t>2026</t></si></sst>',
        },
    ]);
}

const TITLE = (id: number, words: string) => {
    return genPlaceholderBox(id, 'Title 1', '<p:ph type="title"/>', [words]);
};

async function genServiceDeckBytes(hasCalcChain = false) {
    const slideType =
        'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data:
                HEADER +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>' +
                '<Override PartName="/ppt/presentation.xml" ContentType="p"/>' +
                [1, 2, 3]
                    .map((n) => {
                        return `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${slideType}"/>`;
                    })
                    .join('') +
                '<Override PartName="/ppt/charts/chart1.xml" ContentType="c"/>' +
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
                '<p:sldId id="258" r:id="rId4"/></p:sldIdLst>' +
                '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([
                ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
                ['rId2', 'slide', 'slides/slide1.xml'],
                ['rId3', 'slide', 'slides/slide2.xml'],
                ['rId4', 'slide', 'slides/slide3.xml'],
            ]),
        },
        {
            fileName: 'ppt/slideMasters/slideMaster1.xml',
            data: `${HEADER}<p:sldMaster ${NS}><p:cSld><p:spTree>${GROUP}</p:spTree></p:cSld></p:sldMaster>`,
        },
        // in the zip's own order: 7 before 1 and 2, as a real deck lists them
        {
            fileName: 'ppt/slideLayouts/slideLayout7.xml',
            data: genLayout('Blank', ''),
        },
        {
            fileName: 'ppt/slideLayouts/slideLayout1.xml',
            data: genLayout(
                'Title Slide',
                genPlaceholderBox(2, 'Title 1', '<p:ph type="ctrTitle"/>', [
                    'Click to edit',
                ]) +
                    genPlaceholderBox(
                        3,
                        'Subtitle 2',
                        '<p:ph type="subTitle" idx="1"/>',
                        ['Click to edit'],
                    ),
            ),
        },
        {
            fileName: 'ppt/slideLayouts/slideLayout2.xml',
            data: genLayout(
                'Title and Content',
                TITLE(2, 'Click to edit') +
                    genPlaceholderBox(
                        3,
                        'Content Placeholder 2',
                        '<p:ph idx="1"/>',
                        ['Click to edit'],
                    ),
            ),
        },
        ...[1, 2, 7].map((n) => {
            return {
                fileName: `ppt/slideLayouts/_rels/slideLayout${n}.xml.rels`,
                data: genRels([
                    ['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'],
                ]),
            };
        }),
        {
            fileName: 'ppt/slides/slide1.xml',
            data: genSlide(
                genPlaceholderBox(2, 'Title 1', '<p:ph type="ctrTitle"/>', [
                    'Sunday Service',
                ]) +
                    genPlaceholderBox(
                        3,
                        'Subtitle 2',
                        '<p:ph type="subTitle" idx="1"/>',
                        ['Welcome', 'to Grace Church'],
                    ),
            ),
        },
        {
            fileName: 'ppt/slides/_rels/slide1.xml.rels',
            data: genRels([
                ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
            ]),
        },
        {
            fileName: 'ppt/slides/slide2.xml',
            data: genSlide(TITLE(2, 'Order of Service') + TABLE),
        },
        {
            fileName: 'ppt/slides/_rels/slide2.xml.rels',
            data: genRels([
                ['rId1', 'slideLayout', '../slideLayouts/slideLayout2.xml'],
            ]),
        },
        {
            fileName: 'ppt/slides/slide3.xml',
            data: genSlide(TITLE(2, 'Giving This Year') + CHART_FRAME),
        },
        {
            fileName: 'ppt/slides/_rels/slide3.xml.rels',
            data: genRels([
                ['rId1', 'slideLayout', '../slideLayouts/slideLayout2.xml'],
                ['rId2', 'chart', '../charts/chart1.xml'],
            ]),
        },
        { fileName: 'ppt/charts/chart1.xml', data: CHART },
        {
            fileName: 'ppt/charts/_rels/chart1.xml.rels',
            data: genRels([
                [
                    'rId1',
                    'package',
                    '../embeddings/Microsoft_Excel_Sheet1.xlsx',
                ],
            ]),
        },
        {
            fileName: 'ppt/embeddings/Microsoft_Excel_Sheet1.xlsx',
            data: await genWorkbookBytes(hasCalcChain),
        },
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

async function runOnDeck(bytes: Uint8Array, changes: OfficeChangeType[]) {
    const { opened, document } = await readDeck(bytes);
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
        after: after.document,
        pkg: after.opened.pkg,
        changed: result.changed,
    };
}

async function runOk(bytes: Uint8Array, changes: OfficeChangeType[]) {
    const out = await runOnDeck(bytes, changes);
    if ('reason' in out) {
        throw new Error(out.reason);
    }
    return out;
}

function toSlideTexts(document: OfficeDocumentType) {
    return document.kind === 'pptx'
        ? document.slides.map((slide) => {
              return slide.lines
                  .map((line) => {
                      return line.text;
                  })
                  .join(' / ');
          })
        : [];
}

function findShownBox(
    document: OfficeDocumentType,
    slide: number,
    name: string,
) {
    const read = toOfficeReadResult(document);
    if (read.kind !== 'PowerPoint') {
        throw new Error('not a deck');
    }
    return (read.slides[slide - 1].boxes as any[]).find((box) => {
        return box.name === name;
    });
}

describe('a deck read whole: its layouts, a table, a chart', () => {
    test("the deck's layouts in its own order, a table's size", async () => {
        const { document } = await readDeck(await genServiceDeckBytes());
        const read = toOfficeReadResult(document);
        expect(read).toMatchObject({
            kind: 'PowerPoint',
            layouts: ['Title Slide', 'Title and Content', 'Blank'],
        });
        expect(findShownBox(document, 2, 'Table 2')).toMatchObject({
            kind: 'table',
            rows: 4,
            columns: 2,
        });
        // the table's words are lines of the slide, as before
        expect(toSlideTexts(document)[1]).toContain('9:10 / Worship');
    });
});

describe('a new slide from a layout (EC-771)', () => {
    test('at the end, on Title and Content: its title and its lines', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                newSlide: true,
                title: 'Prayer Requests',
                lines: ['For the sick', 'For our missionaries'],
            },
        ]);
        expect(toSlideTexts(out.after)).toEqual([
            ...toSlideTexts(
                (await readDeck(await genServiceDeckBytes())).document,
            ),
            'Prayer Requests / For the sick / For our missionaries',
        ]);
        expect(out.changed).toEqual([
            'Added a new slide at place 4 on the layout "Title and Content", ' +
                'titled “Prayer Requests”, with 2 lines.',
        ]);
        const slide = out.after.kind === 'pptx' ? out.after.slides[3] : null;
        expect(slide?.partPath).toBe('ppt/slides/slide4.xml');
        expect(slide?.layoutPath).toBe('ppt/slideLayouts/slideLayout2.xml');
        // its own part, its content type and a slide id past the others
        expect(await out.pkg.readText('[Content_Types].xml')).toContain(
            '<Override PartName="/ppt/slides/slide4.xml" ' +
                'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>',
        );
        expect(await out.pkg.readText('ppt/presentation.xml')).toContain(
            '<p:sldId id="258" r:id="rId4"/><p:sldId id="259" r:id="rId5"/>',
        );
    });

    test('a blank one in second place; words it has no box for are said', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { newSlide: true, layout: 'blank', to: 2, title: 'Amen' },
        ]);
        expect(toSlideTexts(out.after)).toEqual([
            'Sunday Service / Welcome / to Grace Church',
            '',
            expect.stringContaining('Order of Service'),
            expect.stringContaining('Giving This Year'),
        ]);
        expect(out.changed[0]).toContain(
            'Added a new slide at place 2 on the layout "Blank". That ' +
                'layout has no box for “Amen”: say so',
        );
    });

    test('refused: a layout the deck lacks, a place past the end', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [{ newSlide: true, layout: 'Comparison' }]),
        ).toEqual({
            reason:
                'The deck has no layout "Comparison". Its layouts: "Title ' +
                'Slide", "Title and Content", "Blank".',
        });
        expect(
            await runOnDeck(bytes, [{ newSlide: true, to: 9 }]),
        ).toHaveProperty('reason', expect.stringContaining('from 1 to 4'));
        expect(
            await runOnDeck(bytes, [{ newSlide: true, slide: 2 } as never]),
        ).toHaveProperty('reason', expect.stringContaining('placed by `to`'));
    });
});

describe("a table's rows and columns (EC-771)", () => {
    test('a row added at the end, then one taken out', async () => {
        const bytes = await genServiceDeckBytes();
        const added = await runOk(bytes, [
            {
                slide: 2,
                table: 'Table 2',
                addRow: 5,
                cells: ['10:30', 'Closing Prayer'],
            },
        ]);
        expect(added.changed).toEqual([
            'Table "Table 2" on slide 2: added a row (now row 5), its words ' +
                '“10:30 | Closing Prayer”.',
        ]);
        expect(findShownBox(added.after, 2, 'Table 2')).toMatchObject({
            rows: 5,
            columns: 2,
        });
        expect(toSlideTexts(added.after)[1]).toContain(
            '9:40 / Sermon / 10:30 / Closing Prayer',
        );
        const removed = await runOk(added.written, [
            { slide: 2, table: 'table 2', removeRow: 3 },
        ]);
        expect(findShownBox(removed.after, 2, 'Table 2')).toMatchObject({
            rows: 4,
        });
        expect(toSlideTexts(removed.after)[1]).not.toContain('Worship');
    });

    test('a column added, its words down it', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 2,
                table: 'Table 2',
                addColumn: 3,
                cells: ['Leader', 'Tim', 'Anna', 'Tim'],
            },
        ]);
        expect(findShownBox(out.after, 2, 'Table 2')).toMatchObject({
            rows: 4,
            columns: 3,
        });
        expect(toSlideTexts(out.after)[1]).toContain(
            'Time / Item / Leader / 9:00 / Welcome / Tim',
        );
    });

    test('refused: two at once, no slide, a table not there', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [
                { slide: 2, table: 'Table 2', addRow: 2, removeRow: 3 },
            ]),
        ).toHaveProperty('reason', expect.stringContaining('ONE of `addRow`'));
        expect(
            await runOnDeck(bytes, [{ table: 'Table 2', addRow: 2 }]),
        ).toHaveProperty(
            'reason',
            'A table is on one slide: give its `slide`.',
        );
        expect(
            await runOnDeck(bytes, [{ slide: 3, table: 'Table 2', addRow: 2 }]),
        ).toHaveProperty('reason', expect.stringContaining('Table 2'));
        expect(
            await runOnDeck(bytes, [{ slide: 2, cells: ['x'] }]),
        ).toHaveProperty('reason', expect.stringContaining('`cells` go with'));
    });
});

describe('an entrance animation (EC-771)', () => {
    test('a box faded in, read back, and taken off byte for byte', async () => {
        const bytes = await genServiceDeckBytes();
        const before = await readDeck(bytes);
        const slide1 = await before.opened.pkg.readText(
            'ppt/slides/slide1.xml',
        );
        const added = await runOk(bytes, [
            { slide: 1, box: 'Title 1', animation: 'Fade In' },
        ]);
        expect(added.changed).toEqual([
            '"Title 1" on slide 1: comes in with fade, on a click.',
        ]);
        expect(findShownBox(added.after, 1, 'Title 1')).toMatchObject({
            animation: 'fade',
        });
        expect(findShownBox(added.after, 1, 'Subtitle 2')).not.toHaveProperty(
            'animation',
        );
        const taken = await runOk(added.written, [
            { slide: 1, box: 'Title 1', animation: 'none' },
        ]);
        expect(taken.changed).toEqual([
            '"Title 1" on slide 1: no animation now.',
        ]);
        expect(await taken.pkg.readText('ppt/slides/slide1.xml')).toBe(slide1);
    });

    test('a box taken off takes its animation with it (2026-11-21)', async () => {
        const added = await runOk(await genServiceDeckBytes(), [
            { slide: 1, box: 'Title 1', animation: 'fade' },
            { slide: 1, box: 'Subtitle 2', animation: 'fly' },
        ]);
        const before = await added.pkg.readText('ppt/slides/slide1.xml');
        const titleId = /<p:cNvPr\b[^>]*\sid="(\d+)"[^>]*\sname="Title 1"/.exec(
            before as string,
        )?.[1];
        expect(titleId).toBeDefined();
        expect(before).toContain(`<p:spTgt spid="${titleId}"`);
        const out = await runOk(added.written, [
            { slide: 1, removeBox: 'Title 1' },
        ]);
        const slide = (await out.pkg.readText('ppt/slides/slide1.xml')) ?? '';
        // nothing names the box that is gone; the other one still comes in
        expect(slide).not.toContain(`spid="${titleId}"`);
        expect(findShownBox(out.after, 1, 'Subtitle 2')).toMatchObject({
            animation: 'fly',
        });
    });

    test("no box named: the slide's boxes of words, line by line", async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slide: 1, animation: 'fly', byLine: true, when: 'after' },
        ]);
        expect(out.changed).toEqual([
            '"Title 1", "Subtitle 2" on slide 1: comes in with fly, line by ' +
                'line, after the one before.',
        ]);
        expect(findShownBox(out.after, 1, 'Subtitle 2')).toMatchObject({
            animation: 'fly, line by line',
        });
    });

    test('refused: an effect it does not have, a box not there', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [{ slide: 1, animation: 'bounce' }]),
        ).toHaveProperty(
            'reason',
            expect.stringContaining('`animation` is one of appear, fade'),
        );
        expect(
            await runOnDeck(bytes, [
                { slide: 1, box: 'Picture 9', animation: 'fade' },
            ]),
        ).toHaveProperty(
            'reason',
            'Slide 1 has no box "Picture 9". Its boxes: "Title 1", ' +
                '"Subtitle 2".',
        );
    });
});

async function readZipText(bytes: Uint8Array, name: string) {
    const entries = readOfficeZipEntries(bytes);
    if ('reason' in entries) {
        throw new Error(entries.reason);
    }
    const entry = entries.find((one) => {
        return one.fileName === name;
    });
    return entry === undefined
        ? null
        : new TextDecoder().decode(await readOfficeZipEntryBytes(bytes, entry));
}

async function readWorkbookSheet(out: { pkg: { readBytes?: any } }) {
    const bytes = await out.pkg.readBytes(
        'ppt/embeddings/Microsoft_Excel_Sheet1.xlsx',
    );
    return await readZipText(bytes, 'xl/worksheets/sheet1.xml');
}

describe("a chart's words and numbers (EC-771)", () => {
    test('read: its kind, title, categories and series', async () => {
        const { document } = await readDeck(await genServiceDeckBytes());
        expect(findShownBox(document, 3, 'Chart 2')).toMatchObject({
            kind: 'chart',
            chart: {
                kind: 'column',
                title: null,
                categories: ['Jan', 'Feb', 'Mar'],
                series: [{ name: '2026', values: [120, 135, 150] }],
            },
        });
    });

    test('a month added: the chart draws it AND its workbook holds it', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 3,
                chart: 'Chart 2',
                chartTitle: 'Giving',
                categories: ['Jan', 'Feb', 'Mar', 'Apr'],
                series: [{ index: 0, values: [120, 135, 150, 160] }],
            },
        ]);
        expect(out.changed).toEqual([
            'Changed the chart "Chart 2" on slide 3: its title “Giving”, ' +
                'its categories, its numbers.',
        ]);
        expect(findShownBox(out.after, 3, 'Chart 2')).toMatchObject({
            chart: {
                title: 'Giving',
                categories: ['Jan', 'Feb', 'Mar', 'Apr'],
                series: [{ name: '2026', values: [120, 135, 150, 160] }],
            },
        });
        // Edit Data in PowerPoint opens on the same: A5 Apr, B5 160
        const sheet = await readWorkbookSheet(out);
        expect(sheet).toMatch(/<c r="A5"[^>]*>.*?Apr.*?<\/c>/);
        expect(sheet).toMatch(/<c r="B5"[^>]*><v>160<\/v><\/c>/);
        // the rest of the workbook is as it was
        expect(sheet).toContain('<c r="B2"><v>120</v></c>');
    });

    test('a series renamed, one number changed, the rest kept', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 3,
                chart: 'chart 2',
                series: [
                    { index: 0, name: '2026 Giving', values: [120, 135, 155] },
                ],
            },
        ]);
        expect(findShownBox(out.after, 3, 'Chart 2')).toMatchObject({
            chart: {
                categories: ['Jan', 'Feb', 'Mar'],
                series: [{ name: '2026 Giving', values: [120, 135, 155] }],
            },
        });
        const sheet = await readWorkbookSheet(out);
        expect(sheet).toMatch(/<c r="B4"[^>]*><v>155<\/v><\/c>/);
        expect(sheet).toMatch(/<c r="B1"[^>]*>.*?2026 Giving.*?<\/c>/);
    });

    test("Excel's calc chain goes with the cells written over", async () => {
        const out = await runOk(await genServiceDeckBytes(true), [
            {
                slide: 3,
                chart: 'Chart 2',
                series: [{ index: 0, values: [1, 2, 3] }],
            },
        ]);
        const bytes = await out.pkg.readBytes!(
            'ppt/embeddings/Microsoft_Excel_Sheet1.xlsx',
        );
        expect(await readZipText(bytes as Uint8Array, 'xl/calcChain.xml')).toBe(
            null,
        );
        expect(
            await readZipText(
                bytes as Uint8Array,
                'xl/_rels/workbook.xml.rels',
            ),
        ).not.toContain('calcChain');
        expect(
            await readZipText(bytes as Uint8Array, '[Content_Types].xml'),
        ).not.toContain('calcChain');
    });

    test('refused: no chart by that name, nothing said to change', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [
                { slide: 3, chart: 'Chart 9', chartTitle: 'x' },
            ]),
        ).toEqual({
            reason: 'Slide 3 has no chart "Chart 9"; its charts: "Chart 2".',
        });
        expect(
            await runOnDeck(bytes, [{ slide: 3, chart: 'Chart 2' }]),
        ).toHaveProperty(
            'reason',
            expect.stringContaining('Say what to change in the chart'),
        );
    });
});

describe("a table's own colours (2026-11-21)", () => {
    test('a header row filled, borders drawn, the bands taken off', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 2,
                table: 'Table 2',
                tableLook: { fill: 'green', rows: [1], borders: '#808080' },
            },
            {
                slide: 2,
                table: 'Table 2',
                tableLook: { banded: false },
            },
        ]);
        expect(out.changed).toEqual([
            expect.stringMatching(
                /^Table "Table 2" on slide 2: the cells .*\(row 1\), borders .*\.$/,
            ),
            'Table "Table 2" on slide 2: its rows not banded.',
        ]);
        const slideXml =
            (await out.pkg.readText('ppt/slides/slide2.xml')) ?? '';
        expect(slideXml).toContain('<a:srgbClr val="808080"/>');
        expect(slideXml).not.toMatch(/bandRow="1"/);
        // the words of the table as they were
        expect(toSlideTexts(out.after)[1]).toContain('9:40 / Sermon');
    });

    test('refused: a colour it cannot read, cells with a look', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [
                { slide: 2, table: 'Table 2', tableLook: { fill: 'sky-ish' } },
            ]),
        ).toEqual({
            reason: 'No colour "sky-ish": a name or #RRGGBB, or "none".',
        });
        expect(
            await runOnDeck(bytes, [
                {
                    slide: 2,
                    table: 'Table 2',
                    tableLook: { fill: 'red' },
                    addRow: 2,
                },
            ]),
        ).toHaveProperty('reason', expect.stringContaining('ONE of'));
    });
});

describe("a chart's kind (2026-11-21)", () => {
    test('a column chart made a line chart, its numbers kept', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slide: 3, chart: 'Chart 2', chartKind: 'line' },
        ]);
        expect(out.changed).toEqual([
            'Changed the chart "Chart 2" on slide 3: a line chart now (it ' +
                'was a column chart).',
        ]);
        expect(findShownBox(out.after, 3, 'Chart 2')).toMatchObject({
            chart: {
                kind: 'line',
                categories: ['Jan', 'Feb', 'Mar'],
                series: [{ name: '2026', values: [120, 135, 150] }],
            },
        });
    });

    test('a pie with a new title in one change', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 3,
                chart: 'Chart 2',
                chartKind: 'Pie chart',
                chartTitle: 'Giving',
            },
        ]);
        expect(out.changed[0]).toMatch(
            /^Changed the chart "Chart 2" on slide 3: a pie chart now \(it was a column chart\), its title “Giving”/,
        );
        expect(findShownBox(out.after, 3, 'Chart 2')).toMatchObject({
            chart: { kind: 'pie', title: 'Giving' },
        });
    });

    test('refused: a kind it does not make, a kind with no chart', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [
                { slide: 3, chart: 'Chart 2', chartKind: 'radar' },
            ]),
        ).toEqual({
            reason:
                'No chart kind "radar": column, bar, line, pie, doughnut, ' +
                'area.',
        });
        expect(
            await runOnDeck(bytes, [{ slide: 3, chartKind: 'pie' }]),
        ).toHaveProperty('reason', expect.stringContaining('`chartKind`'));
    });
});

describe('a new shape, a link, numbers and a footer, a flip, a line through (2026-11-21)', () => {
    const readSlide = async (out: { pkg: any }, n: number) => {
        return ((await out.pkg.readText(`ppt/slides/slide${n}.xml`)) ??
            '') as string;
    };

    test('a right arrow with its words, filled red, in one change', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            {
                slide: 1,
                shape: 'Right Arrow',
                textBox: 'This way',
                at: [70, 40, 20, 15],
                fill: 'red',
            },
        ]);
        expect(out.changed).toEqual([
            'Added a right arrow "Right Arrow 3" on slide 1 at [70, 40, 20, ' +
                '15]: “This way”.',
            '"Right Arrow 3" on slide 1: filled red (#FF0000).',
        ]);
        const xml = await readSlide(out, 1);
        const box = xml.slice(xml.indexOf('name="Right Arrow 3"'));
        expect(box).toContain('<p:cNvSpPr/>');
        expect(box).toContain(
            '<a:prstGeom prst="rightArrow"><a:avLst/></a:prstGeom>' +
                '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>' +
                '<p:style><a:lnRef idx="2">',
        );
        expect(box).toContain(
            '<a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr ' +
                'algn="ctr"/><a:r><a:rPr lang="en-US"/><a:t>This way</a:t>',
        );
        expect(findShownBox(out.after, 1, 'Right Arrow 3')).toMatchObject({
            lines: expect.any(String),
        });
    });

    test('a circle with no place is round, in the middle; a line is a connector', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slide: 2, shape: 'circle' },
            { slide: 3, shape: 'line', at: [10, 80, 80, 0], outline: 'navy' },
        ]);
        const circle = await readSlide(out, 2);
        const ext = /name="Oval 4"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/.exec(
            circle,
        );
        expect(ext?.[1]).toBe(ext?.[2]);
        expect(circle).toContain('<a:prstGeom prst="ellipse">');
        const line = await readSlide(out, 3);
        expect(line).toContain(
            '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="4" name="Straight Connector 3"/>',
        );
        expect(line).toContain(
            '<a:ln w="28575"><a:solidFill><a:srgbClr val="000080"/>' +
                '</a:solidFill></a:ln>',
        );
        expect(line).toMatch(/<a:ext cx="\d+" cy="0"\/>/);
    });

    test('refused: a shape not made here, words in a line, a Word file', async () => {
        const bytes = await genServiceDeckBytes();
        expect(await runOnDeck(bytes, [{ slide: 1, shape: 'dragon' }])).toEqual(
            {
                reason: expect.stringContaining(
                    '`shape` is one of rectangle, rounded rectangle, oval',
                ),
            },
        );
        expect(
            await runOnDeck(bytes, [{ slide: 1, shape: 'line', textBox: 'x' }]),
        ).toEqual({ reason: expect.stringContaining('A line holds no words') });
        expect(await runOnDeck(bytes, [{ shape: 'star' }])).toEqual({
            reason: 'A new shape goes on one slide: give its `slide`.',
        });
    });

    test('a web link on a title, a jump to a slide on a line, then none', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slide: 1, box: 'Title 1', link: 'www.grace.church/live' },
            { slide: 1, box: 'Subtitle 2', link: 'slide 3' },
        ]);
        expect(out.changed).toEqual([
            'The lines of "Title 1" on slide 1: a link to ' +
                'https://www.grace.church/live.',
            'The lines of "Subtitle 2" on slide 1: a link to slide 3.',
        ]);
        const xml = await readSlide(out, 1);
        expect(xml).toContain(
            '<a:rPr lang="en-US"><a:hlinkClick r:id="rId2"/></a:rPr>' +
                '<a:t>Sunday Service</a:t>',
        );
        expect(xml).toContain(
            '<a:hlinkClick r:id="rId3" action="ppaction://hlinksldjump"/>',
        );
        expect(xml).not.toContain('owaLink');
        const rels = (await out.pkg.readText(
            'ppt/slides/_rels/slide1.xml.rels',
        )) as string;
        expect(rels).toContain(
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/' +
                'officeDocument/2006/relationships/hyperlink" ' +
                'Target="https://www.grace.church/live" TargetMode="External"/>',
        );
        expect(rels).toContain('relationships/slide" Target="slide3.xml"/>');
        const none = await runOk(out.written, [
            { slide: 1, box: 'Title 1', link: 'none' },
        ]);
        expect(await readSlide(none, 1)).toContain(
            '<a:rPr lang="en-US"/><a:t>Sunday Service</a:t>',
        );
    });

    test('refused: a link to a script, to a slide not there', async () => {
        const bytes = await genServiceDeckBytes();
        expect(
            await runOnDeck(bytes, [
                { slide: 1, box: 'Title 1', link: 'javascript:alert(1)' },
            ]),
        ).toEqual({
            reason: expect.stringContaining('`link` is a web address'),
        });
        expect(
            await runOnDeck(bytes, [
                { slide: 1, box: 'Title 1', link: 'slide 9' },
            ]),
        ).toEqual({
            reason: 'There is no slide 9 to link to: the deck has 3.',
        });
    });

    test('a line through the words; a box flipped', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slide: 1, box: 'Subtitle 2', strike: true },
            {
                slide: 1,
                shape: 'heart',
                at: [5, 5, 10, 10],
                flip: 'upside down',
            },
        ]);
        expect(out.changed.slice(-1)).toEqual([
            '"Heart 3" on slide 1: flipped upside down.',
        ]);
        expect(out.changed).toContain(
            'The lines of "Subtitle 2" on slide 1: struck through.',
        );
        const xml = await readSlide(out, 1);
        expect(xml).toContain(
            '<a:rPr lang="en-US" strike="sngStrike"/><a:t>Welcome</a:t>',
        );
        expect(xml).toMatch(/name="Heart 3"[\s\S]*?<a:xfrm flipV="1">/);
        // a box with no place of its own, nor one its layout gives: said
        expect(
            await runOnDeck(out.written, [
                { slide: 1, box: 'Title 1', flip: 'horizontal' },
            ]),
        ).toEqual({
            reason: '"Title 1" on slide 1: it has no place of its own to flip.',
        });
    });

    test('numbers and a footer where the layout has no place for them', async () => {
        const out = await runOk(await genServiceDeckBytes(), [
            { slideNumbers: true, footer: 'Grace Church' },
        ]);
        expect(out.changed).toEqual([
            'The layout of slides 1-3 has no place for a slide number: say ' +
                'so; a text box there can hold it. The layout of slides 1-3 ' +
                'has no place for a footer: say so; a text box there can ' +
                'hold it.',
        ]);
    });
});
