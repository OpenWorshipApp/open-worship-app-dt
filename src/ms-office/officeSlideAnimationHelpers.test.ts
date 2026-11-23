import { describe, expect, test } from 'vitest';

import {
    OFFICE_ANIMATION_LIST,
    type OfficeAnimationEffectType,
    type OfficeAnimationStartType,
    readSlideAnimations,
    setShapeAnimationXml,
    toOfficeAnimation,
} from './officeSlideAnimationHelpers';
import { listChildElements } from './officeXmlEditHelpers';

const TITLE =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr>' +
    '<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>' +
    '<a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Amazing Grace</a:t></a:r>' +
    '</a:p></p:txBody></p:sp>';
// four paragraphs, the third with no words
const VERSE =
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content Placeholder 2"/>' +
    '<p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/>' +
    '<a:p><a:r><a:t>Amazing grace</a:t></a:r></a:p>' +
    '<a:p><a:r><a:t>how sweet the sound</a:t></a:r></a:p>' +
    '<a:p><a:endParaRPr lang="en-US"/></a:p>' +
    '<a:p><a:r><a:t>that saved</a:t></a:r><a:br/><a:r><a:t>a wretch</a:t>' +
    '</a:r></a:p></p:txBody></p:sp>';
const PICTURE =
    '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 3"/><p:cNvPicPr/>' +
    '<p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>' +
    '</p:blipFill><p:spPr/></p:pic>';
const GROUP =
    '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Group 4"/><p:cNvGrpSpPr/>' +
    '<p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr>' +
    '<p:cNvPr id="6" name="Oval 5"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr/></p:sp></p:grpSp>';
const RECTANGLE =
    '<p:sp><p:nvSpPr><p:cNvPr id="7" name="Rectangle 6"/><p:cNvSpPr/>' +
    '<p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
    '<a:p><a:endParaRPr/></a:p></p:txBody></p:sp>';

const SLIDE_EXT = '<p:extLst><p:ext uri="{slide}"/></p:extLst>';

// `after`: what follows the colour map; the cSld has an extLst of its own
function genSlide(after = '', boxes = '') {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<p:sld xmlns:a="a" xmlns:r="r" xmlns:p="p"><p:cSld><p:spTree>' +
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
        `</p:nvGrpSpPr><p:grpSpPr/>${TITLE}${VERSE}${PICTURE}${GROUP}` +
        `${boxes}</p:spTree><p:extLst><p:ext uri="{cSld}"/></p:extLst>` +
        '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
        `${after}</p:sld>`
    );
}

const SLIDE_COND =
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/>' +
    '</p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond ' +
    'evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>' +
    '</p:nextCondLst>';

// what PowerPoint writes for the title fading in on a click
const FADE_TIMING =
    '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" ' +
    'restart="never" nodeType="tmRoot"><p:childTnLst><p:seq ' +
    'concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" ' +
    'nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold">' +
    '<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
    '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/>' +
    '</p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="10" ' +
    'presetClass="entr" presetSubtype="0" fill="hold" grpId="0" ' +
    'nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst>' +
    '<p:childTnLst><p:set><p:cBhvr><p:cTn id="6" dur="1" fill="hold">' +
    '<p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl>' +
    '<p:spTgt spid="2"/></p:tgtEl><p:attrNameLst><p:attrName>' +
    'style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to>' +
    '<p:strVal val="visible"/></p:to></p:set><p:animEffect ' +
    'transition="in" filter="fade"><p:cBhvr><p:cTn id="7" dur="500"/>' +
    '<p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:animEffect>' +
    '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>' +
    '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>' +
    `${SLIDE_COND}</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>` +
    '<p:bldLst><p:bldP spid="2" grpId="0"/></p:bldLst></p:timing>';

// what PowerPoint writes for a transition only newer readers know
const WRAPPED_TRANSITION =
    '<mc:AlternateContent xmlns:mc="mc"><mc:Choice Requires="p14">' +
    '<p:transition spd="slow" p14:dur="2000"><p14:vortex/></p:transition>' +
    '</mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/>' +
    '</p:transition></mc:Fallback></mc:AlternateContent>';

function must(xml: string | null) {
    if (xml === null) {
        throw new Error('no slide');
    }
    return xml;
}

function genAnimation(
    effect: OfficeAnimationEffectType,
    start: OfficeAnimationStartType = 'click',
    byLine = false,
    seconds = 0.5,
) {
    return { effect, start, byLine, seconds };
}

// `p:sld`'s own children, in order
function listSlideChildNames(xml: string) {
    const open = /<p:sld\b[^>]*>/.exec(xml);
    if (open === null) {
        return [];
    }
    return listChildElements(
        xml,
        open.index + open[0].length,
        xml.lastIndexOf('</p:sld>'),
    ).map((child) => {
        return child.name;
    });
}

function readTiming(xml: string) {
    return /<p:timing>[\s\S]*<\/p:timing>/.exec(xml)?.[0] ?? '';
}

function readIds(xml: string) {
    return [...xml.matchAll(/<p:cTn\b[^>]*?\sid="([^"]*)"/g)].map((match) => {
        return match[1];
    });
}

function expectNumbered(xml: string) {
    const ids = readIds(xml);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(
        ids.map((_id, index) => {
            return String(index + 1);
        }),
    );
}

// each effect as `presetID/subtype nodeType spid[:paragraph] grpId`
function listEffects(xml: string) {
    return [
        ...xml.matchAll(
            /<p:cTn [^>]*?presetID="(\d+)"[^>]*?presetSubtype="(\d+)"[^>]*?grpId="(\d+)" nodeType="(\w+)">[\s\S]*?<p:spTgt spid="(\d+)"(?:><p:txEl><p:pRg st="(\d+)")?/g,
        ),
    ].map((match) => {
        const paragraph = match[6] === undefined ? '' : `:${match[6]}`;
        return `${match[1]}/${match[2]} ${match[4]} ${match[5]}${paragraph} g${match[3]}`;
    });
}

// each click group and step by when it starts, in order
function listStarts(xml: string) {
    return [
        ...xml.matchAll(
            /<p:par><p:cTn id="\d+" fill="hold"><p:stCondLst><p:cond delay="(\w+)"\/>(<p:cond evt="onBegin")?/g,
        ),
    ].map((match) => {
        return match[1] + (match[2] === undefined ? '' : '+begin');
    });
}

function readBuildList(xml: string) {
    return /<p:bldLst>([\s\S]*?)<\/p:bldLst>/.exec(xml)?.[1] ?? null;
}

describe('naming an animation (2026-11-20)', () => {
    test('as a model says it', () => {
        expect(toOfficeAnimation('Fade In')).toBe('fade');
        expect(toOfficeAnimation('fly-in')).toBe('fly');
        expect(toOfficeAnimation(' Wipe in ')).toBe('wipe');
        expect(toOfficeAnimation('zoom in')).toBe('zoom');
        expect(toOfficeAnimation('appear')).toBe('appear');
        expect(toOfficeAnimation('None')).toBe('none');
        expect(toOfficeAnimation('off')).toBe('none');
        expect(toOfficeAnimation('spin')).toBe(null);
        expect(toOfficeAnimation(2)).toBe(null);
        expect(OFFICE_ANIMATION_LIST).toEqual([
            'appear',
            'fade',
            'fly',
            'wipe',
            'zoom',
        ]);
    });
});

describe('putting an animation on (2026-11-20)', () => {
    test('as PowerPoint writes it: after the transition, before the extension list', () => {
        const slide = genSlide(
            '<p:transition spd="med"><p:fade/></p:transition>' + SLIDE_EXT,
        );
        const xml = must(
            setShapeAnimationXml(slide, '2', genAnimation('fade', 'click')),
        );
        expect(readTiming(xml)).toBe(FADE_TIMING);
        expect(listSlideChildNames(xml)).toEqual([
            'p:cSld',
            'p:clrMapOvr',
            'p:transition',
            'p:timing',
            'p:extLst',
        ]);
        // the cSld's own extension list is not the slide's
        expect(xml.indexOf('<p:timing>')).toBeGreaterThan(
            xml.indexOf('</p:cSld>'),
        );
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
        ]);
    });

    test("after Office's wrapped transition", () => {
        const xml = must(
            setShapeAnimationXml(
                genSlide(WRAPPED_TRANSITION + SLIDE_EXT),
                '4',
                genAnimation('appear'),
            ),
        );
        expect(listSlideChildNames(xml)).toEqual([
            'p:cSld',
            'p:clrMapOvr',
            'mc:AlternateContent',
            'p:timing',
            'p:extLst',
        ]);
        // a picture: no build entry, no build list
        expect(readBuildList(xml)).toBe(null);
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '4', effect: 'appear', byLine: false },
        ]);
    });

    test('each effect as its preset, its seconds in ms', () => {
        const presetMap: Record<OfficeAnimationEffectType, string[]> = {
            appear: ['1/0', 'style.visibility'],
            fade: ['10/0', 'filter="fade"><p:cBhvr><p:cTn id="7" dur="1250"/>'],
            fly: [
                '2/4',
                '<p:attrName>ppt_y</p:attrName>',
                '<p:strVal val="1+#ppt_h/2"/>',
                '<p:cTn id="8" dur="1250" fill="hold"/>',
            ],
            wipe: ['22/4', 'filter="wipe(down)"', 'dur="1250"'],
            zoom: [
                '53/16',
                '<p:attrName>ppt_w</p:attrName>',
                '<p:fltVal val="0"/>',
                'filter="fade"',
                'dur="1250"',
            ],
        };
        for (const effect of OFFICE_ANIMATION_LIST) {
            const xml = must(
                setShapeAnimationXml(
                    genSlide(),
                    '2',
                    genAnimation(effect, 'click', false, 1.25),
                ),
            );
            const [preset, ...parts] = presetMap[effect];
            expect(listEffects(xml)).toEqual([`${preset} clickEffect 2 g0`]);
            for (const part of parts) {
                expect(xml).toContain(part);
            }
            expectNumbered(xml);
            expect(readSlideAnimations(xml)).toEqual([
                { shapeId: '2', effect, byLine: false },
            ]);
        }
        // appear has no duration; none given is half a second, at most 59
        const appear = must(
            setShapeAnimationXml(genSlide(), '2', genAnimation('appear')),
        );
        expect(appear).not.toContain('dur="500"');
        expect(
            setShapeAnimationXml(
                genSlide(),
                '2',
                genAnimation('fade', 'click', false, Number.NaN),
            ),
        ).toContain('<p:cTn id="7" dur="500"/>');
        expect(
            setShapeAnimationXml(
                genSlide(),
                '2',
                genAnimation('fade', 'click', false, 100),
            ),
        ).toContain('<p:cTn id="7" dur="59000"/>');
    });

    test('line by line on clicks: a click for each line with words', () => {
        const xml = must(
            setShapeAnimationXml(
                genSlide(),
                '3',
                genAnimation('fade', 'click', true),
            ),
        );
        // the third paragraph has no words: skipped, the fourth is 3
        expect(listEffects(xml)).toEqual([
            '10/0 clickEffect 3:0 g0',
            '10/0 clickEffect 3:1 g0',
            '10/0 clickEffect 3:3 g0',
        ]);
        expect(xml).toContain(
            '<p:spTgt spid="3"><p:txEl><p:pRg st="3" end="3"/></p:txEl>' +
                '</p:spTgt>',
        );
        expect(listStarts(xml)).toEqual([
            'indefinite',
            '0',
            'indefinite',
            '0',
            'indefinite',
            '0',
        ]);
        expect(readBuildList(xml)).toBe(
            '<p:bldP spid="3" grpId="0" build="p"/>',
        );
        expectNumbered(xml);
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '3', effect: 'fade', byLine: true },
        ]);
    });

    test('line by line after the previous: with the slide, each after the one before', () => {
        const xml = must(
            setShapeAnimationXml(
                genSlide(),
                '3',
                genAnimation('wipe', 'after', true),
            ),
        );
        expect(listEffects(xml)).toEqual([
            '22/4 afterEffect 3:0 g0',
            '22/4 afterEffect 3:1 g0',
            '22/4 afterEffect 3:3 g0',
        ]);
        // one group, begun with the main sequence (id 2), a step a line
        expect(listStarts(xml)).toEqual([
            'indefinite+begin',
            '0',
            '500',
            '1000',
        ]);
        expect(xml).toContain(
            '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>',
        );
        expect(xml).toContain(
            '<p:cTn id="2" dur="indefinite" nodeType="mainSeq">',
        );
    });

    test('with the previous joins its step; after the previous waits for its longest', () => {
        let xml = must(
            setShapeAnimationXml(
                genSlide(),
                '2',
                genAnimation('fade', 'click', false, 1),
            ),
        );
        xml = must(
            setShapeAnimationXml(xml, '4', genAnimation('zoom', 'with')),
        );
        xml = must(
            setShapeAnimationXml(xml, '3', genAnimation('fly', 'after')),
        );
        expect(listEffects(xml)).toEqual([
            '10/0 clickEffect 2 g0',
            '53/16 withEffect 4 g0',
            '2/4 afterEffect 3 g0',
        ]);
        expect(listStarts(xml)).toEqual(['indefinite', '0', '1000']);
        // the picture has no build entry; the verse comes in whole
        expect(readBuildList(xml)).toBe(
            '<p:bldP spid="2" grpId="0"/><p:bldP spid="3" grpId="0"/>',
        );
        expectNumbered(xml);
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
            { shapeId: '4', effect: 'zoom', byLine: false },
            { shapeId: '3', effect: 'fly', byLine: false },
        ]);
    });

    test('a shape with no words animates its background', () => {
        const xml = must(
            setShapeAnimationXml(
                genSlide('', RECTANGLE),
                '7',
                genAnimation('fade', 'click', true),
            ),
        );
        expect(listEffects(xml)).toEqual(['10/0 clickEffect 7 g0']);
        expect(readBuildList(xml)).toBe(
            '<p:bldP spid="7" grpId="0" animBg="1"/>',
        );
    });
});

describe('changing and taking an animation off (2026-11-20)', () => {
    test("replaced: the old out, the new at the end, the other box's kept", () => {
        let xml = must(
            setShapeAnimationXml(genSlide(), '2', genAnimation('fade')),
        );
        xml = must(
            setShapeAnimationXml(xml, '3', genAnimation('fly', 'click', true)),
        );
        xml = must(
            setShapeAnimationXml(xml, '2', genAnimation('zoom', 'after')),
        );
        expect(listEffects(xml)).toEqual([
            '2/4 clickEffect 3:0 g0',
            '2/4 clickEffect 3:1 g0',
            '2/4 clickEffect 3:3 g0',
            '53/16 afterEffect 2 g0',
        ]);
        expect(listStarts(xml)).toEqual([
            'indefinite',
            '0',
            'indefinite',
            '0',
            'indefinite',
            '0',
            '500',
        ]);
        expect(xml.split('<p:timing>').length).toBe(2);
        expect(readBuildList(xml)).toBe(
            '<p:bldP spid="3" grpId="0" build="p"/><p:bldP spid="2" grpId="0"/>',
        );
        expectNumbered(xml);
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '3', effect: 'fly', byLine: true },
            { shapeId: '2', effect: 'zoom', byLine: false },
        ]);
    });

    test('taken off: the next keeps its click, the steps after move up, the last takes the timing', () => {
        const slide = genSlide(SLIDE_EXT);
        let xml = must(setShapeAnimationXml(slide, '2', genAnimation('fade')));
        xml = must(
            setShapeAnimationXml(
                xml,
                '3',
                genAnimation('wipe', 'with', false, 1),
            ),
        );
        xml = must(
            setShapeAnimationXml(xml, '4', genAnimation('appear', 'after')),
        );
        expect(listStarts(xml)).toEqual(['indefinite', '0', '1000']);
        // the title out: the verse now starts that click
        xml = must(setShapeAnimationXml(xml, '2', null));
        expect(listEffects(xml)).toEqual([
            '22/4 clickEffect 3 g0',
            '1/0 afterEffect 4 g0',
        ]);
        expect(listStarts(xml)).toEqual(['indefinite', '0', '1000']);
        expect(readBuildList(xml)).toBe('<p:bldP spid="3" grpId="0"/>');
        expectNumbered(xml);
        // the verse out: its step goes, the picture's moves up to the click
        xml = must(setShapeAnimationXml(xml, '3', null));
        expect(listEffects(xml)).toEqual(['1/0 clickEffect 4 g0']);
        expect(listStarts(xml)).toEqual(['indefinite', '0']);
        expect(readBuildList(xml)).toBe(null);
        // the last out: no timing left, the slide as it was
        xml = must(setShapeAnimationXml(xml, '4', null));
        expect(xml).toBe(slide);
        // nothing to take off: the slide untouched
        expect(setShapeAnimationXml(slide, '2', null)).toBe(slide);
    });

    test('a step made shorter moves the next one up', () => {
        let xml = must(
            setShapeAnimationXml(genSlide(), '2', genAnimation('fade')),
        );
        xml = must(
            setShapeAnimationXml(
                xml,
                '3',
                genAnimation('wipe', 'with', false, 2),
            ),
        );
        xml = must(
            setShapeAnimationXml(xml, '4', genAnimation('appear', 'after')),
        );
        expect(listStarts(xml)).toEqual(['indefinite', '0', '2000']);
        xml = must(setShapeAnimationXml(xml, '3', null));
        expect(listEffects(xml)).toEqual([
            '10/0 clickEffect 2 g0',
            '1/0 afterEffect 4 g0',
        ]);
        expect(listStarts(xml)).toEqual(['indefinite', '0', '500']);
    });

    test("a slide's own timing changed in place: a trigger's sequence kept, references renumbered", () => {
        const appear = (id: number, spid: number, nodeType: string) => {
            return (
                `<p:par><p:cTn id="${id}" presetID="1" presetClass="entr" ` +
                `presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}">` +
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
                `<p:set><p:cBhvr><p:cTn id="${id + 1}" dur="1" fill="hold">` +
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>' +
                `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst>` +
                '<p:attrName>style.visibility</p:attrName></p:attrNameLst>' +
                '</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>' +
                '</p:childTnLst></p:cTn></p:par>'
            );
        };
        // the title appears with the slide; a click on the picture brings
        // the verse in; ids with a gap, as another writer leaves them
        const timing =
            '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" ' +
            'restart="never" nodeType="tmRoot"><p:childTnLst><p:seq ' +
            'concurrent="1" nextAc="seek"><p:cTn id="5" dur="indefinite" ' +
            'nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="6" ' +
            'fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond ' +
            'evt="onBegin" delay="0"><p:tn val="5"/></p:cond></p:stCondLst>' +
            '<p:childTnLst><p:par><p:cTn id="7" fill="hold"><p:stCondLst>' +
            '<p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
            appear(8, 2, 'withEffect') +
            '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>' +
            `</p:childTnLst></p:cTn>${SLIDE_COND}</p:seq><p:seq ` +
            'concurrent="1" nextAc="seek"><p:cTn id="20" ' +
            'restart="whenNotActive" fill="hold" evtFilter="cancelBubble" ' +
            'nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" ' +
            'delay="0"><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cond>' +
            '</p:stCondLst><p:endSync evt="end" delay="0"><p:rtn val="all"/>' +
            '</p:endSync><p:childTnLst><p:par><p:cTn id="21" fill="hold">' +
            '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
            '<p:par><p:cTn id="22" fill="hold"><p:stCondLst><p:cond ' +
            'delay="0"/></p:stCondLst><p:childTnLst>' +
            appear(23, 3, 'clickEffect') +
            '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>' +
            '</p:childTnLst></p:cTn><p:nextCondLst><p:cond evt="onNext" ' +
            'delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>' +
            '</p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par>' +
            '</p:tnLst><p:bldLst><p:bldP spid="2" grpId="0"/><p:bldP ' +
            'spid="3" grpId="0"/></p:bldLst></p:timing>';
        const slide = genSlide(timing + SLIDE_EXT);
        expect(readSlideAnimations(slide)).toEqual([
            { shapeId: '2', effect: 'appear', byLine: false },
        ]);
        let xml = must(
            setShapeAnimationXml(
                slide,
                '3',
                genAnimation('fade', 'click', true),
            ),
        );
        expect(xml.split('<p:timing>').length).toBe(2);
        expect(listSlideChildNames(xml)).toEqual([
            'p:cSld',
            'p:clrMapOvr',
            'p:timing',
            'p:extLst',
        ]);
        expectNumbered(xml);
        // the main sequence renumbered 2, its group's reference with it
        expect(xml).toContain('<p:tn val="2"/>');
        expect(xml).not.toContain('<p:tn val="5"/>');
        // the verse's build group 0 is the trigger's: the new one is 1
        expect(listEffects(xml)).toEqual([
            '1/0 withEffect 2 g0',
            '10/0 clickEffect 3:0 g1',
            '10/0 clickEffect 3:1 g1',
            '10/0 clickEffect 3:3 g1',
            '1/0 clickEffect 3 g0',
        ]);
        expect(readBuildList(xml)).toBe(
            '<p:bldP spid="2" grpId="0"/><p:bldP spid="3" grpId="0"/>' +
                '<p:bldP spid="3" grpId="1" build="p"/>',
        );
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '2', effect: 'appear', byLine: false },
            { shapeId: '3', effect: 'fade', byLine: true },
        ]);
        // both off: the trigger's sequence keeps the timing, the main
        // sequence an empty shell
        xml = must(setShapeAnimationXml(xml, '2', null));
        xml = must(setShapeAnimationXml(xml, '3', null));
        expect(readSlideAnimations(xml)).toEqual([]);
        expect(xml).toContain(
            '<p:cTn id="2" dur="indefinite" nodeType="mainSeq"/>',
        );
        expect(xml).toContain('nodeType="interactiveSeq"');
        expect(listEffects(xml)).toEqual(['1/0 clickEffect 3 g0']);
        expect(readBuildList(xml)).toBe('<p:bldP spid="3" grpId="0"/>');
        expectNumbered(xml);
    });

    test("Office's wrapped timing: both copies changed, the fallback read, the wrapper gone with the last", () => {
        const wrapped =
            '<mc:AlternateContent xmlns:mc="mc"><mc:Choice xmlns:p14="p14" ' +
            'Requires="p14">' +
            FADE_TIMING.replace(
                'nodeType="tmRoot"',
                'nodeType="tmRoot" p14:mark="1"',
            ) +
            `</mc:Choice><mc:Fallback>${FADE_TIMING}</mc:Fallback>` +
            '</mc:AlternateContent>';
        const bare = genSlide(WRAPPED_TRANSITION + SLIDE_EXT);
        const slide = genSlide(WRAPPED_TRANSITION + wrapped + SLIDE_EXT);
        let xml = must(
            setShapeAnimationXml(slide, '3', genAnimation('appear')),
        );
        expect(xml.split('<p:timing>').length).toBe(3);
        expect(xml.split('presetID="1"').length).toBe(3);
        expect(xml).toContain('p14:mark="1"');
        expect(listSlideChildNames(xml)).toEqual([
            'p:cSld',
            'p:clrMapOvr',
            'mc:AlternateContent',
            'mc:AlternateContent',
            'p:extLst',
        ]);
        expect(readSlideAnimations(xml)).toEqual([
            { shapeId: '2', effect: 'fade', byLine: false },
            { shapeId: '3', effect: 'appear', byLine: false },
        ]);
        xml = must(setShapeAnimationXml(xml, '2', null));
        expect(xml.split('<p:timing>').length).toBe(3);
        xml = must(setShapeAnimationXml(xml, '3', null));
        expect(xml).toBe(bare);
    });

    test('null for a box that is not there, or one inside a group', () => {
        const slide = genSlide();
        expect(setShapeAnimationXml(slide, '9', genAnimation('fade'))).toBe(
            null,
        );
        expect(setShapeAnimationXml(slide, '9', null)).toBe(null);
        expect(setShapeAnimationXml(slide, '6', genAnimation('fade'))).toBe(
            null,
        );
        expect(setShapeAnimationXml(slide, 'x', genAnimation('fade'))).toBe(
            null,
        );
        expect(
            setShapeAnimationXml(
                '<p:sld><p:cSld/></p:sld>',
                '2',
                genAnimation('fade'),
            ),
        ).toBe(null);
        expect(readSlideAnimations(slide)).toEqual([]);
        // the group itself comes in whole
        expect(
            listEffects(
                must(setShapeAnimationXml(slide, '5', genAnimation('fade'))),
            ),
        ).toEqual(['10/0 clickEffect 5 g0']);
    });
});
