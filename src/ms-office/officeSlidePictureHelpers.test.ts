import { describe, expect, test } from 'vitest';

import {
    addSlidePictureXml,
    checkIsFillingPlace,
    genPictureCropXml,
    listCoveredWordBoxes,
    readBoxPictureRelId,
    readPictureInfo,
    setBoxPictureXml,
    toPicturePlace,
} from './officeSlidePictureHelpers';

const WIDE = { cx: 12192000, cy: 6858000 };

/** A PNG's signature and header chunk: all a size is read from. */
function genPngBytes(width: number, height: number) {
    const bytes = new Uint8Array(33);
    bytes.set([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
        0x44, 0x52,
    ]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    bytes[24] = 8;
    bytes[25] = 2;
    return bytes;
}

/** A JPEG with an APP0 marker before its frame, as a camera writes one. */
function genJpegBytes(width: number, height: number) {
    return new Uint8Array([
        0xff,
        0xd8,
        ...[0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0)],
        // a lone marker between them, stepped over
        0xff,
        0xd0,
        ...[0xff, 0xc0, 0x00, 0x11, 0x08],
        height >> 8,
        height & 255,
        width >> 8,
        width & 255,
        ...Array(10).fill(0),
        0xff,
        0xd9,
    ]);
}

describe('a picture read off its header (2026-11-20, EC-770)', () => {
    test('PNG, JPEG, GIF and BMP, by their bytes and never their name', () => {
        expect(readPictureInfo(genPngBytes(1600, 900))).toEqual({
            extension: 'png',
            contentType: 'image/png',
            width: 1600,
            height: 900,
        });
        expect(readPictureInfo(genJpegBytes(4032, 3024))).toEqual({
            extension: 'jpeg',
            contentType: 'image/jpeg',
            width: 4032,
            height: 3024,
        });
        const gif = new Uint8Array(13);
        gif.set([...'GIF89a'].map((one) => one.charCodeAt(0)));
        gif.set([0x40, 0x01, 0xf0, 0x00], 6);
        expect(readPictureInfo(gif)).toMatchObject({
            extension: 'gif',
            width: 320,
            height: 240,
        });
        const bmp = new Uint8Array(30);
        bmp.set([0x42, 0x4d]);
        const view = new DataView(bmp.buffer);
        view.setInt32(18, 640, true);
        // a top-down bitmap says its height below zero
        view.setInt32(22, -480, true);
        expect(readPictureInfo(bmp)).toMatchObject({
            extension: 'bmp',
            width: 640,
            height: 480,
        });
    });

    test('anything else, a cut header or a picture of no size, is none', () => {
        expect(
            readPictureInfo(new TextEncoder().encode('%PDF-1.7 not a picture')),
        ).toBe(null);
        expect(readPictureInfo(genPngBytes(1600, 900).slice(0, 20))).toBe(null);
        expect(readPictureInfo(genPngBytes(0, 900))).toBe(null);
        // a JPEG with no frame marker says no size
        expect(
            readPictureInfo(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0])),
        ).toBe(null);
    });
});

describe('where a picture goes, and its crop', () => {
    const photo = readPictureInfo(genJpegBytes(800, 600));
    const wide = readPictureInfo(genPngBytes(1600, 900));
    if (photo === null || wide === null) {
        throw new Error('no picture');
    }

    test('nothing said: three fifths of the slide, its own shape, centred', () => {
        // 4:3 on a 16:9 slide: the height decides
        expect(toPicturePlace(undefined, photo, WIDE)).toEqual({
            x: 3352800,
            y: 1371600,
            cx: 5486400,
            cy: 4114800,
        });
    });

    test('a width and a height: fitted inside that area, nothing cut off', () => {
        // the live run's tall area on the right: the 4:3 photo whole,
        // centred down it, where it had lost a quarter off each side
        const tall = toPicturePlace([60, 10, 30, 80], photo, WIDE);
        expect(tall).toEqual({
            x: 7315200,
            y: 2057400,
            cx: 3657600,
            cy: 2743200,
        });
        expect(genPictureCropXml(photo, tall as never)).toBe('');
        // no x or y: the fitted picture centred on the slide
        expect(toPicturePlace([null, null, 40, 40], photo, WIDE)).toEqual({
            x: 4267200,
            y: 2057400,
            cx: 3657600,
            cy: 2743200,
        });
    });

    test('a width alone keeps its shape; the whole slide is filled', () => {
        expect(toPicturePlace([60, 10, 30, null], photo, WIDE)).toEqual({
            x: 7315200,
            y: 685800,
            cx: 3657600,
            cy: 2743200,
        });
        expect(toPicturePlace([null, null, null, 50], wide, WIDE)).toEqual({
            x: 3048000,
            y: 1714500,
            cx: 6096000,
            cy: 3429000,
        });
        expect(toPicturePlace([0, 0, 100, 100], photo, WIDE)).toEqual({
            x: 0,
            y: 0,
            ...WIDE,
        });
    });

    test('refused: a wrong `at`, no size, or past five slides', () => {
        expect(toPicturePlace([1, 2, 3], photo, WIDE)).toHaveProperty('reason');
        expect(toPicturePlace([0, 0, 0, null], photo, WIDE)).toHaveProperty(
            'reason',
        );
        expect(toPicturePlace([0, 0, 600, null], photo, WIDE)).toHaveProperty(
            'reason',
        );
    });

    test('the boxes of words a picture in front lies over', () => {
        const boxes = [
            { name: 'Title 1', at: [10, 5, 80, 15], lineIds: ['2.1'] },
            { name: 'Body', at: [5, 25, 90, 60], lineIds: ['2.2', '2.3'] },
            // no words, or no place: never named
            { name: 'Picture 3', at: [0, 0, 100, 100], lineIds: [] },
            { name: 'Odd', at: null, lineIds: ['2.4'] },
        ];
        // the live run's photo, on the right of a verse
        expect(listCoveredWordBoxes([60, 20, 30, 60], boxes)).toEqual(['Body']);
        // in the corner under the title, clear of the words
        expect(listCoveredWordBoxes([80, 86, 18, 12], boxes)).toEqual([]);
        // a hairline over the body: under a twentieth of it
        expect(listCoveredWordBoxes([90, 80, 10, 10], boxes)).toEqual([]);
    });

    test('a place covering the slide is a background', () => {
        expect(checkIsFillingPlace({ x: 0, y: 0, ...WIDE }, WIDE)).toBe(true);
        expect(
            checkIsFillingPlace(
                { x: -20000, y: 0, cx: 12230000, cy: 6858000 },
                WIDE,
            ),
        ).toBe(true);
        expect(
            checkIsFillingPlace({ x: 0, y: 0, cx: 6096000, cy: 6858000 }, WIDE),
        ).toBe(false);
    });

    test('cropped to the box, the middle kept, never squeezed', () => {
        // 4:3 in a 16:9 box: a strip off the top and the bottom
        expect(genPictureCropXml(photo, { x: 0, y: 0, ...WIDE })).toBe(
            '<a:srcRect t="12500" b="12500"/>',
        );
        // 16:9 in a square box: the sides
        expect(genPictureCropXml(wide, { x: 0, y: 0, cx: 900, cy: 900 })).toBe(
            '<a:srcRect l="21875" r="21875"/>',
        );
        expect(genPictureCropXml(wide, { x: 0, y: 0, ...WIDE })).toBe('');
    });
});

describe("a slide's XML", () => {
    const SLIDE =
        '<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:nvGrpSpPr>' +
        '<p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
        '<p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="4" name="Title 1"/>' +
        '</p:nvSpPr></p:sp></p:spTree></p:cSld></p:sld>';
    const place = { x: 1, y: 2, cx: 3, cy: 4 };

    test('a picture in front, named as PowerPoint names one; `r:` declared', () => {
        const added = addSlidePictureXml(
            SLIDE,
            'rId7',
            place,
            '',
            false,
            'a&b.png',
        );
        expect(added?.name).toBe('Picture 4');
        expect(added?.xml).toContain(
            '<p:sld xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="a"',
        );
        expect(added?.xml).toContain(
            '</p:sp><p:pic><p:nvPicPr><p:cNvPr id="5" name="Picture 4" ' +
                'descr="a&amp;b.png"/>',
        );
        expect(added?.xml).toContain(
            '<a:blip r:embed="rId7"/><a:stretch><a:fillRect/></a:stretch>' +
                '</p:blipFill><p:spPr><a:xfrm><a:off x="1" y="2"/>' +
                '<a:ext cx="3" cy="4"/></a:xfrm>',
        );
        expect(
            added?.xml.endsWith('</p:pic></p:spTree></p:cSld></p:sld>'),
        ).toBe(true);
    });

    test("behind: the first box, after the tree's own properties", () => {
        const added = addSlidePictureXml(
            SLIDE,
            'rId7',
            place,
            '<a:srcRect t="1" b="1"/>',
            true,
            'bg.jpg',
        );
        expect(added?.xml).toContain(
            '<p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="5" name="Picture 4"',
        );
        expect(added?.xml).toContain(
            '<a:blip r:embed="rId7"/><a:srcRect t="1" b="1"/><a:stretch>',
        );
        expect(
            addSlidePictureXml('<p:sld/>', 'rId1', place, '', true, 'x'),
        ).toBe(null);
        expect(
            addSlidePictureXml('<p:sld/>', 'rId1', place, '', false, 'x'),
        ).toBe(null);
    });

    test("another picture in a picture's place: its blip, its crop", () => {
        const box =
            '<p:pic><p:blipFill><a:blip r:embed="rId1"><a:extLst>' +
            '<a:ext uri="{x}"/></a:extLst></a:blip>' +
            '<a:srcRect l="5"/><a:stretch/></p:blipFill></p:pic>';
        expect(setBoxPictureXml(box, 'rId9', '<a:srcRect t="2" b="2"/>')).toBe(
            '<p:pic><p:blipFill><a:blip r:embed="rId9"><a:extLst>' +
                '<a:ext uri="{x}"/></a:extLst></a:blip>' +
                '<a:srcRect t="2" b="2"/><a:stretch/></p:blipFill></p:pic>',
        );
        expect(setBoxPictureXml(box, 'rId9', '')).toBe(
            '<p:pic><p:blipFill><a:blip r:embed="rId9"><a:extLst>' +
                '<a:ext uri="{x}"/></a:extLst></a:blip><a:stretch/>' +
                '</p:blipFill></p:pic>',
        );
        // a text box draws no picture
        expect(setBoxPictureXml('<p:sp><p:txBody/></p:sp>', 'rId9', '')).toBe(
            null,
        );
        expect(readBoxPictureRelId(box)).toBe('rId1');
        expect(readBoxPictureRelId('<p:sp><p:txBody/></p:sp>')).toBe(null);
    });
});
