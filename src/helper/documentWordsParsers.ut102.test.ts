// @vitest-environment jsdom
//
// The parsers on what a converter or a slide document can carry beside the
// words: a comment and a script or style block inside a paragraph (never
// words, never counted in a face), and canvas items that are no item.

import { describe, expect, test } from 'vitest';

import {
    parseAppDocumentSlide,
    parseDocxPageHtml,
    parsePptxSlideHtml,
} from './documentWordsParsers';

describe('what is inside a paragraph but is not words', () => {
    test('a Word page: a comment, a script and a style block are left out', () => {
        const page = parseDocxPageHtml(
            '<html><body style="font-family:\'Body Face\'">' +
                '<p>Amazing<!-- a reviewer note --> grace' +
                '<script>window.sung = "not sung";</script>' +
                '<style>.x { color: red; }</style> how sweet</p>' +
                '</body></html>',
            { number: 1, width: 816, height: 1056 },
        );
        expect(page.shapes).toHaveLength(1);
        expect(page.shapes[0].lines).toEqual(['Amazing grace how sweet']);
        // Only the sung letters are counted in the face.
        expect(page.shapes[0].fontCountMap).toEqual({ 'Body Face': 20 });
    });

    test('a PowerPoint slide: the same, inside a shape', () => {
        const page = parsePptxSlideHtml(
            '<html><body><svg width="1280" height="720">' +
                '<g data-id="1" transform="translate(10,20)">' +
                '<rect width="600" height="300"/>' +
                '<foreignObject width="600" height="300">' +
                '<div xmlns="http://www.w3.org/1999/xhtml">' +
                '<p><span style="font-family:\'Slide Face\'">Praise God</span>' +
                '<!-- speaker cue --><style>p { margin: 0; }</style>' +
                '<script>var cue = 1;</script></p>' +
                '</div></foreignObject></g></svg></body></html>',
            { number: 2, isHidden: false, width: 1280, height: 720 },
        );
        expect(page.shapes).toEqual([
            {
                x: 10,
                y: 20,
                width: 600,
                height: 300,
                lines: ['Praise God'],
                fontCountMap: { 'Slide Face': 9 },
            },
        ]);
    });
});

describe('a slide document item that is no item', () => {
    test('a null or a number among the canvas items is passed over', () => {
        const page = parseAppDocumentSlide(
            {
                canvasItems: [
                    null,
                    7,
                    'text',
                    {
                        type: 'text',
                        text: 'Amazing grace',
                        fontFamily: 'Slide Face',
                        left: 10,
                        top: 20,
                        width: 300,
                        height: 100,
                    },
                ],
            },
            { number: 1, width: 1920, height: 1080 },
        );
        expect(page.shapes).toEqual([
            {
                x: 10,
                y: 20,
                width: 300,
                height: 100,
                lines: ['Amazing grace'],
                fontCountMap: { 'Slide Face': 12 },
            },
        ]);
        expect(page.pictures).toEqual([]);
        expect(page.isHidden).toBe(false);
    });
});
