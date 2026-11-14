// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
    parseAppDocumentSlide,
    parseDocxPageHtml,
    parsePdfPageText,
    parsePptxSlideHtml,
    toFirstFontFamily,
} from './documentWordsParsers';
import { genDocumentWords } from './documentWordsRules';

// The shape `pptx-to-html-conv` writes (read off a real deck's slide2.html):
// each shape a `<g data-id>` moved by `translate`, sized by its `rect`, its
// words in `<p>`s of `<span>`s naming a face; a picture an `<img>`.
function genPptxSlide(header: string, lines: string[]) {
    const paragraphs = lines
        .map((line) => {
            return (
                "<p style=\"text-align:center;font-family:'Calibri Light'," +
                "'Arial',sans-serif;\">" +
                `<span style="font-size:44.0pt;font-family:'Body Face',sans-serif">${line}</span>` +
                '</p>'
            );
        })
        .join('');
    return (
        '<!DOCTYPE html><html><head><style>' +
        "@font-face { font-family: 'Body Face'; src: url('fonts/a.ttf'); }" +
        '</style></head><body><div class="slide">' +
        '<svg class="pptx-slide-layer" width="1280" height="720">' +
        '<g data-id="2-1" data-pptx-id="2" transform="translate(49,44)">' +
        '<rect width="1181.9" height="70.7" fill="#548235"/>' +
        '<foreignObject x="0" y="0" width="1181.9" height="70.7">' +
        '<div xmlns="http://www.w3.org/1999/xhtml">' +
        '<p style="font-family:\'Calibri\',sans-serif;">' +
        `<span style="font-family:'Display Face',sans-serif">${header}</span>` +
        '<span style="font-family:\'Arial\',sans-serif"> (HYMN)</span>' +
        '</p></div></foreignObject></g>' +
        '<g data-id="2-2" data-pptx-id="4" transform="translate(49,127)">' +
        '<rect width="1181.9" height="549.2" fill="#3DB3B0"/>' +
        '<foreignObject x="0" y="0" width="1181.9" height="549.2">' +
        `<div xmlns="http://www.w3.org/1999/xhtml">${paragraphs}</div>` +
        '</foreignObject></g>' +
        '<g data-id="2-3" transform="translate(614,244)">' +
        '<foreignObject width="51" height="51">' +
        '<img src="images/image1.png" alt="audio" />' +
        '</foreignObject></g>' +
        '</svg></div></body></html>'
    );
}

describe('documentWordsParsers', () => {
    it('reads the first family of a font stack', () => {
        expect(toFirstFontFamily("'Body Face', 'Arial', sans-serif")).toBe(
            'Body Face',
        );
        expect(toFirstFontFamily('"Display Face"')).toBe('Display Face');
        expect(toFirstFontFamily('inherit')).toBeNull();
        expect(toFirstFontFamily('')).toBeNull();
    });

    it('reads a PowerPoint slide as placed boxes with their faces', () => {
        const page = parsePptxSlideHtml(
            genPptxSlide('Song No. 2', ['First line', 'Second line']),
            { number: 2, isHidden: false, width: 1280, height: 720 },
        );
        expect(page.shapes).toHaveLength(2);
        const [header, body] = page.shapes;
        expect(header).toMatchObject({ x: 49, y: 44, height: 70.7 });
        expect(header.lines).toEqual(['Song No. 2 (HYMN)']);
        expect(header.fontCountMap).toEqual({
            'Display Face': 8,
            Arial: 6,
        });
        expect(body).toMatchObject({ x: 49, y: 127, height: 549.2 });
        expect(body.lines).toEqual(['First line', 'Second line']);
        expect(body.fontCountMap).toEqual({ 'Body Face': 19 });
        expect(page.pictures).toEqual([
            { x: 614, y: 244, width: 51, height: 51 },
        ]);
    });

    it('drafts a deck: heading out, body face kept, icon slide empty', () => {
        const pages = [
            parsePptxSlideHtml(
                genPptxSlide('Song No. 1', ['Line A', 'Line B']),
                {
                    number: 1,
                    isHidden: false,
                    width: 1280,
                    height: 720,
                },
            ),
            parsePptxSlideHtml(
                genPptxSlide('Song No. 2', ['Line C', 'Line D']),
                {
                    number: 2,
                    isHidden: false,
                    width: 1280,
                    height: 720,
                },
            ),
        ];
        const result = genDocumentWords(pages, { fileTitle: 'Deck' });
        expect(result.title).toBe('Song No. 1 (HYMN)');
        expect(result.fontFamily).toBe('Body Face');
        expect(result.text).toBe(
            'Song No. 1 (HYMN)\n\nLine A\nLine B\n\nLine C\nLine D',
        );
    });

    it('reads a Word page: a heading apart, a blank paragraph parts stanzas', () => {
        const page = parseDocxPageHtml(
            '<html><body style="font-family: \'Body Face\', serif;">' +
                '<h1>Amazing Grace</h1>' +
                '<p><span style="font-family:\'Run Face\'">Amazing grace</span></p>' +
                '<p>how sweet the sound<br>that saved a wretch</p>' +
                '<p>&nbsp;</p>' +
                '<ul><li><p>I once was lost</p></li></ul>' +
                '<img src="a.png" width="800" height="600">' +
                '</body></html>',
            { number: 1, width: 816, height: 1056 },
        );
        expect(page.shapes[0]).toMatchObject({
            lines: ['Amazing Grace'],
            isHeading: true,
        });
        expect(page.shapes[1].lines).toEqual([
            'Amazing grace',
            'how sweet the sound',
            'that saved a wretch',
            ' ',
            'I once was lost',
        ]);
        expect(page.shapes[1].fontCountMap).toEqual({
            'Run Face': 12,
            'Body Face': 44,
        });
        expect(page.pictures).toEqual([
            { x: 0, y: 0, width: 800, height: 600 },
        ]);
        const result = genDocumentWords([page], { fileTitle: 'file' });
        expect(result.title).toBe('Amazing Grace');
        expect(result.fontFamily).toBe('Body Face');
        expect(result.text).toBe(
            'Amazing Grace\n\nAmazing grace\nhow sweet the sound\n' +
                'that saved a wretch\n\nI once was lost',
        );
    });

    it('takes a PDF page with no text as a picture to read', () => {
        const scanned = parsePdfPageText('  \n ', {
            number: 3,
            width: 612,
            height: 792,
        });
        expect(scanned.shapes).toEqual([]);
        expect(scanned.pictures).toEqual([
            { x: 0, y: 0, width: 612, height: 792 },
        ]);
        const text = parsePdfPageText('Line one\nLine two', {
            number: 1,
            width: 612,
            height: 792,
        });
        expect(text.shapes[0].lines).toEqual(['Line one', 'Line two']);
        expect(text.pictures).toEqual([]);
        const result = genDocumentWords([text, scanned], { fileTitle: 'Scan' });
        expect(result.pictureNeededPages).toEqual([3]);
    });

    it('reads a slide document: text and html boxes, pictures, hidden', () => {
        const page = parseAppDocumentSlide(
            {
                isDisabled: true,
                canvasItems: [
                    {
                        type: 'text',
                        text: '#92 new',
                        fontFamily: 'Face A',
                        left: 658,
                        top: 737,
                        width: 603,
                        height: 141,
                    },
                    {
                        type: 'image',
                        srcData: 'data:image/png;base64,AAAA',
                        left: 0,
                        top: 0,
                        width: 1920,
                        height: 1080,
                    },
                    {
                        type: 'html',
                        html: '<p>Line <b>one</b></p><p>Line two</p>',
                        left: 10,
                        top: 10,
                        width: 500,
                        height: 300,
                    },
                    { type: 'bible', left: 0, top: 0, width: 10, height: 10 },
                ],
            },
            { number: 1, width: 1920, height: 1080 },
        );
        expect(page.isHidden).toBe(true);
        expect(page.shapes.map((shape) => shape.lines)).toEqual([
            ['#92 new'],
            ['Line one', 'Line two'],
        ]);
        expect(page.shapes[0].fontCountMap).toEqual({ 'Face A': 6 });
        expect(page.pictures).toEqual([
            { x: 0, y: 0, width: 1920, height: 1080 },
        ]);
    });

    it('sends a picture slide with a number on it to the picture route', () => {
        const page = parseAppDocumentSlide(
            {
                canvasItems: [
                    {
                        type: 'text',
                        text: '12',
                        fontFamily: 'Face A',
                        top: 900,
                    },
                    {
                        type: 'image',
                        left: 0,
                        top: 0,
                        width: 1920,
                        height: 1080,
                    },
                ],
            },
            { number: 1, width: 1920, height: 1080 },
        );
        const result = genDocumentWords([page], { fileTitle: 'Song 12' });
        expect(result.pictureNeededPages).toEqual([1]);
        expect(result.skipped.numbers).toBe(1);
    });
});
