import { describe, expect, test } from 'vitest';

import {
    type OfficeChartCellType,
    findSheetPath,
    listSheetTablePaths,
    readChartData,
    setChartDataXml,
    setSheetCellsXml,
    setSheetTableXml,
} from './officeChartHelpers';

// Every place `from` is, written as `to` (no `$` patterns: formulas hold `$`).
function swap(text: string, from: string, to: string) {
    if (!text.includes(from)) {
        throw new Error(`not in the fixture: ${from}`);
    }
    return text.split(from).join(to);
}

function toChanged(result: ReturnType<typeof setChartDataXml>) {
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

// --- a chart as PowerPoint 365 writes it -------------------------------------
// From a deck's `ppt/charts/chart1.xml` (a clustered column chart inserted in
// PowerPoint, 2026-11-20), cut to two series and given a typed title.

const NS =
    'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const TITLE_BODY =
    '<a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" ' +
    'vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/>';
const TITLE_LOOK =
    '<a:pPr><a:defRPr sz="1862" b="0" i="0" u="none" strike="noStrike" ' +
    'kern="1200" spc="0" baseline="0"><a:solidFill><a:schemeClr val="tx1">' +
    '<a:lumMod val="65000"/><a:lumOff val="35000"/></a:schemeClr>' +
    '</a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/>' +
    '<a:cs typeface="+mn-cs"/></a:defRPr></a:pPr>';
const TITLE_FRAME =
    '<c:overlay val="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln>' +
    '<a:effectLst/></c:spPr>';
const TITLE_TX_PR =
    `<c:txPr>${TITLE_BODY}<a:p>${TITLE_LOOK}` +
    '<a:endParaRPr lang="en-US"/></a:p></c:txPr>';
const TITLE_RUNS =
    '<a:r><a:rPr lang="en-US" dirty="0"/><a:t>Sunday </a:t></a:r>' +
    '<a:r><a:rPr lang="en-US" b="1" dirty="0"/><a:t>Attendance</a:t></a:r>';
const TYPED_TITLE =
    `<c:title><c:tx><c:rich>${TITLE_BODY}<a:p>${TITLE_LOOK}${TITLE_RUNS}` +
    `</a:p></c:rich></c:tx>${TITLE_FRAME}${TITLE_TX_PR}</c:title>`;
// the "Chart Title" PowerPoint shows when nobody typed one
const AUTO_TITLE = `<c:title>${TITLE_FRAME}${TITLE_TX_PR}</c:title>`;

const CATEGORIES =
    '<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$5</c:f><c:strCache>' +
    '<c:ptCount val="4"/><c:pt idx="0"><c:v>Week 1</c:v></c:pt>' +
    '<c:pt idx="1"><c:v>Week 2</c:v></c:pt><c:pt idx="2"><c:v>Week 3</c:v>' +
    '</c:pt><c:pt idx="3"><c:v>Week 4</c:v></c:pt></c:strCache></c:strRef>' +
    '</c:cat>';

function genSeries(
    index: number,
    column: string,
    name: string,
    values: string[],
    extra = '',
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
        '</c:strCache></c:strRef></c:tx><c:spPr><a:solidFill>' +
        `<a:schemeClr val="accent${index + 1}"/></a:solidFill><a:ln>` +
        '<a:noFill/></a:ln><a:effectLst/></c:spPr>' +
        `<c:invertIfNegative val="0"/>${extra}${CATEGORIES}<c:val><c:numRef>` +
        `<c:f>Sheet1!$${column}$2:$${column}$5</c:f><c:numCache>` +
        '<c:formatCode>General</c:formatCode><c:ptCount val="4"/>' +
        `${points}</c:numCache></c:numRef></c:val><c:extLst><c:ext ` +
        'uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://' +
        'schemas.microsoft.com/office/drawing/2014/chart"><c16:uniqueId ' +
        `val="{0000000${index}-E938-4C28-996B-DE8246E4687B}"/></c:ext>` +
        '</c:extLst></c:ser>'
    );
}

const TWO_SERIES =
    genSeries(0, 'B', 'Adults', ['4.3', '2.5', '3.5', '4.5']) +
    genSeries(1, 'C', 'Children', ['2.4', '4.4000000000000004', '1.8', '2.8']);

function genChart(head: string, series = TWO_SERIES) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<c:chartSpace ${NS}><c:date1904 val="0"/><c:lang val="en-US"/>` +
        '<c:roundedCorners val="0"/><mc:AlternateContent xmlns:mc="http://' +
        'schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice ' +
        'Requires="c14" xmlns:c14="http://schemas.microsoft.com/office/' +
        'drawing/2007/8/2/chart"><c14:style val="102"/></mc:Choice>' +
        '<mc:Fallback><c:style val="2"/></mc:Fallback></mc:AlternateContent>' +
        `<c:chart>${head}<c:plotArea><c:layout/><c:barChart>` +
        '<c:barDir val="col"/><c:grouping val="clustered"/>' +
        `<c:varyColors val="0"/>${series}<c:dLbls><c:showLegendKey val="0"/>` +
        '<c:showVal val="0"/></c:dLbls><c:gapWidth val="219"/>' +
        '<c:overlap val="-27"/><c:axId val="559342127"/>' +
        '<c:axId val="559345487"/></c:barChart><c:catAx>' +
        '<c:axId val="559342127"/><c:scaling><c:orientation val="minMax"/>' +
        '</c:scaling><c:delete val="0"/><c:axPos val="b"/>' +
        '<c:crossAx val="559345487"/></c:catAx><c:valAx>' +
        '<c:axId val="559345487"/><c:scaling><c:orientation val="minMax"/>' +
        '</c:scaling><c:delete val="0"/><c:axPos val="l"/>' +
        '<c:crossAx val="559342127"/></c:valAx></c:plotArea><c:legend>' +
        '<c:legendPos val="b"/><c:overlay val="0"/></c:legend>' +
        '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
        '<c:externalData r:id="rId3"><c:autoUpdate val="0"/>' +
        '</c:externalData></c:chartSpace>'
    );
}

const CHART = genChart(`${TYPED_TITLE}<c:autoTitleDeleted val="0"/>`);

describe('a chart read (2026-11-20)', () => {
    test('its kind, typed title, categories, and each series', () => {
        expect(readChartData(CHART)).toEqual({
            kind: 'column',
            title: 'Sunday Attendance',
            categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            series: [
                { name: 'Adults', values: [4.3, 2.5, 3.5, 4.5] },
                { name: 'Children', values: [2.4, 4.4, 1.8, 2.8] },
            ],
        });
    });

    test('a title PowerPoint makes is none; a part that is no chart is null', () => {
        const auto = genChart(`${AUTO_TITLE}<c:autoTitleDeleted val="0"/>`);
        expect(readChartData(auto)?.title).toBe(null);
        expect(
            readChartData(
                swap(
                    swap(CHART, '<c:barChart>', '<c:pie3DChart>'),
                    '</c:barChart>',
                    '</c:pie3DChart>',
                ),
            )?.kind,
        ).toBe('pie3D');
        expect(readChartData('<p:sld/>')).toBe(null);
        // the newer kinds (waterfall, treemap) are another part altogether
        expect(
            readChartData('<cx:chartSpace><cx:chart/></cx:chartSpace>'),
        ).toBe(null);
    });
});

describe('a chart changed: its copy and the cells (2026-11-20)', () => {
    test('title, a series name, values and categories, with exactly the cells that change', () => {
        const result = toChanged(
            setChartDataXml(CHART, {
                title: 'Easter Attendance',
                categories: ['Week 1', 'Week 2', 'Palm Sunday', 'Easter'],
                // 4.4 is what the cache's 4.4000000000000004 is: kept
                series: [
                    { index: 1, name: 'Youth', values: [2.4, 4.4, 6, 12.5] },
                ],
            }),
        );
        let expected = swap(
            CHART,
            TITLE_RUNS,
            '<a:r><a:rPr lang="en-US" dirty="0"/><a:t>Easter Attendance</a:t></a:r>',
        );
        expected = swap(
            expected,
            '<c:v>Week 3</c:v>',
            '<c:v>Palm Sunday</c:v>',
        );
        expected = swap(expected, '<c:v>Week 4</c:v>', '<c:v>Easter</c:v>');
        expected = swap(expected, '<c:v>Children</c:v>', '<c:v>Youth</c:v>');
        expected = swap(
            expected,
            '<c:pt idx="2"><c:v>1.8</c:v></c:pt><c:pt idx="3"><c:v>2.8</c:v>',
            '<c:pt idx="2"><c:v>6</c:v></c:pt><c:pt idx="3"><c:v>12.5</c:v>',
        );
        expect(result.xml).toBe(expected);
        expect(result.cells).toEqual([
            { sheet: 'Sheet1', ref: 'A4', value: 'Palm Sunday' },
            { sheet: 'Sheet1', ref: 'A5', value: 'Easter' },
            { sheet: 'Sheet1', ref: 'C1', value: 'Youth' },
            { sheet: 'Sheet1', ref: 'C4', value: 6 },
            { sheet: 'Sheet1', ref: 'C5', value: 12.5 },
        ]);
        expect(readChartData(result.xml)?.series[1]).toEqual({
            name: 'Youth',
            values: [2.4, 4.4, 6, 12.5],
        });
    });

    test('nothing asked, nothing changed', () => {
        expect(setChartDataXml(CHART, {})).toEqual({ xml: CHART, cells: [] });
        expect(
            setChartDataXml(CHART, {
                series: [{ index: 0, values: [4.3, 2.5, 3.5, 4.5] }],
            }),
        ).toEqual({ xml: CHART, cells: [] });
    });

    test('null takes a point out and empties its cell; numbers never in exponents', () => {
        const result = toChanged(
            setChartDataXml(CHART, {
                series: [{ index: 0, values: [1e21, null, 1.5e-7, 4.5] }],
            }),
        );
        expect(result.xml).toBe(
            swap(
                CHART,
                '<c:pt idx="0"><c:v>4.3</c:v></c:pt><c:pt idx="1"><c:v>2.5</c:v>' +
                    '</c:pt><c:pt idx="2"><c:v>3.5</c:v></c:pt>',
                '<c:pt idx="0"><c:v>1000000000000000000000</c:v></c:pt>' +
                    '<c:pt idx="2"><c:v>0.00000015</c:v></c:pt>',
            ),
        );
        expect(result.cells).toEqual([
            { sheet: 'Sheet1', ref: 'B2', value: 1e21 },
            { sheet: 'Sheet1', ref: 'B3', value: null },
            { sheet: 'Sheet1', ref: 'B4', value: 1.5e-7 },
        ]);
        expect(readChartData(result.xml)?.series[0].values).toEqual([
            1e21,
            null,
            1.5e-7,
            4.5,
        ]);
    });

    test('words escaped, a line break the model wrote as \\n made one', () => {
        const result = toChanged(
            setChartDataXml(CHART, {
                title: 'Tea & <Cake>\\nAfter church',
                series: [{ index: 0, name: 'Mums & Dads' }],
            }),
        );
        expect(result.xml).toContain(
            '<a:r><a:rPr lang="en-US" dirty="0"/><a:t>Tea &amp; &lt;Cake&gt;' +
                '</a:t></a:r><a:br><a:rPr lang="en-US" dirty="0"/></a:br><a:r>' +
                '<a:rPr lang="en-US" dirty="0"/><a:t>After church</a:t></a:r></a:p>',
        );
        expect(result.xml).toContain('<c:v>Mums &amp; Dads</c:v>');
        expect(readChartData(result.xml)?.title).toBe(
            'Tea & <Cake>\nAfter church',
        );
        expect(result.cells).toEqual([
            { sheet: 'Sheet1', ref: 'B1', value: 'Mums & Dads' },
        ]);
    });

    test('what cannot be done is said, and nothing is changed', () => {
        const reasonOf = (change: Parameters<typeof setChartDataXml>[1]) => {
            const result = setChartDataXml(CHART, change);
            return 'reason' in result ? result.reason : null;
        };
        expect(reasonOf({ series: [{ index: 2, name: 'Teens' }] })).toBe(
            'There is no series 2 in this chart; its series are 0 "Adults", ' +
                '1 "Children".',
        );
        expect(
            reasonOf({ series: [{ index: 0, values: [1, 2, 3, 4, 5] }] }),
        ).toBe(
            'This chart has 4 categories, so "Adults" needs 4 values, one ' +
                'for each; 5 were given. To add or take away a category, ' +
                'give the categories too.',
        );
        expect(
            reasonOf({
                categories: ['A', 'B', 'C', 'D', 'E'],
                series: [{ index: 1, values: [1, 2, 3, 4] }],
            }),
        ).toBe(
            '5 categories were given, so "Children" needs 5 values, one ' +
                'for each; 4 were given.',
        );
        expect(
            reasonOf({ series: [{ index: 0, values: [1, Number.NaN, 3, 4] }] }),
        ).toBe('"Adults" was given a value that is not a number.');
        expect(reasonOf({ categories: [] })).toBe(
            'A chart needs at least one category.',
        );
        expect(setChartDataXml('<c:chartSpace/>', { title: 'x' })).toEqual({
            reason:
                'This chart could not be read, so it cannot be changed here; ' +
                'change it in PowerPoint.',
        });
    });
});

describe('a chart title (2026-11-20)', () => {
    test('one PowerPoint made gets the words, in the look it keeps for them', () => {
        const auto = genChart(`${AUTO_TITLE}<c:autoTitleDeleted val="0"/>`);
        const result = toChanged(setChartDataXml(auto, { title: 'Giving' }));
        expect(result.xml).toBe(
            swap(
                auto,
                AUTO_TITLE,
                `<c:title><c:tx><c:rich>${TITLE_BODY}<a:p>${TITLE_LOOK}` +
                    '<a:r><a:rPr lang="en-US"/><a:t>Giving</a:t></a:r>' +
                    '<a:endParaRPr lang="en-US"/></a:p></c:rich></c:tx>' +
                    `${TITLE_FRAME}${TITLE_TX_PR}</c:title>`,
            ),
        );
        expect(readChartData(result.xml)?.title).toBe('Giving');
        expect(result.cells).toEqual([]);
        // a title there while PowerPoint was told there is none: told again
        const told = swap(
            auto,
            '<c:autoTitleDeleted val="0"/>',
            '<c:autoTitleDeleted val="1"/>',
        );
        expect(toChanged(setChartDataXml(told, { title: 'Giving' })).xml).toBe(
            result.xml,
        );
    });

    test('a chart with none gets a plain one, and PowerPoint told it has one', () => {
        const deleted = genChart('<c:autoTitleDeleted val="1"/>');
        const minimal =
            '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>' +
            '<a:t>Giving</a:t></a:r></a:p></c:rich></c:tx>' +
            '<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>';
        expect(
            toChanged(setChartDataXml(deleted, { title: 'Giving' })).xml,
        ).toBe(swap(deleted, '<c:autoTitleDeleted val="1"/>', minimal));
        const bare = genChart('');
        expect(toChanged(setChartDataXml(bare, { title: 'Giving' })).xml).toBe(
            swap(
                bare,
                '<c:chart><c:plotArea>',
                `<c:chart>${minimal}<c:plotArea>`,
            ),
        );
        // left alone when not asked
        expect(toChanged(setChartDataXml(deleted, {})).xml).toBe(deleted);
    });

    test("'' takes it off", () => {
        expect(toChanged(setChartDataXml(CHART, { title: '' })).xml).toBe(
            swap(
                CHART,
                `${TYPED_TITLE}<c:autoTitleDeleted val="0"/>`,
                '<c:autoTitleDeleted val="1"/>',
            ),
        );
        // no `c:autoTitleDeleted` yet: made where the title was
        const alone = genChart(TYPED_TITLE);
        expect(toChanged(setChartDataXml(alone, { title: ' ' })).xml).toBe(
            swap(alone, TYPED_TITLE, '<c:autoTitleDeleted val="1"/>'),
        );
    });

    test('a title taken from a cell: its copy and its cell', () => {
        const linked =
            '<c:title><c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache>' +
            '<c:ptCount val="1"/><c:pt idx="0"><c:v>Adults</c:v></c:pt>' +
            `</c:strCache></c:strRef></c:tx>${TITLE_FRAME}</c:title>`;
        const chart = genChart(`${linked}<c:autoTitleDeleted val="0"/>`);
        expect(readChartData(chart)?.title).toBe('Adults');
        const result = toChanged(
            setChartDataXml(chart, { title: 'Grown-ups' }),
        );
        expect(result.xml).toBe(
            swap(
                chart,
                '<c:v>Adults</c:v></c:pt></c:strCache></c:strRef></c:tx><c:overlay',
                '<c:v>Grown-ups</c:v></c:pt></c:strCache></c:strRef></c:tx><c:overlay',
            ),
        );
        expect(result.cells).toEqual([
            { sheet: 'Sheet1', ref: 'B1', value: 'Grown-ups' },
        ]);
    });
});

describe('a category added or taken away (2026-11-20)', () => {
    test('grown: every range, count and point, the new cells written', () => {
        const result = toChanged(
            setChartDataXml(CHART, {
                categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
                series: [{ index: 0, values: [4.3, 2.5, 3.5, 4.5, 5.1] }],
            }),
        );
        let expected = swap(
            CHART,
            '<c:f>Sheet1!$A$2:$A$5</c:f><c:strCache><c:ptCount val="4"/>',
            '<c:f>Sheet1!$A$2:$A$6</c:f><c:strCache><c:ptCount val="5"/>',
        );
        expected = swap(
            expected,
            '<c:v>Week 4</c:v></c:pt>',
            '<c:v>Week 4</c:v></c:pt><c:pt idx="4"><c:v>Week 5</c:v></c:pt>',
        );
        for (const column of ['B', 'C']) {
            expected = swap(
                expected,
                `<c:f>Sheet1!$${column}$2:$${column}$5</c:f><c:numCache>` +
                    '<c:formatCode>General</c:formatCode><c:ptCount val="4"/>',
                `<c:f>Sheet1!$${column}$2:$${column}$6</c:f><c:numCache>` +
                    '<c:formatCode>General</c:formatCode><c:ptCount val="5"/>',
            );
        }
        expected = swap(
            expected,
            '<c:v>4.5</c:v></c:pt>',
            '<c:v>4.5</c:v></c:pt><c:pt idx="4"><c:v>5.1</c:v></c:pt>',
        );
        expect(result.xml).toBe(expected);
        // the series not given its values gets an empty point, its cell too
        expect(result.cells).toEqual([
            { sheet: 'Sheet1', ref: 'A6', value: 'Week 5' },
            { sheet: 'Sheet1', ref: 'B6', value: 5.1 },
            { sheet: 'Sheet1', ref: 'C6', value: null },
        ]);
        expect(readChartData(result.xml)?.series[1].values).toEqual([
            2.4,
            4.4,
            1.8,
            2.8,
            null,
        ]);
        // a new point given as empty: its cell emptied all the same
        expect(
            toChanged(
                setChartDataXml(CHART, {
                    categories: ['W1', 'W2', 'W3', 'W4', 'W5'],
                    series: [{ index: 0, values: [4.3, 2.5, 3.5, 4.5, null] }],
                }),
            ).cells.filter((cell) => {
                return cell.ref.startsWith('B');
            }),
        ).toEqual([{ sheet: 'Sheet1', ref: 'B6', value: null }]);
    });

    test("shrunk: ranges, counts and points; a gone point's own look too, the cells left", () => {
        const look = (idx: number) => {
            return (
                `<c:dPt><c:idx val="${idx}"/><c:invertIfNegative val="0"/>` +
                '<c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr ' +
                'val="FF0000"/></a:solidFill></c:spPr></c:dPt>'
            );
        };
        const chart = genChart(
            '',
            genSeries(
                0,
                'B',
                'Adults',
                ['4.3', '2.5', '3.5', '4.5'],
                look(1) + look(3),
            ),
        );
        const result = toChanged(
            setChartDataXml(chart, {
                categories: ['Week 1', 'Week 2', 'Week 3'],
            }),
        );
        let expected = swap(chart, look(3), '');
        expected = swap(
            expected,
            '<c:f>Sheet1!$A$2:$A$5</c:f><c:strCache><c:ptCount val="4"/>',
            '<c:f>Sheet1!$A$2:$A$4</c:f><c:strCache><c:ptCount val="3"/>',
        );
        expected = swap(expected, '<c:pt idx="3"><c:v>Week 4</c:v></c:pt>', '');
        expected = swap(
            expected,
            '<c:f>Sheet1!$B$2:$B$5</c:f><c:numCache><c:formatCode>General' +
                '</c:formatCode><c:ptCount val="4"/>',
            '<c:f>Sheet1!$B$2:$B$4</c:f><c:numCache><c:formatCode>General' +
                '</c:formatCode><c:ptCount val="3"/>',
        );
        expected = swap(expected, '<c:pt idx="3"><c:v>4.5</c:v></c:pt>', '');
        expect(result.xml).toBe(expected);
        expect(result.cells).toEqual([]);
        expect(readChartData(result.xml)?.series[0].values).toEqual([
            4.3, 2.5, 3.5,
        ]);
    });

    test('data in rows grows to the right; one point grows down like its name', () => {
        const rowsChart = genChart(
            '',
            '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef>' +
                '<c:f>Sheet1!$A$2</c:f><c:strCache><c:ptCount val="1"/>' +
                '<c:pt idx="0"><c:v>Adults</c:v></c:pt></c:strCache>' +
                '</c:strRef></c:tx><c:cat><c:strRef><c:f>Sheet1!$B$1:$C$1</c:f>' +
                '<c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Jan</c:v>' +
                '</c:pt><c:pt idx="1"><c:v>Feb</c:v></c:pt></c:strCache>' +
                '</c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$C$2</c:f>' +
                '<c:numCache><c:formatCode>General</c:formatCode>' +
                '<c:ptCount val="2"/><c:pt idx="0"><c:v>10</c:v></c:pt>' +
                '<c:pt idx="1"><c:v>12</c:v></c:pt></c:numCache></c:numRef>' +
                '</c:val></c:ser>',
        );
        const grown = toChanged(
            setChartDataXml(rowsChart, {
                categories: ['Jan', 'Feb', 'Mar'],
                series: [{ index: 0, values: [10, 12, 15] }],
            }),
        );
        expect(grown.xml).toContain('<c:f>Sheet1!$B$1:$D$1</c:f>');
        expect(grown.xml).toContain('<c:f>Sheet1!$B$2:$D$2</c:f>');
        expect(grown.cells).toEqual([
            { sheet: 'Sheet1', ref: 'D1', value: 'Mar' },
            { sheet: 'Sheet1', ref: 'D2', value: 15 },
        ]);
        const onePoint = genChart(
            '',
            '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef>' +
                '<c:f>Sheet1!$B$1</c:f></c:strRef></c:tx><c:cat><c:strRef>' +
                '<c:f>Sheet1!$A$2</c:f><c:strCache><c:ptCount val="1"/>' +
                '<c:pt idx="0"><c:v>Jan</c:v></c:pt></c:strCache></c:strRef>' +
                '</c:cat><c:val><c:numRef><c:f>Sheet1!$B$2</c:f><c:numCache>' +
                '<c:formatCode>General</c:formatCode><c:ptCount val="1"/>' +
                '<c:pt idx="0"><c:v>10</c:v></c:pt></c:numCache></c:numRef>' +
                '</c:val></c:ser>',
        );
        const down = toChanged(
            setChartDataXml(onePoint, {
                categories: ['Jan', 'Feb'],
                series: [{ index: 0, name: 'Adults', values: [10, 12] }],
            }),
        );
        // a name PowerPoint kept no copy of gets one
        expect(down.xml).toContain(
            '<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache>' +
                '<c:ptCount val="1"/><c:pt idx="0"><c:v>Adults</c:v></c:pt>' +
                '</c:strCache></c:strRef></c:tx>',
        );
        expect(down.xml).toContain('<c:f>Sheet1!$A$2:$A$3</c:f>');
        expect(down.xml).toContain('<c:f>Sheet1!$B$2:$B$3</c:f>');
        expect(down.cells).toEqual([
            { sheet: 'Sheet1', ref: 'B1', value: 'Adults' },
            { sheet: 'Sheet1', ref: 'A3', value: 'Feb' },
            { sheet: 'Sheet1', ref: 'B3', value: 12 },
        ]);
        // one point laid out in rows: its name beside its value
        let across = swap(onePoint, 'Sheet1!$B$1', 'Sheet1!$A$2');
        across = swap(
            across,
            '<c:f>Sheet1!$A$2</c:f><c:strCache>',
            '<c:f>Sheet1!$B$1</c:f><c:strCache>',
        );
        const right = toChanged(
            setChartDataXml(across, {
                categories: ['Jan', 'Feb'],
                series: [{ index: 0, values: [10, 12] }],
            }),
        );
        expect(right.xml).toContain('<c:f>Sheet1!$B$1:$C$1</c:f>');
        expect(right.xml).toContain('<c:f>Sheet1!$B$2:$C$2</c:f>');
        expect(right.cells).toEqual([
            { sheet: 'Sheet1', ref: 'C1', value: 'Feb' },
            { sheet: 'Sheet1', ref: 'C2', value: 12 },
        ]);
    });

    test('not when error bars take their size from cells', () => {
        const chart = genChart(
            '',
            genSeries(
                0,
                'B',
                'Adults',
                ['1', '2', '3', '4'],
                '<c:errBars><c:errDir val="y"/><c:errBarType val="both"/>' +
                    '<c:errValType val="cust"/><c:plus><c:numRef>' +
                    '<c:f>Sheet1!$D$2:$D$5</c:f></c:numRef></c:plus></c:errBars>',
            ),
        );
        expect(setChartDataXml(chart, { categories: ['A', 'B', 'C'] })).toEqual(
            {
                reason:
                    'This chart takes error bars or labels from cells for its ' +
                    'points, so a category cannot be added or taken away here; ' +
                    'change it in PowerPoint.',
            },
        );
        // the same number of them is still fine
        expect(
            'xml' in
                setChartDataXml(chart, { categories: ['A', 'B', 'C', 'D'] }),
        ).toBe(true);
    });
});

describe('categories that are numbers (2026-11-20)', () => {
    const years = genChart(
        '',
        swap(
            genSeries(0, 'B', 'Adults', ['40', '42', '45', '51']),
            CATEGORIES,
            '<c:cat><c:numRef><c:f>Sheet1!$A$2:$A$5</c:f><c:numCache>' +
                '<c:formatCode>General</c:formatCode><c:ptCount val="4"/>' +
                '<c:pt idx="0"><c:v>2021</c:v></c:pt><c:pt idx="1"><c:v>2022' +
                '</c:v></c:pt><c:pt idx="2"><c:v>2023</c:v></c:pt>' +
                '<c:pt idx="3"><c:v>2024</c:v></c:pt></c:numCache></c:numRef>' +
                '</c:cat>',
        ),
    );

    test('read as written; years given stay numbers, words make them words', () => {
        expect(readChartData(years)?.categories).toEqual([
            '2021',
            '2022',
            '2023',
            '2024',
        ]);
        const later = toChanged(
            setChartDataXml(years, {
                categories: ['2021', '2022', '2023', '2025'],
            }),
        );
        expect(later.xml).toBe(
            swap(years, '<c:v>2024</c:v>', '<c:v>2025</c:v>'),
        );
        expect(later.cells).toEqual([
            { sheet: 'Sheet1', ref: 'A5', value: 2025 },
        ]);
        const words = toChanged(
            setChartDataXml(years, {
                categories: ['Spring', 'Summer', 'Autumn', 'Winter'],
            }),
        );
        expect(words.xml).toContain(
            '<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$5</c:f><c:strCache>' +
                '<c:ptCount val="4"/><c:pt idx="0"><c:v>Spring</c:v></c:pt>' +
                '<c:pt idx="1"><c:v>Summer</c:v></c:pt><c:pt idx="2"><c:v>' +
                'Autumn</c:v></c:pt><c:pt idx="3"><c:v>Winter</c:v></c:pt>' +
                '</c:strCache></c:strRef></c:cat>',
        );
        expect(
            words.cells.map((cell) => {
                return cell.value;
            }),
        ).toEqual(['Spring', 'Summer', 'Autumn', 'Winter']);
    });
});

describe('formulas this cannot read (2026-11-20)', () => {
    test("LibreOffice's own names: the chart changes, no cells", () => {
        // what LibreOffice writes for a chart it exported, with no workbook
        let chart = swap(CHART, 'Sheet1!$A$2:$A$5', 'categories');
        chart = swap(chart, 'Sheet1!$B$1', 'label 0');
        chart = swap(chart, 'Sheet1!$B$2:$B$5', '0');
        const result = toChanged(
            setChartDataXml(chart, {
                categories: ['W1', 'W2', 'W3', 'W4'],
                series: [{ index: 0, name: 'Grown-ups', values: [1, 2, 3, 4] }],
            }),
        );
        expect(readChartData(result.xml)).toMatchObject({
            categories: ['W1', 'W2', 'W3', 'W4'],
            series: [{ name: 'Grown-ups', values: [1, 2, 3, 4] }, {}],
        });
        // every formula changed is one LibreOffice named
        expect(
            result.cells.map((cell) => {
                return cell.ref;
            }),
        ).toEqual([]);
    });

    test('two areas on one sheet are read; two sheets, another workbook are not', () => {
        const withValues = (formula: string) => {
            return genChart(
                '',
                swap(
                    genSeries(0, 'B', 'Adults', ['1', '2', '3', '4']),
                    'Sheet1!$B$2:$B$5',
                    formula,
                ),
            );
        };
        const cellsOf = (formula: string) => {
            return toChanged(
                setChartDataXml(withValues(formula), {
                    series: [{ index: 0, values: [5, 6, 7, 8] }],
                }),
            ).cells.filter((cell: OfficeChartCellType) => {
                return typeof cell.value === 'number';
            });
        };
        expect(cellsOf('(Sheet1!$B$2:$B$3,Sheet1!$B$5:$B$6)')).toEqual([
            { sheet: 'Sheet1', ref: 'B2', value: 5 },
            { sheet: 'Sheet1', ref: 'B3', value: 6 },
            { sheet: 'Sheet1', ref: 'B5', value: 7 },
            { sheet: 'Sheet1', ref: 'B6', value: 8 },
        ]);
        expect(cellsOf("'Sunday''s count'!$C$2:$C$5")[0]).toEqual({
            sheet: "Sunday's count",
            ref: 'C2',
            value: 5,
        });
        expect(cellsOf('(Sheet1!$B$2:$B$3,Sheet2!$B$4:$B$5)')).toEqual([]);
        expect(cellsOf('[1]Sheet1!$B$2:$B$5')).toEqual([]);
        expect(cellsOf('Attendance')).toEqual([]);
        // the chart's own copy changed all the same
        const crossed = toChanged(
            setChartDataXml(withValues('(Sheet1!$B$2:$B$3,Sheet2!$B$4:$B$5)'), {
                series: [{ index: 0, values: [5, 6, 7, 8] }],
            }),
        );
        expect(readChartData(crossed.xml)?.series[0].values).toEqual([
            5, 6, 7, 8,
        ]);
    });
});

// --- the embedded workbook, as PowerPoint embedded it --------------------------

const WORKBOOK =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ' +
    'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/' +
    'relationships"><fileVersion appName="xl" lastEdited="7"/><sheets>' +
    '<sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Q&amp;A" ' +
    'sheetId="2" r:id="rId5"/></sheets><calcPr calcId="191029"/>' +
    '<oleSize ref="A1"/></workbook>';
const WORKBOOK_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/' +
    'relationships"><Relationship Id="rId3" Type="http://schemas.' +
    'openxmlformats.org/officeDocument/2006/relationships/styles" ' +
    'Target="styles.xml"/><Relationship Id="rId1" Type="http://schemas.' +
    'openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
    'Target="worksheets/sheet1.xml"/><Relationship Id="rId5" Type="http://' +
    'schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
    ' Target="/xl/worksheets/sheet9.xml"/></Relationships>';

const SHEET_HEAD =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ' +
    'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/' +
    'relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-' +
    'compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.' +
    'microsoft.com/office/spreadsheetml/2009/9/ac">';
const SHEET =
    SHEET_HEAD +
    '<dimension ref="A1:D5"/><sheetViews><sheetView tabSelected="1" ' +
    'workbookViewId="0"><selection activeCell="B1" sqref="B1"/></sheetView>' +
    '</sheetViews><sheetFormatPr defaultRowHeight="14.4" ' +
    'x14ac:dyDescent="0.3"/><cols><col min="1" max="1" width="10.44140625" ' +
    'customWidth="1"/></cols><sheetData><row r="1" spans="1:4" ' +
    'x14ac:dyDescent="0.3"><c r="A1" t="s"><v>7</v></c><c r="B1" t="s"><v>0' +
    '</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>' +
    '<row r="2" spans="1:4" x14ac:dyDescent="0.3"><c r="A2" t="s"><v>3</v>' +
    '</c><c r="B2"><v>4.3</v></c><c r="C2"><v>2.4</v></c><c r="D2"><v>2</v>' +
    '</c></row><row r="3" spans="1:4" x14ac:dyDescent="0.3"><c r="A3" ' +
    't="s"><v>4</v></c><c r="B3"><v>2.5</v></c><c r="C3"><v>4.4000000000000004' +
    '</v></c><c r="D3"><v>2</v></c></row><row r="4" spans="1:4" ' +
    'x14ac:dyDescent="0.3"><c r="A4" t="s"><v>5</v></c><c r="B4"><v>3.5</v>' +
    '</c><c r="C4"><v>1.8</v></c><c r="D4"><v>3</v></c></row><row r="5" ' +
    'spans="1:4" x14ac:dyDescent="0.3"><c r="A5" t="s"><v>6</v></c>' +
    '<c r="B5"><v>4.5</v></c><c r="C5"><v>2.8</v></c><c r="D5"><v>5</v></c>' +
    '</row></sheetData><pageMargins left="0.7" right="0.7" top="0.75" ' +
    'bottom="0.75" header="0.3" footer="0.3"/><tableParts count="1">' +
    '<tablePart r:id="rId1"/></tableParts></worksheet>';

const TABLE =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<table ' +
    'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'id="1" name="Table1" displayName="Table1" ref="A1:D5" ' +
    'totalsRowShown="0"><autoFilter ref="A1:D5"/><tableColumns count="4">' +
    '<tableColumn id="1" name=" "/><tableColumn id="2" name="Series 1"/>' +
    '<tableColumn id="3" name="Series 2"/><tableColumn id="4" ' +
    'name="Series 3"/></tableColumns><tableStyleInfo showFirstColumn="0" ' +
    'showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>';

describe('the workbook found (2026-11-20)', () => {
    test("a sheet's part by its name, in any case; none for a name not there", () => {
        expect(findSheetPath(WORKBOOK, WORKBOOK_RELS, 'Sheet1')).toBe(
            'xl/worksheets/sheet1.xml',
        );
        expect(findSheetPath(WORKBOOK, WORKBOOK_RELS, 'sheet1')).toBe(
            'xl/worksheets/sheet1.xml',
        );
        expect(findSheetPath(WORKBOOK, WORKBOOK_RELS, 'Q&A')).toBe(
            'xl/worksheets/sheet9.xml',
        );
        expect(findSheetPath(WORKBOOK, WORKBOOK_RELS, 'Sheet2')).toBe(null);
        expect(findSheetPath(WORKBOOK, '<Relationships/>', 'Sheet1')).toBe(
            null,
        );
    });

    test("a sheet's tables from its rels", () => {
        expect(
            listSheetTablePaths(
                '<Relationships xmlns="http://schemas.openxmlformats.org/' +
                    'package/2006/relationships"><Relationship Id="rId1" ' +
                    'Type="http://schemas.openxmlformats.org/officeDocument/' +
                    '2006/relationships/table" Target="../tables/table1.xml"/>' +
                    '</Relationships>',
                'xl/worksheets/sheet1.xml',
            ),
        ).toEqual(['xl/tables/table1.xml']);
    });
});

describe('cells written into a sheet (2026-11-20)', () => {
    test('numbers, words, emptied, a new cell and a new row; every other byte kept', () => {
        const written = setSheetCellsXml(SHEET, [
            { ref: 'C1', value: 'Youth' },
            { ref: 'C4', value: 6 },
            { ref: 'B3', value: null },
            { ref: 'E2', value: 7 },
            { ref: 'C6', value: 12.5 },
            { ref: 'A6', value: ' Easter ' },
        ]);
        let expected = swap(
            SHEET,
            '<c r="C1" t="s"><v>1</v></c>',
            '<c r="C1" t="inlineStr"><is><t>Youth</t></is></c>',
        );
        expected = swap(
            expected,
            '<c r="C4"><v>1.8</v></c>',
            '<c r="C4"><v>6</v></c>',
        );
        expected = swap(expected, '<c r="B3"><v>2.5</v></c>', '<c r="B3"/>');
        expected = swap(
            expected,
            '<row r="2" spans="1:4" x14ac:dyDescent="0.3">',
            '<row r="2" spans="1:5" x14ac:dyDescent="0.3">',
        );
        expected = swap(
            expected,
            '<c r="D2"><v>2</v></c></row>',
            '<c r="D2"><v>2</v></c><c r="E2"><v>7</v></c></row>',
        );
        expected = swap(
            expected,
            '</row></sheetData>',
            '</row><row r="6"><c r="A6" t="inlineStr"><is><t ' +
                'xml:space="preserve"> Easter </t></is></c><c r="C6"><v>12.5' +
                '</v></c></row></sheetData>',
        );
        expected = swap(
            expected,
            '<dimension ref="A1:D5"/>',
            '<dimension ref="A1:E6"/>',
        );
        expect(written).toBe(expected);
        expect(setSheetCellsXml(SHEET, [])).toBe(SHEET);
    });

    test("a written cell's formula dropped; a shared formula's other cells keep their values", () => {
        const sheet =
            SHEET_HEAD +
            '<dimension ref="A1:D3"/><sheetData><row r="1"><c r="A1" s="2">' +
            '<f>SUM(B1:B3)</f><v>6</v></c><c r="B1"><v>1</v></c></row>' +
            '<row r="2"><c r="B2"><f t="shared" ref="B2:D3" si="0">B1+1</f>' +
            '<v>2</v></c></row><row r="3"><c r="B3"><f t="shared" si="0"/>' +
            '<v>3</v></c><c r="C3" t="str"><f t="shared" si="1"/><v>x</v></c>' +
            '<c r="D3" t="str"><f t="shared" si="0"/><v>yes</v></c></row>' +
            '</sheetData></worksheet>';
        expect(
            setSheetCellsXml(sheet, [
                { ref: 'A1', value: 10 },
                { ref: 'B2', value: 5 },
            ]),
        ).toBe(
            SHEET_HEAD +
                '<dimension ref="A1:D3"/><sheetData><row r="1"><c r="A1" ' +
                's="2"><v>10</v></c><c r="B1"><v>1</v></c></row><row r="2">' +
                '<c r="B2"><v>5</v></c></row><row r="3"><c r="B3"><v>3</v></c>' +
                '<c r="C3" t="str"><f t="shared" si="1"/><v>x</v></c>' +
                '<c r="D3" t="inlineStr"><is><t>yes</t></is></c></row>' +
                '</sheetData></worksheet>',
        );
    });

    test('rows and cells placed by counting, a prefix, an empty sheet', () => {
        const prefixed =
            '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/' +
            'spreadsheetml/2006/main"><x:sheetData><x:row><x:c><x:v>1</x:v>' +
            '</x:c><x:c><x:v>2</x:v></x:c></x:row><x:row><x:c><x:v>3</x:v>' +
            '</x:c></x:row></x:sheetData></x:worksheet>';
        expect(
            setSheetCellsXml(prefixed, [
                { ref: 'B1', value: 'two' },
                { ref: 'D1', value: 4 },
                { ref: 'A4', value: 5 },
            ]),
        ).toBe(
            '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/' +
                'spreadsheetml/2006/main"><x:sheetData><x:row r="1">' +
                '<x:c r="A1"><x:v>1</x:v></x:c><x:c r="B1" t="inlineStr">' +
                '<x:is><x:t>two</x:t></x:is></x:c><x:c r="D1"><x:v>4</x:v>' +
                '</x:c></x:row><x:row r="2"><x:c><x:v>3</x:v></x:c></x:row>' +
                '<x:row r="4"><x:c r="A4"><x:v>5</x:v></x:c></x:row>' +
                '</x:sheetData></x:worksheet>',
        );
        expect(
            setSheetCellsXml(
                '<worksheet><dimension ref="A1"/><sheetData/></worksheet>',
                [
                    { ref: 'B2', value: 1 },
                    { ref: 'A1', value: 'Week' },
                ],
            ),
        ).toBe(
            '<worksheet><dimension ref="A1:B2"/><sheetData><row r="1">' +
                '<c r="A1" t="inlineStr"><is><t>Week</t></is></c></row>' +
                '<row r="2"><c r="B2"><v>1</v></c></row></sheetData>' +
                '</worksheet>',
        );
    });

    test('a new row goes between the rows around it', () => {
        expect(
            setSheetCellsXml(SHEET, [{ ref: 'A7', value: 1 }]).length,
        ).toBeGreaterThan(SHEET.length);
        const gap =
            '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row>' +
            '<row r="5"><c r="A5"><v>5</v></c></row></sheetData></worksheet>';
        expect(setSheetCellsXml(gap, [{ ref: 'B3', value: 3 }])).toBe(
            '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row>' +
                '<row r="3"><c r="B3"><v>3</v></c></row><row r="5"><c r="A5">' +
                '<v>5</v></c></row></sheetData></worksheet>',
        );
    });
});

describe("the workbook's table kept true (2026-11-20)", () => {
    test("a header's words are its column's name; rows below grow it", () => {
        expect(
            setSheetTableXml(TABLE, [
                { ref: 'C1', value: 'Youth & "Kids"' },
                { ref: 'A6', value: 'Week 5' },
                { ref: 'C6', value: 3 },
                // outside it: no name, no growth
                { ref: 'F1', value: 'Notes' },
                { ref: 'F9', value: 1 },
            ]),
        ).toBe(
            swap(
                swap(
                    TABLE,
                    'name="Series 2"',
                    'name="Youth &amp; &quot;Kids&quot;"',
                ),
                'ref="A1:D5"',
                'ref="A1:D6"',
            ),
        );
        expect(setSheetTableXml(TABLE, [{ ref: 'B3', value: 1 }])).toBe(TABLE);
    });
});
