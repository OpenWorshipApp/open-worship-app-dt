import { describe, expect, test } from 'vitest';

import {
    applyParagraphLook,
    applyWordsLook,
    checkIsOfficeColorOff,
    describeOfficeLook,
    readOfficeLook,
    setSlideBackgroundXml,
    setSlideHiddenXml,
    toOfficeColor,
} from './officeXmlLookHelpers';
import { readParagraphText } from './officeXmlEditHelpers';

describe('colours', () => {
    test('hex, short hex, rgb() and a name, as Office writes them', () => {
        expect(toOfficeColor('#00b050')).toBe('00B050');
        expect(toOfficeColor('00B050')).toBe('00B050');
        expect(toOfficeColor('#0b5')).toBe('00BB55');
        expect(toOfficeColor('rgb(0, 176, 80)')).toBe('00B050');
        expect(toOfficeColor('green')).toBe('008000');
        expect(toOfficeColor('Dark Blue')).toBe('00008B');
        expect(toOfficeColor('dark-grey')).toBe('A9A9A9');
    });

    test('words that are no colour are refused', () => {
        expect(toOfficeColor('greenish')).toBeNull();
        expect(toOfficeColor('rgb(300, 0, 0)')).toBeNull();
        // three letters a word could be need the #
        expect(toOfficeColor('bad')).toBeNull();
        expect(toOfficeColor(12)).toBeNull();
        expect(checkIsOfficeColorOff('none')).toBe(true);
        expect(checkIsOfficeColorOff('No colour')).toBe(true);
        expect(checkIsOfficeColorOff('green')).toBe(false);
    });
});

describe('a look asked for', () => {
    test('read whole, said back', () => {
        const read = readOfficeLook({
            color: 'green',
            size: '40pt',
            bold: true,
            italic: false,
            font: 'Arial',
            align: 'centre',
            highlight: 'none',
        });
        expect(read).toEqual({
            look: {
                color: '008000',
                size: 40,
                bold: true,
                italic: false,
                font: 'Arial',
                align: 'center',
                highlight: null,
            },
        });
        if ('reason' in read || read.look === null) {
            throw new Error('no look');
        }
        expect(describeOfficeLook(read.look)).toBe(
            'colour green (#008000), no highlight, 40 pt, bold, not italic, ' +
                'font Arial, aligned center',
        );
        expect(readOfficeLook({ text: 'x' })).toEqual({ look: null });
    });

    test('each wrong value refused in a sentence', () => {
        expect(readOfficeLook({ color: 'greenish' })).toEqual({
            reason: expect.stringContaining('is not a colour'),
        });
        expect(readOfficeLook({ size: 0 })).toEqual({
            reason:
                "`size` is the words' size in points (1 to 400), or a " +
                'change of each word\'s own size: "+20%", "-10%", "+4" ' +
                '(points).',
        });
        expect(readOfficeLook({ bold: 'yes' })).toEqual({
            reason: '`bold` is true or false.',
        });
        expect(readOfficeLook({ font: '<b>' })).toEqual({
            reason: expect.stringContaining('`font`'),
        });
        expect(readOfficeLook({ align: 'up' })).toEqual({
            reason: '`align` is one of left, center, right, justify.',
        });
    });
});

describe('a PowerPoint line given a look', () => {
    test('every run, the break and the end; other properties kept', () => {
        const xml =
            '<a:p><a:r><a:rPr lang="en-US" b="1" dirty="0">' +
            '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>' +
            '<a:latin typeface="Calibri"/><a:hlinkClick r:id="rId2"/></a:rPr>' +
            '<a:t>Amazing</a:t></a:r><a:br/>' +
            '<a:r><a:t> grace</a:t></a:r>' +
            '<a:endParaRPr lang="en-US" dirty="0"/></a:p>';
        const out = applyParagraphLook(
            xml,
            { color: '00B050', size: 40, italic: true },
            'pptx',
        );
        expect(out).toBe(
            '<a:p><a:r><a:rPr lang="en-US" b="1" dirty="0" sz="4000" i="1">' +
                '<a:solidFill><a:srgbClr val="00B050"/></a:solidFill>' +
                '<a:latin typeface="Calibri"/><a:hlinkClick r:id="rId2"/></a:rPr>' +
                '<a:t>Amazing</a:t></a:r>' +
                '<a:br><a:rPr sz="4000" i="1"><a:solidFill><a:srgbClr val="00B050"/>' +
                '</a:solidFill></a:rPr></a:br>' +
                '<a:r><a:rPr sz="4000" i="1"><a:solidFill><a:srgbClr val="00B050"/>' +
                '</a:solidFill></a:rPr><a:t> grace</a:t></a:r>' +
                '<a:endParaRPr lang="en-US" dirty="0" sz="4000" i="1">' +
                '<a:solidFill><a:srgbClr val="00B050"/></a:solidFill>' +
                '</a:endParaRPr></a:p>',
        );
        expect(readParagraphText(out ?? '', 'pptx')).toBe('Amazing\n grace');
    });

    test('a face for every script, in the schema order; aligned', () => {
        const xml =
            '<a:p><a:pPr marL="0"/><a:r><a:rPr><a:ln/><a:effectLst/>' +
            '<a:cs typeface="Khmer OS"/></a:rPr><a:t>x</a:t></a:r></a:p>';
        expect(
            applyParagraphLook(
                xml,
                { font: 'Battambang', highlight: 'FFFF00', align: 'center' },
                'pptx',
            ),
        ).toBe(
            '<a:p><a:pPr marL="0" algn="ctr"/><a:r><a:rPr><a:ln/><a:effectLst/>' +
                '<a:highlight><a:srgbClr val="FFFF00"/></a:highlight>' +
                '<a:latin typeface="Battambang"/><a:ea typeface="Battambang"/>' +
                '<a:cs typeface="Battambang"/></a:rPr><a:t>x</a:t></a:r>' +
                '<a:endParaRPr><a:highlight><a:srgbClr val="FFFF00"/></a:highlight>' +
                '<a:latin typeface="Battambang"/><a:ea typeface="Battambang"/>' +
                '<a:cs typeface="Battambang"/></a:endParaRPr></a:p>',
        );
    });

    test('alignment alone touches no run; an empty line is opened', () => {
        expect(
            applyParagraphLook(
                '<a:p><a:r><a:t>x</a:t></a:r></a:p>',
                { align: 'right' },
                'pptx',
            ),
        ).toBe('<a:p><a:pPr algn="r"/><a:r><a:t>x</a:t></a:r></a:p>');
        expect(applyParagraphLook('<a:p/>', { bold: false }, 'pptx')).toBe(
            '<a:p><a:endParaRPr b="0"/></a:p>',
        );
    });
});

describe('a Word line given a look', () => {
    test('runs in a link too, the mark, in the schema order', () => {
        const xml =
            '<w:p><w:pPr><w:pStyle w:val="Title"/><w:rPr><w:lang w:val="en-US"/>' +
            '</w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/>' +
            '<w:b/><w:sz w:val="22"/><w14:textFill/></w:rPr><w:t>Dear</w:t></w:r>' +
            '<w:hyperlink r:id="rId3"><w:r><w:t>friends</w:t></w:r></w:hyperlink>' +
            '</w:p>';
        const out = applyParagraphLook(
            xml,
            {
                color: '00B050',
                size: 14,
                font: 'Arial',
                underline: true,
                align: 'justify',
            },
            'docx',
        );
        expect(out).toBe(
            '<w:p><w:pPr><w:pStyle w:val="Title"/><w:jc w:val="both"/>' +
                '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" ' +
                'w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="00B050"/>' +
                '<w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/>' +
                '<w:lang w:val="en-US"/></w:rPr></w:pPr>' +
                '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" ' +
                'w:eastAsia="Arial" w:cs="Arial"/><w:b/><w:color w:val="00B050"/>' +
                '<w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/>' +
                '</w:rPr><w:t>Dear</w:t></w:r>' +
                '<w:hyperlink r:id="rId3"><w:r><w:rPr><w:rFonts w:ascii="Arial" ' +
                'w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                '<w:color w:val="00B050"/><w:sz w:val="28"/><w:szCs w:val="28"/>' +
                '<w:u w:val="single"/></w:rPr><w:t>friends</w:t></w:r></w:hyperlink>' +
                '</w:p>',
        );
    });

    test('bold off, a highlight as a shading and taken off', () => {
        const xml =
            '<w:p><w:r><w:rPr><w:b/><w:highlight w:val="yellow"/></w:rPr>' +
            '<w:t>x</w:t></w:r></w:p>';
        expect(
            applyParagraphLook(
                xml,
                { bold: false, highlight: 'FFC000' },
                'docx',
            ),
        ).toBe(
            '<w:p><w:pPr><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/>' +
                '<w:shd w:val="clear" w:color="auto" w:fill="FFC000"/>' +
                '</w:rPr></w:pPr><w:r><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/>' +
                '<w:shd w:val="clear" w:color="auto" w:fill="FFC000"/>' +
                '</w:rPr><w:t>x</w:t></w:r></w:p>',
        );
        expect(applyParagraphLook(xml, { highlight: null }, 'docx')).toBe(
            '<w:p><w:pPr><w:rPr/></w:pPr><w:r><w:rPr><w:b/></w:rPr>' +
                '<w:t>x</w:t></w:r></w:p>',
        );
    });

    test('the page settings a line holds stay after its look', () => {
        const xml =
            '<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:pPr>' +
            '<w:r><w:t>Last</w:t></w:r></w:p>';
        expect(applyParagraphLook(xml, { align: 'center' }, 'docx')).toBe(
            '<w:p><w:pPr><w:jc w:val="center"/><w:sectPr><w:pgSz w:w="12240"/>' +
                '</w:sectPr></w:pPr><w:r><w:t>Last</w:t></w:r></w:p>',
        );
    });
});

describe('a slide', () => {
    const slide =
        '<p:sld xmlns:a="a" xmlns:p="p"><p:cSld name="Hymn"><p:spTree/>' +
        '</p:cSld></p:sld>';

    test('a background made, changed and taken off', () => {
        const green = setSlideBackgroundXml(slide, '00B050');
        expect(green).toBe(
            '<p:sld xmlns:a="a" xmlns:p="p"><p:cSld name="Hymn"><p:bg><p:bgPr>' +
                '<a:solidFill><a:srgbClr val="00B050"/></a:solidFill>' +
                '<a:effectLst/></p:bgPr></p:bg><p:spTree/></p:cSld></p:sld>',
        );
        const blue = setSlideBackgroundXml(green ?? '', '0000FF');
        expect(blue).toContain('<a:srgbClr val="0000FF"/>');
        expect(blue).not.toContain('00B050');
        expect(setSlideBackgroundXml(blue ?? '', null)).toBe(slide);
        expect(setSlideBackgroundXml('<p:sld/>', '000000')).toBeNull();
    });

    test('hidden in the show and shown again', () => {
        const hidden = setSlideHiddenXml(slide, true);
        expect(hidden).toContain('<p:sld xmlns:a="a" xmlns:p="p" show="0">');
        expect(setSlideHiddenXml(hidden, false)).toBe(slide);
    });
});

describe("a size against each word's own (2026-11-20)", () => {
    test('read as a change: percent, points, a word', () => {
        expect(readOfficeLook({ size: '+20%' })).toEqual({
            look: { sizeBy: { scale: 1.2, add: 0 } },
        });
        expect(readOfficeLook({ size: '90%' })).toEqual({
            look: { sizeBy: { scale: 0.9, add: 0 } },
        });
        expect(readOfficeLook({ size: '-10%' })).toEqual({
            look: { sizeBy: { scale: 0.9, add: 0 } },
        });
        expect(readOfficeLook({ size: '+4pt' })).toEqual({
            look: { sizeBy: { scale: 1, add: 4 } },
        });
        expect(readOfficeLook({ size: 'Bigger' })).toEqual({
            look: { sizeBy: { scale: 1.2, add: 0 } },
        });
        // a plain size stays one
        expect(readOfficeLook({ size: '40pt' })).toEqual({
            look: { size: 40 },
        });
        expect(readOfficeLook({ size: '+0%x' })).toHaveProperty('reason');
        expect(describeOfficeLook({ sizeBy: { scale: 0.8, add: -2 } })).toBe(
            '20% smaller, 2 pt smaller',
        );
    });

    test('each run from its own size, one with none from the base', () => {
        const look = { sizeBy: { scale: 1.5, add: 0 } };
        expect(
            applyParagraphLook(
                '<a:p><a:r><a:rPr sz="2000"/><a:t>a</a:t></a:r>' +
                    '<a:r><a:t>b</a:t></a:r></a:p>',
                look,
                'pptx',
                40,
            ),
        ).toBe(
            '<a:p><a:r><a:rPr sz="3000"/><a:t>a</a:t></a:r><a:r>' +
                '<a:rPr sz="6000"/><a:t>b</a:t></a:r>' +
                '<a:endParaRPr sz="6000"/></a:p>',
        );
        // Word's half points; 1-400 kept
        expect(
            applyParagraphLook(
                '<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>a</w:t>' +
                    '</w:r></w:p>',
                { sizeBy: { scale: 100, add: 0 } },
                'docx',
            ),
        ).toContain('<w:sz w:val="800"/>');
    });
});

describe('some words of a line given a look (2026-11-20)', () => {
    const red = { color: 'FF0000' };

    test('the runs cut at the words, the rest as it was', () => {
        const line =
            '<a:p><a:r><a:rPr lang="en-US" b="1"/><a:t>Praise the Lord, ' +
            'praise the lord</a:t></a:r></a:p>';
        const out = applyWordsLook(line, 'Lord', red, 'pptx');
        // exactly as written first: the other capitals left alone
        expect(out?.count).toBe(1);
        expect(out?.xml).toBe(
            '<a:p><a:r><a:rPr lang="en-US" b="1"/><a:t>Praise the </a:t>' +
                '</a:r><a:r><a:rPr lang="en-US" b="1"><a:solidFill>' +
                '<a:srgbClr val="FF0000"/></a:solidFill></a:rPr>' +
                '<a:t>Lord</a:t></a:r><a:r><a:rPr lang="en-US" b="1"/>' +
                '<a:t>, praise the lord</a:t></a:r></a:p>',
        );
        expect(readParagraphText(out?.xml ?? '', 'pptx')).toBe(
            'Praise the Lord, praise the lord',
        );
        // in other capitals when it is not there as written
        expect(applyWordsLook(line, 'PRAISE', red, 'pptx')?.count).toBe(2);
        expect(applyWordsLook(line, 'Amen', red, 'pptx')).toEqual({
            xml: line,
            count: 0,
        });
    });

    test('words across runs and a break; a field never cut', () => {
        const line =
            '<a:p><a:r><a:t>Jesus Chr</a:t></a:r><a:r><a:rPr b="1"/>' +
            '<a:t>ist is Lord</a:t></a:r><a:br/><a:fld id="{1}" ' +
            'type="slidenum"><a:t>12</a:t></a:fld></a:p>';
        const out = applyWordsLook(line, 'Christ', red, 'pptx');
        expect(out?.xml).toContain(
            '<a:r><a:t>Jesus </a:t></a:r><a:r><a:rPr><a:solidFill>' +
                '<a:srgbClr val="FF0000"/></a:solidFill></a:rPr>' +
                '<a:t>Chr</a:t></a:r><a:r><a:rPr b="1"><a:solidFill>',
        );
        expect(out?.xml).toContain('<a:t>ist</a:t></a:r><a:r><a:rPr b="1"/>');
        // part of a field: left as it is
        expect(applyWordsLook(line, '1', red, 'pptx')?.xml).toContain(
            '<a:fld id="{1}" type="slidenum"><a:t>12</a:t></a:fld>',
        );
    });

    test('Word: spaces kept, a tab in the run kept after the words', () => {
        const out = applyWordsLook(
            '<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Hello Lord</w:t><w:tab/>' +
                '<w:t>x</w:t></w:r></w:p>',
            'Hello',
            { bold: true },
            'docx',
        );
        expect(out?.xml).toBe(
            '<w:p><w:r><w:rPr><w:b/><w:bCs/><w:i/></w:rPr><w:t>Hello</w:t>' +
                '</w:r><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">' +
                ' Lord</w:t><w:tab/><w:t>x</w:t></w:r></w:p>',
        );
    });
});
