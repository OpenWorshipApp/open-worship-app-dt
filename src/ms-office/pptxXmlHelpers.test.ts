// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import type {
    PptxDeckInfoType,
    PptxRunType,
    PptxSlideModelType,
    PptxSlideRelsType,
} from './pptxXmlHelpers';
import {
    escapeXmlText,
    genAppPropsXml,
    genContentTypesXml,
    genCorePropsXml,
    genNotesMasterRelsXml,
    genNotesMasterXml,
    genNotesSlideRelsXml,
    genNotesSlideXml,
    genPptxSlideSize,
    genPptxUnits,
    genPresPropsXml,
    genPresentationRelsXml,
    genPresentationXml,
    genRootRelsXml,
    genSlideLayoutRelsXml,
    genSlideLayoutXml,
    genSlideMasterRelsXml,
    genSlideMasterXml,
    genSlideRelsXml,
    genSlideXml,
    genTableStylesXml,
    genThemeXml,
    genViewPropsXml,
    splitPptxParagraphs,
} from './pptxXmlHelpers';

function parseXml(xml: string) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    expect(document.getElementsByTagName('parsererror').length).toBe(0);
    return document;
}

function genRun(text: string, extra: Partial<PptxRunType> = {}): PptxRunType {
    return {
        text,
        fontFamily: 'Battambang',
        fontSize: 105,
        color: { hex: 'FFFFFF', alpha: 1 },
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isStrike: false,
        letterSpacing: 0,
        baselineShift: 0,
        lang: 'km-KH',
        ...extra,
    };
}

const DECK = genPptxSlideSize(1920, 1080);
const UNITS = genPptxUnits(DECK, 1920, 1080);

function genModel(): PptxSlideModelType {
    return {
        width: 1920,
        height: 1080,
        background: {
            kind: 'picture',
            media: { fileName: 'image1.jpeg' },
            crop: { left: 0, top: 0.125, right: 0, bottom: 0.125 },
        },
        elements: [
            {
                kind: 'shape',
                name: 'text 1',
                box: { x: 51, y: 154, width: 1818, height: 894, rotation: 0 },
                geometry: { kind: 'rect' },
                fill: { hex: '008080', alpha: 0.545 },
                textBody: {
                    align: 'ctr',
                    lineSpacing: 141.75,
                    insets: { left: 10.5, top: 176, right: 10.5, bottom: 0 },
                    lines: [
                        {
                            runs: [genRun('line one & <two>')],
                            isNewParagraph: true,
                        },
                        { runs: [genRun('wrapped')], isNewParagraph: false },
                        {
                            runs: [
                                genRun('(DOXOLOGY)', {
                                    fontFamily: 'Times New Roman',
                                    lang: 'en-US',
                                }),
                            ],
                            isNewParagraph: true,
                        },
                    ],
                },
            },
            {
                kind: 'group',
                name: 'text 2',
                box: {
                    x: 99.5,
                    y: 141.5,
                    width: 1721,
                    height: 343,
                    rotation: 10,
                },
                children: [
                    {
                        kind: 'picture',
                        name: 'text 2 blur',
                        box: {
                            x: 99.5,
                            y: 141.5,
                            width: 1721,
                            height: 343,
                            rotation: 0,
                        },
                        geometry: { kind: 'roundRect', radius: 100 },
                        fill: null,
                        media: { fileName: 'image2.jpeg' },
                        crop: null,
                        opacity: 1,
                    },
                    {
                        kind: 'shape',
                        name: 'text 2',
                        box: {
                            x: 99.5,
                            y: 141.5,
                            width: 1721,
                            height: 343,
                            rotation: 0,
                        },
                        geometry: { kind: 'roundRect', radius: 100 },
                        fill: { hex: '000000', alpha: 0.48 },
                        textBody: {
                            align: 'ctr',
                            lineSpacing: 101.25,
                            insets: {
                                left: 7.5,
                                top: 130,
                                right: 7.5,
                                bottom: 0,
                            },
                            lines: [
                                {
                                    runs: [genRun('title', { fontSize: 75 })],
                                    isNewParagraph: true,
                                },
                            ],
                        },
                    },
                ],
            },
            {
                kind: 'picture',
                name: 'image 3',
                box: { x: 0, y: 366, width: 1920, height: 348, rotation: 0 },
                geometry: { kind: 'rect' },
                fill: { hex: 'FF00FF', alpha: 0.5 },
                // the background's picture used again
                media: { fileName: 'image1.jpeg' },
                crop: null,
                opacity: 0.5,
            },
        ],
        note: '',
        isHidden: true,
    };
}

describe('genPptxSlideSize / genPptxUnits', () => {
    test('a 1920x1080 slide is 20in x 11.25in at 9525 EMU a pixel', () => {
        expect(DECK).toEqual({
            emuPerPx: 9525,
            widthEmu: 18288000,
            heightEmu: 10287000,
        });
        expect(UNITS).toEqual({ emuPerPx: 9525, offsetX: 0, offsetY: 0 });
    });

    test('a slide past PowerPoint`s 56in limit is scaled down to fit it', () => {
        const deck = genPptxSlideSize(7680, 4320);
        expect(deck.widthEmu).toBe(51206400);
        expect(deck.heightEmu).toBe(28803600);
    });

    test('a slide of another shape is fitted into the deck, centered', () => {
        const units = genPptxUnits(DECK, 1080, 1080);
        expect(units.emuPerPx).toBe(9525);
        expect(units.offsetX).toBe((18288000 - 1080 * 9525) / 2);
        expect(units.offsetY).toBe(0);
    });
});

describe('genSlideXml', () => {
    function genSlide(model = genModel()) {
        const rels: PptxSlideRelsType = {
            mediaRelationshipMap: new Map(),
            notesSlideIndex: 1,
        };
        const xml = genSlideXml(model, UNITS, rels);
        return { xml, rels, document: parseXml(xml) };
    }

    test('writes a well-formed hidden slide', () => {
        const { xml } = genSlide();
        expect(xml).toContain('<p:sld ');
        expect(xml).toContain(' show="0"');
    });

    test('keeps every browser line break and paragraph', () => {
        const { xml, document } = genSlide();
        const [firstBody] = Array.from(
            document.getElementsByTagName('p:txBody'),
        );
        expect(firstBody.getElementsByTagName('a:p').length).toBe(2);
        expect(firstBody.getElementsByTagName('a:br').length).toBe(1);
        expect(xml).toContain('line one &amp; &lt;two&gt;');
        // 141.75px exact spacing: 106.31pt
        expect(xml).toContain('<a:spcPts val="10631"/>');
        // 105px text: 78.75pt
        expect(xml).toContain('sz="7875"');
        expect(xml).toContain('wrap="none"');
    });

    test('names one font for every script of a run', () => {
        const { document } = genSlide();
        const runList = Array.from(document.getElementsByTagName('a:rPr'));
        const timesRun = runList.find((run) => {
            return (
                run
                    .getElementsByTagName('a:latin')[0]
                    ?.getAttribute('typeface') === 'Times New Roman'
            );
        });
        expect(timesRun).toBeDefined();
        for (const tagName of ['a:ea', 'a:cs']) {
            expect(
                timesRun
                    ?.getElementsByTagName(tagName)[0]
                    ?.getAttribute('typeface'),
            ).toBe('Times New Roman');
        }
        expect(timesRun?.getAttribute('lang')).toBe('en-US');
    });

    test('writes insets and translucent fills in EMU and percent', () => {
        const { xml } = genSlide();
        expect(xml).toContain('lIns="100013"');
        expect(xml).toContain('tIns="1676400"');
        expect(xml).toContain('<a:alpha val="54500"/>');
    });

    test('draws a rounded box holding text with a full text rectangle', () => {
        const { document } = genSlide();
        const [group] = Array.from(document.getElementsByTagName('p:grpSp'));
        expect(group).toBeDefined();
        const shape = group.getElementsByTagName('p:sp')[0];
        // a preset rounded rectangle would inset the text by 29.3% of the
        // radius; the custom outline keeps the whole box for it
        expect(shape.getElementsByTagName('a:custGeom').length).toBe(1);
        expect(shape.getElementsByTagName('a:rect')[0].getAttribute('b')).toBe(
            'b',
        );
        // a picture keeps the preset, clipped to the same corners
        const picture = group.getElementsByTagName('p:pic')[0];
        const preset = picture.getElementsByTagName('a:prstGeom')[0];
        expect(preset.getAttribute('prst')).toBe('roundRect');
        expect(
            preset.getElementsByTagName('a:gd')[0].getAttribute('fmla'),
        ).toBe(`val ${Math.round((100 / 343) * 100000)}`);
    });

    test('turns a group about the item and keeps its children flat', () => {
        const { document } = genSlide();
        const group = document.getElementsByTagName('p:grpSp')[0];
        const groupXfrm = group
            .getElementsByTagName('p:grpSpPr')[0]
            .getElementsByTagName('a:xfrm')[0];
        expect(groupXfrm.getAttribute('rot')).toBe('600000');
        expect(
            groupXfrm.getElementsByTagName('a:chOff')[0].getAttribute('x'),
        ).toBe(groupXfrm.getElementsByTagName('a:off')[0].getAttribute('x'));
        const childXfrm = group
            .getElementsByTagName('p:sp')[0]
            .getElementsByTagName('a:xfrm')[0];
        expect(childXfrm.getAttribute('rot')).toBeNull();
    });

    test('shares one relationship per picture, background included', () => {
        const { xml, rels } = genSlide();
        expect(Array.from(rels.mediaRelationshipMap.entries())).toEqual([
            ['image1.jpeg', 'rId2'],
            ['image2.jpeg', 'rId3'],
        ]);
        expect(xml).toContain(
            '<a:blip r:embed="rId2"><a:alphaModFix amt="50000"/></a:blip>',
        );
        expect(xml).toContain('<a:srcRect t="12500" b="12500"/>');
        const relsXml = genSlideRelsXml(rels);
        parseXml(relsXml);
        expect(relsXml).toContain('Target="../slideLayouts/slideLayout1.xml"');
        expect(relsXml).toContain('Id="rId3" ');
        expect(relsXml).toContain(
            'Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"',
        );
    });

    test('paints a slide with nothing behind it black, as a screen does', () => {
        const { xml } = genSlide({ ...genModel(), background: null });
        expect(xml).toContain(
            '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/>',
        );
    });
});

describe('package parts', () => {
    const info: PptxDeckInfoType = {
        title: 'Doxology & Praise',
        slideCount: 3,
        notesSlideIndexes: [2],
        hiddenSlideCount: 1,
        widthEmu: DECK.widthEmu,
        heightEmu: DECK.heightEmu,
        createdAt: new Date('2026-09-21T10:00:00.000Z'),
        applicationName: 'Open Worship app',
    };

    test('every part is well-formed XML', () => {
        for (const xml of [
            genContentTypesXml(info),
            genRootRelsXml(),
            genCorePropsXml(info),
            genAppPropsXml(info),
            genPresentationXml(info),
            genPresentationRelsXml(info),
            genSlideMasterXml(),
            genSlideMasterRelsXml(),
            genSlideLayoutXml(),
            genSlideLayoutRelsXml(),
            genThemeXml('Open Worship'),
            genPresPropsXml(),
            genViewPropsXml(),
            genTableStylesXml(),
            genNotesMasterXml(),
            genNotesMasterRelsXml(),
            genNotesSlideXml('first line\nsecond & third'),
            genNotesSlideRelsXml(2),
        ]) {
            parseXml(xml);
        }
    });

    test('the presentation and its relationships agree on every id', () => {
        const presentation = parseXml(genPresentationXml(info));
        const rels = parseXml(genPresentationRelsXml(info));
        const targetById = new Map(
            Array.from(rels.getElementsByTagName('Relationship')).map(
                (relationship) => {
                    return [
                        relationship.getAttribute('Id'),
                        relationship.getAttribute('Target'),
                    ];
                },
            ),
        );
        const slideTargets = Array.from(
            presentation.getElementsByTagName('p:sldId'),
        ).map((slideId) => {
            return targetById.get(slideId.getAttribute('r:id'));
        });
        expect(slideTargets).toEqual([
            'slides/slide1.xml',
            'slides/slide2.xml',
            'slides/slide3.xml',
        ]);
        const notesMasterId = presentation
            .getElementsByTagName('p:notesMasterId')[0]
            .getAttribute('r:id');
        expect(targetById.get(notesMasterId)).toBe(
            'notesMasters/notesMaster1.xml',
        );
        expect(
            presentation.getElementsByTagName('p:sldSz')[0].getAttribute('cx'),
        ).toBe('18288000');
        // every id is used once
        expect(new Set(targetById.keys()).size).toBe(
            rels.getElementsByTagName('Relationship').length,
        );
    });

    test('declares every slide and speaker note it writes', () => {
        const xml = genContentTypesXml(info);
        for (const partName of [
            '/ppt/slides/slide1.xml',
            '/ppt/slides/slide3.xml',
            '/ppt/notesSlides/notesSlide2.xml',
            '/ppt/notesMasters/notesMaster1.xml',
            '/ppt/theme/theme2.xml',
        ]) {
            expect(xml).toContain(`PartName="${partName}"`);
        }
        expect(xml).not.toContain('notesSlide1.xml');
        expect(xml).toContain('Extension="jpeg" ContentType="image/jpeg"');
        expect(
            genContentTypesXml({ ...info, notesSlideIndexes: [] }),
        ).not.toContain('notesMaster');
    });

    test('a document with no slides is an empty presentation', () => {
        const xml = genPresentationXml({
            ...info,
            slideCount: 0,
            notesSlideIndexes: [],
        });
        parseXml(xml);
        expect(xml).not.toContain('sldIdLst');
        expect(xml).not.toContain('notesMasterIdLst');
    });

    test('writes speaker notes one paragraph per line', () => {
        const document = parseXml(genNotesSlideXml('first line\n\nthird'));
        const body = document.getElementsByTagName('p:txBody')[0];
        expect(body.getElementsByTagName('a:p').length).toBe(3);
        expect(body.textContent).toBe('first linethird');
    });
});

describe('escapeXmlText / splitPptxParagraphs', () => {
    test('drops what XML 1.0 cannot hold', () => {
        expect(escapeXmlText('a\u0001b\u000bc\ufffed')).toBe('abcd');
        expect(escapeXmlText('tab\tand\nnewline')).toBe('tab\tand\nnewline');
    });

    test('opens a paragraph at every hard break', () => {
        const run = genRun('x');
        const paragraphList = splitPptxParagraphs([
            { runs: [run], isNewParagraph: false },
            { runs: [run], isNewParagraph: false },
            { runs: [], isNewParagraph: true },
            { runs: [run], isNewParagraph: true },
        ]);
        expect(
            paragraphList.map((lines) => {
                return lines.length;
            }),
        ).toEqual([2, 1, 1]);
    });
});
