import { describe, expect, test } from 'vitest';

import {
    checkIsOfficeTextName,
    checkIsSongDocumentName,
    dropRunningLines,
    joinBlocks,
    readHtmlLines,
    readSlideHtmlLines,
    readWordPageLines,
    toPdfPageBlocks,
    toSlideDocumentBlocks,
} from './documentTextHelpers';

// A slide as `pptx-to-html-conv` 1.0.4 writes it -- the shape of the
// user's own hymn deck (`1 .)  # 1 new.pptx`, slide 2), in English words;
// the deck itself is the Khmer package's test: the head, the style sheet
// inside the body, a picture, the header box with its zero-width space, the
// verse box with its empty paragraphs.
const SLIDE_HTML = `\uFEFF<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Slide 2</title>
</head>
<body style="width:1280px;height:720px;">
<style>
* { margin: 0; padding: 0; }
</style>
<div class="slide">
<svg class="pptx-slide-layer" xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
<rect width="1280" height="720" fill="#ffffff"/>
<g data-id="2-1" transform="translate(-10,-12)">
<image href="images/image2.jpg" width="1300.3" height="742.8" preserveAspectRatio="none"/>
</g>
<g data-id="2-2" transform="translate(72,-12)">
<foreignObject x="0" y="0" width="205.0" height="85.1" overflow="visible">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;">
<p style="text-align:center;"><span style="font-size:24.0pt;">#  12\u200b  New  1/4</span></p>
</div>
</foreignObject>
</g>
<g data-id="2-3" transform="translate(-10,97)">
<foreignObject x="0" y="0" width="1300.3" height="521.6" overflow="visible">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;">
<p style="text-align:center;"><span style="color:#FFFF00;">1-</span><span style="color:#FFFFFF;"> What more\u200b\u200b can I say ?  Though I had</span></p>
<p style="text-align:center;"><span style="color:#FFFFFF;">a thousand  tongues it would  not be enough  </span></p>
<p style="text-align:center;line-height:0.78;">&nbsp;</p>
<p style="text-align:center;line-height:0.78;">&nbsp;</p>
</div>
</foreignObject>
</g>
</svg>
</div>
</body>
</html>`;

// A page as `docx-to-html-conv` 1.0.4 writes it: a header and a footer the
// song is no part of, an empty paragraph between verses, a line break
// inside a paragraph, a tab, an ampersand.
const WORD_PAGE_HTML = `\uFEFF<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>hymn – Page 1</title>
</head>
<body style="font-size: 11pt;">
<style>
.document { position: absolute; }
</style>
<div class="page-header">
<p>Grace Church Hymnal</p>
</div>
<div class="document">
<h1>Amazing Grace</h1>
<p>&nbsp;</p>
<p>Amazing grace, how sweet the sound<br/>That saved a wretch like me</p>
<p>&nbsp;</p>
<p>I once was lost,<span style="display:inline-block;width:36pt;"></span>but now am found</p>
<p>Was blind, but now I see &amp; more</p>
</div>
<div class="page-footer">
<p>Page 1</p>
</div>
</body>
</html>`;

describe('the names', () => {
    test('a deck and a Word file go through the converters', () => {
        expect(checkIsOfficeTextName('Amazing Grace.pptx')).toBe(true);
        expect(checkIsOfficeTextName('hymn.DOCX')).toBe(true);
        expect(checkIsOfficeTextName('old.ppt')).toBe(false);
        expect(checkIsOfficeTextName('old.doc')).toBe(false);
        expect(checkIsOfficeTextName('notes.pdf')).toBe(false);
    });

    test('a slide document, a deck, a Word file and a PDF make a song', () => {
        for (const name of [
            'Sunday.ows',
            'Amazing Grace.pptx',
            'hymn.docx',
            '/docs/Hymn 12.PDF',
        ]) {
            expect(checkIsSongDocumentName(name), name).toBe(true);
        }
        for (const name of [
            'song.owl',
            'flow.owpf',
            'old.ppt',
            'old.doc',
            'words.txt',
            'picture.png',
            '',
        ]) {
            expect(checkIsSongDocumentName(name), name).toBe(false);
        }
    });
});

describe('readHtmlLines', () => {
    test('a paragraph is a line, an empty one an empty line', () => {
        expect(
            readHtmlLines('<p>one</p><p>&nbsp;</p><p> two  words </p>'),
        ).toEqual(['one', '', 'two words']);
    });

    test('a break inside a paragraph starts the next line', () => {
        expect(readHtmlLines('<p>first<br/>second<br>third</p>')).toEqual([
            'first',
            'second',
            'third',
        ]);
    });

    test('every entity the converters write is read back', () => {
        expect(
            readHtmlLines(
                '<p>&lt;b&gt; &quot;Holy&quot; &amp; It&#39;s &#169; 2026 &#128512; &#x41;</p>',
            ),
        ).toEqual(['<b> "Holy" & It\'s © 2026 😀 A']);
    });

    test('the head, a style sheet, a script and a chart are no words', () => {
        expect(
            readHtmlLines(
                '<html><head><title>Slide 1</title></head><body>' +
                    '<style>p { color: red; }</style>' +
                    '<script>var x = "<p>no</p>";</script>' +
                    '<!-- <p>no</p> -->' +
                    '<svg><text x="1">42</text></svg>' +
                    '<p>yes</p></body></html>',
            ),
        ).toEqual(['yes']);
    });

    test('words outside a paragraph end where their block does', () => {
        expect(
            readHtmlLines(
                '<ul><li>one</li><li>two</li></ul>' +
                    '<table><tr><td>a</td><td><p>b</p></td></tr></table>',
            ),
        ).toEqual(['one', 'two', 'a', 'b']);
    });

    test("a bullet the deck converter wrote is the slide's, not the song's", () => {
        expect(
            readHtmlLines(
                '<p style="margin-left:24px"><span style="color:#fff;">•</span>&nbsp;<span>He lives</span></p>' +
                    '<p><span>1.</span>&nbsp;<span>He reigns</span></p>' +
                    '<p><span style="color:#ff0;">1-</span><span> What</span></p>',
            ),
        ).toEqual(['He lives', 'He reigns', '1- What']);
    });

    test('a line of invisible marks is empty, a word break inside is kept', () => {
        expect(
            readHtmlLines('<p>\u200b\u200b</p><p>Holy\u200bGod</p>'),
        ).toEqual(['', 'Holy\u200bGod']);
    });

    test('a zero-width space at a line edge goes, a direction mark stays', () => {
        // EC-590: a title slide's number line ended in its colon, a
        // zero-width space and a space, and the colon the title is read by
        // was hidden behind the mark.
        expect(
            readHtmlLines(
                '<p>No. 5 : \u200b </p><p>\u200bBlue Lantern\u2060</p>' +
                    '<p>\u200fGrace to you</p><p>Holy\u200b God</p>',
            ),
        ).toEqual([
            'No. 5 :',
            'Blue Lantern',
            '\u200fGrace to you',
            'Holy\u200b God',
        ]);
    });
});

describe('readSlideHtmlLines', () => {
    test("a converted slide's lines, its empty paragraphs left out", () => {
        expect(readSlideHtmlLines(SLIDE_HTML)).toEqual([
            '# 12\u200b New 1/4',
            '1- What more\u200b\u200b can I say ? Though I had',
            'a thousand tongues it would not be enough',
        ]);
    });
});

describe('readWordPageLines', () => {
    test('the body of the page, its empty lines kept, no header or footer', () => {
        expect(readWordPageLines(WORD_PAGE_HTML)).toEqual([
            'Amazing Grace',
            '',
            'Amazing grace, how sweet the sound',
            'That saved a wretch like me',
            '',
            'I once was lost, but now am found',
            'Was blind, but now I see & more',
        ]);
    });

    test('a page with no body part is read whole', () => {
        expect(readWordPageLines('<body><p>only</p></body>')).toEqual(['only']);
    });
});

describe('dropRunningLines', () => {
    test('a header every slide repeats but for its numbers goes', () => {
        expect(
            dropRunningLines([
                ['Hymn 12: Morning Light'],
                ['# 12 1/3', '1. first line', 'second line'],
                ['# 12 2/3', '2. third line', 'fourth line'],
                [],
                ['# 12\u200b 3/3', '3. fifth line', 'sixth line'],
            ]),
        ).toEqual([
            ['Hymn 12: Morning Light'],
            ['1. first line', 'second line'],
            ['2. third line', 'fourth line'],
            ['3. fifth line', 'sixth line'],
        ]);
    });

    test('a repeated last line is kept once, on the last slide', () => {
        expect(
            dropRunningLines([
                ['first', '(c) 2026 Some Church'],
                ['second', '(c) 2026 Some Church'],
                ['third', '(c) 2026 Some Church'],
            ]),
        ).toEqual([['first'], ['second'], ['third', '(c) 2026 Some Church']]);
    });

    test('a line on one slide in five is not furniture', () => {
        const slides = [
            ['Chorus', 'a'],
            ['Verse', 'b'],
            ['Bridge', 'c'],
            ['Tag', 'd'],
        ];
        expect(dropRunningLines(slides)).toEqual(slides);
    });
});

describe('joinBlocks', () => {
    test('a blank line between blocks, never two', () => {
        expect(
            joinBlocks([['a', 'b'], [], ['c', '', '', '', 'd'], ['', '']]),
        ).toBe('a\nb\n\nc\n\nd');
        expect(joinBlocks([])).toBe('');
    });
});

describe('toSlideDocumentBlocks', () => {
    test("a slide's text boxes, a slide a block, a slide turned off left out", () => {
        const text = JSON.stringify({
            items: [
                {
                    id: 1,
                    canvasItems: [
                        { type: 'image', text: 'not words' },
                        {
                            type: 'text',
                            text: 'Amazing grace\nHow sweet the sound',
                        },
                        { type: 'text', text: '  \n' },
                    ],
                },
                {
                    id: 2,
                    isDisabled: true,
                    canvasItems: [{ type: 'text', text: 'Announcements' }],
                },
                { id: 3, canvasItems: [] },
                {
                    id: 4,
                    canvasItems: [
                        { type: 'text', text: 'I once was lost\r\n but now' },
                    ],
                },
            ],
        });
        expect(toSlideDocumentBlocks(`\uFEFF${text}`)).toEqual([
            ['Amazing grace', 'How sweet the sound'],
            ['I once was lost', 'but now'],
        ]);
    });

    test('a file that is not a slide document is none', () => {
        expect(toSlideDocumentBlocks('{ not json')).toBeNull();
        expect(toSlideDocumentBlocks('{"slides": []}')).toBeNull();
        expect(toSlideDocumentBlocks('{"items": []}')).toEqual([]);
    });
});

describe('toPdfPageBlocks', () => {
    test("each page's lines, its own number and the running header gone", () => {
        expect(
            toPdfPageBlocks([
                {
                    text: 'Hymnal\n\nAmazing Grace\nAmazing grace\nhow sweet the sound\n\nThat saved a wretch\n\n- 1 -\n',
                },
                { text: 'Hymnal\nI once was lost\nbut now am found\nPage 2' },
                { text: null },
                { text: '   \n\n' },
            ]),
        ).toEqual([
            [
                'Amazing Grace',
                'Amazing grace',
                'how sweet the sound',
                '',
                'That saved a wretch',
            ],
            ['I once was lost', 'but now am found'],
        ]);
    });

    test('a number in the words is not a page number', () => {
        expect(
            toPdfPageBlocks([{ text: '12 Gates\n10,000 reasons\n3 of us' }]),
        ).toEqual([['12 Gates', '10,000 reasons', '3 of us']]);
        expect(
            toPdfPageBlocks([{ text: '3\nAmazing grace\nPage 3 of 5' }]),
        ).toEqual([['Amazing grace']]);
    });
});
