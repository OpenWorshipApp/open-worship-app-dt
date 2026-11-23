import { describe, expect, test } from 'vitest';

import {
    type OfficeLayoutType,
    genSlideFromLayout,
    genSlideFromLayoutXml,
    listLayoutPlaceholders,
    pickLayout,
    readLayoutName,
    readOfficeLayout,
} from './officeSlideLayoutHelpers';

// A layout part as PowerPoint writes one: each box `[name, ph attributes]`,
// with the prompt words a layout holds.
function genLayout(name: string | null, boxes: [string, string][]) {
    const boxesXml = boxes
        .map(([boxName, ph], index) => {
            return (
                `<p:sp><p:nvSpPr><p:cNvPr id="${index + 2}" name="${boxName}"/>` +
                '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' +
                `<p:ph${ph}/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>` +
                '<a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>' +
                '<a:t>Click to edit</a:t></a:r></a:p></p:txBody></p:sp>'
            );
        })
        .join('');
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        '<p:sldLayout xmlns:a="a" xmlns:r="r" xmlns:p="p" type="obj" ' +
        `preserve="1"><p:cSld${name === null ? '' : ` name="${name}"`}>` +
        '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/>' +
        '<p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
        boxesXml +
        '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/>' +
        '</p:clrMapOvr></p:sldLayout>'
    );
}

const FOOTERS: [string, string][] = [
    ['Date Placeholder 3', ' type="dt" sz="half" idx="10"'],
    ['Footer Placeholder 4', ' type="ftr" sz="quarter" idx="11"'],
    ['Slide Number Placeholder 5', ' type="sldNum" sz="quarter" idx="12"'],
];
const TITLE_SLIDE = genLayout('Title Slide', [
    ['Title 1', ' type="ctrTitle"'],
    ['Subtitle 2', ' type="subTitle" idx="1"'],
    ...FOOTERS,
]);
const TITLE_AND_CONTENT = genLayout('Title and Content', [
    ['Title 1', ' type="title"'],
    ['Content Placeholder 2', ' idx="1"'],
    ...FOOTERS,
]);
const TWO_CONTENT = genLayout('Two Content', [
    ['Title 1', ' type="title"'],
    ['Content Placeholder 2', ' sz="half" idx="1"'],
    ['Content Placeholder 3', ' sz="half" idx="2"'],
    ...FOOTERS,
]);
const TITLE_ONLY = genLayout('Title Only', [
    ['Title 1', ' type="title"'],
    ...FOOTERS,
]);
const BLANK = genLayout('Blank', FOOTERS);
const PICTURE_WITH_CAPTION = genLayout('Picture with Caption', [
    ['Title 1', ' type="title"'],
    ['Picture Placeholder 2', ' type="pic" idx="1"'],
    ['Text Placeholder 3', ' type="body" sz="half" idx="2"'],
    ...FOOTERS,
]);
const VERTICAL_TITLE_AND_TEXT = genLayout('Vertical Title and Text', [
    ['Vertical Title 1', ' type="title" orient="vert"'],
    ['Vertical Text Placeholder 2', ' type="body" orient="vert" idx="1"'],
    ...FOOTERS,
]);

const SLIDE_HEAD =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/>' +
    '<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>' +
    '<a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/>' +
    '<a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const SLIDE_TAIL =
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sld>';
const EMPTY_PARAGRAPH = '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>';

function genBox(id: number, name: string, ph: string, paragraphs: string) {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr>` +
        '<a:spLocks noGrp="1"/></p:cNvSpPr>' +
        `<p:nvPr><p:ph${ph}/></p:nvPr></p:nvSpPr><p:spPr/>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
    );
}

function genRun(text: string) {
    return `<a:r><a:rPr dirty="0"/><a:t>${text}</a:t></a:r>`;
}

describe("a layout's name and placeholders", () => {
    test('its own name, unescaped; none, or an empty one, is null', () => {
        expect(readLayoutName(TITLE_AND_CONTENT)).toBe('Title and Content');
        expect(readLayoutName(genLayout('Words &amp; Picture', []))).toBe(
            'Words & Picture',
        );
        expect(readLayoutName(genLayout(null, []))).toBeNull();
        expect(readLayoutName(genLayout('  ', []))).toBeNull();
    });

    test('in order; no type is body; date, footer and number left out', () => {
        expect(listLayoutPlaceholders(TITLE_AND_CONTENT)).toEqual([
            { type: 'title', idx: null, name: 'Title 1' },
            { type: 'body', idx: '1', name: 'Content Placeholder 2' },
        ]);
        expect(listLayoutPlaceholders(PICTURE_WITH_CAPTION)).toEqual([
            { type: 'title', idx: null, name: 'Title 1' },
            { type: 'pic', idx: '1', name: 'Picture Placeholder 2' },
            { type: 'body', idx: '2', name: 'Text Placeholder 3' },
        ]);
        expect(
            listLayoutPlaceholders(
                genLayout('Notes', [['Header 1', ' type="hdr"']]),
            ),
        ).toEqual([]);
        expect(listLayoutPlaceholders(BLANK)).toEqual([]);
    });

    test('a layout read whole; one with no name called by its file', () => {
        expect(
            readOfficeLayout('ppt/slideLayouts/slideLayout7.xml', BLANK),
        ).toEqual({
            path: 'ppt/slideLayouts/slideLayout7.xml',
            name: 'Blank',
            placeholders: [],
        });
        expect(
            readOfficeLayout(
                'ppt/slideLayouts/slideLayout12.xml',
                genLayout(null, []),
            ).name,
        ).toBe('slideLayout12');
    });
});

describe('which layout a new slide takes', () => {
    // in the order a zip lists them, not the deck's
    const layouts = [
        ['slideLayout10.xml', VERTICAL_TITLE_AND_TEXT],
        ['slideLayout9.xml', PICTURE_WITH_CAPTION],
        ['slideLayout7.xml', BLANK],
        ['slideLayout6.xml', TITLE_ONLY],
        ['slideLayout4.xml', TWO_CONTENT],
        ['slideLayout2.xml', TITLE_AND_CONTENT],
        ['slideLayout1.xml', TITLE_SLIDE],
    ].map(([file, xml]) => {
        return readOfficeLayout(`ppt/slideLayouts/${file}`, xml);
    });
    const pickName = (asked: string | null, from = layouts) => {
        return pickLayout(from, asked)?.name ?? null;
    };

    test('by its name: any case, spaces and punctuation, filler words', () => {
        expect(pickName('Two Content')).toBe('Two Content');
        expect(pickName('title-and CONTENT')).toBe('Title and Content');
        expect(pickName('Title, Content')).toBe('Title and Content');
        expect(pickName('blank layout')).toBe('Blank');
        expect(pickName('Picture with Caption')).toBe('Picture with Caption');
    });

    test('by a word inside the name, the first in the deck order', () => {
        expect(pickName('caption')).toBe('Picture with Caption');
        // both have "content": the deck's second layout before its fourth
        expect(pickName('content')).toBe('Title and Content');
        expect(pickName('vertical')).toBe('Vertical Title and Text');
        // inside a word of the name, when no whole word is
        expect(pickName('pict')).toBe('Picture with Caption');
    });

    test("'blank' and 'title' by what the layout holds", () => {
        const renamed = layouts.map((layout) => {
            return layout.name === 'Blank'
                ? { ...layout, name: 'Empty' }
                : layout.name === 'Title Slide'
                  ? { ...layout, name: 'Opening' }
                  : layout;
        });
        expect(pickName('blank', renamed)).toBe('Empty');
        expect(pickName('Title', renamed)).toBe('Opening');
        expect(pickName('title')).toBe('Title Slide');
    });

    test('none asked: the title-and-content one, else the first', () => {
        expect(pickName(null)).toBe('Title and Content');
        expect(pickName('  ')).toBe('Title and Content');
        // named otherwise: a title and one body
        const others = layouts.map((layout) => {
            return layout.name === 'Title and Content'
                ? { ...layout, name: 'Words' }
                : layout;
        });
        expect(pickName(null, others)).toBe('Words');
        const noBody: OfficeLayoutType[] = layouts.filter((layout) => {
            return ['Blank', 'Title Only'].includes(layout.name);
        });
        expect(pickName(null, noBody)).toBe('Title Only');
        expect(pickLayout([], null)).toBeNull();
    });

    test('null when nothing fits the name asked', () => {
        expect(pickName('Chart')).toBeNull();
        expect(pickName('blank', [])).toBeNull();
        expect(
            pickName(
                'blank',
                layouts.filter((layout) => {
                    return layout.name !== 'Blank';
                }),
            ),
        ).toBeNull();
    });
});

describe('a new slide on a layout', () => {
    test('title and content: its boxes, ids, names, escaped words', () => {
        expect(
            genSlideFromLayoutXml(TITLE_AND_CONTENT, {
                title: 'Fish & <Loaves>',
                lines: ['Five "loaves"', '', 'Two fish'],
            }),
        ).toBe(
            SLIDE_HEAD +
                genBox(
                    2,
                    'Title 1',
                    ' type="title"',
                    `<a:p>${genRun('Fish &amp; &lt;Loaves&gt;')}</a:p>`,
                ) +
                genBox(
                    3,
                    'Content Placeholder 2',
                    ' idx="1"',
                    `<a:p>${genRun('Five "loaves"')}</a:p>` +
                        EMPTY_PARAGRAPH +
                        `<a:p>${genRun('Two fish')}</a:p>`,
                ) +
                SLIDE_TAIL,
        );
    });

    test('no words: every box holds one empty paragraph', () => {
        expect(genSlideFromLayout(TITLE_SLIDE, {})).toEqual({
            xml:
                SLIDE_HEAD +
                genBox(2, 'Title 1', ' type="ctrTitle"', EMPTY_PARAGRAPH) +
                genBox(
                    3,
                    'Subtitle 2',
                    ' type="subTitle" idx="1"',
                    EMPTY_PARAGRAPH,
                ) +
                SLIDE_TAIL,
            leftOut: [],
        });
    });

    test("a title slide's subtitle holds the lines; a break inside one", () => {
        const xml = genSlideFromLayoutXml(TITLE_SLIDE, {
            title: 'Welcome',
            lines: ['Sunday\n10 AM\u0007'],
        });
        expect(xml).toContain(
            genBox(
                3,
                'Subtitle 2',
                ' type="subTitle" idx="1"',
                `<a:p>${genRun('Sunday')}<a:br/>${genRun('10 AM')}</a:p>`,
            ),
        );
    });

    test('a picture placeholder left off; the ids follow on', () => {
        const xml = genSlideFromLayoutXml(PICTURE_WITH_CAPTION, {
            lines: ['Our choir'],
        });
        expect(xml).toBe(
            SLIDE_HEAD +
                genBox(2, 'Title 1', ' type="title"', EMPTY_PARAGRAPH) +
                genBox(
                    3,
                    'Text Placeholder 2',
                    ' type="body" sz="half" idx="2"',
                    `<a:p>${genRun('Our choir')}</a:p>`,
                ) +
                SLIDE_TAIL,
        );
        expect(xml).not.toContain('type="pic"');
    });

    test("a placeholder's size and direction kept, its name says so", () => {
        expect(
            genSlideFromLayoutXml(TWO_CONTENT, { lines: ['Left'] }),
        ).toContain(
            genBox(
                3,
                'Content Placeholder 2',
                ' sz="half" idx="1"',
                `<a:p>${genRun('Left')}</a:p>`,
            ) +
                genBox(
                    4,
                    'Content Placeholder 3',
                    ' sz="half" idx="2"',
                    EMPTY_PARAGRAPH,
                ),
        );
        const vertical = genSlideFromLayoutXml(VERTICAL_TITLE_AND_TEXT, {
            title: 'Psalm 23',
        });
        expect(vertical).toContain(
            genBox(
                2,
                'Vertical Title 1',
                ' type="title" orient="vert"',
                `<a:p>${genRun('Psalm 23')}</a:p>`,
            ),
        );
        expect(vertical).toContain(
            '<p:cNvPr id="3" name="Vertical Text Placeholder 2"/>',
        );
    });

    test('words with no box to hold them are left out, and said', () => {
        expect(
            genSlideFromLayout(BLANK, {
                title: 'Hymn 4',
                lines: ['First line', '', 'Second line'],
            }),
        ).toEqual({
            xml: SLIDE_HEAD + SLIDE_TAIL,
            leftOut: ['Hymn 4', 'First line', 'Second line'],
        });
        const titleOnly = genSlideFromLayout(TITLE_ONLY, {
            title: 'Hymn 4',
            lines: ['First line'],
        });
        expect(titleOnly.leftOut).toEqual(['First line']);
        expect(titleOnly.xml).toContain(`<a:p>${genRun('Hymn 4')}</a:p>`);
        // a title of spaces is no words
        expect(genSlideFromLayout(BLANK, { title: '  ' }).leftOut).toEqual([]);
    });
});
