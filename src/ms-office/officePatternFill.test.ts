import { describe, expect, test } from 'vitest';

import {
    applyBoxLookXml,
    readOfficeBoxLook,
} from './officeSlideBoxLookHelpers';
import {
    genOfficeFillXml,
    setSlideBackgroundXml,
    toOfficeFill,
    toOfficeFillWords,
    toOfficePattern,
} from './officeXmlLookHelpers';

// A pattern fill said in plain words (2026-11-21, the goal _chatbot can
// change do everything on a given pptx_: the one fill still refused).
describe('a pattern', () => {
    test('read from its colours and its kind', () => {
        expect(toOfficePattern('navy stripes on white')).toBe(
            'pattern:dkHorz:000080:FFFFFF',
        );
        expect(toOfficePattern('stripes of navy on white')).toBe(
            'pattern:dkHorz:000080:FFFFFF',
        );
        expect(toOfficePattern('red and white checks')).toBe(
            'pattern:lgCheck:FF0000:FFFFFF',
        );
        expect(toOfficePattern('gold dots')).toBe(
            'pattern:pct20:FFD700:FFFFFF',
        );
        expect(toOfficePattern('a pattern of dark blue vertical stripes')).toBe(
            'pattern:dkVert:00008B:FFFFFF',
        );
        expect(toOfficePattern('black diagonal stripes over yellow')).toBe(
            'pattern:wdDnDiag:000000:FFFF00',
        );
    });

    test('words that are not one are none', () => {
        expect(toOfficePattern('navy')).toBeNull();
        expect(toOfficePattern('navy to black')).toBeNull();
        expect(toOfficePattern('greenish stripes')).toBeNull();
        expect(toOfficePattern('navy squiggles on white')).toBeNull();
        expect(toOfficePattern(7)).toBeNull();
    });

    test('a colour and a gradient are read before a pattern', () => {
        expect(toOfficeFill('red')).toBe('FF0000');
        expect(toOfficeFill('red to blue')).toBe(
            'gradient:5400000:FF0000:0000FF',
        );
        expect(toOfficeFill('red and white stripes')).toBe(
            'pattern:dkHorz:FF0000:FFFFFF',
        );
    });

    test('written as a:pattFill, see-through on both colours', () => {
        expect(genOfficeFillXml('pattern:lgCheck:FF0000:FFFFFF')).toBe(
            '<a:pattFill prst="lgCheck"><a:fgClr><a:srgbClr val="FF0000"/>' +
                '</a:fgClr><a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr>' +
                '</a:pattFill>',
        );
        expect(genOfficeFillXml('pattern:pct20:000000:FFFFFF', 40)).toContain(
            '<a:fgClr><a:srgbClr val="000000"><a:alpha val="60000"/>',
        );
        expect(toOfficeFillWords('pattern:dkHorz:000080:FFFFFF')).toBe(
            'a pattern of stripes in navy (#000080) on white (#FFFFFF)',
        );
    });

    test("a slide's background and a box's fill take one", () => {
        const slide =
            '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" ' +
            'name="Title 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>' +
            '<a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
            '</p:sp></p:spTree></p:cSld></p:sld>';
        expect(
            setSlideBackgroundXml(slide, 'pattern:dkHorz:000080:FFFFFF'),
        ).toContain('<p:bg><p:bgPr><a:pattFill prst="dkHorz">');
        const fill = 'pattern:dkHorz:000080:FFFFFF';
        expect(readOfficeBoxLook({ fill: 'navy stripes on white' })).toEqual({
            look: { fill },
        });
        // a solid fill gives way to it
        const box =
            '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:solidFill>' +
            '<a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr></p:sp>';
        expect(applyBoxLookXml(box, { fill }, 'shape')).toEqual({
            xml:
                '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:pattFill ' +
                'prst="dkHorz"><a:fgClr><a:srgbClr val="000080"/></a:fgClr>' +
                '<a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr></a:pattFill>' +
                '</p:spPr></p:sp>',
        });
    });
});
