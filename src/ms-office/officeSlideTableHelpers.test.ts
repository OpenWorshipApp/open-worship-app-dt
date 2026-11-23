import { describe, expect, test } from 'vitest';

import {
    addTableColumnXml,
    addTableRowXml,
    fitWidths,
    listSlideTables,
    removeTableColumnXml,
    removeTableRowXml,
} from './officeSlideTableHelpers';

// --- a slide as PowerPoint writes a table on it ------------------------------

const A16 = 'http://schemas.microsoft.com/office/drawing/2014/main';
const ROW_ID_URI = '{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}';
const COLUMN_ID_URI = '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}';

function genColumn(width: number, id: number | null = null) {
    if (id === null) {
        return `<a:gridCol w="${width}"/>`;
    }
    return (
        `<a:gridCol w="${width}"><a:extLst><a:ext uri="${COLUMN_ID_URI}">` +
        `<a16:colId xmlns:a16="${A16}" val="${id}"/></a:ext></a:extLst>` +
        '</a:gridCol>'
    );
}

function genRowIdExt(id: number) {
    return (
        `<a:extLst><a:ext uri="${ROW_ID_URI}"><a16:rowId xmlns:a16="${A16}" ` +
        `val="${id}"/></a:ext></a:extLst>`
    );
}

function genRow(cells: string[], id: number | null = null, height = 370840) {
    return (
        `<a:tr h="${height}">${cells.join('')}` +
        `${id === null ? '' : genRowIdExt(id)}</a:tr>`
    );
}

// a heading cell: centred, bold, on a dark fill
const HEAD_PARAGRAPH_PROPS = '<a:pPr algn="ctr"/>';
const HEAD_RUN_PROPS = '<a:rPr lang="en-US" b="1" dirty="0"/>';
const HEAD_END_PROPS = '<a:endParaRPr lang="en-US" b="1" dirty="0"/>';
const HEAD_CELL_PROPS =
    '<a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="1F4E79"/>' +
    '</a:solidFill></a:tcPr>';

function genHeadCell(text: string, attributes = '') {
    return (
        `<a:tc${attributes}><a:txBody><a:bodyPr/><a:lstStyle/><a:p>` +
        `${HEAD_PARAGRAPH_PROPS}<a:r>${HEAD_RUN_PROPS}<a:t>${text}</a:t>` +
        `</a:r>${HEAD_END_PROPS}</a:p></a:txBody>${HEAD_CELL_PROPS}</a:tc>`
    );
}

// a body cell: red words and no end props of its own; an empty one has
// only them
const BODY_RUN_PROPS =
    '<a:rPr lang="en-US" sz="2000" dirty="0"><a:solidFill>' +
    '<a:srgbClr val="C00000"/></a:solidFill></a:rPr>';
const BODY_EMPTY_END_PROPS = '<a:endParaRPr lang="en-US" sz="2000" dirty="0"/>';

function genBodyCell(text: string, attributes = '') {
    const paragraph =
        text === ''
            ? `<a:p>${BODY_EMPTY_END_PROPS}</a:p>`
            : `<a:p><a:r>${BODY_RUN_PROPS}<a:t>${text}</a:t></a:r></a:p>`;
    return (
        `<a:tc${attributes}><a:txBody><a:bodyPr/><a:lstStyle/>${paragraph}` +
        '</a:txBody><a:tcPr/></a:tc>'
    );
}

function genTableFrame(
    name: string,
    id: number,
    columns: string,
    rows: string,
    cx: number,
    cy: number,
) {
    return (
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" ` +
        `name="${name}"/><p:cNvGraphicFramePr><a:graphicFrameLocks ` +
        'noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
        `<p:xfrm><a:off x="2032000" y="1397000"/><a:ext cx="${cx}" ` +
        `cy="${cy}"/></p:xfrm><a:graphic><a:graphicData uri="http://` +
        'schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>' +
        '<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>' +
        '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr>' +
        `<a:tblGrid>${columns}</a:tblGrid>${rows}</a:tbl></a:graphicData>` +
        '</a:graphic></p:graphicFrame>'
    );
}

function genSlide(boxes: string) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/' +
        'main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/' +
        '2006/relationships" xmlns:p="http://schemas.openxmlformats.org/' +
        'presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr>' +
        '<p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
        `<p:grpSpPr/>${boxes}</p:spTree></p:cSld><p:clrMapOvr>` +
        '<a:masterClrMapping/></p:clrMapOvr></p:sld>'
    );
}

const TITLE =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr>' +
    '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>' +
    '<a:bodyPr/><a:p><a:r><a:t>This Sunday</a:t></a:r></a:p></p:txBody>' +
    '</p:sp>';

const SONG_ROWS = [
    genRow(
        [genHeadCell('Song'), genHeadCell('Key'), genHeadCell('Leader')],
        10000,
    ),
    genRow(
        [genBodyCell('Amazing Grace'), genBodyCell('G'), genBodyCell('Anna')],
        10001,
    ),
    genRow(
        [genBodyCell('How Great Thou Art'), genBodyCell('Bb'), genBodyCell('')],
        10002,
    ),
];
const SONG_COLUMNS = [
    genColumn(4064000, 20000),
    genColumn(2438400, 20001),
    genColumn(1625600, 20002),
];
const SONG_TABLE = genTableFrame(
    'Table 3',
    4,
    SONG_COLUMNS.join(''),
    SONG_ROWS.join(''),
    8128000,
    1112520,
);
// a table in a group, no ids, its grid narrower than its frame
const SCHEDULE_GROUP =
    '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="6" name="Group 5"/>' +
    '<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    genTableFrame(
        'Schedule',
        7,
        genColumn(2000000),
        genRow([genBodyCell('10:00')]),
        3000000,
        370840,
    ) +
    '</p:grpSp>';
const SLIDE = genSlide(TITLE + SONG_TABLE + SCHEDULE_GROUP);

/** The `w` of each column of the first table on the slide. */
function readFirstWidths(xml: string) {
    const grid = /<a:tblGrid>[\s\S]*?<\/a:tblGrid>/.exec(xml)?.[0] ?? '';
    return [...grid.matchAll(/<a:gridCol w="(\d+)"/g)].map((matched) => {
        return Number(matched[1]);
    });
}

function expectXml(out: string | { reason: string }) {
    if (typeof out !== 'string') {
        throw new Error(out.reason);
    }
    return out;
}

describe('the tables of a slide (2026-11-20)', () => {
    test('listed by name in order, a grouped one too, rows and columns', () => {
        expect(listSlideTables(SLIDE)).toEqual([
            { name: 'Table 3', rows: 3, columns: 3 },
            { name: 'Schedule', rows: 1, columns: 1 },
        ]);
        expect(listSlideTables(genSlide(TITLE))).toEqual([]);
    });

    test('an unknown table refused, naming the ones there are', () => {
        const reason = {
            reason:
                'There is no table "Prices" on this slide; its tables are ' +
                '"Table 3" and "Schedule".',
        };
        expect(addTableRowXml(SLIDE, 'Prices', null, [])).toEqual(reason);
        expect(removeTableRowXml(SLIDE, 'Prices', 1)).toEqual(reason);
        expect(addTableColumnXml(SLIDE, 'Prices', null, [])).toEqual(reason);
        expect(removeTableColumnXml(SLIDE, 'Prices', 1)).toEqual(reason);
        expect(
            removeTableRowXml(genSlide(TITLE + SONG_TABLE), 'Prices', 1),
        ).toEqual({
            reason:
                'There is no table "Prices" on this slide; its table is ' +
                '"Table 3".',
        });
        expect(removeTableRowXml(genSlide(TITLE), 'Table 3', 1)).toEqual({
            reason:
                'There is no table "Table 3" on this slide; it has no ' +
                'tables at all.',
        });
    });
});

describe('a row added or taken out', () => {
    // the look of row 3, cell by cell: the run's props, the end props made
    // from them; the empty cell's end props, the run's props made from them
    const BODY_END_PROPS =
        '<a:endParaRPr lang="en-US" sz="2000" dirty="0"><a:solidFill>' +
        '<a:srgbClr val="C00000"/></a:solidFill></a:endParaRPr>';
    const genBodyCopy = (paragraphInner: string) => {
        return (
            '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>' +
            `<a:p>${paragraphInner}</a:p></a:txBody><a:tcPr/></a:tc>`
        );
    };

    test('at the end: the last row copied, words escaped, frame taller', () => {
        const out = expectXml(
            addTableRowXml(SLIDE, 'table 3', null, ['Tom & Jerry', '<C>']),
        );
        const newRow =
            '<a:tr h="370840">' +
            genBodyCopy(
                `<a:r>${BODY_RUN_PROPS}<a:t>Tom &amp; Jerry</a:t></a:r>` +
                    BODY_END_PROPS,
            ) +
            genBodyCopy(
                `<a:r>${BODY_RUN_PROPS}<a:t>&lt;C&gt;</a:t></a:r>` +
                    BODY_END_PROPS,
            ) +
            genBodyCopy(BODY_EMPTY_END_PROPS) +
            genRowIdExt(10003) +
            '</a:tr>';
        expect(out).toBe(
            SLIDE.replace('cy="1112520"', 'cy="1483360"').replace(
                SONG_ROWS[2],
                SONG_ROWS[2] + newRow,
            ),
        );
        expect(listSlideTables(out)[0]).toEqual({
            name: 'Table 3',
            rows: 4,
            columns: 3,
        });
        // taken out again: the slide as it was, byte for byte
        expect(removeTableRowXml(out, 'Table 3', 4)).toBe(SLIDE);
    });

    test('at 1: the heading row copied, put before it', () => {
        const out = expectXml(addTableRowXml(SLIDE, 'Table 3', 1, ['Hymn']));
        const genHeadCopy = (inner: string) => {
            return (
                '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>' +
                `${HEAD_PARAGRAPH_PROPS}${inner}${HEAD_END_PROPS}</a:p>` +
                `</a:txBody>${HEAD_CELL_PROPS}</a:tc>`
            );
        };
        const newRow =
            '<a:tr h="370840">' +
            genHeadCopy(`<a:r>${HEAD_RUN_PROPS}<a:t>Hymn</a:t></a:r>`) +
            genHeadCopy('') +
            genHeadCopy('') +
            genRowIdExt(10003) +
            '</a:tr>';
        expect(out).toBe(
            SLIDE.replace('cy="1112520"', 'cy="1483360"').replace(
                SONG_ROWS[0],
                newRow + SONG_ROWS[0],
            ),
        );
    });

    test('at 3: the row before it copied, its own height', () => {
        const tall = SLIDE.replace(
            SONG_ROWS[1],
            SONG_ROWS[1].replace('h="370840"', 'h="500000"'),
        );
        const out = expectXml(addTableRowXml(tall, 'Table 3', 3, ['Be Thou']));
        const at = out.indexOf('<a:t>Be Thou</a:t>');
        // after row 2, before row 3
        expect(out.lastIndexOf('<a:t>Anna</a:t>', at)).toBeGreaterThan(0);
        expect(out.indexOf('<a:t>How Great Thou Art</a:t>')).toBeGreaterThan(
            at,
        );
        expect(out.lastIndexOf('<a:tr h="500000">', at)).toBeGreaterThan(
            out.indexOf('<a:t>Anna</a:t>'),
        );
        expect(out).toContain('cy="1612520"');
    });

    test('a row taken out, the frame shorter, the rest unchanged', () => {
        expect(removeTableRowXml(SLIDE, 'Table 3', 2)).toBe(
            SLIDE.replace('cy="1112520"', 'cy="741680"').replace(
                SONG_ROWS[1],
                '',
            ),
        );
    });

    test('a number out of the table refused with its real size', () => {
        expect(addTableRowXml(SLIDE, 'Table 3', 5, [])).toEqual({
            reason:
                'The table "Table 3" has 3 rows, so a new row can be ' +
                'number 1 to 4.',
        });
        expect(addTableRowXml(SLIDE, 'Table 3', 0, [])).toHaveProperty(
            'reason',
        );
        expect(addTableRowXml(SLIDE, 'Table 3', 1.5, [])).toHaveProperty(
            'reason',
        );
        expect(removeTableRowXml(SLIDE, 'Table 3', 4)).toEqual({
            reason:
                'The table "Table 3" has 3 rows, so there is no row 4 to ' +
                'take out.',
        });
        expect(
            addTableRowXml(SLIDE, 'Table 3', null, ['a', 'b', 'c', 'd']),
        ).toEqual({
            reason:
                'The table "Table 3" has 3 columns, so a new row holds 3 ' +
                'cells, not 4.',
        });
    });

    test('the only row kept: take the table off instead', () => {
        expect(removeTableRowXml(SLIDE, 'Schedule', 1)).toEqual({
            reason:
                'Row 1 is the only row of the table "Schedule", so it ' +
                'cannot be taken out; take the table off instead.',
        });
    });

    test('in a grouped table with no ids: the copy carries none', () => {
        const out = expectXml(addTableRowXml(SLIDE, 'Schedule', null, ['11']));
        expect(out).toBe(
            SLIDE.replace('cy="370840"', 'cy="741680"').replace(
                genRow([genBodyCell('10:00')]),
                genRow([genBodyCell('10:00')]) +
                    '<a:tr h="370840">' +
                    genBodyCopy(
                        `<a:r>${BODY_RUN_PROPS}<a:t>11</a:t></a:r>` +
                            BODY_END_PROPS,
                    ) +
                    '</a:tr>',
            ),
        );
    });
});

describe('a column added or taken out', () => {
    test('at the end: the last column copied, the width kept', () => {
        const out = expectXml(
            addTableColumnXml(SLIDE, 'Table 3', null, ['Hymn no.', '12']),
        );
        const widths = readFirstWidths(out);
        expect(widths).toEqual([3386667, 2032000, 1354667, 1354666]);
        expect(
            widths.reduce((all, width) => {
                return all + width;
            }, 0),
        ).toBe(8128000);
        // the new column's own id, the next free one
        expect(out).toContain(
            `<a:gridCol w="1354666"><a:extLst><a:ext uri="${COLUMN_ID_URI}">` +
                `<a16:colId xmlns:a16="${A16}" val="20003"/></a:ext>` +
                '</a:extLst></a:gridCol></a:tblGrid>',
        );
        // a heading cell after "Leader", body cells after "Anna" and the
        // empty one, the row's id after them
        expect(out).toContain(
            '<a:t>Leader</a:t></a:r>' +
                `${HEAD_END_PROPS}</a:p></a:txBody>${HEAD_CELL_PROPS}</a:tc>` +
                '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>' +
                `${HEAD_PARAGRAPH_PROPS}<a:r>${HEAD_RUN_PROPS}<a:t>Hymn no.` +
                `</a:t></a:r>${HEAD_END_PROPS}</a:p></a:txBody>` +
                `${HEAD_CELL_PROPS}</a:tc>${genRowIdExt(10000)}`,
        );
        expect(out).toContain(
            `<a:t>12</a:t></a:r><a:endParaRPr lang="en-US" sz="2000" ` +
                'dirty="0"><a:solidFill><a:srgbClr val="C00000"/>' +
                '</a:solidFill></a:endParaRPr></a:p></a:txBody><a:tcPr/>' +
                `</a:tc>${genRowIdExt(10001)}`,
        );
        expect(out).toContain(
            `${genBodyCell('')}${genBodyCell('')}${genRowIdExt(10002)}`,
        );
        expect(listSlideTables(out)[0]).toEqual({
            name: 'Table 3',
            rows: 3,
            columns: 4,
        });
        // taken out again: the widths given back, the slide as it was
        expect(removeTableColumnXml(out, 'Table 3', 4)).toBe(SLIDE);
    });

    test('at 2: column 1 copied, put before column 2', () => {
        const out = expectXml(
            addTableColumnXml(SLIDE, 'Table 3', 2, ['Verse']),
        );
        expect(readFirstWidths(out)).toEqual([
            2709334, 2709333, 1625600, 1083733,
        ]);
        expect(out).toContain(
            `${HEAD_RUN_PROPS}<a:t>Song</a:t></a:r>${HEAD_END_PROPS}</a:p>` +
                `</a:txBody>${HEAD_CELL_PROPS}</a:tc><a:tc><a:txBody>` +
                `<a:bodyPr/><a:lstStyle/><a:p>${HEAD_PARAGRAPH_PROPS}<a:r>` +
                `${HEAD_RUN_PROPS}<a:t>Verse</a:t></a:r>`,
        );
        expect(out.indexOf('val="20003"')).toBeLessThan(
            out.indexOf('val="20001"'),
        );
        expect(out.indexOf('val="20003"')).toBeGreaterThan(
            out.indexOf('val="20000"'),
        );
    });

    test("the frame's width kept, not the grid's", () => {
        const out = expectXml(addTableColumnXml(SLIDE, 'Schedule', null, []));
        // the grid summed to 2000000 in a frame 3000000 wide
        expect(out).toContain(
            '<a:tblGrid><a:gridCol w="1500000"/><a:gridCol w="1500000"/>' +
                '</a:tblGrid>',
        );
    });

    test('a column taken out, its width shared out to the others', () => {
        const out = expectXml(removeTableColumnXml(SLIDE, 'Table 3', 2));
        expect(out).toBe(
            SLIDE.replace(SONG_COLUMNS[1], '')
                .replace('w="4064000"', 'w="5805714"')
                .replace('w="1625600"', 'w="2322286"')
                .replace(genHeadCell('Key'), '')
                .replace(genBodyCell('G'), '')
                .replace(genBodyCell('Bb'), ''),
        );
    });

    test('a number out of the table refused with its real size', () => {
        expect(addTableColumnXml(SLIDE, 'Table 3', 0, [])).toEqual({
            reason:
                'The table "Table 3" has 3 columns, so a new column can be ' +
                'number 1 to 4.',
        });
        expect(removeTableColumnXml(SLIDE, 'Table 3', 9)).toEqual({
            reason:
                'The table "Table 3" has 3 columns, so there is no column ' +
                '9 to take out.',
        });
        expect(
            addTableColumnXml(SLIDE, 'Table 3', null, ['a', 'b', 'c', 'd']),
        ).toEqual({
            reason:
                'The table "Table 3" has 3 rows, so a new column holds 3 ' +
                'cells, not 4.',
        });
        expect(removeTableColumnXml(SLIDE, 'Schedule', 1)).toEqual({
            reason:
                'Column 1 is the only column of the table "Schedule", so ' +
                'it cannot be taken out; take the table off instead.',
        });
    });
});

describe('merged cells', () => {
    // row 1: A spans columns 1-2 (B covered); column 3: F spans rows 2-3
    // (I covered)
    const MERGED_ROWS = [
        genRow([
            genHeadCell('A', ' gridSpan="2"'),
            genHeadCell('', ' hMerge="1"'),
            genHeadCell('C'),
        ]),
        genRow([
            genBodyCell('D'),
            genBodyCell('E'),
            genBodyCell('F', ' rowSpan="2"'),
        ]),
        genRow([
            genBodyCell('G'),
            genBodyCell('H'),
            genBodyCell('', ' vMerge="1"'),
        ]),
    ];
    const MERGED = genSlide(
        genTableFrame(
            'Merged',
            4,
            genColumn(3000000) + genColumn(3000000) + genColumn(3000000),
            MERGED_ROWS.join(''),
            9000000,
            1112520,
        ),
    );

    test('no column put or taken where a merge crosses', () => {
        expect(addTableColumnXml(MERGED, 'Merged', 2, [])).toEqual({
            reason:
                'Cells of the table "Merged" are merged across columns 1 ' +
                'and 2, so a new column cannot go between them; unmerge ' +
                'those cells first or choose another place.',
        });
        const across = {
            reason:
                'Column 1 of the table "Merged" has a cell merged with the ' +
                'column beside it, so it cannot be taken out alone; unmerge ' +
                'that cell first.',
        };
        expect(removeTableColumnXml(MERGED, 'Merged', 1)).toEqual(across);
        expect(removeTableColumnXml(MERGED, 'Merged', 2)).toEqual({
            reason: across.reason.replace('Column 1', 'Column 2'),
        });
        // beside the merge, and a column merged only downwards
        expect(typeof addTableColumnXml(MERGED, 'Merged', 3, [])).toBe(
            'string',
        );
        expect(typeof addTableColumnXml(MERGED, 'Merged', 1, [])).toBe(
            'string',
        );
        expect(
            listSlideTables(
                expectXml(removeTableColumnXml(MERGED, 'Merged', 3)),
            ),
        ).toEqual([{ name: 'Merged', rows: 3, columns: 2 }]);
    });

    test('no row put or taken where a merge crosses', () => {
        expect(addTableRowXml(MERGED, 'Merged', 3, [])).toEqual({
            reason:
                'Cells of the table "Merged" are merged across rows 2 and 3, ' +
                'so a new row cannot go between them; unmerge those cells ' +
                'first or choose another place.',
        });
        const across = {
            reason:
                'Row 2 of the table "Merged" has a cell merged with the row ' +
                'above or below it, so it cannot be taken out alone; ' +
                'unmerge that cell first.',
        };
        expect(removeTableRowXml(MERGED, 'Merged', 2)).toEqual(across);
        expect(removeTableRowXml(MERGED, 'Merged', 3)).toEqual({
            reason: across.reason.replace('Row 2', 'Row 3'),
        });
        // a row merged only across is taken out whole
        expect(removeTableRowXml(MERGED, 'Merged', 1)).toBe(
            MERGED.replace(MERGED_ROWS[0], '').replace(
                'cy="1112520"',
                'cy="741680"',
            ),
        );
    });

    test('a row copied from a merged one has a cell per column', () => {
        const out = expectXml(addTableRowXml(MERGED, 'Merged', 2, ['x', 'y']));
        const newRow = out.slice(
            out.indexOf(MERGED_ROWS[0]) + MERGED_ROWS[0].length,
            out.indexOf(MERGED_ROWS[1]),
        );
        expect(newRow.match(/<a:tc>/g)).toHaveLength(3);
        expect(newRow).not.toMatch(/gridSpan|hMerge|rowSpan|vMerge/);
        expect(newRow).toContain('<a:t>y</a:t>');
    });
});

describe('the words and look of a new cell', () => {
    const LINKED =
        '<a:tc id="7"><a:txBody><a:bodyPr anchor="b"/><a:p><a:r>' +
        '<a:rPr lang="en-US"><a:hlinkClick r:id="rId9"/></a:rPr>' +
        '<a:t>site</a:t></a:r></a:p></a:txBody></a:tc>';
    const slide = genSlide(
        genTableFrame(
            'Links',
            4,
            genColumn(1000000),
            genRow([LINKED]),
            1000000,
            370840,
        ),
    );

    test('lines broken, no link, no cell id, a body with no list style', () => {
        const out = expectXml(
            addTableRowXml(slide, 'Links', null, ['One\nTwo']),
        );
        expect(out).toContain(
            `${LINKED}</a:tr><a:tr h="370840"><a:tc><a:txBody>` +
                '<a:bodyPr anchor="b"/><a:p><a:r><a:rPr lang="en-US"></a:rPr>' +
                '<a:t>One</a:t></a:r><a:br><a:rPr lang="en-US"></a:rPr>' +
                '</a:br><a:r><a:rPr lang="en-US"></a:rPr><a:t>Two</a:t>' +
                '</a:r><a:endParaRPr lang="en-US"></a:endParaRPr></a:p>' +
                '</a:txBody></a:tc></a:tr>',
        );
    });

    test('widths made whole numbers summing exactly', () => {
        expect(fitWidths([1, 1, 1], 100)).toEqual([34, 33, 33]);
        expect(fitWidths([0, 0], 5)).toEqual([3, 2]);
        expect(fitWidths([], 5)).toEqual([]);
    });
});
