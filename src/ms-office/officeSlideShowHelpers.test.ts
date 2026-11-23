import { describe, expect, test } from 'vitest';

import {
    OFFICE_TRANSITION_LIST,
    readSlideTransition,
    scaleSlidePartXml,
    setPresentationSizeXml,
    setSlideTransitionXml,
    toOfficeSlideSize,
    toOfficeTransition,
} from './officeSlideShowHelpers';
import { listSlideBoxes, readBoxPlace } from './officeSlideBoxHelpers';

function genSlide(after = '') {
    return (
        '<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree><p:nvGrpSpPr/>' +
        '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/>' +
        `</p:clrMapOvr>${after}</p:sld>`
    );
}

// what PowerPoint writes for a transition only newer readers know
const WRAPPED =
    '<mc:AlternateContent xmlns:mc="mc"><mc:Choice Requires="p14">' +
    '<p:transition spd="slow" p14:dur="2000" advTm="3000"><p14:vortex/>' +
    '</p:transition></mc:Choice><mc:Fallback><p:transition spd="slow" ' +
    'advTm="3000"><p:fade/></p:transition></mc:Fallback>' +
    '</mc:AlternateContent>';

describe('a transition (2026-11-20)', () => {
    test('named as a person says it', () => {
        expect(toOfficeTransition('Fade')).toBe('fade');
        expect(toOfficeTransition('fade in')).toBe('fade');
        expect(toOfficeTransition('uncover')).toBe('uncover');
        expect(toOfficeTransition('swirl')).toBe(null);
        expect(OFFICE_TRANSITION_LIST).toContain('none');
    });

    test('put after the colour map, before the timing; replaced; taken off', () => {
        const timing = '<p:timing><p:tnLst/></p:timing>';
        const faded = setSlideTransitionXml(genSlide(timing), {
            kind: 'fade',
        });
        expect(faded).toBe(
            genSlide(
                '<p:transition spd="med"><p:fade/></p:transition>' + timing,
            ),
        );
        expect(
            setSlideTransitionXml(faded ?? '', { kind: 'wipe', advance: 2.5 }),
        ).toBe(
            genSlide(
                '<p:transition spd="med" advTm="2500"><p:wipe/>' +
                    `</p:transition>${timing}`,
            ),
        );
        expect(setSlideTransitionXml(faded ?? '', { kind: 'none' })).toBe(
            genSlide(timing),
        );
        // the seconds alone: kept with no effect, never an empty one
        expect(setSlideTransitionXml(genSlide(), { advance: 4 })).toBe(
            genSlide('<p:transition advTm="4000"/>'),
        );
        expect(setSlideTransitionXml('<p:sld/>', { kind: 'fade' })).toBe(null);
    });

    test("Office's two copies: a new one replaces both, the time is set in both", () => {
        expect(setSlideTransitionXml(genSlide(WRAPPED), { kind: 'push' })).toBe(
            genSlide(
                '<p:transition spd="med" advTm="3000"><p:push/></p:transition>',
            ),
        );
        const timed = setSlideTransitionXml(genSlide(WRAPPED), { advance: 0 });
        expect(timed).toContain('<p14:vortex/>');
        expect(timed).not.toContain('advTm');
        expect(readSlideTransition(genSlide(WRAPPED))).toEqual({
            kind: 'fade',
            advance: 3,
        });
        expect(readSlideTransition(genSlide())).toBe(null);
    });
});

describe('the slide size (2026-11-20)', () => {
    test('named as a person says it; written, or put where it goes', () => {
        expect(toOfficeSlideSize('4x3')?.name).toBe('4:3');
        expect(toOfficeSlideSize('Widescreen')?.name).toBe('16:9');
        expect(toOfficeSlideSize('3:2')).toBe(null);
        const size = toOfficeSlideSize('4:3');
        if (size === null) {
            throw new Error('no size');
        }
        expect(
            setPresentationSizeXml(
                '<p:presentation><p:sldIdLst/><p:sldSz cx="12192000" ' +
                    'cy="6858000"/><p:notesSz cx="1" cy="1"/></p:presentation>',
                size,
            ),
        ).toBe(
            '<p:presentation><p:sldIdLst/><p:sldSz cx="9144000" ' +
                'cy="6858000" type="screen4x3"/><p:notesSz cx="1" cy="1"/>' +
                '</p:presentation>',
        );
        expect(
            setPresentationSizeXml(
                '<p:presentation><p:sldMasterIdLst></p:sldMasterIdLst>' +
                    '</p:presentation>',
                size,
            ),
        ).toContain('</p:sldMasterIdLst><p:sldSz cx="9144000"');
    });

    test('boxes stretched with the slide, a picture keeps its shape', () => {
        const box = (name: string, kind: 'sp' | 'pic', place: number[]) => {
            const [x, y, cx, cy] = place;
            return (
                `<p:${kind}><p:nvSpPr><p:cNvPr id="2" name="${name}"/>` +
                `</p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/>` +
                `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr></p:${kind}>`
            );
        };
        const xml =
            '<p:sld><p:cSld><p:spTree><p:nvGrpSpPr/>' +
            box('Text', 'sp', [1219200, 685800, 6096000, 1000000]) +
            box('Photo', 'pic', [0, 0, 1219200, 1219200]) +
            box('Curtain', 'pic', [0, 0, 12192000, 6858000]) +
            '</p:spTree></p:cSld></p:sld>';
        const scaled = scaleSlidePartXml(
            xml,
            { cx: 12192000, cy: 6858000 },
            { cx: 9144000, cy: 6858000 },
        );
        const places = listSlideBoxes(scaled).map((one) => {
            return readBoxPlace(scaled.slice(one.start, one.end));
        });
        expect(places).toEqual([
            { x: 914400, y: 685800, cx: 4572000, cy: 1000000 },
            // three quarters of its size, its middle where the middle went
            { x: 0, y: 152400, cx: 914400, cy: 914400 },
            { x: 0, y: 0, cx: 9144000, cy: 6858000 },
        ]);
        expect(
            scaleSlidePartXml(
                xml,
                { cx: 9144000, cy: 6858000 },
                { cx: 9144000, cy: 6858000 },
            ),
        ).toBe(xml);
    });
});
