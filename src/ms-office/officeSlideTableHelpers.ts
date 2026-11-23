// The SHAPE of a table on a PowerPoint slide -- a row or a column added or
// taken out -- for `owa_office_edit` (2026-11-20, the goal _chatbot can
// change do everything on a given pptx_). The words in a table's cells are
// lines and change as every other line does; this is rows and columns only.
//
// A slide's table is a `p:graphicFrame` holding `a:graphic` >
// `a:graphicData` > `a:tbl`: its column widths in `a:tblGrid` (`a:gridCol
// w=`), then its rows (`a:tr h=`), each one `a:tc` per grid column. A merged
// cell spans with `gridSpan` / `rowSpan`, and the cells it covers stay in
// place, marked `hMerge` / `vMerge`.
//
// A new row or column looks like the one it is put after; the table keeps
// its width (the columns share it again) and grows or shrinks by a row's
// height; a change that would cut a merged cell is refused. Pure, strings in
// and out, the same tag scanner as the words: only what changes is touched.

import { type SlideBoxType, listSlideBoxes } from './officeSlideBoxHelpers';
import {
    type ElementType,
    escapeXmlText,
    listChildElements,
    toWrittenText,
} from './officeXmlEditHelpers';

export type SlideTableType = { name: string; rows: number; columns: number };

// A number attribute and where its digits are in the slide.
type NumberSpotType = { value: number; start: number; end: number };

type TableCellType = {
    element: ElementType;
    gridSpan: number;
    rowSpan: number;
    isHMerge: boolean;
    isVMerge: boolean;
};

type TableRowType = {
    element: ElementType;
    height: number;
    cells: TableCellType[];
    extList: ElementType | null;
};

type TableColumnType = {
    element: ElementType;
    width: NumberSpotType | null;
    extList: ElementType | null;
};

type TableReadType = {
    name: string;
    table: ElementType;
    columns: TableColumnType[];
    rows: TableRowType[];
    // the frame's own size, `p:xfrm` > `a:ext`
    frameWidth: NumberSpotType | null;
    frameHeight: NumberSpotType | null;
};

type EditType = { start: number; end: number; text: string };

// the largest id `a16:rowId` / `a16:colId` holds (an unsigned int)
const MAX_ID = 4294967295;

// What a COPY of a cell must not carry: a merge belongs to the cell it was
// made on, and `id` names one cell.
const CELL_ONLY_ATTRIBUTE_PATTERN =
    /\s(?:gridSpan|rowSpan|hMerge|vMerge|id)\s*=\s*(?:"[^"]*"|'[^']*')/g;

// A link belongs to the words it was put on, not to their look.
const LINK_PATTERN =
    /<a:(hlinkClick|hlinkMouseOver)\b(?:[^>"']|"[^"]*"|'[^']*')*?(?:\/>|>[\s\S]*?<\/a:\1>)/g;

function listOwnChildren(xml: string, element: ElementType) {
    if (element.openEnd === element.end) {
        return [];
    }
    return listChildElements(xml, element.openEnd, element.closeStart);
}

function findOwnChild(xml: string, element: ElementType, name: string) {
    return (
        listOwnChildren(xml, element).find((child) => {
            return child.name === name;
        }) ?? null
    );
}

function readAttributeText(xml: string, element: ElementType, name: string) {
    const matched = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    ).exec(xml.slice(element.start, element.openEnd));
    return matched === null ? null : (matched[1] ?? matched[2]);
}

function readNumberSpot(
    xml: string,
    element: ElementType,
    name: string,
): NumberSpotType | null {
    const matched = new RegExp(`(\\s${name}\\s*=\\s*["'])(-?\\d+)["']`).exec(
        xml.slice(element.start, element.openEnd),
    );
    if (matched === null) {
        return null;
    }
    const start = element.start + matched.index + matched[1].length;
    return {
        value: Number(matched[2]),
        start,
        end: start + matched[2].length,
    };
}

function checkIsOn(value: string | null) {
    return value === '1' || value === 'true';
}

function readSpan(xml: string, cell: ElementType, name: string) {
    const value = Number(readAttributeText(xml, cell, name) ?? 1);
    return Number.isInteger(value) && value > 1 ? value : 1;
}

function readTable(xml: string, box: SlideBoxType): TableReadType | null {
    const frame = listChildElements(xml, box.start, box.end)[0];
    if (frame === undefined) {
        return null;
    }
    const frameChildren = listOwnChildren(xml, frame);
    const place = frameChildren.find((child) => {
        return child.name === 'p:xfrm';
    });
    const ext = place === undefined ? null : findOwnChild(xml, place, 'a:ext');
    const graphic = frameChildren.find((child) => {
        return child.name === 'a:graphic';
    });
    const data =
        graphic === undefined
            ? null
            : findOwnChild(xml, graphic, 'a:graphicData');
    const table = data === null ? null : findOwnChild(xml, data, 'a:tbl');
    if (table === null) {
        return null;
    }
    const tableChildren = listOwnChildren(xml, table);
    const grid = tableChildren.find((child) => {
        return child.name === 'a:tblGrid';
    });
    const columns = (grid === undefined ? [] : listOwnChildren(xml, grid))
        .filter((child) => {
            return child.name === 'a:gridCol';
        })
        .map((element) => {
            return {
                element,
                width: readNumberSpot(xml, element, 'w'),
                extList: findOwnChild(xml, element, 'a:extLst'),
            };
        });
    const rows = tableChildren
        .filter((child) => {
            return child.name === 'a:tr';
        })
        .map((element) => {
            const rowChildren = listOwnChildren(xml, element);
            return {
                element,
                height: readNumberSpot(xml, element, 'h')?.value ?? 0,
                cells: rowChildren
                    .filter((child) => {
                        return child.name === 'a:tc';
                    })
                    .map((cell) => {
                        return {
                            element: cell,
                            gridSpan: readSpan(xml, cell, 'gridSpan'),
                            rowSpan: readSpan(xml, cell, 'rowSpan'),
                            isHMerge: checkIsOn(
                                readAttributeText(xml, cell, 'hMerge'),
                            ),
                            isVMerge: checkIsOn(
                                readAttributeText(xml, cell, 'vMerge'),
                            ),
                        };
                    }),
                extList:
                    rowChildren.find((child) => {
                        return child.name === 'a:extLst';
                    }) ?? null,
            };
        });
    return {
        name: box.name,
        table,
        columns,
        rows,
        frameWidth: ext === null ? null : readNumberSpot(xml, ext, 'cx'),
        frameHeight: ext === null ? null : readNumberSpot(xml, ext, 'cy'),
    };
}

function readSlideTables(slideXml: string) {
    const out: TableReadType[] = [];
    for (const box of listSlideBoxes(slideXml)) {
        if (box.kind !== 'table') {
            continue;
        }
        const table = readTable(slideXml, box);
        if (table !== null) {
            out.push(table);
        }
    }
    return out;
}

/** Every table on the slide, by its frame's name, in document order. */
export function listSlideTables(slideXml: string): SlideTableType[] {
    return readSlideTables(slideXml).map((table) => {
        return {
            name: table.name,
            rows: table.rows.length,
            columns: table.columns.length,
        };
    });
}

function toCountText(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function toListText(names: string[]) {
    if (names.length <= 1) {
        return names.join('');
    }
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The table `tableName` means -- its name, else in any case -- or why not. */
function findSlideTable(
    slideXml: string,
    tableName: string,
): TableReadType | { reason: string } {
    const tables = readSlideTables(slideXml);
    const wanted = tableName.trim();
    const found =
        tables.find((table) => {
            return table.name === wanted;
        }) ??
        tables.find((table) => {
            return table.name.toLowerCase() === wanted.toLowerCase();
        });
    if (found !== undefined) {
        return found;
    }
    if (tables.length === 0) {
        return {
            reason: `There is no table "${wanted}" on this slide; it has no tables at all.`,
        };
    }
    const names = tables.map((table) => {
        return `"${table.name}"`;
    });
    return {
        reason:
            `There is no table "${wanted}" on this slide; its ` +
            `${names.length === 1 ? 'table is' : 'tables are'} ` +
            `${toListText(names)}.`,
    };
}

/** Each row one cell per grid column, each column a width: a plain grid. */
function checkIsPlainGrid(table: TableReadType) {
    return (
        table.rows.every((row) => {
            return row.cells.length === table.columns.length;
        }) &&
        table.columns.every((column) => {
            return column.width !== null;
        })
    );
}

function toNotPlainReason(table: TableReadType, what: string) {
    return (
        `The table "${table.name}" is not laid out as plain rows and ` +
        `columns, so its ${what} cannot be changed here.`
    );
}

/**
 * Whether a merged cell runs over the line above row `index` (0-based): a
 * cell above spans down past it, or a cell of that row continues one.
 */
function checkIsRowLineMerged(rows: TableRowType[], index: number) {
    if (index <= 0 || index >= rows.length) {
        return false;
    }
    if (
        rows[index].cells.some((cell) => {
            return cell.isVMerge;
        })
    ) {
        return true;
    }
    return rows.slice(0, index).some((row, rowIndex) => {
        return row.cells.some((cell) => {
            return rowIndex + cell.rowSpan > index;
        });
    });
}

/** The same for the line left of column `index`, in a plain grid. */
function checkIsColumnLineMerged(
    rows: TableRowType[],
    columnCount: number,
    index: number,
) {
    if (index <= 0 || index >= columnCount) {
        return false;
    }
    return rows.some((row) => {
        return (
            row.cells[index].isHMerge ||
            row.cells.slice(0, index).some((cell, cellIndex) => {
                return cellIndex + cell.gridSpan > index;
            })
        );
    });
}

function applyEdits(xml: string, edits: EditType[]) {
    const sorted = [...edits].sort((a, b) => {
        return a.start - b.start || a.end - b.end;
    });
    let out = '';
    let cursor = 0;
    for (const edit of sorted) {
        out += xml.slice(cursor, edit.start) + edit.text;
        cursor = edit.end;
    }
    return out + xml.slice(cursor);
}

function toNumberEdit(spot: NumberSpotType, value: number): EditType {
    return { start: spot.start, end: spot.end, text: String(value) };
}

function toWhole(value: number) {
    return BigInt(Math.max(Math.round(value), 0));
}

/**
 * `widths` made whole numbers that sum to `total` exactly, each in its
 * share: the parts left over go to the largest remainders, the first first.
 * Exact integer sums -- a float's remainders of two equal shares can differ
 * in their last digit and hand the part to the wrong one.
 */
export function fitWidths(widths: readonly number[], total: number) {
    if (widths.length === 0) {
        return [];
    }
    const zero = BigInt(0);
    const whole = toWhole(total);
    let shares = widths.map(toWhole);
    let sum = shares.reduce((all, share) => {
        return all + share;
    }, zero);
    if (sum === zero) {
        // no widths to go by: shared out evenly
        shares = shares.map(() => {
            return BigInt(1);
        });
        sum = BigInt(shares.length);
    }
    const out = shares.map((share) => {
        return (share * whole) / sum;
    });
    let left =
        whole -
        out.reduce((all, width) => {
            return all + width;
        }, zero);
    const order = shares
        .map((share, index) => {
            return { index, remainder: (share * whole) % sum };
        })
        .sort((a, b) => {
            if (a.remainder === b.remainder) {
                return a.index - b.index;
            }
            return a.remainder > b.remainder ? -1 : 1;
        });
    for (let at = 0; left > zero; at++) {
        out[order[at % order.length].index] += BigInt(1);
        left -= BigInt(1);
    }
    return out.map((width) => {
        return Number(width);
    });
}

// --- the ids Office keys a row or a column by (`a16:rowId`, `a16:colId`) --

type IdKindType = 'rowId' | 'colId';

function genIdPattern(kind: IdKindType) {
    return new RegExp(`(<[\\w.-]+:${kind}\\b[^>]*?\\sval\\s*=\\s*["'])(\\d+)`);
}

function listUsedIds(xml: string, table: ElementType, kind: IdKindType) {
    const pattern = new RegExp(genIdPattern(kind).source, 'g');
    const used = new Set<number>();
    for (const matched of xml.slice(table.start, table.end).matchAll(pattern)) {
        used.add(Number(matched[2]));
    }
    return used;
}

function takeFreshId(used: Set<number>) {
    let id = Math.max(0, ...used) + 1;
    if (id > MAX_ID) {
        id = 1;
        while (used.has(id)) {
            id++;
        }
    }
    used.add(id);
    return id;
}

/**
 * A copy of a row's or column's `a:extLst`: its id given a fresh value, any
 * other extension left out -- '' when nothing is left.
 */
function genFreshExtListXml(
    xml: string,
    extList: ElementType | null,
    kind: IdKindType,
    used: Set<number>,
) {
    if (extList === null) {
        return '';
    }
    const pattern = genIdPattern(kind);
    const exts = listOwnChildren(xml, extList)
        .filter((child) => {
            return (
                child.name === 'a:ext' &&
                pattern.test(xml.slice(child.start, child.end))
            );
        })
        .map((child) => {
            return xml
                .slice(child.start, child.end)
                .replace(pattern, (_whole, before: string) => {
                    return `${before}${takeFreshId(used)}`;
                });
        });
    if (exts.length === 0) {
        return '';
    }
    return (
        xml.slice(extList.start, extList.openEnd) +
        exts.join('') +
        '</a:extLst>'
    );
}

// --- a new cell, in the look of another -----------------------------------

type ParagraphLookType = {
    paragraphProps: string;
    runProps: string;
    endProps: string;
};

function toRunProps(endProps: string) {
    return endProps
        .replace(/^<a:endParaRPr\b/, '<a:rPr')
        .replace(/<\/a:endParaRPr>$/, '</a:rPr>');
}

function toEndProps(runProps: string) {
    return runProps
        .replace(/^<a:rPr\b/, '<a:endParaRPr')
        .replace(/<\/a:rPr>$/, '</a:endParaRPr>');
}

/** A cell's first paragraph's look: its `a:pPr`, its first run's props. */
function readParagraphLook(
    xml: string,
    paragraph: ElementType | undefined,
): ParagraphLookType {
    const children =
        paragraph === undefined ? [] : listOwnChildren(xml, paragraph);
    const take = (element: ElementType | null | undefined) => {
        return element === null || element === undefined
            ? ''
            : xml.slice(element.start, element.end).replace(LINK_PATTERN, '');
    };
    const run = children.find((child) => {
        return child.name === 'a:r' || child.name === 'a:fld';
    });
    let runProps =
        run === undefined ? '' : take(findOwnChild(xml, run, 'a:rPr'));
    let endProps = take(
        children.find((child) => {
            return child.name === 'a:endParaRPr';
        }),
    );
    if (runProps === '' && endProps !== '') {
        runProps = toRunProps(endProps);
    }
    if (endProps === '' && runProps !== '') {
        endProps = toEndProps(runProps);
    }
    return {
        paragraphProps: take(
            children.find((child) => {
                return child.name === 'a:pPr';
            }),
        ),
        runProps,
        endProps,
    };
}

function genParagraphXml(look: ParagraphLookType, words: string) {
    const text = toWrittenText(words);
    if (text === '') {
        return `<a:p>${look.paragraphProps}${look.endProps}</a:p>`;
    }
    const lineBreak =
        look.runProps === '' ? '<a:br/>' : `<a:br>${look.runProps}</a:br>`;
    const runs = text
        .split('\n')
        .map((line) => {
            return `<a:r>${look.runProps}<a:t>${escapeXmlText(line)}</a:t></a:r>`;
        })
        .join(lineBreak);
    return `<a:p>${look.paragraphProps}${runs}${look.endProps}</a:p>`;
}

/**
 * A new cell holding `words` in the look of `cell`: its `a:tcPr`, its
 * text body's properties, ONE paragraph in its first paragraph's look; no
 * merge of its own.
 */
function genCellXml(xml: string, cell: ElementType, words: string) {
    const openTag = xml
        .slice(cell.start, cell.openEnd)
        .replace(/\s*\/>$/, '>')
        .replace(CELL_ONLY_ATTRIBUTE_PATTERN, '');
    const children = listOwnChildren(xml, cell);
    const body = children.find((child) => {
        return child.name === 'a:txBody';
    });
    const cellProps = children.find((child) => {
        return child.name === 'a:tcPr';
    });
    const bodyChildren = body === undefined ? [] : listOwnChildren(xml, body);
    const take = (name: string) => {
        const child = bodyChildren.find((one) => {
            return one.name === name;
        });
        return child === undefined ? null : xml.slice(child.start, child.end);
    };
    const look = readParagraphLook(
        xml,
        bodyChildren.find((child) => {
            return child.name === 'a:p';
        }),
    );
    return (
        openTag +
        '<a:txBody>' +
        (take('a:bodyPr') ?? '<a:bodyPr/>') +
        (take('a:lstStyle') ?? '') +
        genParagraphXml(look, words) +
        '</a:txBody>' +
        (cellProps === undefined
            ? ''
            : xml.slice(cellProps.start, cellProps.end)) +
        '</a:tc>'
    );
}

function genColumnXml(
    xml: string,
    column: TableColumnType,
    width: number,
    used: Set<number>,
) {
    const openTag = xml
        .slice(column.element.start, column.element.openEnd)
        .replace(/(\sw\s*=\s*["'])-?\d+/, (_whole, before: string) => {
            return `${before}${width}`;
        });
    const extList = genFreshExtListXml(xml, column.extList, 'colId', used);
    if (extList === '') {
        return openTag.replace(/\s*\/?>$/, '/>');
    }
    return `${openTag.replace(/\s*\/>$/, '>')}${extList}</a:gridCol>`;
}

function checkIsWantedPlace(index: number, count: number) {
    return Number.isInteger(index) && index >= 0 && index <= count;
}

// --- rows ------------------------------------------------------------------

/**
 * The slide with a new row in the table `tableName`: row number `at`
 * (1-based; null: the last), its cells `cells` left to right (missing ones
 * empty), in the look and height of the row it is put after (at 1: of row
 * 1). The table's frame grows by that height. Or why not.
 */
export function addTableRowXml(
    slideXml: string,
    tableName: string,
    at: number | null,
    cells: readonly string[],
): string | { reason: string } {
    const table = findSlideTable(slideXml, tableName);
    if ('reason' in table) {
        return table;
    }
    const count = table.rows.length;
    const columnCount = table.columns.length;
    if (count === 0 || columnCount === 0) {
        return {
            reason:
                `The table "${table.name}" has no rows or columns to copy ` +
                'the look of, so a row cannot be added to it.',
        };
    }
    const index = at === null ? count : at - 1;
    if (!checkIsWantedPlace(index, count)) {
        return {
            reason:
                `The table "${table.name}" has ${toCountText(count, 'row')}, ` +
                `so a new row can be number 1 to ${count + 1}.`,
        };
    }
    if (cells.length > columnCount) {
        return {
            reason:
                `The table "${table.name}" has ` +
                `${toCountText(columnCount, 'column')}, so a new row holds ` +
                `${toCountText(columnCount, 'cell')}, not ${cells.length}.`,
        };
    }
    if (!checkIsPlainGrid(table)) {
        return { reason: toNotPlainReason(table, 'rows') };
    }
    if (checkIsRowLineMerged(table.rows, index)) {
        return {
            reason:
                `Cells of the table "${table.name}" are merged across rows ` +
                `${index} and ${index + 1}, so a new row cannot go between ` +
                'them; unmerge those cells first or choose another place.',
        };
    }
    const source = table.rows[Math.max(index - 1, 0)];
    const cellsXml = source.cells
        .map((cell, cellIndex) => {
            return genCellXml(slideXml, cell.element, cells[cellIndex] ?? '');
        })
        .join('');
    const rowXml =
        slideXml.slice(source.element.start, source.element.openEnd) +
        cellsXml +
        genFreshExtListXml(
            slideXml,
            source.extList,
            'rowId',
            listUsedIds(slideXml, table.table, 'rowId'),
        ) +
        '</a:tr>';
    const where =
        index < count
            ? table.rows[index].element.start
            : table.rows[count - 1].element.end;
    const edits: EditType[] = [{ start: where, end: where, text: rowXml }];
    if (table.frameHeight !== null) {
        edits.push(
            toNumberEdit(
                table.frameHeight,
                table.frameHeight.value + source.height,
            ),
        );
    }
    return applyEdits(slideXml, edits);
}

/**
 * The slide with row number `row` (1-based) of the table `tableName` taken
 * out, its frame shorter by the row's height; or why not.
 */
export function removeTableRowXml(
    slideXml: string,
    tableName: string,
    row: number,
): string | { reason: string } {
    const table = findSlideTable(slideXml, tableName);
    if ('reason' in table) {
        return table;
    }
    const count = table.rows.length;
    if (!Number.isInteger(row) || row < 1 || row > count) {
        return {
            reason:
                `The table "${table.name}" has ${toCountText(count, 'row')}, ` +
                `so there is no row ${row} to take out.`,
        };
    }
    if (count === 1) {
        return {
            reason:
                `Row 1 is the only row of the table "${table.name}", so it ` +
                'cannot be taken out; take the table off instead.',
        };
    }
    const index = row - 1;
    if (
        checkIsRowLineMerged(table.rows, index) ||
        checkIsRowLineMerged(table.rows, index + 1)
    ) {
        return {
            reason:
                `Row ${row} of the table "${table.name}" has a cell merged ` +
                'with the row above or below it, so it cannot be taken out ' +
                'alone; unmerge that cell first.',
        };
    }
    const removed = table.rows[index];
    const edits: EditType[] = [
        { start: removed.element.start, end: removed.element.end, text: '' },
    ];
    if (table.frameHeight !== null) {
        edits.push(
            toNumberEdit(
                table.frameHeight,
                Math.max(table.frameHeight.value - removed.height, 0),
            ),
        );
    }
    return applyEdits(slideXml, edits);
}

// --- columns ---------------------------------------------------------------

// The width the table keeps: its frame's, else what its columns add up to.
function readTableWidth(table: TableReadType) {
    if (table.frameWidth !== null && table.frameWidth.value > 0) {
        return table.frameWidth.value;
    }
    return table.columns.reduce((all, column) => {
        return all + (column.width?.value ?? 0);
    }, 0);
}

function genWidthEdits(table: TableReadType, widths: (number | null)[]) {
    const edits: EditType[] = [];
    table.columns.forEach((column, index) => {
        const width = widths[index];
        if (
            column.width !== null &&
            width !== null &&
            width !== column.width.value
        ) {
            edits.push(toNumberEdit(column.width, width));
        }
    });
    return edits;
}

/**
 * The slide with a new column in the table `tableName`: column number `at`
 * (1-based; null: the last), its cells `cells` top to bottom (missing ones
 * empty), in the look and width of the column it is put after (at 1: of
 * column 1). Every column is then made narrower in its share so the table
 * keeps its width. Or why not.
 */
export function addTableColumnXml(
    slideXml: string,
    tableName: string,
    at: number | null,
    cells: readonly string[],
): string | { reason: string } {
    const table = findSlideTable(slideXml, tableName);
    if ('reason' in table) {
        return table;
    }
    const count = table.columns.length;
    const rowCount = table.rows.length;
    if (count === 0 || rowCount === 0) {
        return {
            reason:
                `The table "${table.name}" has no rows or columns to copy ` +
                'the look of, so a column cannot be added to it.',
        };
    }
    const index = at === null ? count : at - 1;
    if (!checkIsWantedPlace(index, count)) {
        return {
            reason:
                `The table "${table.name}" has ` +
                `${toCountText(count, 'column')}, so a new column can be ` +
                `number 1 to ${count + 1}.`,
        };
    }
    if (cells.length > rowCount) {
        return {
            reason:
                `The table "${table.name}" has ` +
                `${toCountText(rowCount, 'row')}, so a new column holds ` +
                `${toCountText(rowCount, 'cell')}, not ${cells.length}.`,
        };
    }
    if (!checkIsPlainGrid(table)) {
        return { reason: toNotPlainReason(table, 'columns') };
    }
    if (checkIsColumnLineMerged(table.rows, count, index)) {
        return {
            reason:
                `Cells of the table "${table.name}" are merged across ` +
                `columns ${index} and ${index + 1}, so a new column cannot go ` +
                'between them; unmerge those cells first or choose another ' +
                'place.',
        };
    }
    const sourceIndex = Math.max(index - 1, 0);
    const widths = table.columns.map((column) => {
        return column.width?.value ?? 0;
    });
    const fitted = fitWidths(
        [
            ...widths.slice(0, index),
            widths[sourceIndex],
            ...widths.slice(index),
        ],
        readTableWidth(table),
    );
    const edits = genWidthEdits(
        table,
        table.columns.map((_column, columnIndex) => {
            return fitted[columnIndex < index ? columnIndex : columnIndex + 1];
        }),
    );
    const columnWhere =
        index < count
            ? table.columns[index].element.start
            : table.columns[count - 1].element.end;
    edits.push({
        start: columnWhere,
        end: columnWhere,
        text: genColumnXml(
            slideXml,
            table.columns[sourceIndex],
            fitted[index],
            listUsedIds(slideXml, table.table, 'colId'),
        ),
    });
    table.rows.forEach((row, rowIndex) => {
        const where =
            index < count
                ? row.cells[index].element.start
                : row.cells[count - 1].element.end;
        edits.push({
            start: where,
            end: where,
            text: genCellXml(
                slideXml,
                row.cells[sourceIndex].element,
                cells[rowIndex] ?? '',
            ),
        });
    });
    return applyEdits(slideXml, edits);
}

/**
 * The slide with column number `column` (1-based) of the table `tableName`
 * taken out, its width shared out to the others in their shares so the
 * table keeps its width; or why not.
 */
export function removeTableColumnXml(
    slideXml: string,
    tableName: string,
    column: number,
): string | { reason: string } {
    const table = findSlideTable(slideXml, tableName);
    if ('reason' in table) {
        return table;
    }
    const count = table.columns.length;
    if (!Number.isInteger(column) || column < 1 || column > count) {
        return {
            reason:
                `The table "${table.name}" has ` +
                `${toCountText(count, 'column')}, so there is no column ` +
                `${column} to take out.`,
        };
    }
    if (count === 1) {
        return {
            reason:
                `Column 1 is the only column of the table "${table.name}", ` +
                'so it cannot be taken out; take the table off instead.',
        };
    }
    if (!checkIsPlainGrid(table)) {
        return { reason: toNotPlainReason(table, 'columns') };
    }
    const index = column - 1;
    if (
        checkIsColumnLineMerged(table.rows, count, index) ||
        checkIsColumnLineMerged(table.rows, count, index + 1)
    ) {
        return {
            reason:
                `Column ${column} of the table "${table.name}" has a cell ` +
                'merged with the column beside it, so it cannot be taken ' +
                'out alone; unmerge that cell first.',
        };
    }
    const kept = table.columns
        .filter((_column, columnIndex) => {
            return columnIndex !== index;
        })
        .map((one) => {
            return one.width?.value ?? 0;
        });
    const fitted = fitWidths(kept, readTableWidth(table));
    const edits = genWidthEdits(
        table,
        table.columns.map((_column, columnIndex) => {
            if (columnIndex === index) {
                return null;
            }
            return fitted[columnIndex < index ? columnIndex : columnIndex - 1];
        }),
    );
    const removed = table.columns[index].element;
    edits.push({ start: removed.start, end: removed.end, text: '' });
    for (const row of table.rows) {
        const cell = row.cells[index].element;
        edits.push({ start: cell.start, end: cell.end, text: '' });
    }
    return applyEdits(slideXml, edits);
}
