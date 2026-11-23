import { describe, expect, test } from 'vitest';

import {
    DEFAULT_SLIDE_SIZE,
    addSlideTextBoxXml,
    findBoxPlace,
    findCoveringPicture,
    findNamedBoxes,
    listSlideBoxes,
    readInheritedSize,
    readSlideSize,
    removeSlideBoxXml,
    setBoxPlaceXml,
    toBoxPlace,
    toPercentPlace,
} from './officeSlideBoxHelpers';

function genPicture(name: string, cx: number, cy: number, x = 0, y = 0) {
    return (
        `<p:pic><p:nvPicPr><p:cNvPr id="5" name="${name}"/><p:cNvPicPr/>` +
        '<p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>' +
        `</p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/>` +
        `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr></p:pic>`
    );
}

function genPart(root: string, boxes: string, attributes = '') {
    return (
        `<?xml version="1.0"?>\n<p:${root} xmlns:p="p" xmlns:a="a"${attributes}>` +
        `<p:cSld><p:spTree><p:nvGrpSpPr/>${boxes}</p:spTree></p:cSld></p:${root}>`
    );
}

const TEXT_BOX =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/></p:nvSpPr>' +
    '<p:txBody><a:p><a:r><a:t>Hi</a:t></a:r></a:p></p:txBody></p:sp>';
const GROUP =
    '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="7" name="Group 6"/></p:nvGrpSpPr>' +
    `${genPicture('Logo', 100, 100)}<p:graphicFrame><p:nvGraphicFramePr>` +
    '<p:cNvPr id="8" name="Table 7"/></p:nvGraphicFramePr><a:graphic>' +
    '<a:graphicData><a:tbl/></a:graphicData></a:graphic></p:graphicFrame>' +
    '</p:grpSp>';

describe('the boxes of a slide', () => {
    test('listed in order, a group then its own, the one filling it', () => {
        const xml = genPart(
            'sld',
            genPicture('Curtain', 12192000, 6858000) + TEXT_BOX + GROUP,
        );
        expect(
            listSlideBoxes(xml).map((box) => {
                return [box.name, box.kind, box.isGrouped, box.isFilling];
            }),
        ).toEqual([
            ['Curtain', 'picture', false, true],
            ['Title 1', 'text', false, false],
            ['Group 6', 'group', false, false],
            ['Logo', 'picture', true, false],
            ['Table 7', 'table', true, false],
        ]);
        expect(listSlideBoxes('<p:sld/>')).toEqual([]);
    });

    test("the deck's size read, a 4:3 picture filling a 4:3 slide", () => {
        const size = readSlideSize(
            '<p:presentation><p:sldSz cy="6858000" cx="9144000" type="screen4x3"/>',
        );
        expect(size).toEqual({ cx: 9144000, cy: 6858000 });
        expect(readSlideSize('<p:presentation/>')).toEqual(DEFAULT_SLIDE_SIZE);
        const xml = genPart('sld', genPicture('Back', 9144000, 6858000));
        expect(listSlideBoxes(xml, size)[0].isFilling).toBe(true);
        // on a 16:9 slide it leaves a band uncovered
        expect(listSlideBoxes(xml)[0].isFilling).toBe(false);
    });

    test('a box taken out by name, any case; a group whole', () => {
        const xml = genPart('sld', TEXT_BOX + GROUP);
        const out = removeSlideBoxXml(xml, 'group 6');
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out).toMatchObject({ count: 1, kind: 'group' });
        expect(out.xml).toBe(genPart('sld', TEXT_BOX));
        expect(removeSlideBoxXml(xml, 'Nothing')).toEqual({
            reason:
                'There is no box "Nothing" there. Its boxes: "Title 1" ' +
                '(text), "Group 6" (group), "Logo" (picture), "Table 7" ' +
                '(table).',
        });
    });
});

describe('a picture in front of the background', () => {
    const full = genPicture('Curtain', 12192000, 6858000);

    test('on the slide, its layout or its master', () => {
        const slide = genPart('sld', TEXT_BOX);
        expect(
            findCoveringPicture(genPart('sld', full), DEFAULT_SLIDE_SIZE),
        ).toEqual({ name: 'Curtain', where: '' });
        expect(
            findCoveringPicture(
                slide,
                DEFAULT_SLIDE_SIZE,
                genPart('sldLayout', full),
            ),
        ).toEqual({ name: 'Curtain', where: ' on its layout' });
        expect(
            findCoveringPicture(
                slide,
                DEFAULT_SLIDE_SIZE,
                genPart('sldLayout', ''),
                genPart('sldMaster', full),
            ),
        ).toEqual({ name: 'Curtain', where: ' on its master' });
        expect(findCoveringPicture(slide, DEFAULT_SLIDE_SIZE)).toBeNull();
    });

    test("not a layout's or master's the slide does not show", () => {
        expect(
            findCoveringPicture(
                genPart('sld', TEXT_BOX, ' showMasterSp="0"'),
                DEFAULT_SLIDE_SIZE,
                genPart('sldLayout', full),
            ),
        ).toBeNull();
        expect(
            findCoveringPicture(
                genPart('sld', TEXT_BOX),
                DEFAULT_SLIDE_SIZE,
                genPart('sldLayout', '', ' showMasterSp="0"'),
                genPart('sldMaster', full),
            ),
        ).toBeNull();
    });
});

// a placeholder with no place of its own, as most decks' titles are
function genPlaceholder(name: string, ph: string, extra = '') {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="3" name="${name}"/><p:cNvSpPr/>` +
        `<p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/>${extra}</p:sp>`
    );
}
const PLACE =
    '<p:spPr><a:xfrm><a:off x="609600" y="342900"/><a:ext cx="10972800" ' +
    'cy="1143000"/></a:xfrm></p:spPr>';

describe('where a box is, and moving it (2026-11-20)', () => {
    test("its own place, else its layout's by index or type, its master's", () => {
        const title = genPlaceholder('Title 1', '<p:ph type="title"/>');
        const body = genPlaceholder('Body 2', '<p:ph idx="1"/>');
        const layout = genPart(
            'sldLayout',
            `<p:sp><p:nvSpPr><p:cNvPr id="2" name="L"/><p:cNvSpPr/><p:nvPr>` +
                `<p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>${PLACE}</p:sp>`,
        );
        const master = genPart(
            'sldMaster',
            `<p:sp><p:nvSpPr><p:cNvPr id="2" name="M"/><p:cNvSpPr/><p:nvPr>` +
                `<p:ph type="title"/></p:nvPr></p:nvSpPr>${PLACE}</p:sp>`,
        );
        const place = { x: 609600, y: 342900, cx: 10972800, cy: 1143000 };
        expect(findBoxPlace(body, layout, master)).toEqual(place);
        expect(findBoxPlace(title, layout, master)).toEqual(place);
        expect(findBoxPlace(title, layout, null)).toBe(null);
        expect(toPercentPlace(place, DEFAULT_SLIDE_SIZE)).toEqual([
            5, 5, 90, 16.7,
        ]);
    });

    test('`at` in % read, a null kept, a wrong one refused', () => {
        const current = { x: 1, y: 2, cx: 3, cy: 4 };
        expect(
            toBoxPlace([null, 50, 25, null], DEFAULT_SLIDE_SIZE, current),
        ).toEqual({ x: 1, y: 3429000, cx: 3048000, cy: 4 });
        expect(
            toBoxPlace([0, 0, 0, 10], DEFAULT_SLIDE_SIZE, current),
        ).toHaveProperty('reason');
        expect(
            toBoxPlace([0, 0, 10], DEFAULT_SLIDE_SIZE, current),
        ).toHaveProperty('reason');
        expect(
            toBoxPlace([null, 0, 10, 10], DEFAULT_SLIDE_SIZE, null),
        ).toHaveProperty('reason');
    });

    test('a place written over its own, made in its properties, or opened', () => {
        const place = { x: 10, y: 20, cx: 30, cy: 40 };
        expect(setBoxPlaceXml(genPicture('P', 5, 5, 1, 1), place)).toContain(
            '<a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm>',
        );
        expect(
            setBoxPlaceXml(genPlaceholder('T', '<p:ph type="title"/>'), place),
        ).toContain(
            '<p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" ' +
                'cy="40"/></a:xfrm></p:spPr>',
        );
        expect(
            setBoxPlaceXml(
                '<p:sp><p:spPr bwMode="auto"><a:prstGeom prst="rect"/>' +
                    '</p:spPr></p:sp>',
                place,
            ),
        ).toBe(
            '<p:sp><p:spPr bwMode="auto"><a:xfrm><a:off x="10" y="20"/>' +
                '<a:ext cx="30" cy="40"/></a:xfrm><a:prstGeom prst="rect"/>' +
                '</p:spPr></p:sp>',
        );
    });

    test("a box named by its name, any case, or a line's box type", () => {
        const xml = genPart(
            'sld',
            genPlaceholder('Title 1', '<p:ph type="title"/>') +
                genPicture('Picture 3', 5, 5) +
                GROUP,
        );
        const names = (name: string) => {
            return findNamedBoxes(xml, name).map((box) => {
                return box.name;
            });
        };
        expect(names('picture 3')).toEqual(['Picture 3']);
        expect(names('title')).toEqual(['Title 1']);
        // inside a group: moved with the group, never alone
        expect(names('Logo')).toEqual([]);
    });

    test('a new text box: a free id and name, in front, its lines', () => {
        const xml = genPart('sld', TEXT_BOX + genPicture('TextBox 5', 5, 5));
        const out = addSlideTextBoxXml(
            xml,
            ['Welcome', '', 'friends'],
            { x: 1, y: 2, cx: 3, cy: 4 },
            '<a:rPr lang="en-US" sz="3200"/>',
        );
        expect(out?.name).toBe('TextBox 5 (2)');
        expect(out?.xml).toContain(
            '<p:cNvPr id="6" name="TextBox 5 (2)"/><p:cNvSpPr txBox="1"/>',
        );
        expect(out?.xml).toContain(
            '<a:p><a:r><a:rPr lang="en-US" sz="3200"/><a:t>Welcome</a:t>' +
                '</a:r></a:p><a:p><a:endParaRPr lang="en-US" sz="3200"/>' +
                '</a:p><a:p>',
        );
        expect(out?.xml.endsWith('</p:sp></p:spTree></p:cSld></p:sld>')).toBe(
            true,
        );
    });
});

describe('the size words with none of their own are drawn at', () => {
    const listStyle = (level: number, size: number) => {
        return (
            `<p:txBody><a:bodyPr/><a:lstStyle><a:lvl${level}pPr>` +
            `<a:defRPr sz="${size}"/></a:lvl${level}pPr></a:lstStyle>`
        );
    };
    const master = genPart('sldMaster', '', '').replace(
        '</p:cSld>',
        '</p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/>' +
            '</a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr>' +
            '<a:defRPr sz="2800"/></a:lvl1pPr><a:lvl2pPr><a:defRPr ' +
            'sz="2400"/></a:lvl2pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr>' +
            '<a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>',
    );

    test("the box's list, its layout's, the master's styles, by level", () => {
        const slide = genPart(
            'sld',
            genPlaceholder(
                'Title 1',
                '<p:ph type="title"/>',
                '<p:txBody><a:bodyPr/><a:p><a:r><a:t>T</a:t></a:r></a:p>' +
                    '</p:txBody>',
            ) +
                genPlaceholder(
                    'Body 2',
                    '<p:ph idx="1"/>',
                    '<p:txBody><a:bodyPr/><a:p><a:r><a:t>B</a:t></a:r></a:p>' +
                        '<a:p><a:pPr lvl="1"/><a:r><a:t>C</a:t></a:r></a:p>' +
                        '</p:txBody>',
                ) +
                genPlaceholder(
                    'Own 3',
                    '<p:ph type="body" idx="2"/>',
                    `${listStyle(1, 6000)}<a:p><a:r><a:t>D</a:t></a:r></a:p>` +
                        '</p:txBody>',
                ),
        );
        const layout = genPart(
            'sldLayout',
            genPlaceholder(
                'L',
                '<p:ph type="body" idx="2"/>',
                `${listStyle(1, 3600)}</p:txBody>`,
            ),
        );
        const at = (text: string) => {
            return slide.lastIndexOf('<a:p>', slide.indexOf(`<a:t>${text}<`));
        };
        expect(readInheritedSize(slide, at('T'), layout, master)).toBe(44);
        expect(readInheritedSize(slide, at('B'), layout, master)).toBe(28);
        expect(
            readInheritedSize(
                slide,
                slide.indexOf('<a:p><a:pPr lvl="1"/>'),
                layout,
                master,
            ),
        ).toBe(24);
        expect(readInheritedSize(slide, at('D'), layout, master)).toBe(60);
        expect(readInheritedSize(slide, at('D'), layout, null)).toBe(60);
        expect(
            readInheritedSize(genPart('sld', TEXT_BOX), 0, null, master),
        ).toBe(null);
    });
});
