// The KIND of a chart on a PowerPoint slide -- column, bar, line, pie,
// doughnut or area -- changed for `owa_office_edit` (2026-11-21, the goal
// _chatbot can change do everything on a given pptx_).
//
// A chart part (`ppt/charts/chartN.xml`) draws its series with ONE element
// in `c:plotArea` (`c:barChart`, `c:lineChart`, ...) beside its axes. A new
// kind is that element written again in the target's schema order: each
// `c:ser` keeps its name, look, labels and data and loses the children the
// new kind does not allow, because PowerPoint repairs (or refuses) a file
// with one out of place. A pie has no axes: they go going to one and are
// made coming back. A combination of charts, or a kind outside the six, is
// left to PowerPoint.
//
// Pure, strings in and out, the same tag scanner as the words.

import {
    type ElementType,
    listChildElements,
    unescapeXml,
} from './officeXmlEditHelpers';

export const OFFICE_CHART_KIND_LIST = [
    'column',
    'bar',
    'line',
    'pie',
    'doughnut',
    'area',
] as const;

export type OfficeChartKindType = (typeof OFFICE_CHART_KIND_LIST)[number];

const KIND_SYNONYM_MAP: Record<string, OfficeChartKindType> = {
    column: 'column',
    columns: 'column',
    'vertical bar': 'column',
    'vertical bars': 'column',
    bar: 'bar',
    bars: 'bar',
    'horizontal bar': 'bar',
    'horizontal bars': 'bar',
    line: 'line',
    lines: 'line',
    pie: 'pie',
    pies: 'pie',
    doughnut: 'doughnut',
    doughnuts: 'doughnut',
    donut: 'doughnut',
    donuts: 'doughnut',
    area: 'area',
    areas: 'area',
};

/** A kind as a person or a model writes it ("Pie chart", "donut"), or null. */
export function toOfficeChartKind(value: unknown): OfficeChartKindType | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ')
        .replace(/\s(?:chart|graph)s?$/, '');
    return KIND_SYNONYM_MAP[text] ?? null;
}

// What a series' look is drawn with: a filled shape, a line, or a slice
// whose colour varies point by point.
type FamilyType = 'fill' | 'line' | 'slice';

const FAMILY_MAP: Record<OfficeChartKindType, FamilyType> = {
    column: 'fill',
    bar: 'fill',
    area: 'fill',
    line: 'line',
    pie: 'slice',
    doughnut: 'slice',
};

// A series' children in each kind's schema order (CT_BarSer, CT_LineSer,
// CT_AreaSer, CT_PieSer); anything else is dropped. `c:shape` is 3D only.
const BAR_SERIES_ORDER = [
    'c:idx',
    'c:order',
    'c:tx',
    'c:spPr',
    'c:invertIfNegative',
    'c:pictureOptions',
    'c:dPt',
    'c:dLbls',
    'c:trendline',
    'c:errBars',
    'c:cat',
    'c:val',
    'c:extLst',
];
const LINE_SERIES_ORDER = [
    'c:idx',
    'c:order',
    'c:tx',
    'c:spPr',
    'c:marker',
    'c:dPt',
    'c:dLbls',
    'c:trendline',
    'c:errBars',
    'c:cat',
    'c:val',
    'c:smooth',
    'c:extLst',
];
const AREA_SERIES_ORDER = [
    'c:idx',
    'c:order',
    'c:tx',
    'c:spPr',
    'c:pictureOptions',
    'c:dPt',
    'c:dLbls',
    'c:trendline',
    'c:errBars',
    'c:cat',
    'c:val',
    'c:extLst',
];
const PIE_SERIES_ORDER = [
    'c:idx',
    'c:order',
    'c:tx',
    'c:spPr',
    'c:explosion',
    'c:dPt',
    'c:dLbls',
    'c:cat',
    'c:val',
    'c:extLst',
];

const SERIES_ORDER_MAP: Record<OfficeChartKindType, string[]> = {
    column: BAR_SERIES_ORDER,
    bar: BAR_SERIES_ORDER,
    line: LINE_SERIES_ORDER,
    area: AREA_SERIES_ORDER,
    pie: PIE_SERIES_ORDER,
    doughnut: PIE_SERIES_ORDER,
};

// Where a data label may sit in each kind; PowerPoint repairs a file whose
// label sits where the kind cannot put it (an area or doughnut takes none).
const LABEL_SPOT_MAP: Record<OfficeChartKindType, string[]> = {
    column: ['ctr', 'inEnd', 'inBase', 'outEnd'],
    bar: ['ctr', 'inEnd', 'inBase', 'outEnd'],
    line: ['t', 'b', 'l', 'r', 'ctr'],
    area: [],
    pie: ['bestFit', 'ctr', 'inEnd', 'outEnd'],
    doughnut: [],
};

const KIND_LIST_TEXT = 'column, bar, line, pie, doughnut or area';

const PLOT_PATTERN = /^c:(\w+?)(3D)?Chart$/;
const KNOWN_PLOT_PATTERN = /^c:(bar|line|pie|doughnut|area)(3D)?Chart$/;
const AXIS_NAME_SET = new Set(['c:catAx', 'c:valAx', 'c:dateAx', 'c:serAx']);
const FILL_NAME_SET = new Set([
    'a:noFill',
    'a:solidFill',
    'a:gradFill',
    'a:blipFill',
    'a:pattFill',
    'a:grpFill',
]);
// the fills a line can be drawn with
const LINE_FILL_NAME_SET = new Set(['a:solidFill', 'a:gradFill', 'a:pattFill']);
const SHAPE_HEAD_NAME_SET = new Set(['a:xfrm', 'a:custGeom', 'a:prstGeom']);
// the 3D room a 3D chart stands in, `c:chart`'s children
const ROOM_NAME_SET = new Set([
    'c:view3D',
    'c:floor',
    'c:sideWall',
    'c:backWall',
]);

const UNREADABLE_REASON =
    'This chart could not be read, so its kind cannot be changed here; ' +
    'change it in PowerPoint.';

type EditType = { start: number; end: number; text: string };

type SourceKindType = { kind: OfficeChartKindType; is3D: boolean };

function applyEdits(xml: string, edits: readonly EditType[]) {
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
    if (parent.openEnd === parent.end) {
        return [];
    }
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

function toText(xml: string, element: ElementType | null) {
    return element === null ? '' : xml.slice(element.start, element.end);
}

// A `val` attribute, null when there is none.
function readVal(xml: string, element: ElementType | null) {
    if (element === null) {
        return null;
    }
    const matched = /\sval\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(
        xml.slice(element.start, element.openEnd),
    );
    return matched === null ? null : (matched[1] ?? matched[2]);
}

function readChildVal(xml: string, parent: ElementType, name: string) {
    return readVal(xml, findChild(xml, parent, name));
}

function readSourceKind(xml: string, plot: ElementType): SourceKindType | null {
    const matched = KNOWN_PLOT_PATTERN.exec(plot.name);
    if (matched === null || (matched[1] === 'doughnut' && matched[2])) {
        return null;
    }
    let kind = matched[1] as OfficeChartKindType;
    if (matched[1] === 'bar') {
        // `col` is barDir's default
        kind = readChildVal(xml, plot, 'c:barDir') === 'bar' ? 'bar' : 'column';
    }
    return { kind, is3D: matched[2] !== undefined };
}

// A plot's kind as a sentence names it: 'column', '3D pie', 'scatter'.
function toPlotName(xml: string, plot: ElementType) {
    const source = readSourceKind(xml, plot);
    if (source !== null) {
        return `${source.is3D ? '3D ' : ''}${source.kind}`;
    }
    if (plot.name === 'c:ofPieChart') {
        return readChildVal(xml, plot, 'c:ofPieType') === 'bar'
            ? 'bar of pie'
            : 'pie of pie';
    }
    const matched = PLOT_PATTERN.exec(plot.name);
    return matched === null
        ? plot.name
        : `${matched[2] ? '3D ' : ''}${matched[1]}`;
}

function toSeriesName(xml: string, series: ElementType, index: number) {
    const tx = findChild(xml, series, 'c:tx');
    const matched = /<c:v>([^<]*)<\/c:v>/.exec(toText(xml, tx));
    return matched === null ? `Series ${index + 1}` : unescapeXml(matched[1]);
}

function joinNames(names: readonly string[]) {
    if (names.length < 2) {
        return names.join('');
    }
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * A series' look (`c:spPr`) made to show in the new family: a bar's fill
 * becomes a line's colour (a bar's outline is usually `a:noFill`, which
 * would draw no line at all), a line's colour becomes a bar's fill, and a
 * slice loses the one fill every slice would share, so `varyColors` gives
 * each its own. Everything else in it is kept.
 */
function adaptLookXml(xml: string, look: ElementType, family: FamilyType) {
    const head: string[] = [];
    const tail: string[] = [];
    let fill: ElementType | null = null;
    let line: ElementType | null = null;
    for (const child of listChildren(xml, look)) {
        if (SHAPE_HEAD_NAME_SET.has(child.name)) {
            head.push(toText(xml, child));
        } else if (FILL_NAME_SET.has(child.name)) {
            fill = child;
        } else if (child.name === 'a:ln') {
            line = child;
        } else {
            tail.push(toText(xml, child));
        }
    }
    const lineFill =
        line === null
            ? null
            : (listChildren(xml, line).find((child) => {
                  return FILL_NAME_SET.has(child.name);
              }) ?? null);
    const isLineShown =
        lineFill !== null && LINE_FILL_NAME_SET.has(lineFill.name);
    const isFillShown = fill !== null && fill.name !== 'a:noFill';
    let fillXml = toText(xml, fill);
    let lineXml = toText(xml, line);
    if (family === 'line') {
        if (isLineShown) {
            return toText(xml, look);
        }
        if (fill !== null && LINE_FILL_NAME_SET.has(fill.name)) {
            lineXml = `<a:ln w="28575" cap="rnd">${fillXml}<a:round/></a:ln>`;
            fillXml = '';
        } else if (lineFill !== null) {
            // an outline drawn with nothing: the line's colour left to
            // PowerPoint
            lineXml = '';
        }
    } else if (family === 'fill') {
        if (isFillShown || !isLineShown) {
            return toText(xml, look);
        }
        fillXml = toText(xml, lineFill);
        lineXml = '<a:ln><a:noFill/></a:ln>';
    } else {
        fillXml = '';
        // a thin light edge between slices, as PowerPoint draws a pie
        lineXml =
            '<a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/>' +
            '</a:solidFill></a:ln>';
    }
    const openTag = xml.slice(look.start, look.openEnd).replace(/\s*\/>$/, '>');
    return `${openTag}${head.join('')}${fillXml}${lineXml}${tail.join('')}</c:spPr>`;
}

// An element with its `c:spPr` child written by `adaptLookXml`.
function adaptLookOfXml(xml: string, element: ElementType, family: FamilyType) {
    const look = findChild(xml, element, 'c:spPr');
    if (look === null) {
        return toText(xml, element);
    }
    return (
        xml.slice(element.start, look.start) +
        adaptLookXml(xml, look, family) +
        xml.slice(look.end, element.end)
    );
}

// Every label position the target kind cannot use taken out.
function fixLabelSpots(text: string, spots: readonly string[]) {
    return text.replace(
        /<c:dLblPos\b[^>]*?\sval\s*=\s*["']([^"']*)["'][^>]*\/>/g,
        (whole, spot: string) => {
            return spots.includes(spot) ? whole : '';
        },
    );
}

// A series' extensions without the bar-only fill for a negative value.
function genExtListXml(xml: string, extList: ElementType, isBar: boolean) {
    if (isBar) {
        return toText(xml, extList);
    }
    const kept = listChildren(xml, extList).filter((child) => {
        return !toText(xml, child).includes('invertSolidFillFmt');
    });
    if (kept.length === 0) {
        return '';
    }
    const openTag = xml.slice(extList.start, extList.openEnd);
    return `${openTag}${kept
        .map((child) => {
            return toText(xml, child);
        })
        .join('')}</c:extLst>`;
}

type ContextType = {
    kind: OfficeChartKindType;
    family: FamilyType;
    sourceFamily: FamilyType;
    spots: readonly string[];
};

function genSeriesXml(xml: string, series: ElementType, context: ContextType) {
    const { kind, family, sourceFamily } = context;
    const order = SERIES_ORDER_MAP[kind];
    const isFamilyChanged = family !== sourceFamily;
    const isBar = kind === 'column' || kind === 'bar';
    const maxErrBars = kind === 'area' ? 2 : 1;
    const parts: { rank: number; text: string }[] = [];
    const put = (name: string, text: string) => {
        parts.push({ rank: order.indexOf(name), text });
    };
    let errBarsCount = 0;
    for (const child of listChildren(xml, series)) {
        if (!order.includes(child.name)) {
            continue;
        }
        if (child.name === 'c:errBars' && ++errBarsCount > maxErrBars) {
            continue;
        }
        if (child.name === 'c:spPr' && isFamilyChanged) {
            put(child.name, adaptLookXml(xml, child, family));
        } else if (child.name === 'c:dPt' && isFamilyChanged) {
            if (sourceFamily === 'slice') {
                // each slice's own colour, which would paint every bar or
                // point differently
                continue;
            }
            put(
                child.name,
                family === 'slice'
                    ? toText(xml, child)
                    : adaptLookOfXml(xml, child, family),
            );
        } else if (child.name === 'c:extLst') {
            put(child.name, genExtListXml(xml, child, isBar));
        } else {
            put(child.name, toText(xml, child));
        }
    }
    const has = (name: string) => {
        return listChildren(xml, series, name).length > 0;
    };
    // what PowerPoint writes for each new series of the kind
    if (isBar && !has('c:invertIfNegative')) {
        put('c:invertIfNegative', '<c:invertIfNegative val="0"/>');
    }
    if (kind === 'line' && !has('c:marker')) {
        put('c:marker', '<c:marker><c:symbol val="none"/></c:marker>');
    }
    if (kind === 'line' && !has('c:smooth')) {
        put('c:smooth', '<c:smooth val="0"/>');
    }
    // stable: children of one name keep their order
    parts.sort((a, b) => {
        return a.rank - b.rank;
    });
    const inner = parts
        .map((part) => {
            return part.text;
        })
        .join('');
    const openTag = xml
        .slice(series.start, series.openEnd)
        .replace(/\s*\/>$/, '>');
    return fixLabelSpots(`${openTag}${inner}</c:ser>`, context.spots);
}

function genFreshIds(xml: string) {
    const ids: string[] = [];
    let id = 500000000;
    while (ids.length < 2) {
        id++;
        if (!xml.includes(`"${id}"`)) {
            ids.push(String(id));
        }
    }
    return ids;
}

// A category and a value axis crossing each other, as PowerPoint makes them.
function genAxesXml(catId: string, valId: string, kind: OfficeChartKindType) {
    const isBar = kind === 'bar';
    const scaling =
        '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
        '<c:delete val="0"/>';
    const ticks =
        '<c:numFmt formatCode="General" sourceLinked="1"/>' +
        '<c:majorTickMark val="none"/><c:minorTickMark val="none"/>' +
        '<c:tickLblPos val="nextTo"/>';
    return (
        `<c:catAx><c:axId val="${catId}"/>${scaling}` +
        `<c:axPos val="${isBar ? 'l' : 'b'}"/>${ticks}` +
        `<c:crossAx val="${valId}"/><c:crosses val="autoZero"/>` +
        '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>' +
        '<c:noMultiLvlLbl val="0"/></c:catAx>' +
        `<c:valAx><c:axId val="${valId}"/>${scaling}` +
        `<c:axPos val="${isBar ? 'b' : 'l'}"/><c:majorGridlines/>${ticks}` +
        `<c:crossAx val="${catId}"/><c:crosses val="autoZero"/>` +
        `<c:crossBetween val="${kind === 'area' ? 'midCat' : 'between'}"/>` +
        '</c:valAx>'
    );
}

// The one category axis and the one value axis of a 2D chart, or null.
function findAxisPair(xml: string, axes: readonly ElementType[]) {
    const flat = axes.filter((axis) => {
        return axis.name !== 'c:serAx';
    });
    const cats = flat.filter((axis) => {
        return axis.name === 'c:catAx' || axis.name === 'c:dateAx';
    });
    const vals = flat.filter((axis) => {
        return axis.name === 'c:valAx';
    });
    if (cats.length !== 1 || vals.length !== 1 || flat.length !== 2) {
        return null;
    }
    const catId = readChildVal(xml, cats[0], 'c:axId');
    const valId = readChildVal(xml, vals[0], 'c:axId');
    if (catId === null || valId === null) {
        return null;
    }
    return { cat: cats[0], val: vals[0], catId, valId };
}

const TURNED_SPOT_MAP: Record<string, string> = {
    b: 'l',
    l: 'b',
    t: 'r',
    r: 't',
};

// An axis turned a quarter, for a chart whose bars turn between upright and
// lying down.
function genTurnEdit(xml: string, axis: ElementType): EditType | null {
    const spot = findChild(xml, axis, 'c:axPos');
    const turned = TURNED_SPOT_MAP[readVal(xml, spot) ?? ''];
    if (spot === null || turned === undefined) {
        return null;
    }
    return {
        start: spot.start,
        end: spot.end,
        text: `<c:axPos val="${turned}"/>`,
    };
}

function toBooleanText(value: string | null, isPresent: boolean) {
    if (!isPresent) {
        return '0';
    }
    // a CT_Boolean without `val` is true
    return value === null || value === '1' || value === 'true' ? '1' : '0';
}

function genPlotXml(
    xml: string,
    plot: ElementType,
    context: ContextType,
    axIds: readonly string[],
) {
    const { kind, family, sourceFamily } = context;
    const keep = (name: string) => {
        return toText(xml, findChild(xml, plot, name));
    };
    const series = listChildren(xml, plot, 'c:ser')
        .map((one) => {
            return genSeriesXml(xml, one, context);
        })
        .join('');
    const labels = fixLabelSpots(keep('c:dLbls'), context.spots);
    const axIdsXml = axIds
        .map((id) => {
            return `<c:axId val="${id}"/>`;
        })
        .join('');
    const grouping = readChildVal(xml, plot, 'c:grouping');
    const isStacked = grouping === 'stacked' || grouping === 'percentStacked';
    const varyElement = findChild(xml, plot, 'c:varyColors');
    let varyColors = toBooleanText(readVal(xml, varyElement), !!varyElement);
    if (family === 'slice') {
        varyColors = '1';
    } else if (sourceFamily === 'slice') {
        varyColors = '0';
    }
    const head = `<c:varyColors val="${varyColors}"/>${series}${labels}`;
    if (kind === 'pie' || kind === 'doughnut') {
        const angle = keep('c:firstSliceAng') || '<c:firstSliceAng val="0"/>';
        if (kind === 'pie') {
            return `<c:pieChart>${head}${angle}</c:pieChart>`;
        }
        const hole = keep('c:holeSize') || '<c:holeSize val="75"/>';
        return `<c:doughnutChart>${head}${angle}${hole}</c:doughnutChart>`;
    }
    if (kind === 'line' || kind === 'area') {
        const groupingXml = `<c:grouping val="${isStacked ? grouping : 'standard'}"/>`;
        const drops = keep('c:dropLines');
        if (kind === 'line') {
            return (
                `<c:lineChart>${groupingXml}${head}${drops}` +
                `<c:marker val="1"/>${axIdsXml}</c:lineChart>`
            );
        }
        return `<c:areaChart>${groupingXml}${head}${drops}${axIdsXml}</c:areaChart>`;
    }
    const isFlatBar = plot.name === 'c:barChart';
    const isFromBar = isFlatBar || plot.name === 'c:bar3DChart';
    const gapWidth =
        (isFromBar ? keep('c:gapWidth') : '') ||
        `<c:gapWidth val="${isStacked ? 150 : 219}"/>`;
    // stacked bars sit on one another, clustered ones a little apart
    const overlap = isFlatBar
        ? keep('c:overlap')
        : `<c:overlap val="${isStacked ? 100 : -27}"/>`;
    const lines = isFlatBar
        ? listChildren(xml, plot, 'c:serLines')
              .map((one) => {
                  return toText(xml, one);
              })
              .join('')
        : '';
    // a bar chart's own extensions only stay on a bar chart
    const extensions = isFlatBar ? keep('c:extLst') : '';
    return (
        `<c:barChart><c:barDir val="${kind === 'bar' ? 'bar' : 'col'}"/>` +
        `<c:grouping val="${isStacked ? grouping : 'clustered'}"/>${head}` +
        `${gapWidth}${overlap}${lines}${axIdsXml}${extensions}</c:barChart>`
    );
}

/**
 * The chart part with its one chart drawn as `kind`: every series kept
 * (name, look, labels, categories and values), the children the new kind
 * does not allow dropped and the rest in its schema order, axes taken out
 * going to a pie or doughnut and made coming back, a 3D chart made flat.
 * `from` is the kind it was ('column', '3D pie', ...); the same kind gives
 * the part back as it was. A combination of charts, a kind outside
 * OFFICE_CHART_KIND_LIST, or more than one series going to a pie is
 * refused with why.
 */
export function setChartKindXml(
    chartXml: string,
    kind: OfficeChartKindType,
): { xml: string; from: string } | { reason: string } {
    if (!OFFICE_CHART_KIND_LIST.includes(kind)) {
        return {
            reason: `"${String(kind)}" is not a kind of chart this can make; choose ${KIND_LIST_TEXT}.`,
        };
    }
    const xml = chartXml;
    const root = listChildElements(xml, 0, xml.length).find((one) => {
        return one.name === 'c:chartSpace';
    });
    const chart = root === undefined ? null : findChild(xml, root, 'c:chart');
    const plotArea =
        chart === null ? null : findChild(xml, chart, 'c:plotArea');
    if (chart === null || plotArea === null) {
        return { reason: UNREADABLE_REASON };
    }
    const plotChildren = listChildren(xml, plotArea);
    const plots = plotChildren.filter((child) => {
        return PLOT_PATTERN.test(child.name);
    });
    if (plots.length === 0) {
        return { reason: UNREADABLE_REASON };
    }
    if (plots.length > 1) {
        const names = plots.map((plot) => {
            return toPlotName(xml, plot);
        });
        return {
            reason:
                `This chart combines ${plots.length} charts in one ` +
                `(${joinNames(names)}), so its kind cannot be changed ` +
                'here; change it in PowerPoint with Change Chart Type.',
        };
    }
    const plot = plots[0];
    const source = readSourceKind(xml, plot);
    if (source === null) {
        return {
            reason:
                `This is a ${toPlotName(xml, plot)} chart; only a ` +
                `${KIND_LIST_TEXT} chart can change its kind here. Change ` +
                'it in PowerPoint with Change Chart Type.',
        };
    }
    const from = `${source.is3D ? '3D ' : ''}${source.kind}`;
    if (!source.is3D && source.kind === kind) {
        return { xml, from };
    }
    if (/<c15:filtered\w*Series\b/.test(toText(xml, plot))) {
        return {
            reason:
                'This chart has series hidden from it in Select Data, so ' +
                'its kind cannot be changed here; change it in PowerPoint.',
        };
    }
    const family = FAMILY_MAP[kind];
    const seriesList = listChildren(xml, plot, 'c:ser');
    if (family === 'slice' && seriesList.length > 1) {
        const names = seriesList.map((one, index) => {
            return `"${toSeriesName(xml, one, index)}"`;
        });
        return {
            reason:
                `A ${kind} chart shows one series, and this chart has ` +
                `${seriesList.length}: ${joinNames(names)}. Take out every ` +
                'series but the one to show first, or choose column, bar, ' +
                'line or area.',
        };
    }
    const grouping = readChildVal(xml, plot, 'c:grouping');
    const isStacked = grouping === 'stacked' || grouping === 'percentStacked';
    const context: ContextType = {
        kind,
        family,
        sourceFamily: FAMILY_MAP[source.kind],
        spots: LABEL_SPOT_MAP[kind].filter((spot) => {
            // a stacked bar has no room past its end
            return !(isStacked && spot === 'outEnd' && family === 'fill');
        }),
    };
    const edits: EditType[] = [];
    const remove = (element: ElementType) => {
        edits.push({ start: element.start, end: element.end, text: '' });
    };
    for (const child of listChildren(xml, chart)) {
        if (ROOM_NAME_SET.has(child.name)) {
            remove(child);
        }
    }
    const axes = plotChildren.filter((child) => {
        return AXIS_NAME_SET.has(child.name);
    });
    let axIds: string[] = [];
    let freshAxes = '';
    if (family === 'slice') {
        // a data table hangs under a category axis
        for (const child of plotChildren) {
            if (AXIS_NAME_SET.has(child.name) || child.name === 'c:dTable') {
                remove(child);
            }
        }
    } else {
        const pair = findAxisPair(xml, axes);
        if (pair === null) {
            axes.forEach(remove);
            axIds = genFreshIds(xml);
            freshAxes = genAxesXml(axIds[0], axIds[1], kind);
        } else {
            axIds = [pair.catId, pair.valId];
            for (const axis of axes) {
                if (axis.name === 'c:serAx') {
                    remove(axis);
                }
            }
            if ((source.kind === 'bar') !== (kind === 'bar')) {
                for (const axis of [pair.cat, pair.val]) {
                    const edit = genTurnEdit(xml, axis);
                    if (edit !== null) {
                        edits.push(edit);
                    }
                }
            }
        }
    }
    edits.push({
        start: plot.start,
        end: plot.end,
        text: genPlotXml(xml, plot, context, axIds) + freshAxes,
    });
    // a pie or doughnut has no axis to name its categories: with no legend
    // the months of a column chart made a pie were said nowhere (seen live
    // 2026-11-21), so one goes at the right, where PowerPoint puts it
    if (
        family === 'slice' &&
        findChild(xml, chart, 'c:legend') === null &&
        !/^(?:pie|doughnut)$/.test(source.kind)
    ) {
        edits.push({
            start: plotArea.end,
            end: plotArea.end,
            text: SLICE_LEGEND_XML,
        });
    }
    return { xml: applyEdits(xml, edits), from };
}

const SLICE_LEGEND_XML =
    '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>';
