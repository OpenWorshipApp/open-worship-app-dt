import { describe, expect, test } from 'vitest';

import {
    type OfficeTableLookType,
    readTableLook,
    setTableLookXml,
} from './officeSlideTableLookHelpers';

// --- a slide as PowerPoint writes a table on it ------------------------------

const TABLE_STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';
const EXT_URI = '{B1F0C2D4-5A6E-4F70-8C9D-0A1B2C3D4E5F}';

function genCell(text: string, props = '', attributes = '') {
    const paragraph =
        text === ''
            ? '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>'
            : `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${text}</a:t>` +
              '</a:r></a:p>';
    return (
        `<a:tc${attributes}><a:txBody><a:bodyPr/><a:lstStyle/>${paragraph}` +
        `</a:txBody>${props}</a:tc>`
    );
}

// row 1: a centred cell, a cell with a fill of its own, one with no props
const A1_PROPS = '<a:tcPr anchor="ctr"/>';
const B1_PROPS =
    '<a:tcPr marL="45720"><a:solidFill><a:srgbClr val="FFC000"/>' +
    '</a:solidFill></a:tcPr>';
// row 2: a diagonal line (its own `a:noFill` is not the cell's fill) and an
// extension, the two children that sit around the borders and the fill
const C2_DIAGONAL = '<a:lnTlToBr w="6350"><a:noFill/></a:lnTlToBr>';
const C2_EXTENSIONS = `<a:extLst><a:ext uri="${EXT_URI}"/></a:extLst>`;
const C2_PROPS = `<a:tcPr anchor="b">${C2_DIAGONAL}${C2_EXTENSIONS}</a:tcPr>`;

const CELL_LIST = [
    genCell('Song', A1_PROPS),
    genCell('Key', B1_PROPS),
    genCell('Leader'),
    genCell('Amazing Grace'),
    genCell('G', '<a:tcPr/>'),
    genCell('Ana', C2_PROPS),
    // row 3: the first cell spans two columns, the second is covered
    genCell('Offering', '<a:tcPr/>', ' gridSpan="2"'),
    genCell('', '<a:tcPr/>', ' hMerge="1"'),
    genCell('Team', '<a:tcPr/>'),
];

function genRows(cells: string[]) {
    return [0, 3, 6]
        .map((at) => {
            return `<a:tr h="370840">${cells.slice(at, at + 3).join('')}</a:tr>`;
        })
        .join('');
}

const TABLE_PROPS =
    '<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>' +
    `${TABLE_STYLE_ID}</a:tableStyleId></a:tblPr>`;

function genTableFrame(tableProps: string, cells: string[]) {
    return (
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" ' +
        'name="Table 2"/><p:cNvGraphicFramePr><a:graphicFrameLocks ' +
        'noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
        '<p:xfrm><a:off x="2032000" y="1397000"/><a:ext cx="8128000" ' +
        'cy="1112520"/></p:xfrm><a:graphic><a:graphicData uri="http://' +
        'schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>' +
        `${tableProps}<a:tblGrid><a:gridCol w="2709333"/>` +
        '<a:gridCol w="2709333"/><a:gridCol w="2709334"/></a:tblGrid>' +
        `${genRows(cells)}</a:tbl></a:graphicData></a:graphic>` +
        '</p:graphicFrame>'
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

// a box after the table with fills and lines of its own, to be left alone
const NOTE =
    '<p:sp><p:nvSpPr><p:cNvPr id="5" name="Note 3"/><p:cNvSpPr/><p:nvPr/>' +
    '</p:nvSpPr><p:spPr><a:solidFill><a:srgbClr val="DDEEFF"/>' +
    '</a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/>' +
    '</a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr/><a:p><a:r>' +
    '<a:t>Bring a friend</a:t></a:r></a:p></p:txBody></p:sp>';

const SLIDE = genSlide(TITLE + genTableFrame(TABLE_PROPS, CELL_LIST) + NOTE);

// --- reading it back ----------------------------------------------------------

function expectDone(
    result: { xml: string; cells: number } | { reason: string },
) {
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function expectReason(
    result: { xml: string; cells: number } | { reason: string },
) {
    if (!('reason' in result)) {
        throw new Error('the change was not refused');
    }
    return result.reason;
}

function readCells(xml: string) {
    return [...xml.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((matched) => {
        return matched[0];
    });
}

function readCellProps(cell: string) {
    return /<a:tcPr\b(?:[^>]*\/>|[\s\S]*?<\/a:tcPr>)/.exec(cell)?.[0] ?? '';
}

function readTableProps(xml: string) {
    return /<a:tblPr\b[^>]*>/.exec(xml)?.[0] ?? '';
}

// everything before the table's `<a:tbl>` and after its `</a:tbl>`
function readOutside(xml: string) {
    const start = xml.indexOf('<a:tbl>');
    const end = xml.indexOf('</a:tbl>') + '</a:tbl>'.length;
    return [xml.slice(0, start), xml.slice(end)];
}

function expectOnlyChanged(xml: string, changed: Record<number, string>) {
    readCells(xml).forEach((cell, index) => {
        expect(cell).toBe(changed[index] ?? CELL_LIST[index]);
    });
}

const GREEN_FILL = '<a:solidFill><a:srgbClr val="00B050"/></a:solidFill>';

function genBorders(hex: string) {
    return ['a:lnL', 'a:lnR', 'a:lnT', 'a:lnB']
        .map((name) => {
            return (
                `<${name} w="12700"><a:solidFill><a:srgbClr val="${hex}"/>` +
                `</a:solidFill></${name}>`
            );
        })
        .join('');
}

// --- fills ----------------------------------------------------------------------

describe('setTableLookXml fills', () => {
    test('fills every cell but the covered merged one', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { fill: '00B050' }),
        );
        expect(done.cells).toBe(8);
        const cells = readCells(done.xml);
        cells.forEach((cell, index) => {
            if (index === 7) {
                expect(cell).toBe(CELL_LIST[7]);
                return;
            }
            expect(readCellProps(cell)).toContain(GREEN_FILL);
            expect(cell.match(/<a:solidFill>/g)).toHaveLength(1);
        });
        expect(readTableProps(done.xml)).toBe(readTableProps(SLIDE));
    });

    test('fills row 1 only', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { fill: '00B050', rows: [1] }),
        );
        expect(done.cells).toBe(3);
        expectOnlyChanged(done.xml, {
            0: genCell('Song', `<a:tcPr anchor="ctr">${GREEN_FILL}</a:tcPr>`),
            1: genCell('Key', `<a:tcPr marL="45720">${GREEN_FILL}</a:tcPr>`),
            2: genCell('Leader', `<a:tcPr>${GREEN_FILL}</a:tcPr>`),
        });
    });

    test('fills column 2 only, with the merged cell that spans it', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                columns: [2],
            }),
        );
        expect(done.cells).toBe(3);
        expectOnlyChanged(done.xml, {
            1: genCell('Key', `<a:tcPr marL="45720">${GREEN_FILL}</a:tcPr>`),
            4: genCell('G', `<a:tcPr>${GREEN_FILL}</a:tcPr>`),
            6: genCell(
                'Offering',
                `<a:tcPr>${GREEN_FILL}</a:tcPr>`,
                ' gridSpan="2"',
            ),
        });
    });

    test('fills only where the rows and the columns cross', () => {
        const one = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [2],
                columns: [3],
            }),
        );
        expect(one.cells).toBe(1);
        expectOnlyChanged(one.xml, {
            5: genCell(
                'Ana',
                `<a:tcPr anchor="b">${C2_DIAGONAL}${GREEN_FILL}` +
                    `${C2_EXTENSIONS}</a:tcPr>`,
            ),
        });
        const two = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [1, 3],
                columns: [2],
            }),
        );
        expect(two.cells).toBe(2);
        expectOnlyChanged(two.xml, {
            1: genCell('Key', `<a:tcPr marL="45720">${GREEN_FILL}</a:tcPr>`),
            6: genCell(
                'Offering',
                `<a:tcPr>${GREEN_FILL}</a:tcPr>`,
                ' gridSpan="2"',
            ),
        });
    });

    test('empty rows and columns mean every cell', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [],
                columns: [],
            }),
        );
        expect(done.cells).toBe(8);
    });

    test('a fill replaces the one a cell had, its attributes kept', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '1f4e79',
                rows: [1],
                columns: [2],
            }),
        );
        expect(done.cells).toBe(1);
        expectOnlyChanged(done.xml, {
            1: genCell(
                'Key',
                '<a:tcPr marL="45720"><a:solidFill><a:srgbClr val="1F4E79"/>' +
                    '</a:solidFill></a:tcPr>',
            ),
        });
    });

    test('a self-closing tcPr keeps its attributes', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [1],
                columns: [1],
            }),
        );
        expect(readCellProps(readCells(done.xml)[0])).toBe(
            `<a:tcPr anchor="ctr">${GREEN_FILL}</a:tcPr>`,
        );
    });

    test('a cell without a tcPr gets one right after its words', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [2],
                columns: [1],
            }),
        );
        expect(readCells(done.xml)[3]).toContain(
            `</a:txBody><a:tcPr>${GREEN_FILL}</a:tcPr></a:tc>`,
        );
    });

    test('a null fill takes off the fill a cell set, nothing else', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { fill: null }),
        );
        // only one cell had a fill of its own; the diagonal's is not one
        expect(done.cells).toBe(1);
        expect(done.xml).toBe(
            SLIDE.replace(B1_PROPS, '<a:tcPr marL="45720"/>'),
        );
    });

    test('a null fill where none is set changes nothing', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { fill: null, rows: [2, 3] }),
        );
        expect(done.cells).toBe(0);
        expect(done.xml).toBe(SLIDE);
    });

    test('a covered merged cell is never written', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                borders: '000000',
                rows: [3],
                columns: [2],
            }),
        );
        // the cell spanning column 2 carries it
        expect(done.cells).toBe(1);
        const cells = readCells(done.xml);
        expect(cells[7]).toBe(CELL_LIST[7]);
        expect(readCellProps(cells[6])).toBe(
            `<a:tcPr>${genBorders('000000')}${GREEN_FILL}</a:tcPr>`,
        );
    });

    test('finds the table in any case', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, ' table 2 ', { fill: '00B050' }),
        );
        expect(done.cells).toBe(8);
    });
});

// --- borders --------------------------------------------------------------------

describe('setTableLookXml borders', () => {
    test('borders go before the fill, each in its schema place', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: 'FFFFFF',
                borders: '000000',
                rows: [1, 2],
                columns: [2, 3],
            }),
        );
        expect(done.cells).toBe(4);
        const white = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
        const borders = genBorders('000000');
        expectOnlyChanged(done.xml, {
            1: genCell(
                'Key',
                `<a:tcPr marL="45720">${borders}${white}</a:tcPr>`,
            ),
            2: genCell('Leader', `<a:tcPr>${borders}${white}</a:tcPr>`),
            4: genCell('G', `<a:tcPr>${borders}${white}</a:tcPr>`),
            // before the diagonal, the fill after it and before extensions
            5: genCell(
                'Ana',
                `<a:tcPr anchor="b">${borders}${C2_DIAGONAL}${white}` +
                    `${C2_EXTENSIONS}</a:tcPr>`,
            ),
        });
    });

    test('borders alone keep the fill a cell had', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                borders: 'c00000',
                rows: [1],
                columns: [2],
            }),
        );
        expect(readCellProps(readCells(done.xml)[1])).toBe(
            `<a:tcPr marL="45720">${genBorders('C00000')}<a:solidFill>` +
                '<a:srgbClr val="FFC000"/></a:solidFill></a:tcPr>',
        );
    });

    test('new borders replace the ones set, and null takes them off', () => {
        const first = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { borders: '000000' }),
        );
        const second = expectDone(
            setTableLookXml(first.xml, 'Table 2', { borders: '7F7F7F' }),
        );
        expect(second.xml.match(/<a:lnL\b/g)).toHaveLength(8);
        expect(second.xml).not.toContain(
            'val="000000"/></a:solidFill></a:lnL>',
        );
        const off = expectDone(
            setTableLookXml(second.xml, 'Table 2', { borders: null }),
        );
        expect(off.cells).toBe(8);
        expect(off.xml).not.toMatch(/<a:ln[LRTB]\b/);
        const cells = readCells(off.xml);
        // what else the cells had stays: the fill, the diagonal, attributes
        expect(readCellProps(cells[0])).toBe(A1_PROPS);
        expect(readCellProps(cells[1])).toBe(B1_PROPS);
        expect(readCellProps(cells[5])).toBe(C2_PROPS);
        // a cell that had no props keeps an empty one
        expect(readCellProps(cells[2])).toBe('<a:tcPr/>');
    });
});

// --- the table style's header row and banded rows ---------------------------------

describe('setTableLookXml header and banded', () => {
    test('turns the header row off and on, the cells untouched', () => {
        const off = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { header: false }),
        );
        expect(off.cells).toBe(0);
        expect(readTableProps(off.xml)).toBe('<a:tblPr bandRow="1">');
        expectOnlyChanged(off.xml, {});
        expect(off.xml).toContain(`<a:tableStyleId>${TABLE_STYLE_ID}`);
        const on = expectDone(
            setTableLookXml(off.xml, 'Table 2', { header: true }),
        );
        expect(readTableProps(on.xml)).toBe(
            '<a:tblPr bandRow="1" firstRow="1">',
        );
    });

    test('turns banded rows off', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { banded: false }),
        );
        expect(readTableProps(done.xml)).toBe('<a:tblPr firstRow="1">');
    });

    test('a flag already so is left as written', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', { header: true, banded: true }),
        );
        expect(done.xml).toBe(SLIDE);
    });

    test('a table without tblPr gets one for a flag turned on', () => {
        const bare = genSlide(TITLE + genTableFrame('', CELL_LIST) + NOTE);
        const off = expectDone(
            setTableLookXml(bare, 'Table 2', { header: false }),
        );
        expect(off.xml).toBe(bare);
        const on = expectDone(
            setTableLookXml(bare, 'Table 2', { header: true, banded: true }),
        );
        expect(on.xml).toContain(
            '<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>',
        );
    });

    test('a fill and a flag together', () => {
        const done = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '00B050',
                rows: [1],
                header: false,
            }),
        );
        expect(done.cells).toBe(3);
        expect(readTableProps(done.xml)).toBe('<a:tblPr bandRow="1">');
    });
});

// --- the rest of the slide ----------------------------------------------------------

describe('setTableLookXml outside the table', () => {
    const LOOK_LIST: OfficeTableLookType[] = [
        { fill: '00B050' },
        { fill: null },
        { borders: '000000', rows: [2] },
        { borders: null },
        { header: false, banded: false },
        { fill: 'FFFFFF', borders: '000000', columns: [3], header: true },
    ];

    test.each(LOOK_LIST)(
        '%o leaves every byte outside it as it was',
        (look) => {
            const done = expectDone(setTableLookXml(SLIDE, 'Table 2', look));
            expect(readOutside(done.xml)).toEqual(readOutside(SLIDE));
        },
    );
});

// --- refused --------------------------------------------------------------------------

describe('setTableLookXml refusals', () => {
    test('an unknown table names the tables there are', () => {
        expect(
            expectReason(setTableLookXml(SLIDE, 'Table 9', { fill: '00B050' })),
        ).toBe(
            'There is no table "Table 9" on this slide; its table is "Table 2".',
        );
        expect(
            expectReason(
                setTableLookXml(genSlide(TITLE), 'Table 2', {
                    fill: '00B050',
                }),
            ),
        ).toBe(
            'There is no table "Table 2" on this slide; it has no tables at all.',
        );
    });

    test('a row or a column past the table says how many it has', () => {
        expect(
            expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    fill: '00B050',
                    rows: [1, 4],
                }),
            ),
        ).toBe(
            'The table "Table 2" has 3 rows, so there is no row 4; its rows ' +
                'are numbered 1 to 3.',
        );
        expect(
            expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    borders: '000000',
                    columns: [0],
                }),
            ),
        ).toBe(
            'The table "Table 2" has 3 columns, so there is no column 0; its ' +
                'columns are numbered 1 to 3.',
        );
        expect(
            expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    fill: '00B050',
                    rows: ['2'] as unknown as number[],
                }),
            ),
        ).toContain('there is no row "2"');
    });

    test('a colour not six hex digits is refused', () => {
        for (const fill of ['green', '#00B050', '0B5', '00B05G', 123456]) {
            const reason = expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    fill: fill as string,
                }),
            );
            expect(reason).toBe(
                `${JSON.stringify(fill)} is not a colour for \`fill\`: give ` +
                    'six hex digits RRGGBB, without "#" (for example ' +
                    '1F4E79), or null to take the fill the cells have of ' +
                    'their own off.',
            );
        }
        expect(
            expectReason(setTableLookXml(SLIDE, 'Table 2', { borders: 'red' })),
        ).toContain('"red" is not a colour for `borders`');
    });

    test('a look with nothing in it is refused', () => {
        expect(expectReason(setTableLookXml(SLIDE, 'Table 2', {}))).toBe(
            'This look changes nothing: give `fill` or `borders` (a colour ' +
                'as RRGGBB, or null to take it off), or `header` or `banded` ' +
                '(true or false).',
        );
        expect(
            expectReason(setTableLookXml(SLIDE, 'Table 2', { rows: [1] })),
        ).toContain('This look changes nothing');
        expect(
            expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    header: true,
                    columns: [1],
                }),
            ),
        ).toBe(
            '`rows` and `columns` pick the cells a `fill` or `borders` goes ' +
                'on, and this look has neither; give one, or leave `rows` ' +
                'and `columns` out.',
        );
    });

    test('a flag that is not true or false is refused', () => {
        expect(
            expectReason(
                setTableLookXml(SLIDE, 'Table 2', {
                    header: 'yes' as unknown as boolean,
                }),
            ),
        ).toBe('`header` is true or false.');
    });
});

// --- read -------------------------------------------------------------------------------

describe('readTableLook', () => {
    test('reads the flags and the fills cells set', () => {
        expect(readTableLook(SLIDE, 'Table 2')).toEqual({
            header: true,
            banded: true,
            fills: ['FFC000'],
        });
    });

    test('reads what a change made', () => {
        const filled = expectDone(
            setTableLookXml(SLIDE, 'Table 2', {
                fill: '1F4E79',
                rows: [2],
                header: false,
            }),
        );
        expect(readTableLook(filled.xml, 'Table 2')).toEqual({
            header: false,
            banded: true,
            fills: ['FFC000', '1F4E79'],
        });
        const all = expectDone(
            setTableLookXml(filled.xml, 'Table 2', {
                fill: '00B050',
                borders: '000000',
                banded: false,
            }),
        );
        // a border's colour is not a fill
        expect(readTableLook(all.xml, 'Table 2')).toEqual({
            header: false,
            banded: false,
            fills: ['00B050'],
        });
        const cleared = expectDone(
            setTableLookXml(all.xml, 'Table 2', { fill: null }),
        );
        expect(readTableLook(cleared.xml, 'Table 2')?.fills).toEqual([]);
    });

    test('a covered merged cell shows no fill of its own', () => {
        const covered = SLIDE.replace(
            genCell('', '<a:tcPr/>', ' hMerge="1"'),
            genCell(
                '',
                '<a:tcPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>' +
                    '</a:tcPr>',
                ' hMerge="1"',
            ),
        );
        expect(covered).not.toBe(SLIDE);
        expect(readTableLook(covered, 'Table 2')?.fills).toEqual(['FFC000']);
    });

    test('an unknown table reads as null', () => {
        expect(readTableLook(SLIDE, 'Table 9')).toBeNull();
        expect(readTableLook(genSlide(TITLE), 'Table 2')).toBeNull();
    });
});
