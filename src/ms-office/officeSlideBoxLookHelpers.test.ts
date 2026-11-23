import { describe, expect, test } from 'vitest';

import {
    applyBoxLookXml,
    describeOfficeBoxLook,
    moveSlideBoxXml,
    readOfficeBoxLook,
    setBoxRotationXml,
} from './officeSlideBoxLookHelpers';

function genBox(id: number, name: string) {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/></p:nvSpPr>` +
        '<p:spPr/><p:txBody><a:bodyPr/><a:p/></p:txBody></p:sp>'
    );
}

// three boxes, and the tree's own settings before and after them
const TREE =
    '<p:sld><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>' +
    genBox(2, 'A') +
    genBox(3, 'B') +
    genBox(4, 'C') +
    '<p:extLst><p:ext uri="{t}"/></p:extLst></p:spTree></p:cSld></p:sld>';

function findBox(xml: string, name: string) {
    const start = xml.indexOf(`<p:sp><p:nvSpPr><p:cNvPr id="`, 0);
    const named = xml.indexOf(`name="${name}"`);
    const boxStart = xml.lastIndexOf('<p:sp>', named);
    expect(start).toBeGreaterThanOrEqual(0);
    return {
        start: boxStart,
        end: xml.indexOf('</p:sp>', named) + '</p:sp>'.length,
    };
}

function readOrder(xml: string) {
    return [...xml.matchAll(/name="(\w)"/g)].map((matched) => {
        return matched[1];
    });
}

describe('a box put in front of or behind the others', () => {
    test.each([
        ['A', 'front', ['B', 'C', 'A']],
        ['C', 'back', ['C', 'A', 'B']],
        ['A', 'forward', ['B', 'A', 'C']],
        ['C', 'backward', ['A', 'C', 'B']],
        ['B', 'front', ['A', 'C', 'B']],
        ['B', 'back', ['B', 'A', 'C']],
    ] as const)('%s to the %s', (name, order, expected) => {
        const out = moveSlideBoxXml(TREE, findBox(TREE, name), order);
        expect(out?.isMoved).toBe(true);
        expect(readOrder(out?.xml as string)).toEqual(expected);
        // the tree's own settings stay where they were
        expect(out?.xml).toMatch(
            /<p:spTree><p:nvGrpSpPr\/><p:grpSpPr\/><p:sp>/,
        );
        expect(out?.xml).toMatch(
            /<\/p:sp><p:extLst><p:ext uri="\{t\}"\/><\/p:extLst><\/p:spTree>/,
        );
        expect(out?.xml.length).toBe(TREE.length);
    });

    test('already there: nothing moved; not in the tree: null', () => {
        expect(moveSlideBoxXml(TREE, findBox(TREE, 'C'), 'front')).toEqual({
            xml: TREE,
            isMoved: false,
        });
        expect(moveSlideBoxXml(TREE, findBox(TREE, 'A'), 'backward')).toEqual({
            xml: TREE,
            isMoved: false,
        });
        expect(moveSlideBoxXml(TREE, { start: 1, end: 9 }, 'front')).toBe(null);
        expect(moveSlideBoxXml('<p:sld/>', { start: 0, end: 8 }, 'front')).toBe(
            null,
        );
    });
});

describe("a box's look read from a change", () => {
    test('colours, numbers with their marks, words for each', () => {
        expect(
            readOfficeBoxLook({
                fill: 'Navy',
                outline: 'none',
                transparency: '35%',
                brightness: 'lighter',
                rotate: '-45°',
                valign: 'center',
                order: 'Bring to Front',
            }),
        ).toEqual({
            look: {
                fill: '000080',
                outline: null,
                transparency: 35,
                brightness: 30,
                rotate: 315,
                valign: 'middle',
                order: 'front',
            },
        });
        expect(readOfficeBoxLook({ rotate: 360 })).toEqual({
            look: { rotate: 0 },
        });
        expect(readOfficeBoxLook({ color: 'red' })).toEqual({ look: null });
    });

    test.each([
        [{ fill: 'blurple' }, '`fill` is a colour'],
        [{ outline: 12 }, '`outline` is a colour'],
        [{ transparency: 120 }, '`transparency` is how see-through'],
        [{ brightness: 'very' }, "`brightness` is a picture's"],
        [{ rotate: 'left' }, '`rotate` is the turn in degrees'],
        [{ valign: 'side' }, '`valign` is where the words sit'],
        [{ order: 'sideways' }, '`order` puts a box in front'],
    ])('refused: %o', (change, words) => {
        expect(readOfficeBoxLook(change)).toEqual({
            reason: expect.stringContaining(words),
        });
    });

    test('said back in words', () => {
        expect(
            describeOfficeBoxLook({
                fill: null,
                transparency: 0,
                outline: '000080',
                brightness: 0,
                rotate: 0,
                order: 'backward',
            }),
        ).toBe(
            'no fill, solid, outlined navy (#000080), its own brightness, ' +
                'straight, sent one back',
        );
    });
});

describe("a box's own look written", () => {
    test("an outline's colour changed, its own width and dash kept", () => {
        const box =
            '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:ln w="38100">' +
            '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>' +
            '<a:prstDash val="dash"/></a:ln></p:spPr><p:txBody><a:bodyPr/>' +
            '</p:txBody></p:sp>';
        expect(applyBoxLookXml(box, { outline: 'FF0000' }, 'text')).toEqual({
            xml:
                '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:ln w="38100">' +
                '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>' +
                '<a:prstDash val="dash"/></a:ln></p:spPr><p:txBody>' +
                '<a:bodyPr/></p:txBody></p:sp>',
        });
    });

    test("a theme colour's fill made see-through, its colour kept", () => {
        const box =
            '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:solidFill>' +
            '<a:schemeClr val="tx1"><a:lumMod val="75000"/></a:schemeClr>' +
            '</a:solidFill></p:spPr></p:sp>';
        expect(applyBoxLookXml(box, { transparency: 25 }, 'shape')).toEqual({
            xml:
                '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:solidFill>' +
                '<a:schemeClr val="tx1"><a:lumMod val="75000"/><a:alpha ' +
                'val="75000"/></a:schemeClr></a:solidFill></p:spPr></p:sp>',
        });
    });

    test("a picture's contrast kept when its brightness changes", () => {
        const picture =
            '<p:pic><p:blipFill><a:blip r:embed="rId2"><a:lum ' +
            'bright="20000" contrast="10000"/></a:blip></p:blipFill>' +
            '<p:spPr/></p:pic>';
        expect(applyBoxLookXml(picture, { brightness: 0 }, 'picture')).toEqual({
            xml:
                '<p:pic><p:blipFill><a:blip r:embed="rId2"><a:lum ' +
                'contrast="10000"/></a:blip></p:blipFill><p:spPr/></p:pic>',
        });
    });

    test('a group turned by its own place; a table refused', () => {
        const group =
            '<p:grpSp><p:nvGrpSpPr/><p:grpSpPr><a:xfrm><a:off x="0" ' +
            'y="0"/></a:xfrm></p:grpSpPr><p:sp><p:spPr><a:xfrm/></p:spPr>' +
            '</p:sp></p:grpSp>';
        expect(applyBoxLookXml(group, { rotate: 12.5 }, 'group')).toEqual({
            xml: group.replace('<a:xfrm>', '<a:xfrm rot="750000">'),
        });
        expect(
            applyBoxLookXml('<p:graphicFrame/>', { fill: 'FF0000' }, 'table'),
        ).toEqual({
            reason: "a table's cells are coloured with `tableLook`.",
        });
        expect(
            applyBoxLookXml('<p:graphicFrame/>', { rotate: 5 }, 'chart'),
        ).toEqual({
            reason: 'it is a chart: PowerPoint does not turn one.',
        });
    });

    test('turned straight again; no place of its own: null', () => {
        expect(
            setBoxRotationXml(
                '<p:sp><a:xfrm rot="900000" flipH="1"/></p:sp>',
                0,
            ),
        ).toBe('<p:sp><a:xfrm flipH="1"/></p:sp>');
        expect(setBoxRotationXml('<p:sp><p:spPr/></p:sp>', 30)).toBe(null);
    });
});
