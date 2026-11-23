import { describe, expect, test } from 'vitest';

import {
    checkIsTitleLayout,
    setSlideFooterXml,
} from './officeSlideFooterHelpers';

// a layout holding PowerPoint's footer row, as its blank deck has it
const LAYOUT =
    '<p:sldLayout type="obj"><p:cSld><p:spTree>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="5" name="Footer Placeholder 4"/>' +
    '<p:cNvSpPr/><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr>' +
    '</p:nvSpPr><p:spPr/></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="6" name="Slide Number Placeholder 5"/>' +
    '<p:cNvSpPr/><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/>' +
    '</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:fld ' +
    'id="{11111111-2222-3333-4444-555555555555}" type="slidenum"><a:t>N' +
    '</a:t></a:fld></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>';

const SLIDE =
    '<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/>' +
    '</p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" ' +
    'name="Title 1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Hymn</a:t></a:r></a:p>' +
    '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>';

describe("a slide's number and footer", () => {
    test("the number: the layout's own tag and field, the slide's number", () => {
        const out = setSlideFooterXml(
            SLIDE,
            'sldNum',
            true,
            null,
            LAYOUT,
            null,
            4,
        );
        expect(out.state).toBe('added');
        expect(out.xml).toContain(
            '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Slide Number Placeholder ' +
                '2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' +
                '<p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr>' +
                '</p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>' +
                '<a:fld id="{11111111-2222-3333-4444-555555555555}" ' +
                'type="slidenum"><a:rPr/><a:t>4</a:t></a:fld><a:endParaRPr/>' +
                '</a:p></p:txBody></p:sp></p:spTree>',
        );
        // twice: nothing more; off: gone, the slide as it was
        expect(
            setSlideFooterXml(out.xml, 'sldNum', true, null, LAYOUT, null, 4),
        ).toEqual({ xml: out.xml, state: 'unchanged' });
        expect(
            setSlideFooterXml(out.xml, 'sldNum', false, null, LAYOUT, null),
        ).toEqual({ xml: SLIDE, state: 'removed' });
    });

    test("a footer's words written, then changed, then taken off", () => {
        const out = setSlideFooterXml(
            SLIDE,
            'ftr',
            true,
            'Grace & Peace',
            LAYOUT,
            null,
        );
        expect(out.state).toBe('added');
        expect(out.xml).toContain(
            '<p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr>' +
                '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/>' +
                '<a:t>Grace &amp; Peace</a:t></a:r></a:p></p:txBody></p:sp>',
        );
        const changed = setSlideFooterXml(
            out.xml,
            'ftr',
            true,
            'Welcome',
            LAYOUT,
            null,
        );
        expect(changed.state).toBe('changed');
        expect(changed.xml).toBe(
            out.xml.replace('Grace &amp; Peace', 'Welcome'),
        );
        expect(
            setSlideFooterXml(changed.xml, 'ftr', false, null, LAYOUT, null),
        ).toEqual({ xml: SLIDE, state: 'removed' });
    });

    test("no place in the layout: the master's, else none", () => {
        expect(
            setSlideFooterXml(SLIDE, 'ftr', true, 'x', '<p:sldLayout/>', LAYOUT)
                .state,
        ).toBe('added');
        expect(
            setSlideFooterXml(
                SLIDE,
                'sldNum',
                true,
                null,
                '<p:sldLayout/>',
                null,
            ),
        ).toEqual({ xml: SLIDE, state: 'noPlace' });
        expect(
            setSlideFooterXml(SLIDE, 'ftr', false, null, null, null),
        ).toEqual({ xml: SLIDE, state: 'unchanged' });
    });

    test('a title slide is known by its layout', () => {
        expect(checkIsTitleLayout('<p:sldLayout type="title">')).toBe(true);
        expect(checkIsTitleLayout(LAYOUT)).toBe(false);
        expect(checkIsTitleLayout(null)).toBe(false);
    });
});
