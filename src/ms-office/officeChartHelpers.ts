// A CHART on a PowerPoint slide -- its title, the names of its series, the
// labels along it and the numbers it draws -- read and changed for
// `owa_office_edit` (2026-11-20, the goal _chatbot can change do everything
// on a given pptx_).
//
// A chart part (`ppt/charts/chartN.xml`, `c:chartSpace`) keeps its data
// twice. PowerPoint DRAWS from the copy in the chart (`c:strCache` /
// `c:numCache`) and EDITS from the workbook embedded beside it
// (`c:externalData`), in the cells its formulas name (`c:f`,
// `Sheet1!$B$2:$B$5`): a change written into the chart alone is undone the
// first time someone presses Edit Data. So `setChartDataXml` changes the
// chart AND lists the cells to write the same values into, and
// `setSheetCellsXml` writes them into the workbook's sheet.
//
// A formula this cannot read -- LibreOffice names its data `categories` and
// `label 0` and embeds no workbook at all, a defined name, another workbook,
// two sheets at once -- still has its points changed in the chart; its cells
// are left out of the list.
//
// Pure, strings in and out, the same tag scanner as the words.

import {
    type ElementType,
    type TagType,
    escapeXmlText,
    listChildElements,
    readParagraphText,
    rebuildParagraph,
    scanTags,
    toWrittenText,
    toXmlSafeText,
    unescapeXml,
} from './officeXmlEditHelpers';

export type OfficeChartDataType = {
    // the plot's element without its prefix and 'Chart' ('bar', 'line',
    // 'pie', 'ofPie', 'bar3D', ...); the first plot when there are several
    kind: string;
    // the chart title's words, null when it has none or PowerPoint makes one
    title: string | null;
    // the first series' category labels, numbers as written
    categories: string[];
    series: { name: string | null; values: (number | null)[] }[];
};

export type OfficeChartChangeType = {
    // '' takes the title off
    title?: string;
    // a different number of them adds or takes away points of every series
    categories?: readonly string[];
    // by 0-based index into `series` as read
    series?: readonly {
        index: number;
        name?: string;
        values?: readonly (number | null)[];
    }[];
};

export type OfficeChartCellType = {
    sheet: string;
    ref: string;
    value: string | number | null;
};

export type OfficeSheetCellType = {
    ref: string;
    value: string | number | null;
};

type EditType = { start: number; end: number; text: string };

function applyEdits(xml: string, edits: readonly EditType[]) {
    // an insertion goes BEFORE a removal starting at the same place
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

function listChildren(xml: string, parent: ElementType, name?: string) {
    const children = listChildElements(xml, parent.openEnd, parent.closeStart);
    return name === undefined
        ? children
        : children.filter((child) => {
              return child.name === name;
          });
}

function findChild(xml: string, parent: ElementType, name: string) {
    return listChildren(xml, parent, name)[0] ?? null;
}

function readAttribute(tagXml: string, name: string) {
    const matched = new RegExp(
        `\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    ).exec(tagXml);
    if (matched === null) {
        return null;
    }
    return unescapeXml(matched[2] ?? matched[3] ?? '');
}

function readIntAttribute(tagXml: string, name: string) {
    const text = readAttribute(tagXml, name);
    if (text === null || !/^\s*-?\d+\s*$/.test(text)) {
        return null;
    }
    return Number(text);
}

function readOpenTag(xml: string, element: ElementType) {
    return xml.slice(element.start, element.openEnd);
}

function readInnerText(xml: string, element: ElementType) {
    return unescapeXml(xml.slice(element.openEnd, element.closeStart));
}

function escapeXmlAttribute(text: string) {
    return escapeXmlText(text).replace(/"/g, '&quot;');
}

/**
 * A number as a cell and a chart write it: `String(n)`, but never with an
 * exponent (`1e+21`, `1e-7`), which a chart cache may not hold.
 */
function toNumberText(value: number) {
    const text = String(value);
    if (!text.includes('e')) {
        return text;
    }
    if (Math.abs(value) >= 1) {
        // a double this big holds a whole number
        return BigInt(value).toString();
    }
    const [mantissa, exponent] = text.split('e');
    const digits = mantissa.replace(/^-/, '').replace('.', '');
    const zeros = '0'.repeat(-Number(exponent) - 1);
    return `${value < 0 ? '-' : ''}0.${zeros}${digits}`;
}

const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

// --- cell references ---------------------------------------------------------

type CellAtType = { col: number; row: number };

const MAX_ROW = 1048576;
const MAX_COL = 16384;

function toColumnNumber(letters: string) {
    let out = 0;
    for (const letter of letters.toUpperCase()) {
        out = out * 26 + (letter.charCodeAt(0) - 64);
    }
    return out;
}

function toColumnLetters(column: number) {
    let out = '';
    let rest = column;
    while (rest > 0) {
        out = String.fromCharCode(65 + ((rest - 1) % 26)) + out;
        rest = Math.floor((rest - 1) / 26);
    }
    return out;
}

function toCellRef(at: CellAtType) {
    return `${toColumnLetters(at.col)}${at.row}`;
}

function parseCellRef(text: string): CellAtType | null {
    const matched = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)$/.exec(text.trim());
    if (matched === null) {
        return null;
    }
    const col = toColumnNumber(matched[1]);
    const row = Number(matched[2]);
    if (col > MAX_COL || row > MAX_ROW) {
        return null;
    }
    return { col, row };
}

type AreaType = {
    // the sheet as the formula writes it, quoted or not
    sheetText: string;
    sheet: string;
    startText: string;
    endText: string | null;
    start: CellAtType;
    end: CellAtType;
};

// `Sheet1!$A$2:$A$5`, `'Sunday''s numbers'!$B$1`; never another workbook
// (`[1]Sheet1!A1`), a defined name, or a whole column
const AREA_PATTERN =
    /^(?:'((?:[^'\[\]]|'')+)'|([^'!:,()\[\]\s]+))!(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?$/;

function splitAreas(text: string) {
    const parts: string[] = [];
    let isQuoted = false;
    let from = 0;
    for (let index = 0; index < text.length; index++) {
        const letter = text[index];
        if (letter === "'") {
            isQuoted = !isQuoted;
        } else if (letter === ',' && !isQuoted) {
            parts.push(text.slice(from, index));
            from = index + 1;
        }
    }
    parts.push(text.slice(from));
    return parts;
}

/** A chart formula's areas, all on one sheet, or null. */
function parseFormula(formula: string | null) {
    if (formula === null) {
        return null;
    }
    let text = formula.trim();
    if (text.startsWith('(') && text.endsWith(')')) {
        text = text.slice(1, -1);
    }
    const areas: AreaType[] = [];
    for (const part of splitAreas(text)) {
        const matched = AREA_PATTERN.exec(part.trim());
        if (matched === null) {
            return null;
        }
        const start = parseCellRef(matched[3]);
        const end = matched[4] === undefined ? start : parseCellRef(matched[4]);
        if (start === null || end === null) {
            return null;
        }
        areas.push({
            sheetText:
                matched[1] === undefined ? matched[2] : `'${matched[1]}'`,
            sheet:
                matched[1] === undefined
                    ? matched[2]
                    : matched[1].replace(/''/g, "'"),
            startText: matched[3],
            endText: matched[4] ?? null,
            start,
            end,
        });
    }
    const sheet = areas[0]?.sheet;
    if (
        sheet === undefined ||
        areas.some((area) => {
            return area.sheet !== sheet;
        })
    ) {
        return null;
    }
    return { sheet, areas };
}

/** The cells a formula names, one by one in order, or null. */
function listFormulaCells(formula: string | null) {
    const parsed = parseFormula(formula);
    if (parsed === null) {
        return null;
    }
    const refs: string[] = [];
    for (const { start, end } of parsed.areas) {
        if (start.col === end.col) {
            for (let row = start.row; row <= end.row; row++) {
                refs.push(toCellRef({ col: start.col, row }));
            }
        } else if (start.row === end.row) {
            for (let col = start.col; col <= end.col; col++) {
                refs.push(toCellRef({ col, row: start.row }));
            }
        } else {
            // a block (labels on two levels): not one cell per point
            return null;
        }
    }
    return { sheet: parsed.sheet, refs };
}

/**
 * A one-area formula made `count` cells long from where it starts:
 * `Sheet1!$A$2:$A$5` for 5 is `Sheet1!$A$2:$A$6`. `isColumn` says which way
 * a one-cell formula grows. Null when it cannot be.
 */
function resizeFormula(formula: string, count: number, isColumn: boolean) {
    const parsed = parseFormula(formula);
    if (parsed === null || parsed.areas.length !== 1 || count < 1) {
        return null;
    }
    const area = parsed.areas[0];
    const { start, end } = area;
    let isDown = isColumn;
    if (start.col === end.col && start.row !== end.row) {
        isDown = true;
    } else if (start.row === end.row && start.col !== end.col) {
        isDown = false;
    } else if (start.col !== end.col) {
        return null;
    }
    const last: CellAtType = isDown
        ? { col: start.col, row: start.row + count - 1 }
        : { col: start.col + count - 1, row: start.row };
    if (last.row > MAX_ROW || last.col > MAX_COL) {
        return null;
    }
    if (count === 1) {
        return `${area.sheetText}!${area.startText}`;
    }
    // the dollars written as the formula wrote them
    const style = area.endText ?? area.startText;
    const endText =
        (style.startsWith('$') ? '$' : '') +
        toColumnLetters(last.col) +
        (/^\$?[A-Za-z]+\$/.test(style) ? '$' : '') +
        last.row;
    return `${area.sheetText}!${area.startText}:${endText}`;
}

// --- the chart ---------------------------------------------------------------

const PLOT_PATTERN = /^c:(\w+)Chart$/;

// a plot's kind as a person says it: PowerPoint writes a column chart as a
// `c:barChart` with `c:barDir` "col" (its default), the words a kind change
// takes (`officeChartKindHelpers`)
function toPlotKind(xml: string, plot: ElementType) {
    const kind = PLOT_PATTERN.exec(plot.name)?.[1] ?? '';
    if (kind === 'bar' || kind === 'bar3D') {
        const body = xml.slice(plot.start, plot.end);
        const direction = /<c:barDir\s+val="(\w+)"/.exec(body)?.[1] ?? 'col';
        return direction === 'col' ? 'column' : 'bar';
    }
    return kind;
}

const SOURCE_NAME_SET = new Set([
    'c:strRef',
    'c:numRef',
    'c:multiLvlStrRef',
    'c:strLit',
    'c:numLit',
    'c:v',
]);

type PointType = { element: ElementType; text: string };

type SourceType = {
    // the `c:tx` / `c:cat` / `c:val` / ... element
    element: ElementType;
    // what holds the data in it: a reference, a literal, a `c:v`
    holder: ElementType | null;
    formula: string | null;
    isNumber: boolean;
    isMultiLevel: boolean;
    count: number;
    points: Map<number, PointType>;
};

type SeriesType = {
    element: ElementType;
    name: SourceType | null;
    categories: SourceType | null;
    values: SourceType | null;
    sizes: SourceType | null;
};

type ChartPartsType = {
    chart: ElementType;
    title: ElementType | null;
    autoTitleDeleted: ElementType | null;
    kind: string;
    series: SeriesType[];
};

function readPoints(xml: string, cache: ElementType) {
    const points = new Map<number, PointType>();
    let count: number | null = null;
    for (const child of listChildren(xml, cache)) {
        if (child.name === 'c:ptCount') {
            count = readIntAttribute(readOpenTag(xml, child), 'val');
        } else if (child.name === 'c:pt') {
            const idx = readIntAttribute(readOpenTag(xml, child), 'idx');
            const value = findChild(xml, child, 'c:v');
            if (idx !== null && idx >= 0) {
                points.set(idx, {
                    element: child,
                    text: value === null ? '' : readInnerText(xml, value),
                });
            }
        }
    }
    if (count === null) {
        // a cache that does not count its points: as many as it holds
        count = 0;
        for (const idx of points.keys()) {
            count = Math.max(count, idx + 1);
        }
    }
    return { count, points };
}

function readSource(xml: string, element: ElementType): SourceType {
    const holder =
        listChildren(xml, element).find((child) => {
            return SOURCE_NAME_SET.has(child.name);
        }) ?? null;
    const source: SourceType = {
        element,
        holder,
        formula: null,
        isNumber: false,
        isMultiLevel: false,
        count: 0,
        points: new Map(),
    };
    if (holder === null) {
        return source;
    }
    if (holder.name === 'c:v') {
        source.count = 1;
        source.points.set(0, {
            element: holder,
            text: readInnerText(xml, holder),
        });
        return source;
    }
    source.isNumber = holder.name === 'c:numRef' || holder.name === 'c:numLit';
    source.isMultiLevel = holder.name === 'c:multiLvlStrRef';
    let cache: ElementType | null = holder;
    if (!holder.name.endsWith('Lit')) {
        const formula = findChild(xml, holder, 'c:f');
        source.formula = formula === null ? null : readInnerText(xml, formula);
        cache =
            listChildren(xml, holder).find((child) => {
                return /^c:(?:str|num|multiLvlStr)Cache$/.test(child.name);
            }) ?? null;
    }
    if (cache === null) {
        return source;
    }
    const read = readPoints(xml, cache);
    source.count = read.count;
    source.points = read.points;
    if (source.isMultiLevel) {
        // the labels next to the axis: the first level
        const level = findChild(xml, cache, 'c:lvl');
        source.points =
            level === null ? new Map() : readPoints(xml, level).points;
    }
    return source;
}

function readSeries(xml: string, element: ElementType): SeriesType {
    const children = listChildren(xml, element);
    const find = (...names: string[]) => {
        const child = children.find((one) => {
            return names.includes(one.name);
        });
        return child === undefined ? null : readSource(xml, child);
    };
    return {
        element,
        name: find('c:tx'),
        // a scatter or bubble chart's x and y
        categories: find('c:cat', 'c:xVal'),
        values: find('c:val', 'c:yVal'),
        sizes: find('c:bubbleSize'),
    };
}

function readChartParts(xml: string): ChartPartsType | null {
    const root = listChildElements(xml, 0, xml.length).find((one) => {
        return one.name === 'c:chartSpace';
    });
    if (root === undefined) {
        return null;
    }
    const chart = findChild(xml, root, 'c:chart');
    const plotArea =
        chart === null ? null : findChild(xml, chart, 'c:plotArea');
    if (chart === null || plotArea === null) {
        return null;
    }
    const plots = listChildren(xml, plotArea).filter((child) => {
        return PLOT_PATTERN.test(child.name);
    });
    if (plots.length === 0) {
        return null;
    }
    return {
        chart,
        title: findChild(xml, chart, 'c:title'),
        autoTitleDeleted: findChild(xml, chart, 'c:autoTitleDeleted'),
        kind: toPlotKind(xml, plots[0]),
        series: plots.flatMap((plot) => {
            return listChildren(xml, plot, 'c:ser').map((one) => {
                return readSeries(xml, one);
            });
        }),
    };
}

function toTexts(source: SourceType) {
    return Array.from({ length: source.count }, (_, idx) => {
        return source.points.get(idx)?.text ?? '';
    });
}

function toNumbers(source: SourceType | null) {
    if (source === null) {
        return [];
    }
    return Array.from({ length: source.count }, (_, idx) => {
        const text = source.points.get(idx)?.text;
        if (text === undefined || text.trim() === '') {
            return null;
        }
        const value = Number(text);
        return Number.isFinite(value) ? value : null;
    });
}

function readSourceName(source: SourceType | null) {
    if (source === null || source.holder === null) {
        return null;
    }
    return source.points.get(0)?.text ?? null;
}

function readTitle(xml: string, parts: ChartPartsType) {
    if (parts.title === null) {
        return null;
    }
    const tx = findChild(xml, parts.title, 'c:tx');
    if (tx === null) {
        return null;
    }
    const rich = findChild(xml, tx, 'c:rich');
    if (rich === null) {
        return readSourceName(readSource(xml, tx));
    }
    return listChildren(xml, rich, 'a:p')
        .map((paragraph) => {
            return (
                readParagraphText(
                    xml.slice(paragraph.start, paragraph.end),
                    'pptx',
                ) ?? ''
            );
        })
        .join('\n');
}

/**
 * What a chart part shows: its kind, its title, its category labels and
 * each series' name and numbers, from the chart's own copy of them. Null
 * when it is not a chart this can read (a `cx:chartSpace` of the newer
 * waterfall, treemap or funnel charts is not).
 */
export function readChartData(chartXml: string): OfficeChartDataType | null {
    const parts = readChartParts(chartXml);
    if (parts === null) {
        return null;
    }
    const labelled = parts.series.find((one) => {
        return one.categories !== null && one.categories.holder !== null;
    });
    return {
        kind: parts.kind,
        title: readTitle(chartXml, parts),
        categories:
            labelled?.categories === undefined || labelled.categories === null
                ? []
                : toTexts(labelled.categories),
        series: parts.series.map((one) => {
            return {
                name: readSourceName(one.name),
                values: toNumbers(one.values),
            };
        }),
    };
}

/**
 * A cache (`c:strCache`, `c:numCache`, a literal) holding `count` points:
 * `texts[idx]` written into point idx, null takes it out, undefined keeps
 * it as it was. Its number format and what follows the points are kept.
 */
function rewriteCacheXml(
    cacheXml: string,
    count: number,
    texts: readonly (string | null | undefined)[],
) {
    const root = listChildElements(cacheXml, 0, cacheXml.length)[0];
    if (root === undefined) {
        return cacheXml;
    }
    const openTag = cacheXml
        .slice(root.start, root.openEnd)
        .replace(/\s*\/>$/, '>');
    const before: string[] = [];
    const after: string[] = [];
    const pointMap = new Map<number, string>();
    let countXml = `<c:ptCount val="${count}"/>`;
    for (const child of listChildElements(
        cacheXml,
        root.openEnd,
        root.closeStart,
    )) {
        const childXml = cacheXml.slice(child.start, child.end);
        if (child.name === 'c:pt') {
            const idx = readIntAttribute(readOpenTag(cacheXml, child), 'idx');
            if (idx !== null) {
                pointMap.set(idx, childXml);
            }
        } else if (child.name === 'c:ptCount') {
            if (readIntAttribute(childXml, 'val') === count) {
                countXml = childXml;
            }
        } else if (child.name === 'c:formatCode') {
            before.push(childXml);
        } else {
            after.push(childXml);
        }
    }
    let points = '';
    for (let idx = 0; idx < count; idx++) {
        const text = texts[idx];
        const old = pointMap.get(idx);
        if (text === undefined) {
            points += old ?? '';
            continue;
        }
        if (text === null) {
            continue;
        }
        const value = `<c:v>${escapeXmlText(text)}</c:v>`;
        points +=
            old !== undefined && /<c:v\b[^>]*>[\s\S]*?<\/c:v>/.test(old)
                ? // the point's own number format kept
                  old.replace(/<c:v\b[^>]*>[\s\S]*?<\/c:v>/, () => {
                      return value;
                  })
                : `<c:pt idx="${idx}">${value}</c:pt>`;
    }
    return (
        openTag +
        before.join('') +
        countXml +
        points +
        after.join('') +
        `</${root.name}>`
    );
}

type PutCellType = (
    sheet: string,
    ref: string,
    value: string | number | null,
) => void;

function checkSameNumber(old: string | null, text: string | null) {
    if (old === null || text === null) {
        return old === text;
    }
    return Number(old) === Number(text);
}

/**
 * A reference's or literal's points made `count` long and written with
 * `wanted` (null keeps every point and only changes how many there are), its
 * formula grown or shrunk with it, and the cells that change put. Labels
 * given for a chart that counts its categories as numbers stay numbers while
 * every one is a number. Null when nothing changes.
 */
function genSourceEdit(
    xml: string,
    source: SourceType,
    count: number,
    wanted: readonly (string | number | null)[] | null,
    isColumn: boolean,
    putCell: PutCellType,
): EditType | null {
    const holder = source.holder;
    if (holder === null || holder.name === 'c:v' || source.isMultiLevel) {
        return null;
    }
    const isNumber =
        source.isNumber &&
        (wanted === null ||
            wanted.every((value) => {
                return (
                    typeof value !== 'string' ||
                    value === '' ||
                    NUMBER_PATTERN.test(value.trim())
                );
            }));
    const isConverted = isNumber !== source.isNumber;
    const texts: (string | null | undefined)[] = [];
    const cellMap = new Map<number, string | number | null>();
    for (let idx = 0; idx < count; idx++) {
        const old = source.points.get(idx)?.text ?? null;
        const isGrown = idx >= source.count;
        if (wanted === null) {
            texts.push(undefined);
            if (isGrown) {
                // a point added with nothing in it: its cell emptied too
                cellMap.set(idx, null);
            }
            continue;
        }
        const value = wanted[idx] ?? null;
        let text: string | null = null;
        let cell: string | number | null = null;
        if (value !== null && value !== '') {
            if (isNumber) {
                cell = typeof value === 'number' ? value : Number(value.trim());
                text = toNumberText(cell);
            } else {
                text = String(value);
                cell = text;
            }
        }
        const isSame = isNumber
            ? checkSameNumber(old, text)
            : old === text && !isConverted;
        texts.push(isSame ? undefined : text);
        if (!isSame || isGrown) {
            cellMap.set(idx, cell);
        }
    }
    let formula = source.formula;
    if (formula !== null && count !== source.count) {
        formula = resizeFormula(formula, count, isColumn) ?? formula;
    }
    const isChanged =
        isConverted ||
        count !== source.count ||
        formula !== source.formula ||
        texts.some((text) => {
            return text !== undefined;
        });
    if (!isChanged) {
        return null;
    }
    const cells = listFormulaCells(formula);
    if (cells !== null && cells.refs.length === count) {
        for (const [idx, value] of cellMap) {
            putCell(cells.sheet, cells.refs[idx], value);
        }
    }
    const holderXml = xml.slice(holder.start, holder.end);
    if (holder.name.endsWith('Lit')) {
        const name = isNumber ? 'c:numLit' : 'c:strLit';
        return {
            start: holder.start,
            end: holder.end,
            text: rewriteCacheXml(
                isConverted ? `<${name}></${name}>` : holderXml,
                count,
                texts,
            ),
        };
    }
    const cacheName = isNumber ? 'c:numCache' : 'c:strCache';
    const emptyCache = isNumber
        ? '<c:numCache><c:formatCode>General</c:formatCode></c:numCache>'
        : '<c:strCache></c:strCache>';
    const children = listChildren(xml, holder);
    const hasCache = children.some((child) => {
        return /^c:(?:str|num)Cache$/.test(child.name);
    });
    const newCache = (cacheXml: string) => {
        return rewriteCacheXml(cacheXml, count, texts);
    };
    let inner = '';
    for (const child of children) {
        const childXml = xml.slice(child.start, child.end);
        if (child.name === 'c:f') {
            inner +=
                formula === source.formula
                    ? childXml
                    : `<c:f>${escapeXmlText(formula ?? '')}</c:f>`;
            if (!hasCache) {
                inner += newCache(emptyCache);
            }
        } else if (/^c:(?:str|num)Cache$/.test(child.name)) {
            inner += newCache(isConverted ? `<${cacheName}/>` : childXml);
        } else {
            inner += childXml;
        }
    }
    const name = isNumber ? 'c:numRef' : 'c:strRef';
    const openTag = isConverted
        ? `<${name}>`
        : readOpenTag(xml, holder).replace(/\s*\/>$/, '>');
    return {
        start: holder.start,
        end: holder.end,
        text: `${openTag}${inner}</${name}>`,
    };
}

/**
 * Which way a ONE-cell formula grows (a range grows the way it runs): down
 * a column when a series' name sits above its value, as PowerPoint lays
 * data out, to the right when beside it.
 */
function readIsColumn(series: readonly SeriesType[]) {
    for (const one of series) {
        const name = parseFormula(one.name?.formula ?? null)?.areas[0];
        const value = parseFormula(one.values?.formula ?? null)?.areas[0];
        if (name !== undefined && value !== undefined) {
            return name.start.row !== value.start.row;
        }
    }
    return true;
}

function genNameEdits(
    xml: string,
    series: SeriesType,
    name: string,
    isColumn: boolean,
    putCell: PutCellType,
): EditType[] {
    const text = name === '' ? null : name;
    const source = series.name;
    const literal =
        text === null ? '' : `<c:tx><c:v>${escapeXmlText(text)}</c:v></c:tx>`;
    if (source === null) {
        if (text === null) {
            return [];
        }
        // a series PowerPoint names "Series 1" itself: the name written in
        // the chart, no cell holds it
        const children = listChildren(xml, series.element);
        const after = [...children].reverse().find((child) => {
            return child.name === 'c:order' || child.name === 'c:idx';
        });
        const at = after?.end ?? series.element.openEnd;
        return [{ start: at, end: at, text: literal }];
    }
    if (source.holder === null || source.holder.name === 'c:v') {
        if (readSourceName(source) === text) {
            return [];
        }
        return [
            {
                start: source.element.start,
                end: source.element.end,
                text: literal,
            },
        ];
    }
    const edit = genSourceEdit(xml, source, 1, [text], isColumn, putCell);
    return edit === null ? [] : [edit];
}

// A new title's words in the look a chart keeps for it (`c:txPr`), or none.
function genNewRichXml(xml: string, title: ElementType | null, text: string) {
    const look = title === null ? null : findChild(xml, title, 'c:txPr');
    const children = look === null ? [] : listChildren(xml, look);
    const paragraph = children.find((child) => {
        return child.name === 'a:p';
    });
    const rebuilt =
        rebuildParagraph(
            paragraph === undefined
                ? '<a:p></a:p>'
                : xml.slice(paragraph.start, paragraph.end),
            text,
            'pptx',
        ) ?? '';
    const keep = (name: string, fallback: string) => {
        const child = children.find((one) => {
            return one.name === name;
        });
        return child === undefined
            ? fallback
            : xml.slice(child.start, child.end);
    };
    return (
        '<c:tx><c:rich>' +
        keep('a:bodyPr', '<a:bodyPr/>') +
        keep('a:lstStyle', '<a:lstStyle/>') +
        rebuilt +
        '</c:rich></c:tx>'
    );
}

// The title's words written in its first run, every other run and line
// taken out.
function genRichXml(xml: string, rich: ElementType, text: string) {
    const children = listChildren(xml, rich);
    const paragraphs = children.filter((child) => {
        return child.name === 'a:p';
    });
    const chosen =
        paragraphs.find((one) => {
            return /<a:(?:r|fld)\b/.test(xml.slice(one.start, one.end));
        }) ?? paragraphs[0];
    const rebuilt = rebuildParagraph(
        chosen === undefined
            ? '<a:p></a:p>'
            : xml.slice(chosen.start, chosen.end),
        text,
        'pptx',
    );
    if (rebuilt === null) {
        return null;
    }
    let inner = '';
    let isPlaced = false;
    for (const child of children) {
        if (child.name !== 'a:p') {
            inner += xml.slice(child.start, child.end);
        } else if (!isPlaced) {
            inner += rebuilt;
            isPlaced = true;
        }
    }
    return `${readOpenTag(xml, rich)}${inner}${isPlaced ? '' : rebuilt}</c:rich>`;
}

function genTitleEdits(
    xml: string,
    parts: ChartPartsType,
    text: string,
    isColumn: boolean,
    putCell: PutCellType,
): EditType[] {
    const { chart, title, autoTitleDeleted } = parts;
    const setDeleted = (value: '0' | '1', at: number) => {
        const written = `<c:autoTitleDeleted val="${value}"/>`;
        if (autoTitleDeleted === null) {
            return { start: at, end: at, text: written };
        }
        return {
            start: autoTitleDeleted.start,
            end: autoTitleDeleted.end,
            text: written,
        };
    };
    if (text.trim() === '') {
        // the title taken off, and PowerPoint told not to make one
        if (title === null) {
            return [setDeleted('1', chart.openEnd)];
        }
        return [
            { start: title.start, end: title.end, text: '' },
            setDeleted('1', title.start),
        ];
    }
    if (title === null) {
        const made =
            '<c:title>' +
            genNewRichXml(xml, null, text) +
            '<c:overlay val="0"/></c:title>';
        return [
            { start: chart.openEnd, end: chart.openEnd, text: made },
            setDeleted('0', chart.openEnd),
        ];
    }
    const edits: EditType[] = [];
    if (
        autoTitleDeleted !== null &&
        readAttribute(readOpenTag(xml, autoTitleDeleted), 'val') !== '0'
    ) {
        edits.push(setDeleted('0', title.end));
    }
    if (title.closeStart === title.end) {
        // `<c:title/>`
        edits.push({
            start: title.start,
            end: title.end,
            text:
                '<c:title>' +
                genNewRichXml(xml, null, text) +
                '<c:overlay val="0"/></c:title>',
        });
        return edits;
    }
    const tx = findChild(xml, title, 'c:tx');
    const rich = tx === null ? null : findChild(xml, tx, 'c:rich');
    if (tx !== null && rich !== null) {
        const richXml = genRichXml(xml, rich, text);
        if (richXml !== null) {
            edits.push({ start: rich.start, end: rich.end, text: richXml });
        }
        return edits;
    }
    if (tx !== null) {
        const source = readSource(xml, tx);
        if (source.holder !== null && source.holder.name === 'c:strRef') {
            // a title taken from a cell
            const edit = genSourceEdit(
                xml,
                source,
                1,
                [text],
                isColumn,
                putCell,
            );
            return edit === null ? edits : [...edits, edit];
        }
        edits.push({
            start: tx.start,
            end: tx.end,
            text: genNewRichXml(xml, title, text),
        });
        return edits;
    }
    // "Chart Title" PowerPoint made: the words put first, in its look
    edits.push({
        start: title.openEnd,
        end: title.openEnd,
        text: genNewRichXml(xml, title, text),
    });
    return edits;
}

// A point's own look (`c:dPt`) and label (`c:dLbl`) past the last point.
function genDropPointEdits(xml: string, series: ElementType, count: number) {
    const edits: EditType[] = [];
    const dropFrom = (parent: ElementType, name: string) => {
        for (const child of listChildren(xml, parent, name)) {
            const idx = findChild(xml, child, 'c:idx');
            const value =
                idx === null
                    ? null
                    : readIntAttribute(readOpenTag(xml, idx), 'val');
            if (value !== null && value >= count) {
                edits.push({ start: child.start, end: child.end, text: '' });
            }
        }
    };
    dropFrom(series, 'c:dPt');
    const labels = findChild(xml, series, 'c:dLbls');
    if (labels !== null) {
        dropFrom(labels, 'c:dLbl');
    }
    return edits;
}

function toCountReason(
    name: string,
    given: number,
    count: number,
    isCategoriesGiven: boolean,
) {
    if (isCategoriesGiven) {
        return (
            `${count} categories were given, so "${name}" needs ${count} ` +
            `values, one for each; ${given} were given.`
        );
    }
    return (
        `This chart has ${count} categories, so "${name}" needs ${count} ` +
        `values, one for each; ${given} were given. To add or take away a ` +
        'category, give the categories too.'
    );
}

/**
 * The chart with `change` written into its own copy of the data, and the
 * cells of its embedded workbook to write the same values into (from its
 * formulas; only the cells whose value changes, or that a new point
 * takes), or why it cannot be.
 *
 * - `title`: the words of its first run, the other runs and lines taken
 *   out; a chart with none gets one; '' takes it off.
 * - `categories`: every series' labels; a different number of them adds or
 *   takes away points of every series -- each range grown or shrunk from
 *   where it starts, a series not given its values gets empty points.
 * - `series[].name` / `.values`: by index as read; null takes a point out.
 *
 * A formula this cannot read still has its points changed; its cells are
 * left out.
 */
export function setChartDataXml(
    chartXml: string,
    change: OfficeChartChangeType,
): { xml: string; cells: OfficeChartCellType[] } | { reason: string } {
    const xml = chartXml;
    const parts = readChartParts(xml);
    if (parts === null || parts.series.length === 0) {
        return {
            reason:
                'This chart could not be read, so it cannot be changed ' +
                'here; change it in PowerPoint.',
        };
    }
    const { series } = parts;
    const names = series.map((one, index) => {
        return readSourceName(one.name) ?? `Series ${index + 1}`;
    });
    const labelled = series.filter((one) => {
        return one.categories !== null && one.categories.holder !== null;
    });
    const oldCount = (labelled[0]?.categories ?? series[0].values)?.count ?? 0;
    let count = oldCount;
    let labels: string[] | null = null;
    if (change.categories !== undefined) {
        if (labelled.length === 0) {
            return { reason: 'This chart has no category labels to change.' };
        }
        if (
            labelled.some((one) => {
                return one.categories?.isMultiLevel;
            })
        ) {
            return {
                reason:
                    "This chart's categories have more than one level; " +
                    'change them in PowerPoint.',
            };
        }
        if (change.categories.length === 0) {
            return { reason: 'A chart needs at least one category.' };
        }
        labels = change.categories.map((one) => {
            return toWrittenText(String(one));
        });
        count = labels.length;
    }
    const wantedMap = new Map<
        number,
        { name?: string; values?: readonly (number | null)[] }
    >();
    for (const one of change.series ?? []) {
        if (
            !Number.isInteger(one.index) ||
            one.index < 0 ||
            one.index >= series.length
        ) {
            const list = names
                .map((name, index) => {
                    return `${index} "${name}"`;
                })
                .join(', ');
            return {
                reason: `There is no series ${one.index} in this chart; its series are ${list}.`,
            };
        }
        const wanted = { ...wantedMap.get(one.index) };
        if (one.name !== undefined) {
            wanted.name = toWrittenText(String(one.name));
        }
        if (one.values !== undefined) {
            const values = series[one.index].values;
            if (values === null || values.holder === null) {
                return {
                    reason:
                        `"${names[one.index]}" has no numbers of its own ` +
                        'to change here; change it in PowerPoint.',
                };
            }
            if (one.values.length !== count) {
                return {
                    reason: toCountReason(
                        names[one.index],
                        one.values.length,
                        count,
                        labels !== null,
                    ),
                };
            }
            if (
                one.values.some((value) => {
                    return (
                        value !== null &&
                        (typeof value !== 'number' || !Number.isFinite(value))
                    );
                })
            ) {
                return {
                    reason: `"${names[one.index]}" was given a value that is not a number.`,
                };
            }
            wanted.values = one.values;
        }
        wantedMap.set(one.index, wanted);
    }
    if (count !== oldCount) {
        const isTied = series.some((one) => {
            return /<c:(?:plus|minus)\b|<c15:datalabelsRange\b/.test(
                xml.slice(one.element.start, one.element.end),
            );
        });
        if (isTied) {
            return {
                reason:
                    'This chart takes error bars or labels from cells for ' +
                    'its points, so a category cannot be added or taken ' +
                    'away here; change it in PowerPoint.',
            };
        }
    }
    const isColumn = readIsColumn(series);
    const edits: EditType[] = [];
    const cellMap = new Map<string, OfficeChartCellType>();
    const putCell: PutCellType = (sheet, ref, value) => {
        cellMap.set(`${sheet}!${ref}`, { sheet, ref, value });
    };
    if (change.title !== undefined) {
        edits.push(
            ...genTitleEdits(
                xml,
                parts,
                toWrittenText(String(change.title)),
                isColumn,
                putCell,
            ),
        );
    }
    const isResized = count !== oldCount;
    series.forEach((one, index) => {
        const wanted = wantedMap.get(index);
        if (wanted?.name !== undefined) {
            edits.push(
                ...genNameEdits(xml, one, wanted.name, isColumn, putCell),
            );
        }
        const sources: [
            SourceType | null,
            (string | number | null)[] | null,
        ][] = [
            [one.categories, labels],
            [
                one.values,
                wanted?.values === undefined ? null : [...wanted.values],
            ],
            [one.sizes, null],
        ];
        for (const [source, given] of sources) {
            if (source === null || (given === null && !isResized)) {
                continue;
            }
            const edit = genSourceEdit(
                xml,
                source,
                count,
                given,
                isColumn,
                putCell,
            );
            if (edit !== null) {
                edits.push(edit);
            }
        }
        if (count < oldCount) {
            edits.push(...genDropPointEdits(xml, one.element, count));
        }
    });
    return { xml: applyEdits(xml, edits), cells: [...cellMap.values()] };
}

// --- the embedded workbook -----------------------------------------------------

function resolvePartPath(fromPart: string, target: string) {
    const segments = target.startsWith('/')
        ? []
        : fromPart.split('/').slice(0, -1);
    for (const segment of target.replace(/^\//, '').split('/')) {
        if (segment === '..') {
            segments.pop();
        } else if (segment !== '.' && segment !== '') {
            segments.push(segment);
        }
    }
    return segments.join('/');
}

function listRelationships(relsXml: string) {
    const out: { id: string; type: string; target: string }[] = [];
    for (const tag of scanTags(relsXml)) {
        if (tag.isClose || !/^(?:\w+:)?Relationship$/.test(tag.name)) {
            continue;
        }
        if (readAttribute(tag.attributes, 'TargetMode') === 'External') {
            continue;
        }
        out.push({
            id: readAttribute(tag.attributes, 'Id') ?? '',
            type: readAttribute(tag.attributes, 'Type') ?? '',
            target: readAttribute(tag.attributes, 'Target') ?? '',
        });
    }
    return out;
}

/**
 * The part of an embedded workbook holding the sheet `sheetName` (as a
 * chart formula names it), from `xl/workbook.xml` and its rels:
 * 'xl/worksheets/sheet1.xml'. Null when there is none.
 */
export function findSheetPath(
    workbookXml: string,
    workbookRelsXml: string,
    sheetName: string,
    workbookPath = 'xl/workbook.xml',
) {
    const sheets: { name: string; id: string }[] = [];
    for (const tag of scanTags(workbookXml)) {
        if (tag.isClose || !/^(?:\w+:)?sheet$/.test(tag.name)) {
            continue;
        }
        const id = /\s[\w.-]+:id\s*=\s*"([^"]*)"/.exec(tag.attributes)?.[1];
        sheets.push({
            name: readAttribute(tag.attributes, 'name') ?? '',
            id: id ?? '',
        });
    }
    const found =
        sheets.find((one) => {
            return one.name === sheetName;
        }) ??
        // a sheet's name is the same sheet in any case
        sheets.find((one) => {
            return one.name.toLowerCase() === sheetName.toLowerCase();
        });
    if (found === undefined || found.id === '') {
        return null;
    }
    const relation = listRelationships(workbookRelsXml).find((one) => {
        return one.id === found.id;
    });
    if (relation === undefined || relation.target === '') {
        return null;
    }
    return resolvePartPath(workbookPath, relation.target);
}

/** The tables (`xl/tables/tableN.xml`) a sheet holds, from its rels. */
export function listSheetTablePaths(sheetRelsXml: string, sheetPath: string) {
    return listRelationships(sheetRelsXml)
        .filter((one) => {
            return /\/table$/.test(one.type);
        })
        .map((one) => {
            return resolvePartPath(sheetPath, one.target);
        });
}

type CellPlaceType = {
    element: ElementType;
    col: number;
    openTag: string;
    hasR: boolean;
};

function genCellXml(
    prefix: string,
    openTag: string | null,
    ref: string,
    value: string | number | null,
) {
    let attributes =
        openTag === null
            ? ` r="${ref}"`
            : openTag
                  .replace(/^<[^\s/>]+/, '')
                  .replace(/\s*\/?>$/, '')
                  .replace(/\s(?:t|cm|vm)\s*=\s*("[^"]*"|'[^']*')/g, '');
    if (!/\sr\s*=/.test(attributes)) {
        attributes = ` r="${ref}"${attributes}`;
    }
    const c = `${prefix}c`;
    if (
        value === null ||
        (typeof value === 'number' && !Number.isFinite(value))
    ) {
        return `<${c}${attributes}/>`;
    }
    if (typeof value === 'number') {
        return `<${c}${attributes}><${prefix}v>${toNumberText(value)}</${prefix}v></${c}>`;
    }
    const text = toXmlSafeText(value);
    const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
    return (
        `<${c}${attributes} t="inlineStr"><${prefix}is><${prefix}t${space}>` +
        `${escapeXmlText(text)}</${prefix}t></${prefix}is></${c}>`
    );
}

function readFormulaTag(prefix: string, cellXml: string) {
    return new RegExp(`<${prefix}f\\b((?:[^>"']|"[^"]*"|'[^']*')*?)/?>`).exec(
        cellXml,
    );
}

/**
 * A cell that took its formula from one now gone made a plain value: the
 * value it showed, the formula out.
 */
function genConstantCellXml(prefix: string, cellXml: string, ref: string) {
    const openTag = /^<[^>]*>/.exec(cellXml)?.[0] ?? '';
    if (readAttribute(openTag, 't') === 'str') {
        const value = new RegExp(
            `<${prefix}v\\b[^>]*>([\\s\\S]*?)</${prefix}v>`,
        ).exec(cellXml)?.[1];
        return genCellXml(
            prefix,
            openTag,
            ref,
            value === undefined ? null : unescapeXml(value),
        );
    }
    return cellXml
        .replace(
            new RegExp(
                `<${prefix}f\\b[^>]*/>|<${prefix}f\\b[^>]*>[\\s\\S]*?</${prefix}f>`,
            ),
            '',
        )
        .replace(/^<[^>]*>/, (tag) => {
            return tag.replace(/\s(?:cm|vm)\s*=\s*("[^"]*"|'[^']*')/g, '');
        });
}

function stampRef(openTag: string, ref: string) {
    return openTag.replace(/^<[^\s/>]+/, (name) => {
        return `${name} r="${ref}"`;
    });
}

function widenSpans(openTag: string, low: number, high: number) {
    return openTag.replace(
        /(\sspans\s*=\s*")(\d+):(\d+)(")/,
        (_whole, head, from, to, tail) => {
            const start = Math.min(Number(from), low);
            const end = Math.max(Number(to), high);
            return `${head}${start}:${end}${tail}`;
        },
    );
}

/**
 * A worksheet with `cells` written: a number as `<v>`, words as an inline
 * string, null emptied; a missing row or cell made in its place (rows by
 * number, cells by column); a written cell's formula dropped -- and a
 * shared formula's cells that took it from one made plain values. The
 * sheet's `dimension` and a row's `spans` grow to hold a new cell; every
 * other byte is kept.
 */
export function setSheetCellsXml(
    sheetXml: string,
    cells: readonly OfficeSheetCellType[],
) {
    const wantedMap = new Map<number, Map<number, string | number | null>>();
    for (const cell of cells) {
        const at = parseCellRef(cell.ref);
        if (at === null) {
            continue;
        }
        const row = wantedMap.get(at.row) ?? new Map();
        row.set(at.col, cell.value);
        wantedMap.set(at.row, row);
    }
    if (wantedMap.size === 0) {
        return sheetXml;
    }
    const dataTag = readSheetDataTag(sheetXml);
    if (dataTag === null) {
        return sheetXml;
    }
    const { tag, closeStart, prefix } = dataTag;
    const rowName = `${prefix}row`;
    const genNewCells = (rowNum: number, cols: number[]) => {
        const wanted = wantedMap.get(rowNum);
        return cols
            .map((col) => {
                const ref = toCellRef({ col, row: rowNum });
                return genCellXml(prefix, null, ref, wanted?.get(col) ?? null);
            })
            .join('');
    };
    const genNewRow = (num: number) => {
        const cols = [...(wantedMap.get(num)?.keys() ?? [])].sort((a, b) => {
            return a - b;
        });
        return `<${rowName} r="${num}">${genNewCells(num, cols)}</${rowName}>`;
    };
    if (tag.isSelfClosing) {
        // `<sheetData/>`: opened for its first rows
        const rowsXml = [...wantedMap.keys()]
            .sort((a, b) => {
                return a - b;
            })
            .map(genNewRow)
            .join('');
        const xml =
            sheetXml.slice(0, tag.start) +
            `<${tag.name}${tag.attributes.replace(/\s*$/, '')}>${rowsXml}` +
            `</${tag.name}>` +
            sheetXml.slice(tag.end);
        return growDimension(xml, prefix, wantedMap);
    }
    let lastRow = 0;
    const rows = listChildElements(sheetXml, tag.end, closeStart)
        .filter((one) => {
            return one.name === rowName;
        })
        .map((element) => {
            const r = readIntAttribute(readOpenTag(sheetXml, element), 'r');
            const num = r ?? lastRow + 1;
            lastRow = num;
            return { element, num, hasR: r !== null };
        });
    const readCells = (row: ElementType): CellPlaceType[] => {
        let lastCol = 0;
        return listChildren(sheetXml, row, `${prefix}c`).map((element) => {
            const openTag = readOpenTag(sheetXml, element);
            const at = parseCellRef(readAttribute(openTag, 'r') ?? '');
            const col = at?.col ?? lastCol + 1;
            lastCol = col;
            return { element, col, openTag, hasR: at !== null };
        });
    };
    const rowCellsMap = new Map<number, CellPlaceType[]>();
    // shared formulas whose first cell is written over
    const droppedSet = new Set<string>();
    for (const row of rows) {
        const wanted = wantedMap.get(row.num);
        if (wanted === undefined) {
            continue;
        }
        const rowCells = readCells(row.element);
        rowCellsMap.set(row.num, rowCells);
        for (const cell of rowCells) {
            if (!wanted.has(cell.col)) {
                continue;
            }
            const formula = readFormulaTag(
                prefix,
                sheetXml.slice(cell.element.start, cell.element.end),
            );
            const attributes = formula?.[1] ?? '';
            const shared = readAttribute(attributes, 'si');
            if (
                readAttribute(attributes, 't') === 'shared' &&
                readAttribute(attributes, 'ref') !== null &&
                shared !== null
            ) {
                droppedSet.add(shared);
            }
        }
    }
    // a cell's replacement, by where it starts
    const replacedMap = new Map<number, string>();
    if (droppedSet.size > 0) {
        for (const row of rows) {
            const rowCells = rowCellsMap.get(row.num) ?? readCells(row.element);
            for (const cell of rowCells) {
                if (wantedMap.get(row.num)?.has(cell.col)) {
                    continue;
                }
                const cellXml = sheetXml.slice(
                    cell.element.start,
                    cell.element.end,
                );
                const attributes = readFormulaTag(prefix, cellXml)?.[1];
                if (
                    attributes === undefined ||
                    readAttribute(attributes, 't') !== 'shared' ||
                    readAttribute(attributes, 'ref') !== null ||
                    !droppedSet.has(readAttribute(attributes, 'si') ?? '')
                ) {
                    continue;
                }
                rowCellsMap.set(row.num, rowCells);
                replacedMap.set(
                    cell.element.start,
                    genConstantCellXml(
                        prefix,
                        cellXml,
                        toCellRef({ col: cell.col, row: row.num }),
                    ),
                );
            }
        }
    }
    const edits: EditType[] = [];
    for (const row of rows) {
        const rowCells = rowCellsMap.get(row.num);
        if (rowCells === undefined) {
            continue;
        }
        const wanted = wantedMap.get(row.num) ?? new Map();
        const pending = [...wanted.keys()]
            .filter((col) => {
                return !rowCells.some((cell) => {
                    return cell.col === col;
                });
            })
            .sort((a, b) => {
                return a - b;
            });
        const cols = [
            ...pending,
            ...rowCells.map((cell) => {
                return cell.col;
            }),
        ];
        let openTag = readOpenTag(sheetXml, row.element).replace(
            /\s*\/>$/,
            '>',
        );
        if (!row.hasR) {
            openTag = stampRef(openTag, String(row.num));
        }
        if (pending.length > 0) {
            openTag = widenSpans(openTag, Math.min(...cols), Math.max(...cols));
        }
        let out = openTag;
        let cursor = row.element.openEnd;
        const flush = (before: number) => {
            const ready: number[] = [];
            while (pending.length > 0 && pending[0] < before) {
                ready.push(pending.shift() ?? 0);
            }
            out += genNewCells(row.num, ready);
        };
        for (const child of listChildren(sheetXml, row.element)) {
            out += sheetXml.slice(cursor, child.start);
            cursor = child.end;
            const cell = rowCells.find((one) => {
                return one.element.start === child.start;
            });
            if (cell === undefined) {
                // what follows the cells (`extLst`): the new ones before it
                flush(Infinity);
                out += sheetXml.slice(child.start, child.end);
                continue;
            }
            flush(cell.col);
            const ref = toCellRef({ col: cell.col, row: row.num });
            if (wanted.has(cell.col)) {
                out += genCellXml(
                    prefix,
                    cell.openTag,
                    ref,
                    wanted.get(cell.col) ?? null,
                );
            } else {
                const kept =
                    replacedMap.get(cell.element.start) ??
                    sheetXml.slice(cell.element.start, cell.element.end);
                out += cell.hasR
                    ? kept
                    : kept.replace(/^<[^>]*>/, (tag) => {
                          return stampRef(tag, ref);
                      });
            }
        }
        flush(Infinity);
        out += sheetXml.slice(cursor, row.element.closeStart) + `</${rowName}>`;
        edits.push({
            start: row.element.start,
            end: row.element.end,
            text: out,
        });
    }
    // the rows not there yet, each before the first row after it
    const existingSet = new Set(
        rows.map((row) => {
            return row.num;
        }),
    );
    const newRowNums = [...wantedMap.keys()]
        .filter((num) => {
            return !existingSet.has(num);
        })
        .sort((a, b) => {
            return a - b;
        });
    for (const num of newRowNums) {
        const next = rows.find((row) => {
            return row.num > num;
        });
        const at = next?.element.start ?? closeStart;
        edits.push({ start: at, end: at, text: genNewRow(num) });
    }
    if (newRowNums.length > 0) {
        // a row placed by counting would count the new one
        for (const row of rows) {
            if (!row.hasR && !rowCellsMap.has(row.num)) {
                edits.push({
                    start: row.element.start,
                    end: row.element.openEnd,
                    text: stampRef(
                        readOpenTag(sheetXml, row.element),
                        String(row.num),
                    ),
                });
            }
        }
    }
    return growDimension(applyEdits(sheetXml, edits), prefix, wantedMap);
}

function readSheetDataTag(sheetXml: string) {
    for (const tag of scanTags(sheetXml)) {
        if (tag.isClose || !/^(?:\w+:)?sheetData$/.test(tag.name)) {
            continue;
        }
        const prefix = tag.name.slice(0, -'sheetData'.length);
        if (tag.isSelfClosing) {
            return { tag, closeStart: tag.end, prefix };
        }
        const closeStart = sheetXml.indexOf(`</${tag.name}>`, tag.end);
        return closeStart < 0 ? null : { tag, closeStart, prefix };
    }
    return null;
}

// The sheet's `dimension` grown to hold every cell written.
function growDimension(
    sheetXml: string,
    prefix: string,
    wantedMap: Map<number, Map<number, unknown>>,
) {
    const pattern = new RegExp(
        `(<${prefix}dimension\\b[^>]*\\sref\\s*=\\s*")([^"]*)(")`,
    );
    return sheetXml.replace(pattern, (whole, head, ref, tail) => {
        const [first, second] = String(ref).split(':');
        const start = parseCellRef(first ?? '');
        const end = parseCellRef(second ?? first ?? '');
        if (start === null || end === null) {
            return whole;
        }
        let { col: lowCol, row: lowRow } = start;
        let { col: highCol, row: highRow } = end;
        for (const [row, cols] of wantedMap) {
            for (const col of cols.keys()) {
                lowCol = Math.min(lowCol, col);
                highCol = Math.max(highCol, col);
                lowRow = Math.min(lowRow, row);
                highRow = Math.max(highRow, row);
            }
        }
        const low = toCellRef({ col: lowCol, row: lowRow });
        const high = toCellRef({ col: highCol, row: highRow });
        const grown = low === high ? low : `${low}:${high}`;
        return grown === ref ? whole : `${head}${grown}${tail}`;
    });
}

/**
 * An Excel table (`xl/tables/tableN.xml`) kept true to cells written into
 * its sheet: a header cell's words are its column's name (Excel repairs a
 * file where they differ), and rows written below it grow it down. It never
 * shrinks, and a column added to its right is not made one of its columns.
 */
export function setSheetTableXml(
    tableXml: string,
    cells: readonly OfficeSheetCellType[],
) {
    let table: TagType | null = null;
    const columns: TagType[] = [];
    let filter: TagType | null = null;
    for (const tag of scanTags(tableXml)) {
        if (tag.isClose) {
            continue;
        }
        if (table === null && /^(?:\w+:)?table$/.test(tag.name)) {
            table = tag;
        } else if (/^(?:\w+:)?tableColumn$/.test(tag.name)) {
            columns.push(tag);
        } else if (filter === null && /^(?:\w+:)?autoFilter$/.test(tag.name)) {
            filter = tag;
        }
    }
    if (table === null) {
        return tableXml;
    }
    const ref = readAttribute(table.attributes, 'ref') ?? '';
    const [first, second] = ref.split(':');
    const start = parseCellRef(first ?? '');
    const end = parseCellRef(second ?? '');
    if (start === null || end === null) {
        return tableXml;
    }
    const edits: EditType[] = [];
    const setAttribute = (tag: TagType, name: string, value: string) => {
        const matched = new RegExp(`(\\s${name}\\s*=\\s*")([^"]*)"`).exec(
            tag.attributes,
        );
        if (matched === null) {
            return;
        }
        // the attributes start right after `<name`
        const at =
            tag.start + 1 + tag.name.length + matched.index + matched[1].length;
        edits.push({ start: at, end: at + matched[2].length, text: value });
    };
    if (readAttribute(table.attributes, 'headerRowCount') !== '0') {
        const nameMap = new Map<number, string | number | null>();
        for (const cell of cells) {
            const at = parseCellRef(cell.ref);
            if (
                at !== null &&
                at.row === start.row &&
                at.col >= start.col &&
                at.col <= end.col
            ) {
                nameMap.set(at.col - start.col, cell.value);
            }
        }
        for (const [index, value] of nameMap) {
            const column = columns[index];
            if (column === undefined) {
                continue;
            }
            const name =
                value === null
                    ? `Column${index + 1}`
                    : typeof value === 'number'
                      ? toNumberText(value)
                      : toXmlSafeText(value);
            // a line break in a column's name is written the way Excel does
            setAttribute(
                column,
                'name',
                escapeXmlAttribute(name).replace(/\n/g, '_x000a_'),
            );
        }
    }
    const totals = readIntAttribute(table.attributes, 'totalsRowCount') ?? 0;
    let lastRow = end.row;
    for (const cell of cells) {
        const at = parseCellRef(cell.ref);
        if (at !== null && at.col >= start.col && at.col <= end.col) {
            lastRow = Math.max(lastRow, at.row);
        }
    }
    if (totals === 0 && lastRow > end.row) {
        const grown = `${toCellRef(start)}:${toCellRef({ col: end.col, row: lastRow })}`;
        setAttribute(table, 'ref', grown);
        if (
            filter !== null &&
            readAttribute(filter.attributes, 'ref') === ref
        ) {
            setAttribute(filter, 'ref', grown);
        }
    }
    return applyEdits(tableXml, edits);
}
