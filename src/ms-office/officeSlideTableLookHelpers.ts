// The LOOK of a table on a PowerPoint slide -- its cells' fill and borders,
// and whether its table style marks the first row and bands the rows -- for
// `owa_office_edit` (2026-11-21, the goal _chatbot can change do everything
// on a given pptx_). Rows and columns are `officeSlideTableHelpers.ts`; the
// words in the cells change as every other line does.
//
// A cell's own look is its `a:tcPr`: four borders (`a:lnL` .. `a:lnB`), then
// one fill, in the order the schema fixes -- Office asks to "repair" a file
// that breaks it. A cell with no fill of its own shows its table style's, so
// a fill taken off gives the style's back. The cells a merged cell covers
// (`hMerge` / `vMerge`) show nothing of their own: the cell that spans them
// carries the look, and it is picked when its span meets the rows and
// columns asked for.
//
// Pure, strings in and out, the same tag scanner as the words: only the
// table's own properties and the cells that change are touched.

import { type SlideBoxType, listSlideBoxes } from './officeSlideBoxHelpers';
import { type ElementType, listChildElements } from './officeXmlEditHelpers';

export type OfficeTableLookType = {
    // `RRGGBB`, or null: the cell's own fill taken off (the style's shows)
    fill?: string | null;
    // 1-based; none: every row / column, both: the cells where they cross
    rows?: number[];
    columns?: number[];
    // the table style's first-row emphasis (`firstRow`) and banded rows
    // (`bandRow`)
    header?: boolean;
    banded?: boolean;
    // `RRGGBB` for every edge of the cells, or null: set borders taken off
    borders?: string | null;
};

export type OfficeTableLookReadType = {
    header: boolean;
    banded: boolean;
    // the distinct `RRGGBB` fills cells carry of their own, in table order
    fills: string[];
};

type LookCellType = {
    element: ElementType;
    // 0-based, where it starts
    row: number;
    column: number;
    rowSpan: number;
    gridSpan: number;
    // covered by another cell's span
    isMerged: boolean;
};

type LookTableType = {
    name: string;
    table: ElementType;
    props: ElementType | null;
    rowCount: number;
    columnCount: number;
    cells: LookCellType[];
};

type EditType = { start: number; end: number; text: string };

// undefined: left as it is, null: taken off, `RRGGBB`: written
type CellChangeType = { fill?: string | null; borders?: string | null };

const HEX_PATTERN = /^[\dA-Fa-f]{6}$/;

const BORDER_NAME_LIST = ['a:lnL', 'a:lnR', 'a:lnT', 'a:lnB'];

const FILL_NAME_LIST = [
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
];

// Where each `a:tcPr` child goes (CT_TableCellProperties); a child not
// named here is left where it is and nothing is put before it.
const CELL_PROPS_RANK_MAP: Record<string, number> = {
    'a:lnL': 0,
    'a:lnR': 1,
    'a:lnT': 2,
    'a:lnB': 3,
    'a:lnTlToBr': 4,
    'a:lnBlToTr': 5,
    'a:cell3D': 6,
    ...Object.fromEntries(
        FILL_NAME_LIST.map((name) => {
            return [name, 7];
        }),
    ),
    'a:headers': 8,
    'a:extLst': 9,
};
const BORDERS_RANK = 3;
const FILL_RANK = 7;

// one point, the width PowerPoint gives a plain cell border
const BORDER_WIDTH = 12700;

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

function checkIsOn(value: string | null) {
    return value === '1' || value === 'true';
}

function readSpan(xml: string, cell: ElementType, name: string) {
    const value = Number(readAttributeText(xml, cell, name) ?? 1);
    return Number.isInteger(value) && value > 1 ? value : 1;
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

// --- the table -------------------------------------------------------------

function readLookTable(xml: string, box: SlideBoxType): LookTableType | null {
    const frame = listChildElements(xml, box.start, box.end)[0];
    const graphic =
        frame === undefined ? null : findOwnChild(xml, frame, 'a:graphic');
    const data =
        graphic === null ? null : findOwnChild(xml, graphic, 'a:graphicData');
    const table = data === null ? null : findOwnChild(xml, data, 'a:tbl');
    if (table === null) {
        return null;
    }
    const tableChildren = listOwnChildren(xml, table);
    const grid = tableChildren.find((child) => {
        return child.name === 'a:tblGrid';
    });
    const gridCount = (
        grid === undefined ? [] : listOwnChildren(xml, grid)
    ).filter((child) => {
        return child.name === 'a:gridCol';
    }).length;
    const rows = tableChildren.filter((child) => {
        return child.name === 'a:tr';
    });
    const cells: LookCellType[] = [];
    rows.forEach((row, rowIndex) => {
        listOwnChildren(xml, row)
            .filter((child) => {
                return child.name === 'a:tc';
            })
            .forEach((element, column) => {
                cells.push({
                    element,
                    row: rowIndex,
                    column,
                    rowSpan: readSpan(xml, element, 'rowSpan'),
                    gridSpan: readSpan(xml, element, 'gridSpan'),
                    isMerged:
                        checkIsOn(readAttributeText(xml, element, 'hMerge')) ||
                        checkIsOn(readAttributeText(xml, element, 'vMerge')),
                });
            });
    });
    // no grid to count: as many columns as the widest row has cells
    const cellCount = cells.reduce((most, cell) => {
        return Math.max(most, cell.column + 1);
    }, 0);
    return {
        name: box.name,
        table,
        props:
            tableChildren.find((child) => {
                return child.name === 'a:tblPr';
            }) ?? null,
        rowCount: rows.length,
        columnCount: gridCount > 0 ? gridCount : cellCount,
        cells,
    };
}

/**
 * The table `tableName` means -- its name, else in any case -- or why not.
 * Only the one found is read: a slide's other tables cost nothing.
 */
function findLookTable(
    slideXml: string,
    tableName: string,
): LookTableType | { reason: string } {
    const boxes = listSlideBoxes(slideXml).filter((box) => {
        return box.kind === 'table';
    });
    const wanted = tableName.trim();
    const found =
        boxes.find((box) => {
            return box.name === wanted;
        }) ??
        boxes.find((box) => {
            return box.name.toLowerCase() === wanted.toLowerCase();
        });
    if (found !== undefined) {
        return (
            readLookTable(slideXml, found) ?? {
                reason:
                    `The table "${found.name}" is not written as a plain ` +
                    'table, so its look cannot be changed here.',
            }
        );
    }
    if (boxes.length === 0) {
        return {
            reason: `There is no table "${wanted}" on this slide; it has no tables at all.`,
        };
    }
    const names = boxes.map((box) => {
        return `"${box.name}"`;
    });
    return {
        reason:
            `There is no table "${wanted}" on this slide; its ` +
            `${names.length === 1 ? 'table is' : 'tables are'} ` +
            `${toListText(names)}.`,
    };
}

// --- what is asked ---------------------------------------------------------

function genColorReason(key: 'fill' | 'borders', value: unknown) {
    return (
        `${JSON.stringify(value)} is not a colour for \`${key}\`: give six ` +
        'hex digits RRGGBB, without "#" (for example 1F4E79), or null to ' +
        `take the ${key} the cells have of their own off.`
    );
}

/** Why `look` cannot be written whatever the table, or null. */
function checkLook(look: OfficeTableLookType) {
    const isCellLook = look.fill !== undefined || look.borders !== undefined;
    if (!isCellLook && look.header === undefined && look.banded === undefined) {
        return (
            'This look changes nothing: give `fill` or `borders` (a colour ' +
            'as RRGGBB, or null to take it off), or `header` or `banded` ' +
            '(true or false).'
        );
    }
    // a model that names rows but no fill believes it coloured them
    if (
        !isCellLook &&
        (look.rows?.length ?? 0) + (look.columns?.length ?? 0) > 0
    ) {
        return (
            '`rows` and `columns` pick the cells a `fill` or `borders` goes ' +
            'on, and this look has neither; give one, or leave `rows` and ' +
            '`columns` out.'
        );
    }
    for (const key of ['fill', 'borders'] as const) {
        const value = look[key];
        if (
            value !== undefined &&
            value !== null &&
            (typeof value !== 'string' || !HEX_PATTERN.test(value))
        ) {
            return genColorReason(key, value);
        }
    }
    for (const key of ['header', 'banded'] as const) {
        if (look[key] !== undefined && typeof look[key] !== 'boolean') {
            return `\`${key}\` is true or false.`;
        }
    }
    return null;
}

/** The 1-based numbers `numbers` asks for -- null: all -- or why not. */
function readWantedNumbers(
    numbers: unknown,
    count: number,
    word: 'row' | 'column',
    tableName: string,
): { numbers: Set<number> | null } | { reason: string } {
    if (numbers === undefined) {
        return { numbers: null };
    }
    if (!Array.isArray(numbers)) {
        return {
            reason: `\`${word}s\` is a list of ${word} numbers, counted from 1.`,
        };
    }
    if (numbers.length === 0) {
        return { numbers: null };
    }
    const wrong = numbers.find((number) => {
        return !Number.isInteger(number) || number < 1 || number > count;
    });
    if (wrong !== undefined) {
        const said =
            typeof wrong === 'number' ? String(wrong) : JSON.stringify(wrong);
        return {
            reason:
                `The table "${tableName}" has ${toCountText(count, word)}, ` +
                `so there is no ${word} ${said}` +
                (count > 0
                    ? `; its ${word}s are numbered 1 to ${count}.`
                    : '.'),
        };
    }
    return { numbers: new Set(numbers as number[]) };
}

/** Whether a span from `from` (0-based) meets any of `numbers` (1-based). */
function checkIsSpanWanted(
    numbers: Set<number> | null,
    from: number,
    span: number,
) {
    if (numbers === null) {
        return true;
    }
    for (let at = from; at < from + span; at++) {
        if (numbers.has(at + 1)) {
            return true;
        }
    }
    return false;
}

// --- a cell's own look -----------------------------------------------------

function genFillXml(hex: string) {
    return `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
}

function genBordersXml(hex: string) {
    return BORDER_NAME_LIST.map((name) => {
        return `<${name} w="${BORDER_WIDTH}">${genFillXml(hex)}</${name}>`;
    }).join('');
}

/**
 * The cell props `openTag` + `children` become: what is taken off or
 * replaced dropped, what is written put in its schema place; and whether
 * anything changed.
 */
function genCellPropsXml(
    xml: string,
    openTag: string,
    children: ElementType[],
    change: CellChangeType,
) {
    const dropped = new Set([
        ...(change.borders === undefined ? [] : BORDER_NAME_LIST),
        ...(change.fill === undefined ? [] : FILL_NAME_LIST),
    ]);
    // borders first: their rank is lower
    const pending: { rank: number; text: string }[] = [];
    if (typeof change.borders === 'string') {
        pending.push({
            rank: BORDERS_RANK,
            text: genBordersXml(change.borders),
        });
    }
    if (typeof change.fill === 'string') {
        pending.push({ rank: FILL_RANK, text: genFillXml(change.fill) });
    }
    let isChanged = pending.length > 0;
    let next = 0;
    const parts: string[] = [];
    for (const child of children) {
        if (dropped.has(child.name)) {
            isChanged = true;
            continue;
        }
        const rank = CELL_PROPS_RANK_MAP[child.name] ?? -1;
        while (next < pending.length && rank > pending[next].rank) {
            parts.push(pending[next].text);
            next++;
        }
        parts.push(xml.slice(child.start, child.end));
    }
    for (; next < pending.length; next++) {
        parts.push(pending[next].text);
    }
    const open = openTag.replace(/\s*\/>$/, '>');
    return {
        text:
            parts.length === 0
                ? open.replace(/>$/, '/>')
                : `${open}${parts.join('')}</a:tcPr>`,
        isChanged,
    };
}

/** The edit that gives `cell` its new look, or null when nothing changes. */
function genCellEdit(
    xml: string,
    cell: ElementType,
    change: CellChangeType,
): EditType | null {
    const children = listOwnChildren(xml, cell);
    const props = children.find((child) => {
        return child.name === 'a:tcPr';
    });
    if (props !== undefined) {
        const made = genCellPropsXml(
            xml,
            xml.slice(props.start, props.openEnd),
            listOwnChildren(xml, props),
            change,
        );
        return made.isChanged
            ? { start: props.start, end: props.end, text: made.text }
            : null;
    }
    const made = genCellPropsXml(xml, '<a:tcPr>', [], change);
    if (!made.isChanged) {
        return null;
    }
    if (cell.openEnd === cell.end) {
        // a cell that closes itself is opened to hold its props
        return {
            start: cell.start,
            end: cell.end,
            text:
                xml.slice(cell.start, cell.openEnd).replace(/\s*\/>$/, '>') +
                made.text +
                '</a:tc>',
        };
    }
    // the props come right after the words, before any `a:extLst`
    const body = children.find((child) => {
        return child.name === 'a:txBody';
    });
    const where = body === undefined ? cell.openEnd : body.end;
    return { start: where, end: where, text: made.text };
}

// --- the table's own properties --------------------------------------------

/** `openTag` with the flag `name` on ("1") or off (taken out, the default). */
function setFlag(openTag: string, name: string, isOn: boolean) {
    const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    const matched = pattern.exec(openTag);
    const current = matched === null ? null : (matched[1] ?? matched[2]);
    if (checkIsOn(current) === isOn) {
        // already so: left as written
        return openTag;
    }
    if (!isOn) {
        return openTag.replace(pattern, '');
    }
    if (matched !== null) {
        return openTag.replace(pattern, ` ${name}="1"`);
    }
    return openTag.replace(/\s*(\/?)>$/, ` ${name}="1"$1>`);
}

function setFlags(openTag: string, look: OfficeTableLookType) {
    let out = openTag;
    if (look.header !== undefined) {
        out = setFlag(out, 'firstRow', look.header);
    }
    if (look.banded !== undefined) {
        out = setFlag(out, 'bandRow', look.banded);
    }
    return out;
}

function genTablePropsEdit(
    xml: string,
    table: LookTableType,
    look: OfficeTableLookType,
): EditType | null {
    if (table.props !== null) {
        const openTag = xml.slice(table.props.start, table.props.openEnd);
        const made = setFlags(openTag, look);
        return made === openTag
            ? null
            : {
                  start: table.props.start,
                  end: table.props.openEnd,
                  text: made,
              };
    }
    // none yet: only a flag turned on needs one, off is the default
    const made = setFlags('<a:tblPr/>', look);
    if (made === '<a:tblPr/>' || table.table.openEnd === table.table.end) {
        return null;
    }
    const where = table.table.openEnd;
    return { start: where, end: where, text: made };
}

// --- the edit --------------------------------------------------------------

/**
 * The slide with the table `tableName` given `look`: the fill and the
 * borders on the cells `rows` x `columns` pick (none: all; a covered merged
 * cell never, its spanning cell when the span meets them), the header row
 * and banded rows of its style on or off. `cells` is how many cells had a
 * fill or borders written or taken off. Or why not.
 */
export function setTableLookXml(
    slideXml: string,
    tableName: string,
    look: OfficeTableLookType,
): { xml: string; cells: number } | { reason: string } {
    const lookReason = checkLook(look);
    if (lookReason !== null) {
        return { reason: lookReason };
    }
    const table = findLookTable(slideXml, tableName);
    if ('reason' in table) {
        return table;
    }
    const rows = readWantedNumbers(
        look.rows,
        table.rowCount,
        'row',
        table.name,
    );
    if ('reason' in rows) {
        return rows;
    }
    const columns = readWantedNumbers(
        look.columns,
        table.columnCount,
        'column',
        table.name,
    );
    if ('reason' in columns) {
        return columns;
    }
    const edits: EditType[] = [];
    const propsEdit = genTablePropsEdit(slideXml, table, look);
    if (propsEdit !== null) {
        edits.push(propsEdit);
    }
    const change: CellChangeType = {
        fill:
            typeof look.fill === 'string' ? look.fill.toUpperCase() : look.fill,
        borders:
            typeof look.borders === 'string'
                ? look.borders.toUpperCase()
                : look.borders,
    };
    let cells = 0;
    if (change.fill !== undefined || change.borders !== undefined) {
        for (const cell of table.cells) {
            if (
                cell.isMerged ||
                !checkIsSpanWanted(rows.numbers, cell.row, cell.rowSpan) ||
                !checkIsSpanWanted(columns.numbers, cell.column, cell.gridSpan)
            ) {
                continue;
            }
            const edit = genCellEdit(slideXml, cell.element, change);
            if (edit !== null) {
                edits.push(edit);
                cells++;
            }
        }
    }
    return { xml: applyEdits(slideXml, edits), cells };
}

/**
 * What the table `tableName` shows now: its style's header row and banded
 * rows, and the fills its cells carry of their own as `RRGGBB` (a fill
 * from the theme's colours or a gradient is not listed); null when there
 * is no such table.
 */
export function readTableLook(
    slideXml: string,
    tableName: string,
): OfficeTableLookReadType | null {
    const table = findLookTable(slideXml, tableName);
    if ('reason' in table) {
        return null;
    }
    const fills = new Set<string>();
    for (const cell of table.cells) {
        if (cell.isMerged) {
            continue;
        }
        const props = findOwnChild(slideXml, cell.element, 'a:tcPr');
        const fill =
            props === null
                ? null
                : findOwnChild(slideXml, props, 'a:solidFill');
        const color =
            fill === null ? null : findOwnChild(slideXml, fill, 'a:srgbClr');
        const hex =
            color === null ? null : readAttributeText(slideXml, color, 'val');
        if (hex !== null && HEX_PATTERN.test(hex)) {
            fills.add(hex.toUpperCase());
        }
    }
    const readFlag = (name: string) => {
        return (
            table.props !== null &&
            checkIsOn(readAttributeText(slideXml, table.props, name))
        );
    };
    return {
        header: readFlag('firstRow'),
        banded: readFlag('bandRow'),
        fills: [...fills],
    };
}
