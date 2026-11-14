import { describe, expect, test } from 'vitest';

import {
    dropRunningLines,
    readHtmlLines,
    readSlideHtmlLines,
    toPdfPageBlocks,
} from '../../../../../../chatbot/documentTextHelpers';

// A slide as `pptx-to-html-conv` 1.0.4 writes it, in the shape of the
// user's own hymn deck (`1 .)  # 1 new.pptx`, slide 2): the head, the style
// sheet inside the body, a picture, the header box with its zero-width
// space, the verse box with its empty paragraphs (EC-590). The words are
// made up: a fixture is copied into every clone, and a song's words belong
// to whoever wrote them.
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
<p style="text-align:center;"><span style="font-size:24.0pt;">#  ១​  ថ្មី  ១/៤</span></p>
</div>
</foreignObject>
</g>
<g data-id="2-3" transform="translate(-10,97)">
<foreignObject x="0" y="0" width="1300.3" height="521.6" overflow="visible">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;">
<p style="text-align:center;"><span style="color:#FFFF00;">១-</span><span style="color:#FFFFFF;"> ចង្កៀង​មួយ  នៅ​លើ​ទឹក​​​ ?  គ្មាន</span></p>
<p style="text-align:center;"><span style="color:#FFFFFF;">អ្នក​ណា  ចែវ​ទូក  ទៅ​ផ្ទះ  </span></p>
<p style="text-align:center;line-height:0.78;">&nbsp;</p>
<p style="text-align:center;line-height:0.78;">&nbsp;</p>
</div>
</foreignObject>
</g>
</svg>
</div>
</body>
</html>`;

describe('a Khmer hymnal deck, as the converter writes it', () => {
    test("a converted slide's lines, its empty paragraphs left out", () => {
        expect(readSlideHtmlLines(SLIDE_HTML)).toEqual([
            '# ១​ ថ្មី ១/៤',
            '១- ចង្កៀង​មួយ នៅ​លើ​ទឹក​​​ ? គ្មាន',
            'អ្នក​ណា ចែវ​ទូក ទៅ​ផ្ទះ',
        ]);
    });

    test("a stanza's number in its own colour is the song's, no bullet", () => {
        expect(
            readHtmlLines(
                '<p><span style="color:#ff0;">១-</span><span> ចង្កៀង</span></p>',
            ),
        ).toEqual(['១- ចង្កៀង']);
    });

    test('a zero-width space between two words is kept: the word break', () => {
        expect(readHtmlLines('<p>​​</p><p>ក​ខ</p>')).toEqual(['', 'ក​ខ']);
    });

    test("the header every slide repeats goes, whatever its number's digits", () => {
        expect(
            dropRunningLines([
                ['# ១​ ថ្មី ១/៤', '១- ចង្កៀង​មួយ', 'នៅ​លើ​ទឹក'],
                ['# ១ ថ្មី ២/៤', '២- ពេល​ព្រឹក', 'នៅ​តែ​ភ្លឺ'],
                ['# ១ ថ្មី ៣/៤', '៣- ទូក​ទាំង​អស់', 'អរ​សប្បាយ'],
            ]),
        ).toEqual([
            ['១- ចង្កៀង​មួយ', 'នៅ​លើ​ទឹក'],
            ['២- ពេល​ព្រឹក', 'នៅ​តែ​ភ្លឺ'],
            ['៣- ទូក​ទាំង​អស់', 'អរ​សប្បាយ'],
        ]);
    });
});

describe("a PDF's page in Khmer digits", () => {
    test('its own number on its first or last line is left out', () => {
        expect(toPdfPageBlocks([{ text: '១\nចង្កៀង\n២ / ៥' }])).toEqual([
            ['ចង្កៀង'],
        ]);
    });
});
