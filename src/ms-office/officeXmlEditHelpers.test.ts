import { describe, expect, test } from 'vitest';

import {
    listOfficeParagraphs,
    readParagraphText,
    rebuildParagraph,
    replaceInParagraph,
    replaceParagraphRange,
    setParagraphText,
    toWrittenText,
    toXmlSafeText,
    unescapeXml,
} from './officeXmlEditHelpers';

const BOLD = '<a:rPr lang="en-US" b="1" dirty="0"/>';
const PLAIN = '<a:rPr lang="en-US" dirty="0"/>';

function genSlideXml(shapes: string) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<p:sld xmlns:a="a" xmlns:p="p" xmlns:r="r"><p:cSld><p:spTree>' +
        shapes +
        '</p:spTree></p:cSld></p:sld>'
    );
}

function genShape(name: string, placeholder: string | null, body: string) {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${name}"/><p:cNvSpPr/>` +
        `<p:nvPr>${placeholder === null ? '' : `<p:ph type="${placeholder}"/>`}` +
        '</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
        body +
        '</p:txBody></p:sp>'
    );
}

describe('listOfficeParagraphs', () => {
    test('reads a slide line by line with its box, breaks as new lines', () => {
        const xml = genSlideXml(
            genShape(
                'Title 1',
                'title',
                `<a:p><a:r>${BOLD}<a:t>Amazing </a:t></a:r>` +
                    `<a:r>${PLAIN}<a:t>Grace</a:t></a:r></a:p>`,
            ) +
                genShape(
                    'TextBox 3',
                    null,
                    `<a:p><a:pPr algn="ctr"/><a:r>${PLAIN}<a:t>how sweet</a:t></a:r>` +
                        `<a:br>${PLAIN}</a:br><a:r>${PLAIN}<a:t>the sound</a:t></a:r>` +
                        '<a:endParaRPr lang="en-US"/></a:p>' +
                        '<a:p><a:endParaRPr lang="en-US"/></a:p>',
                ),
        );
        const lines = listOfficeParagraphs(xml, 'pptx');
        expect(
            lines.map((line) => {
                return [line.box, line.text];
            }),
        ).toEqual([
            ['title', 'Amazing Grace'],
            ['TextBox 3', 'how sweet\nthe sound'],
            ['TextBox 3', ''],
        ]);
        // the two lines of one box share it; the title is a box of its own
        expect(lines[1].containerStart).toBe(lines[2].containerStart);
        expect(lines[0].containerStart).not.toBe(lines[1].containerStart);
        expect(xml.slice(lines[0].start, lines[0].end)).toBe(lines[0].xml);
    });

    test('reads escaped words as the words they are', () => {
        const xml = genSlideXml(
            genShape(
                'Title 1',
                'title',
                `<a:p><a:r>${PLAIN}<a:t>Faith &amp; hope &lt;3 &#x263A;</a:t></a:r></a:p>`,
            ),
        );
        expect(listOfficeParagraphs(xml, 'pptx')[0].text).toBe(
            'Faith & hope <3 ☺',
        );
    });

    test('a Word body: styles, tabs, table cells, the old-reader copy hidden', () => {
        const xml =
            '<w:document><w:body>' +
            '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
            '<w:r><w:t>Order of service</w:t></w:r></w:p>' +
            '<w:p><w:r><w:t>Welcome</w:t><w:tab/><w:t>10:00</w:t></w:r></w:p>' +
            '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
            '<w:p/>' +
            '<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><w:txbxContent>' +
            '<w:p><w:r><w:t>in a box</w:t></w:r></w:p>' +
            '</w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>' +
            '<w:p><w:r><w:t>in a box</w:t></w:r></w:p>' +
            '</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>' +
            '<w:sectPr/></w:body></w:document>';
        const lines = listOfficeParagraphs(xml, 'docx');
        expect(
            lines.map((line) => {
                return [line.text, line.box, line.isTable, line.isHidden];
            }),
        ).toEqual([
            ['Order of service', 'Heading1', false, false],
            ['Welcome\t10:00', null, false, false],
            ['cell', null, true, false],
            ['', null, false, false],
            ['in a box', null, false, false],
            ['in a box', null, false, true],
        ]);
    });

    test('words inside paragraph properties are not words of the line', () => {
        const xml =
            '<w:p><w:pPr><w:rPr><w:t>not me</w:t></w:rPr></w:pPr>' +
            '<w:r><w:t>me</w:t></w:r></w:p>';
        expect(readParagraphText(xml, 'docx')).toBe('me');
    });
});

describe('replaceParagraphRange', () => {
    const line =
        `<a:p><a:r>${BOLD}<a:t>Amazing </a:t></a:r>` +
        `<a:r>${PLAIN}<a:t>Grace</a:t></a:r></a:p>`;

    test('a word changed in its own run, the bold run untouched', () => {
        const out = replaceParagraphRange(line, 8, 13, 'Love', 'pptx');
        expect(out).toBe(
            `<a:p><a:r>${BOLD}<a:t>Amazing </a:t></a:r>` +
                `<a:r>${PLAIN}<a:t>Love</a:t></a:r></a:p>`,
        );
    });

    test('a change across two runs goes into the first and empties the rest', () => {
        const out = replaceParagraphRange(line, 4, 10, 'xx', 'pptx');
        expect(readParagraphText(out ?? '', 'pptx')).toBe('Amazxxace');
        expect(out).toContain(`${BOLD}<a:t>Amazxx</a:t>`);
        expect(out).toContain(`${PLAIN}<a:t>ace</a:t>`);
    });

    test('a new line written rebuilds the line in the first run’s look', () => {
        const out = replaceParagraphRange(line, 0, 13, 'one\ntwo', 'pptx');
        expect(out).toBe(
            `<a:p><a:r>${BOLD}<a:t>one</a:t></a:r><a:br>${BOLD}</a:br>` +
                `<a:r>${BOLD}<a:t>two</a:t></a:r></a:p>`,
        );
    });

    test('escapes what it writes', () => {
        const out = replaceParagraphRange(line, 8, 13, 'A & <B>', 'pptx');
        expect(out).toContain('<a:t>A &amp; &lt;B&gt;</a:t>');
        expect(readParagraphText(out ?? '', 'pptx')).toBe('Amazing A & <B>');
    });

    test('Word keeps a space at either end of a run', () => {
        const out = replaceParagraphRange(
            '<w:p><w:r><w:t>Hello</w:t></w:r></w:p>',
            5,
            5,
            ' there ',
            'docx',
        );
        expect(out).toBe(
            '<w:p><w:r><w:t xml:space="preserve">Hello there </w:t></w:r></w:p>',
        );
    });
});

describe('setParagraphText', () => {
    test('only the words that differ change', () => {
        const xml =
            `<a:p><a:r>${BOLD}<a:t>Jesus</a:t></a:r>` +
            `<a:r>${PLAIN}<a:t> loves me</a:t></a:r></a:p>`;
        const out = setParagraphText(xml, 'Jesus loves you', 'pptx');
        expect(out).toBe(
            `<a:p><a:r>${BOLD}<a:t>Jesus</a:t></a:r>` +
                `<a:r>${PLAIN}<a:t> loves you</a:t></a:r></a:p>`,
        );
        expect(setParagraphText(xml, 'Jesus loves me', 'pptx')).toBe(xml);
    });

    test('an empty line takes its end-of-line look', () => {
        const out = setParagraphText(
            '<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US" sz="4000"/></a:p>',
            'Hello',
            'pptx',
        );
        expect(out).toBe(
            '<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="4000"/>' +
                '<a:t>Hello</a:t></a:r><a:endParaRPr lang="en-US" sz="4000"/></a:p>',
        );
    });

    test('a Word line keeps its picture run and its link', () => {
        const xml =
            '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
            '<w:r><w:rPr><w:b/></w:rPr><w:t>Old</w:t><w:br/><w:t>words</w:t></w:r>' +
            '<w:r><w:drawing>PIC</w:drawing></w:r>' +
            '<w:hyperlink r:id="rId5"><w:r><w:t> link</w:t></w:r></w:hyperlink></w:p>';
        const out = setParagraphText(xml, 'New\twords', 'docx') ?? '';
        expect(readParagraphText(out, 'docx')).toBe('New\twords');
        expect(out).toContain('<w:jc w:val="center"/>');
        expect(out).toContain('<w:r><w:drawing>PIC</w:drawing></w:r>');
        expect(out).toContain('<w:rPr><w:b/></w:rPr>');
        expect(out).toContain('<w:hyperlink r:id="rId5"></w:hyperlink>');
    });

    test('a self-closing Word line gets its words', () => {
        expect(setParagraphText('<w:p/>', 'Hi', 'docx')).toBe(
            '<w:p><w:r><w:t xml:space="preserve">Hi</w:t></w:r></w:p>',
        );
    });
});

describe('rebuildParagraph as a copy', () => {
    test('drops what a copy must not carry twice', () => {
        const xml =
            '<w:p w14:paraId="1A2B" w14:textId="3C4D"><w:bookmarkStart w:id="0" w:name="x"/>' +
            '<w:r><w:t>Old</w:t></w:r><w:r><w:commentReference w:id="1"/></w:r>' +
            '<w:bookmarkEnd w:id="0"/></w:p>';
        const out = rebuildParagraph(xml, 'New', 'docx', true) ?? '';
        expect(out).not.toContain('paraId');
        expect(out).not.toContain('bookmark');
        expect(out).not.toContain('commentReference');
        expect(readParagraphText(out, 'docx')).toBe('New');
    });
});

describe('replaceInParagraph', () => {
    test('every place, across runs, counted', () => {
        const xml =
            `<a:p><a:r>${PLAIN}<a:t>Lord, Lo</a:t></a:r>` +
            `<a:r>${BOLD}<a:t>rd and Lord</a:t></a:r></a:p>`;
        const out = replaceInParagraph(xml, 'Lord', 'God', 'pptx');
        expect(out.count).toBe(3);
        expect(readParagraphText(out.xml, 'pptx')).toBe('God, God and God');
    });

    test('nothing found changes nothing', () => {
        const xml = `<a:p><a:r>${PLAIN}<a:t>Hi</a:t></a:r></a:p>`;
        expect(replaceInParagraph(xml, 'zz', 'y', 'pptx')).toEqual({
            xml,
            count: 0,
        });
    });
});

describe('text helpers', () => {
    test('XML cannot hold a stray control character', () => {
        expect(toXmlSafeText('a\u0001b\r\nc\u000Bd')).toBe('ab\ncd');
    });

    test('a line break a model wrote out as \\n is a line break', () => {
        expect(toWrittenText('Welcome\\nGood day')).toBe('Welcome\nGood day');
        expect(toWrittenText('a\\r\\nb\u0001')).toBe('a\nb');
        // the file's own words are matched as they are
        expect(toXmlSafeText('C:\\new')).toBe('C:\\new');
    });

    test('unescapes named and numbered references', () => {
        expect(unescapeXml('&quot;&apos;&#65;&#x42;&bogus;')).toBe(
            '"\'AB&bogus;',
        );
    });
});

describe('a copied line', () => {
    test('keeps the look and none of the extras of the line it copies', () => {
        const xml =
            '<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:sectPr><w:pgSz/></w:sectPr></w:pPr>' +
            '<w:r><w:rPr><w:i/></w:rPr><w:t>Old</w:t></w:r>' +
            '<w:r><w:drawing>PIC</w:drawing></w:r></w:p>';
        expect(rebuildParagraph(xml, 'New', 'docx', true)).toBe(
            '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' +
                '<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">New</w:t></w:r></w:p>',
        );
    });

    test('a slide line copied keeps its paragraph and end look', () => {
        const xml =
            `<a:p><a:pPr lvl="1"/><a:r>${BOLD}<a:t>Old</a:t></a:r>` +
            `<a:fld id="{X}" type="slidenum">${PLAIN}<a:t>3</a:t></a:fld>` +
            '<a:endParaRPr lang="en-US"/></a:p>';
        expect(rebuildParagraph(xml, 'New', 'pptx', true)).toBe(
            `<a:p><a:pPr lvl="1"/><a:r>${BOLD}<a:t>New</a:t></a:r>` +
                '<a:endParaRPr lang="en-US"/></a:p>',
        );
    });
});
