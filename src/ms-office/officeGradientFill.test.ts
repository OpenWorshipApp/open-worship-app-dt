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
    toOfficeGradient,
} from './officeXmlLookHelpers';

// A gradient, written as colours joined by "to" (2026-11-21, the goal
// _chatbot can change do everything on a given pptx_: a gradient had been
// the one look of a slide's background or a box's fill refused).
describe('a gradient', () => {
    test('read from colours joined by "to", top to bottom by default', () => {
        expect(toOfficeGradient('dark blue to purple')).toBe(
            'gradient:5400000:00008B:800080',
        );
        expect(
            toOfficeGradient('a gradient from black to navy, left to right'),
        ).toBe('gradient:0:000000:000080');
        expect(toOfficeGradient('red, white and blue (diagonal)')).toBe(
            'gradient:2700000:FF0000:FFFFFF:0000FF',
        );
        expect(
            toOfficeGradient('#112233 → rgb(0, 176, 80) bottom to top'),
        ).toBe('gradient:16200000:112233:00B050');
    });

    test('anything else is no gradient', () => {
        for (const value of [
            'blue',
            'blue to sky',
            'red to green to blue to black to white',
            'to blue',
            42,
        ]) {
            expect(toOfficeGradient(value)).toBeNull();
        }
        // a colour stays a colour
        expect(toOfficeFill('blue')).toBe('0000FF');
    });

    test('written as Office writes a gradient fill, and said back', () => {
        const fill = toOfficeFill('black to navy, left to right') as string;
        expect(genOfficeFillXml(fill)).toBe(
            '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">' +
                '<a:srgbClr val="000000"/></a:gs><a:gs pos="100000">' +
                '<a:srgbClr val="000080"/></a:gs></a:gsLst>' +
                '<a:lin ang="0" scaled="0"/></a:gradFill>',
        );
        expect(toOfficeFillWords(fill)).toBe(
            'a blend of black (#000000) to navy (#000080), left to right',
        );
        // a plain colour as before
        expect(genOfficeFillXml('FF0000', 40)).toBe(
            '<a:solidFill><a:srgbClr val="FF0000"><a:alpha val="60000"/>' +
                '</a:srgbClr></a:solidFill>',
        );
    });

    test("a slide's background and a box's fill take one", () => {
        const fill = toOfficeFill('dark blue to purple') as string;
        expect(
            setSlideBackgroundXml(
                '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>',
                fill,
            ),
        ).toBe(
            '<p:sld><p:cSld><p:bg><p:bgPr><a:gradFill rotWithShape="1">' +
                '<a:gsLst><a:gs pos="0"><a:srgbClr val="00008B"/></a:gs>' +
                '<a:gs pos="100000"><a:srgbClr val="800080"/></a:gs>' +
                '</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>' +
                '<a:effectLst/></p:bgPr></p:bg><p:spTree/></p:cSld></p:sld>',
        );
        const read = readOfficeBoxLook({ fill: 'dark blue to purple' });
        expect(read).toEqual({ look: { fill } });
        // a solid fill gives way to it, 30% see-through
        const box =
            '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:solidFill>' +
            '<a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr></p:sp>';
        expect(
            applyBoxLookXml(box, { fill, transparency: 30 }, 'shape'),
        ).toEqual({
            xml:
                '<p:sp><p:spPr><a:prstGeom prst="rect"/><a:gradFill ' +
                'rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr ' +
                'val="00008B"><a:alpha val="70000"/></a:srgbClr></a:gs>' +
                '<a:gs pos="100000"><a:srgbClr val="800080"><a:alpha ' +
                'val="70000"/></a:srgbClr></a:gs></a:gsLst><a:lin ' +
                'ang="5400000" scaled="0"/></a:gradFill></p:spPr></p:sp>',
        });
        // an outline is one colour
        expect(readOfficeBoxLook({ outline: 'red to blue' })).toEqual({
            reason: expect.stringContaining('`outline` is a colour'),
        });
    });
});
