import { describe, expect, test } from 'vitest';

import { readChartData } from './officeChartHelpers';
import {
    type OfficeChartKindType,
    setChartKindXml,
    toOfficeChartKind,
} from './officeChartKindHelpers';
import { type ElementType, listChildElements } from './officeXmlEditHelpers';

// --- checks ------------------------------------------------------------------

const TAG_PATTERN =
    /<(\/?)([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const ATTRIBUTES_PATTERN =
    /^(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*$/;

// What makes a part not well-formed XML, or null: tags that do not nest, a
// `<` outside a tag, attributes that are not name="value", not one root.
function findXmlFault(xml: string) {
    const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
    const stack: string[] = [];
    let roots = 0;
    let cursor = 0;
    for (const matched of body.matchAll(TAG_PATTERN)) {
        const [whole, slash, name, attributes, selfClose] = matched;
        const index = matched.index ?? 0;
        if (body.slice(cursor, index).includes('<')) {
            return `a stray "<" before ${index}`;
        }
        cursor = index + whole.length;
        if (!ATTRIBUTES_PATTERN.test(attributes)) {
            return `bad attributes on ${name}: ${attributes}`;
        }
        if (stack.length === 0 && slash === '') {
            roots++;
        }
        if (slash === '/') {
            const open = stack.pop();
            if (open !== name) {
                return `</${name}> closes <${open}>`;
            }
        } else if (selfClose !== '/') {
            stack.push(name);
        }
    }
    if (body.slice(cursor).includes('<')) {
        return 'a stray "<" at the end';
    }
    if (stack.length > 0) {
        return `not closed: ${stack.join(' > ')}`;
    }
    return roots === 1 ? null : `${roots} roots`;
}

function toChanged(result: ReturnType<typeof setChartKindXml>) {
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    expect(findXmlFault(result.xml)).toBe(null);
    return result;
}

function toReason(result: ReturnType<typeof setChartKindXml>) {
    if (!('reason' in result)) {
        throw new Error('changed when it should not be');
    }
    return result.reason;
}

// The element at `path` from the part's root, the first of each name.
function findAt(xml: string, path: readonly string[]) {
    let element: ElementType | undefined = listChildElements(
        xml,
        0,
        xml.length,
    ).find((one) => {
        return one.name === path[0];
    });
    for (const name of path.slice(1)) {
        if (element === undefined) {
            break;
        }
        element = listChildElements(
            xml,
            element.openEnd,
            element.closeStart,
        ).find((one) => {
            return one.name === name;
        });
    }
    if (element === undefined) {
        throw new Error(`not found: ${path.join(' > ')}`);
    }
    return element;
}

function listNamesAt(xml: string, path: readonly string[]) {
    const element = findAt(xml, path);
    return listChildElements(xml, element.openEnd, element.closeStart).map(
        (one) => {
            return one.name;
        },
    );
}

function readTextAt(xml: string, path: readonly string[]) {
    const element = findAt(xml, path);
    return xml.slice(element.start, element.end);
}

function listVals(xml: string, name: string) {
    return [...xml.matchAll(new RegExp(`<${name} val="([^"]*)"/>`, 'g'))].map(
        (matched) => {
            return matched[1];
        },
    );
}

const PLOT_AREA = ['c:chartSpace', 'c:chart', 'c:plotArea'];

function expectSameData(before: string, after: string, kind: string) {
    const read = readChartData(before);
    expect(read).not.toBe(null);
    expect(readChartData(after)).toEqual({ ...read, kind });
}

// --- a clustered column chart as PowerPoint 365 writes it -----------------------

const NS =
    'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const TITLE =
    '<c:title><c:tx><c:rich><a:bodyPr rot="0" spcFirstLastPara="1" ' +
    'vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" ' +
    'anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1862" b="0"/>' +
    '</a:pPr><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Sunday Attendance' +
    '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/><c:spPr>' +
    '<a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr></c:title>' +
    '<c:autoTitleDeleted val="0"/>';

const CATEGORIES =
    '<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$4</c:f><c:strCache>' +
    '<c:ptCount val="3"/><c:pt idx="0"><c:v>Week 1</c:v></c:pt>' +
    '<c:pt idx="1"><c:v>Week 2</c:v></c:pt><c:pt idx="2"><c:v>Week 3</c:v>' +
    '</c:pt></c:strCache></c:strRef></c:cat>';

function genBarLook(index: number) {
    return (
        `<c:spPr><a:solidFill><a:schemeClr val="accent${index + 1}"/>` +
        '</a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>'
    );
}

function genSeries(
    index: number,
    column: string,
    name: string,
    values: string[],
    middle = `${genBarLook(index)}<c:invertIfNegative val="0"/>`,
) {
    const points = values
        .map((value, idx) => {
            return `<c:pt idx="${idx}"><c:v>${value}</c:v></c:pt>`;
        })
        .join('');
    return (
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx>` +
        `<c:strRef><c:f>Sheet1!$${column}$1</c:f><c:strCache>` +
        `<c:ptCount val="1"/><c:pt idx="0"><c:v>${name}</c:v></c:pt>` +
        `</c:strCache></c:strRef></c:tx>${middle}${CATEGORIES}<c:val>` +
        `<c:numRef><c:f>Sheet1!$${column}$2:$${column}$4</c:f><c:numCache>` +
        '<c:formatCode>General</c:formatCode><c:ptCount val="3"/>' +
        `${points}</c:numCache></c:numRef></c:val><c:extLst><c:ext ` +
        'uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://' +
        'schemas.microsoft.com/office/drawing/2014/chart"><c16:uniqueId ' +
        `val="{0000000${index}-E938-4C28-996B-DE8246E4687B}"/></c:ext>` +
        '</c:extLst></c:ser>'
    );
}

const ADULTS = genSeries(0, 'B', 'Adults', ['43', '25', '35']);
const CHILDREN = genSeries(1, 'C', 'Children', ['24', '44', '18']);

const LABELS =
    '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/>' +
    '<c:showCatName val="0"/><c:showSerName val="0"/>' +
    '<c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>';

function genColumnPlot(series: string, grouping = 'clustered') {
    return (
        '<c:barChart><c:barDir val="col"/>' +
        `<c:grouping val="${grouping}"/><c:varyColors val="0"/>${series}` +
        `${LABELS}<c:gapWidth val="219"/><c:overlap val="-27"/>` +
        '<c:axId val="559342127"/><c:axId val="559345487"/></c:barChart>'
    );
}

const AXES =
    '<c:catAx><c:axId val="559342127"/><c:scaling><c:orientation ' +
    'val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' +
    '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark ' +
    'val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
    '<c:crossAx val="559345487"/><c:crosses val="autoZero"/><c:auto ' +
    'val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>' +
    '<c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId ' +
    'val="559345487"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
    '<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt ' +
    'formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/>' +
    '<c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx ' +
    'val="559342127"/><c:crosses val="autoZero"/><c:crossBetween ' +
    'val="between"/></c:valAx>';

function genChart(plotArea: string, room = '') {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<c:chartSpace ${NS}><c:date1904 val="0"/><c:lang val="en-US"/>` +
        `<c:roundedCorners val="0"/><c:chart>${TITLE}${room}<c:plotArea>` +
        `<c:layout/>${plotArea}</c:plotArea><c:legend><c:legendPos ` +
        'val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/>' +
        '<c:dispBlanksAs val="gap"/></c:chart><c:externalData r:id="rId3">' +
        '<c:autoUpdate val="0"/></c:externalData></c:chartSpace>'
    );
}

const CHART = genChart(genColumnPlot(ADULTS + CHILDREN) + AXES);
const ONE_SERIES_CHART = genChart(genColumnPlot(ADULTS) + AXES);

// --- a pie chart as PowerPoint 365 writes it: a colour on each slice ------------

function genSlice(idx: number) {
    return (
        `<c:dPt><c:idx val="${idx}"/><c:bubble3D val="0"/><c:spPr>` +
        `<a:solidFill><a:schemeClr val="accent${idx + 1}"/></a:solidFill>` +
        '<a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/>' +
        '</a:solidFill></a:ln><a:effectLst/></c:spPr></c:dPt>'
    );
}

const PIE_LABELS =
    '<c:dLbls><c:dLblPos val="bestFit"/><c:showLegendKey val="0"/>' +
    '<c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/>' +
    '<c:showPercent val="0"/><c:showBubbleSize val="0"/>' +
    '<c:showLeaderLines val="1"/></c:dLbls>';

const PIE_CHART = genChart(
    '<c:pieChart><c:varyColors val="1"/>' +
        genSeries(
            0,
            'B',
            'Adults',
            ['43', '25', '35'],
            genSlice(0) + genSlice(1) + genSlice(2) + PIE_LABELS,
        ) +
        `${LABELS}<c:firstSliceAng val="90"/></c:pieChart>`,
);

const SERIES_PATH = [...PLOT_AREA, 'c:barChart', 'c:ser'];

describe('a chart kind named as people write it (2026-11-21)', () => {
    test('the kinds, their plurals, "... chart", donut', () => {
        const cases: [unknown, OfficeChartKindType | null][] = [
            ['Column', 'column'],
            ['columns', 'column'],
            ['vertical bar', 'column'],
            ['Bars', 'bar'],
            ['horizontal bar chart', 'bar'],
            ['line chart', 'line'],
            ['Line graph', 'line'],
            ['Pie Chart', 'pie'],
            ['donut', 'doughnut'],
            ['Doughnut chart', 'doughnut'],
            ['  AREA  ', 'area'],
            ['scatter', null],
            ['chart', null],
            ['', null],
            [42, null],
            [null, null],
        ];
        for (const [value, kind] of cases) {
            expect(toOfficeChartKind(value)).toBe(kind);
        }
    });
});

describe('a chart changed to another kind (2026-11-21)', () => {
    test('column to bar: the bars lie down and their axes turn, the series untouched', () => {
        const result = toChanged(setChartKindXml(CHART, 'bar'));
        expect(result.from).toBe('column');
        expect(listVals(result.xml, 'c:barDir')).toEqual(['bar']);
        expect(listVals(result.xml, 'c:axPos')).toEqual(['l', 'b']);
        expect(listNamesAt(result.xml, PLOT_AREA)).toEqual([
            'c:layout',
            'c:barChart',
            'c:catAx',
            'c:valAx',
        ]);
        expect(result.xml).toContain(ADULTS + CHILDREN);
        expectSameData(CHART, result.xml, 'bar');
        // and back, byte for byte
        const back = toChanged(setChartKindXml(result.xml, 'column'));
        expect(back).toEqual({ xml: CHART, from: 'bar' });
    });

    test('column to line: line children in order, no invertIfNegative, the axes kept', () => {
        const result = toChanged(setChartKindXml(CHART, 'line'));
        expect(result.from).toBe('column');
        const plotPath = [...PLOT_AREA, 'c:lineChart'];
        expect(listNamesAt(result.xml, plotPath)).toEqual([
            'c:grouping',
            'c:varyColors',
            'c:ser',
            'c:ser',
            'c:dLbls',
            'c:marker',
            'c:axId',
            'c:axId',
        ]);
        expect(listVals(result.xml, 'c:grouping')).toEqual(['standard']);
        expect(readTextAt(result.xml, plotPath)).toContain(
            '<c:marker val="1"/>',
        );
        expect(listNamesAt(result.xml, [...plotPath, 'c:ser'])).toEqual([
            'c:idx',
            'c:order',
            'c:tx',
            'c:spPr',
            'c:marker',
            'c:cat',
            'c:val',
            'c:smooth',
            'c:extLst',
        ]);
        expect(result.xml).not.toContain('invertIfNegative');
        // a bar's colour is the line's: its `a:noFill` outline drew none
        expect(readTextAt(result.xml, [...plotPath, 'c:ser', 'c:spPr'])).toBe(
            '<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr ' +
                'val="accent1"/></a:solidFill><a:round/></a:ln><a:effectLst/>' +
                '</c:spPr>',
        );
        expect(listVals(result.xml, 'c:axId')).toEqual([
            '559342127',
            '559345487',
            '559342127',
            '559345487',
        ]);
        expect(result.xml).toContain(AXES);
        expectSameData(CHART, result.xml, 'line');
    });

    test('line back to column: the part PowerPoint wrote, byte for byte', () => {
        const line = toChanged(setChartKindXml(CHART, 'line'));
        const back = toChanged(setChartKindXml(line.xml, 'column'));
        expect(back.from).toBe('line');
        expect(back.xml).toBe(CHART);
        expect(listNamesAt(back.xml, SERIES_PATH)).toEqual([
            'c:idx',
            'c:order',
            'c:tx',
            'c:spPr',
            'c:invertIfNegative',
            'c:cat',
            'c:val',
            'c:extLst',
        ]);
    });

    test('column to area, and a label position the kind cannot use taken out', () => {
        const labelled = genChart(
            genColumnPlot(
                genSeries(
                    0,
                    'B',
                    'Adults',
                    ['43', '25', '35'],
                    genBarLook(0) +
                        '<c:invertIfNegative val="0"/><c:dLbls>' +
                        '<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/>' +
                        '<c:showVal val="1"/></c:dLbls>',
                ),
            ) + AXES,
        );
        const area = toChanged(setChartKindXml(labelled, 'area'));
        const plotPath = [...PLOT_AREA, 'c:areaChart'];
        expect(listNamesAt(area.xml, plotPath)).toEqual([
            'c:grouping',
            'c:varyColors',
            'c:ser',
            'c:dLbls',
            'c:axId',
            'c:axId',
        ]);
        expect(listNamesAt(area.xml, [...plotPath, 'c:ser'])).toEqual([
            'c:idx',
            'c:order',
            'c:tx',
            'c:spPr',
            'c:dLbls',
            'c:cat',
            'c:val',
            'c:extLst',
        ]);
        expect(area.xml).not.toContain('dLblPos');
        expect(area.xml).toContain('<c:showVal val="1"/>');
        expectSameData(labelled, area.xml, 'area');
        // a pie can put a label past its end
        const pie = toChanged(setChartKindXml(labelled, 'pie'));
        expect(listVals(pie.xml, 'c:dLblPos')).toEqual(['outEnd']);
    });

    test('a stacked column stays stacked as a line, and its bars overlap coming back', () => {
        const stacked = genChart(
            genColumnPlot(ADULTS + CHILDREN, 'stacked') + AXES,
        );
        const line = toChanged(setChartKindXml(stacked, 'line'));
        expect(listVals(line.xml, 'c:grouping')).toEqual(['stacked']);
        const back = toChanged(setChartKindXml(line.xml, 'column'));
        expect(listVals(back.xml, 'c:grouping')).toEqual(['stacked']);
        expect(listVals(back.xml, 'c:gapWidth')).toEqual(['150']);
        expect(listVals(back.xml, 'c:overlap')).toEqual(['100']);
    });

    test('one series to pie: the axes gone, varied colours, a first slice angle', () => {
        const result = toChanged(setChartKindXml(ONE_SERIES_CHART, 'pie'));
        expect(result.from).toBe('column');
        expect(listNamesAt(result.xml, PLOT_AREA)).toEqual([
            'c:layout',
            'c:pieChart',
        ]);
        const plotPath = [...PLOT_AREA, 'c:pieChart'];
        expect(listNamesAt(result.xml, plotPath)).toEqual([
            'c:varyColors',
            'c:ser',
            'c:dLbls',
            'c:firstSliceAng',
        ]);
        expect(listVals(result.xml, 'c:varyColors')).toEqual(['1']);
        expect(listVals(result.xml, 'c:firstSliceAng')).toEqual(['0']);
        expect(result.xml).not.toMatch(/axId|catAx|valAx|invertIfNegative/);
        expect(listNamesAt(result.xml, [...plotPath, 'c:ser'])).toEqual([
            'c:idx',
            'c:order',
            'c:tx',
            'c:spPr',
            'c:cat',
            'c:val',
            'c:extLst',
        ]);
        // no one fill for every slice, so each takes its own colour
        expect(readTextAt(result.xml, [...plotPath, 'c:ser', 'c:spPr'])).toBe(
            '<c:spPr><a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/>' +
                '</a:solidFill></a:ln><a:effectLst/></c:spPr>',
        );
        expectSameData(ONE_SERIES_CHART, result.xml, 'pie');
    });

    test('a column chart with no legend made a pie: a legend names the slices', () => {
        const noLegend = ONE_SERIES_CHART.replace(
            /<c:legend>.*?<\/c:legend>/,
            '',
        );
        expect(noLegend).not.toContain('c:legend');
        const result = toChanged(setChartKindXml(noLegend, 'pie'));
        expect(result.xml).toContain(
            '</c:plotArea><c:legend><c:legendPos val="r"/><c:overlay ' +
                'val="0"/></c:legend><c:plotVisOnly',
        );
        // a legend already there is the chart's own: left as it was
        const kept = toChanged(setChartKindXml(ONE_SERIES_CHART, 'pie'));
        expect(kept.xml.match(/<c:legend>/g)).toHaveLength(1);
        expect(kept.xml).toContain('<c:legendPos val="b"/>');
        // back to a column, the legend it was given stays
        const back = toChanged(setChartKindXml(result.xml, 'column'));
        expect(back.xml.match(/<c:legend>/g)).toHaveLength(1);
    });

    test('pie to column: a category and a value axis made, crossing each other', () => {
        const result = toChanged(setChartKindXml(PIE_CHART, 'column'));
        expect(result.from).toBe('pie');
        expect(listNamesAt(result.xml, PLOT_AREA)).toEqual([
            'c:layout',
            'c:barChart',
            'c:catAx',
            'c:valAx',
        ]);
        const plotPath = [...PLOT_AREA, 'c:barChart'];
        expect(listNamesAt(result.xml, plotPath)).toEqual([
            'c:barDir',
            'c:grouping',
            'c:varyColors',
            'c:ser',
            'c:dLbls',
            'c:gapWidth',
            'c:overlap',
            'c:axId',
            'c:axId',
        ]);
        const [catId, valId] = listVals(
            readTextAt(result.xml, plotPath),
            'c:axId',
        );
        expect(catId).not.toBe(valId);
        const catAx = readTextAt(result.xml, [...PLOT_AREA, 'c:catAx']);
        const valAx = readTextAt(result.xml, [...PLOT_AREA, 'c:valAx']);
        expect(listVals(catAx, 'c:axId')).toEqual([catId]);
        expect(listVals(catAx, 'c:crossAx')).toEqual([valId]);
        expect(listVals(catAx, 'c:axPos')).toEqual(['b']);
        expect(listVals(catAx, 'c:delete')).toEqual(['0']);
        expect(listVals(valAx, 'c:axId')).toEqual([valId]);
        expect(listVals(valAx, 'c:crossAx')).toEqual([catId]);
        expect(listVals(valAx, 'c:axPos')).toEqual(['l']);
        expect(listNamesAt(result.xml, [...PLOT_AREA, 'c:catAx'])).toEqual([
            'c:axId',
            'c:scaling',
            'c:delete',
            'c:axPos',
            'c:numFmt',
            'c:majorTickMark',
            'c:minorTickMark',
            'c:tickLblPos',
            'c:crossAx',
            'c:crosses',
            'c:auto',
            'c:lblAlgn',
            'c:lblOffset',
            'c:noMultiLvlLbl',
        ]);
        expect(listNamesAt(result.xml, [...PLOT_AREA, 'c:valAx'])).toEqual([
            'c:axId',
            'c:scaling',
            'c:delete',
            'c:axPos',
            'c:majorGridlines',
            'c:numFmt',
            'c:majorTickMark',
            'c:minorTickMark',
            'c:tickLblPos',
            'c:crossAx',
            'c:crosses',
            'c:crossBetween',
        ]);
        expect(listVals(result.xml, 'c:varyColors')).toEqual(['0']);
        // each slice's own colour would paint every bar differently, and a
        // bar label cannot sit at "bestFit"
        expect(result.xml).not.toMatch(/c:dPt|dLblPos/);
        expect(listNamesAt(result.xml, [...plotPath, 'c:ser'])).toEqual([
            'c:idx',
            'c:order',
            'c:tx',
            'c:invertIfNegative',
            'c:dLbls',
            'c:cat',
            'c:val',
            'c:extLst',
        ]);
        expectSameData(PIE_CHART, result.xml, 'column');
    });

    test('a doughnut has a hole; from a pie it keeps the slices and their angle', () => {
        const fromColumn = toChanged(
            setChartKindXml(ONE_SERIES_CHART, 'doughnut'),
        );
        const plotPath = [...PLOT_AREA, 'c:doughnutChart'];
        expect(listNamesAt(fromColumn.xml, plotPath)).toEqual([
            'c:varyColors',
            'c:ser',
            'c:dLbls',
            'c:firstSliceAng',
            'c:holeSize',
        ]);
        expect(listVals(fromColumn.xml, 'c:holeSize')).toEqual(['75']);
        expectSameData(ONE_SERIES_CHART, fromColumn.xml, 'doughnut');
        const fromPie = toChanged(setChartKindXml(PIE_CHART, 'doughnut'));
        expect(fromPie.from).toBe('pie');
        expect(listVals(fromPie.xml, 'c:firstSliceAng')).toEqual(['90']);
        expect(fromPie.xml).toContain(genSlice(2));
        // a doughnut puts its labels where it likes
        expect(fromPie.xml).not.toContain('dLblPos');
        expectSameData(PIE_CHART, fromPie.xml, 'doughnut');
    });

    test('a 3D column made a flat column: no room, no depth, no series axis', () => {
        const room =
            '<c:view3D><c:rotX val="15"/><c:rotY val="20"/><c:rAngAx ' +
            'val="0"/></c:view3D><c:floor><c:thickness val="0"/></c:floor>' +
            '<c:sideWall><c:thickness val="0"/></c:sideWall><c:backWall>' +
            '<c:thickness val="0"/></c:backWall>';
        const series = [ADULTS, CHILDREN]
            .map((one) => {
                return one.replace('</c:val>', '</c:val><c:shape val="box"/>');
            })
            .join('');
        const serAx =
            '<c:serAx><c:axId val="559348847"/><c:scaling><c:orientation ' +
            'val="minMax"/></c:scaling><c:delete val="0"/><c:axPos ' +
            'val="b"/><c:crossAx val="559345487"/></c:serAx>';
        const chart3D = genChart(
            '<c:bar3DChart><c:barDir val="col"/><c:grouping ' +
                `val="standard"/><c:varyColors val="0"/>${series}${LABELS}` +
                '<c:gapWidth val="150"/><c:gapDepth val="150"/><c:shape ' +
                'val="box"/><c:axId val="559342127"/><c:axId ' +
                'val="559345487"/><c:axId val="559348847"/></c:bar3DChart>' +
                AXES +
                serAx,
            room,
        );
        const result = toChanged(setChartKindXml(chart3D, 'column'));
        expect(result.from).toBe('3D column');
        expect(result.xml).not.toMatch(
            /view3D|c:floor|sideWall|backWall|serAx|gapDepth|c:shape|559348847/,
        );
        expect(listNamesAt(result.xml, PLOT_AREA)).toEqual([
            'c:layout',
            'c:barChart',
            'c:catAx',
            'c:valAx',
        ]);
        expect(listNamesAt(result.xml, [...PLOT_AREA, 'c:barChart'])).toEqual([
            'c:barDir',
            'c:grouping',
            'c:varyColors',
            'c:ser',
            'c:ser',
            'c:dLbls',
            'c:gapWidth',
            'c:overlap',
            'c:axId',
            'c:axId',
        ]);
        expect(listVals(result.xml, 'c:grouping')).toEqual(['clustered']);
        expect(listVals(result.xml, 'c:gapWidth')).toEqual(['150']);
        expect(result.xml).toContain(ADULTS + CHILDREN);
        expectSameData(chart3D, result.xml, 'column');
    });

    test('the same kind gives the part back as it was', () => {
        expect(setChartKindXml(CHART, 'column')).toEqual({
            xml: CHART,
            from: 'column',
        });
        expect(setChartKindXml(PIE_CHART, 'pie')).toEqual({
            xml: PIE_CHART,
            from: 'pie',
        });
    });
});

describe('a chart kind that is not changed here (2026-11-21)', () => {
    test('two series to a pie, naming them', () => {
        expect(toReason(setChartKindXml(CHART, 'pie'))).toBe(
            'A pie chart shows one series, and this chart has 2: "Adults" ' +
                'and "Children". Take out every series but the one to show ' +
                'first, or choose column, bar, line or area.',
        );
        expect(toReason(setChartKindXml(CHART, 'doughnut'))).toMatch(
            /^A doughnut chart shows one series/,
        );
    });

    test('a scatter chart', () => {
        const scatter = genChart(
            '<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors ' +
                'val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:xVal>' +
                '<c:numLit><c:ptCount val="1"/><c:pt idx="0"><c:v>1</c:v>' +
                '</c:pt></c:numLit></c:xVal><c:yVal><c:numLit><c:ptCount ' +
                'val="1"/><c:pt idx="0"><c:v>2</c:v></c:pt></c:numLit>' +
                '</c:yVal></c:ser><c:axId val="1"/><c:axId val="2"/>' +
                '</c:scatterChart>',
        );
        expect(toReason(setChartKindXml(scatter, 'line'))).toBe(
            'This is a scatter chart; only a column, bar, line, pie, ' +
                'doughnut or area chart can change its kind here. Change it ' +
                'in PowerPoint with Change Chart Type.',
        );
    });

    test('a combination of a column and a line chart', () => {
        const line = genColumnPlot(CHILDREN)
            .replace('<c:barChart><c:barDir val="col"/>', '<c:lineChart>')
            .replace('</c:barChart>', '</c:lineChart>')
            .replace(/<c:gapWidth[^>]*\/><c:overlap[^>]*\/>/, '');
        const combo = genChart(genColumnPlot(ADULTS) + line + AXES);
        expect(toReason(setChartKindXml(combo, 'column'))).toBe(
            'This chart combines 2 charts in one (column and line), so its ' +
                'kind cannot be changed here; change it in PowerPoint with ' +
                'Change Chart Type.',
        );
    });

    test('series hidden in Select Data, a part that is no chart, a kind not made here', () => {
        const hidden = CHART.replace(
            '</c:barChart>',
            '<c:extLst><c:ext uri="{02D57815-91ED-43cb-92C2-25804820EDAC}" ' +
                'xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/' +
                'chart"><c15:filteredBarSeries><c15:ser><c:idx val="2"/>' +
                '<c:order val="2"/></c15:ser></c15:filteredBarSeries>' +
                '</c:ext></c:extLst></c:barChart>',
        );
        expect(toReason(setChartKindXml(hidden, 'line'))).toBe(
            'This chart has series hidden from it in Select Data, so its ' +
                'kind cannot be changed here; change it in PowerPoint.',
        );
        expect(toReason(setChartKindXml('<p:sld/>', 'line'))).toBe(
            'This chart could not be read, so its kind cannot be changed ' +
                'here; change it in PowerPoint.',
        );
        expect(
            toReason(
                setChartKindXml(
                    CHART,
                    'radar' as unknown as OfficeChartKindType,
                ),
            ),
        ).toBe(
            '"radar" is not a kind of chart this can make; choose column, ' +
                'bar, line, pie, doughnut or area.',
        );
    });
});
