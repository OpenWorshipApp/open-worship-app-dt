// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { WordTextLangPickerType } from './markdownWordHelpers';
import {
    fitWordPictureSize,
    genWordContentTypesXml,
    genWordCorePropsXml,
    genWordDocumentRelsXml,
    genWordDocumentXml,
    genWordNumberingXml,
    genWordPackageRelsXml,
    genWordPageSize,
    genWordSettingsXml,
    genWordStylesXml,
    snapshotMarkdownWordPage,
    toWordContentBox,
} from './markdownWordHelpers';

const LETTER = { widthTwips: 12240, heightTwips: 15840 };
const noTextLang: WordTextLangPickerType = () => {
    return null;
};

function genPage(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    return element;
}

function snapshot(html: string, pickTextLang = noTextLang) {
    return snapshotMarkdownWordPage([genPage(html)], {
        pickTextLang,
        pageSize: LETTER,
    });
}

function checkIsWellFormed(xml: string) {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    return parsed.getElementsByTagName('parsererror').length === 0;
}

describe('snapshotMarkdownWordPage', () => {
    it('writes headings, paragraphs and inline styles as Word does', () => {
        const { bodyXml } = snapshot(
            '<h2 id="md-heading-intro">Intro</h2>\n' +
                '<p>  Some   <strong>bold</strong> and <em>soft</em>\n' +
                ' <code>x()</code> <del>gone</del> x<sup>2</sup>  </p>',
        );
        expect(bodyXml).toContain('<w:pStyle w:val="Heading2"/>');
        expect(bodyXml).toContain('<w:bookmarkStart w:id="0" w:name="_md1"/>');
        // Spaces as the page shows them: one, none at either end.
        expect(bodyXml).toContain(
            '<w:t xml:space="preserve">Some </w:t></w:r><w:r><w:rPr><w:b/>',
        );
        expect(bodyXml).toContain('<w:i/><w:iCs/>');
        expect(bodyXml).toContain('<w:rStyle w:val="VerbatimChar"/>');
        expect(bodyXml).toContain('<w:strike/>');
        expect(bodyXml).toContain('<w:vertAlign w:val="superscript"/>');
        expect(bodyXml).not.toContain('>  ');
        expect(bodyXml).toContain('<w:t xml:space="preserve">2</w:t>');
    });

    it('links a web address, a heading of the page, and no file', () => {
        const result = snapshot(
            '<h1 id="md-heading-top">Top</h1>' +
                '<p><a href="https://example.org/a?b=1&amp;c=2">web</a> ' +
                '<a href="#top">up</a> <a href="notes.md">file</a> ' +
                '<a href="https://example.org/a?b=1&amp;c=2">again</a></p>',
        );
        expect(result.links).toEqual(['https://example.org/a?b=1&c=2']);
        expect(result.bodyXml).toContain(
            '<w:hyperlink r:id="rIdLink1" w:history="1">',
        );
        expect(result.bodyXml).toContain(
            '<w:hyperlink w:anchor="_md1" w:history="1">',
        );
        expect(result.bodyXml.match(/<w:hyperlink /g)).toHaveLength(3);
        expect(result.bodyXml).toContain('<w:rStyle w:val="Hyperlink"/>');
        const relsXml = genWordDocumentRelsXml(result, []);
        expect(relsXml).toContain(
            'Target="https://example.org/a?b=1&amp;c=2" TargetMode="External"',
        );
        expect(checkIsWellFormed(relsXml)).toBe(true);
    });

    it('numbers each list from its own start, nested lists one level in', () => {
        const result = snapshot(
            '<ol start="3"><li>three<ul><li>dot</li></ul></li>' +
                '<li><p>four</p><p>more of four</p></li></ol>' +
                '<ol><li>one</li></ol>',
        );
        expect(result.lists).toEqual([
            { kind: 'decimal', level: 0, start: 3 },
            { kind: 'bullet', level: 1, start: 1 },
            { kind: 'decimal', level: 0, start: 1 },
        ]);
        expect(result.bodyXml).toContain(
            '<w:numPr><w:ilvl w:val="1"/><w:numId w:val="2"/></w:numPr>',
        );
        // The second paragraph of an item is indented under it, unnumbered.
        expect(result.bodyXml).toContain(
            '<w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t xml:space="preserve">more of four',
        );
        const numberingXml = genWordNumberingXml(result.lists);
        expect(numberingXml).toContain(
            '<w:num w:numId="1"><w:abstractNumId w:val="1"/>' +
                '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/>',
        );
        expect(numberingXml).toContain(
            '<w:num w:numId="2"><w:abstractNumId w:val="0"/></w:num>',
        );
        expect(checkIsWellFormed(numberingXml)).toBe(true);
    });

    it('keeps a code block line by line, and a quote as a quote', () => {
        const { bodyXml } = snapshot(
            '<pre><code>a\n\tb\n</code></pre>' +
                '<blockquote><p>said</p><blockquote><p>inner</p></blockquote></blockquote>',
        );
        expect(bodyXml).toContain(
            '<w:pPr><w:pStyle w:val="SourceCode"/></w:pPr>' +
                '<w:r><w:t xml:space="preserve">a</w:t></w:r><w:r><w:br/></w:r>' +
                '<w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">b</w:t></w:r></w:p>',
        );
        // Code in a code block is not shaded twice.
        expect(bodyXml).not.toContain('VerbatimChar');
        expect(bodyXml).toContain(
            '<w:pPr><w:pStyle w:val="Quote"/></w:pPr><w:r><w:t xml:space="preserve">said',
        );
        expect(bodyXml).toContain(
            '<w:pStyle w:val="Quote"/><w:ind w:left="720"/>',
        );
    });

    it('writes a table with its header row and spans, every cell ending in a paragraph', () => {
        const { bodyXml } = snapshot(
            '<table><thead><tr><th>A</th><th style="text-align:right">B</th></tr></thead>' +
                '<tbody><tr><td colspan="2"></td></tr></tbody></table>',
        );
        expect(bodyXml).toContain('<w:trPr><w:tblHeader/></w:trPr>');
        expect(bodyXml.match(/<w:gridCol /g)).toHaveLength(2);
        expect(bodyXml).toContain('<w:gridSpan w:val="2"/>');
        expect(bodyXml).toContain('<w:jc w:val="right"/>');
        expect(bodyXml).toContain('<w:b/><w:bCs/>');
        expect(bodyXml).toContain('</w:tcPr><w:p/></w:tc>');
    });

    it('takes a drawn diagram -- the light one for paper, not the dark one beside it -- and a picture', () => {
        const page = genPage(
            '<div class="app-markdown-mermaid app-markdown-mermaid--rendered app-markdown-mermaid--has-print">' +
                '<svg viewBox="0 0 10 10" class="dark"></svg></div>' +
                '<div class="app-markdown-mermaid app-markdown-mermaid--rendered app-markdown-mermaid--print">' +
                '<svg viewBox="0 0 300 120" class="light" style="max-width: 300px"><text>A</text></svg></div>' +
                '<p><img src="https://example.org/pic.png" alt="A map" width="200"> after</p>' +
                '<p><img src="file:///pictures/My%20Photo.jpg"></p>' +
                '<div class="app-markdown-print-appendix"><p>old appendix</p></div>',
        );
        const result = snapshotMarkdownWordPage([page], {
            pickTextLang: noTextLang,
            pageSize: LETTER,
        });
        expect(result.pictures).toHaveLength(3);
        const [diagram, picture, photo] = result.pictures;
        expect(diagram.source).toEqual(
            expect.objectContaining({ kind: 'svg', width: 300, height: 120 }),
        );
        expect(diagram.source.kind === 'svg' && diagram.source.svgText).toMatch(
            /class="light"[^>]*width="300" height="120"|width="300"/,
        );
        expect(
            diagram.source.kind === 'svg' && diagram.source.svgText,
        ).not.toContain('max-width');
        expect(picture).toEqual({
            source: {
                kind: 'src',
                src: 'https://example.org/pic.png',
                width: 200,
            },
            alt: 'A map',
        });
        // No alt: the file's own name says what was there.
        expect(photo.alt).toBe('My Photo.jpg');
        expect(result.bodyXml).not.toContain('old appendix');
        expect(result.bodyXml).toContain(
            '<w:pPr><w:jc w:val="center"/></w:pPr>\u0000P0\u0000',
        );

        const documentXml = genWordDocumentXml(result, [
            { fileName: 'image1.png', width: 300, height: 120 },
            null,
            { fileName: 'image3.jpeg', width: 40, height: 30 },
        ]);
        expect(documentXml).not.toContain('\u0000');
        expect(documentXml).toContain('<a:blip r:embed="rIdImage1"/>');
        expect(documentXml).toContain(
            `<wp:extent cx="${300 * 9525}" cy="${120 * 9525}"/>`,
        );
        // One that could not be had is named in its place.
        expect(documentXml).toContain(
            '<w:t xml:space="preserve">[A map]</w:t>',
        );
        expect(documentXml).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
        expect(checkIsWellFormed(documentXml)).toBe(true);
        const relsXml = genWordDocumentRelsXml(result, [
            { fileName: 'image1.png', width: 300, height: 120 },
            null,
            { fileName: 'image3.jpeg', width: 40, height: 30 },
        ]);
        expect(relsXml).toContain('Id="rIdImage1"');
        expect(relsXml).not.toContain('Id="rIdImage2"');
        expect(relsXml).toContain('Target="media/image3.jpeg"');
    });

    it('reads the roots one after the other: the page, then the appendix', () => {
        const appendix = genPage('<h2>Verses</h2><p><sup>16</sup> For God</p>');
        const result = snapshotMarkdownWordPage(
            [genPage('<p>Page</p>'), appendix],
            { pickTextLang: noTextLang, pageSize: LETTER },
        );
        expect(result.bodyXml.indexOf('Page')).toBeLessThan(
            result.bodyXml.indexOf('Verses'),
        );
        expect(result.bodyXml).toContain(
            '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">16</w:t>',
        );
    });

    it('gives a language its face, and a right-to-left one its direction', () => {
        // A paragraph takes its direction from its first letter, a run its
        // face and direction from its own words.
        const pickTextLang: WordTextLangPickerType = (text) => {
            if (/f/.test(text)) {
                return { fontFamily: 'Xx Face', isRtl: false };
            }
            return /[bk]/.test(text) ? { fontFamily: null, isRtl: true } : null;
        };
        const { bodyXml } = snapshot(
            '<p>plain</p><p>face</p><p>back</p>',
            pickTextLang,
        );
        expect(bodyXml).toContain(
            '<w:rFonts w:ascii="Xx Face" w:hAnsi="Xx Face" w:eastAsia="Xx Face" w:cs="Xx Face"/>',
        );
        expect(bodyXml).toContain('<w:pPr><w:bidi/></w:pPr>');
        expect(bodyXml).toContain('<w:rPr><w:rtl/></w:rPr>');
        expect(bodyXml.match(/w:rFonts/g)).toHaveLength(1);
    });

    it('escapes what the page says, and drops what XML cannot hold', () => {
        const page = genPage('<p></p>');
        page.querySelector('p')!.textContent = 'a < b & "c"\u0001';
        const result = snapshotMarkdownWordPage([page], {
            pickTextLang: noTextLang,
            pageSize: LETTER,
        });
        expect(result.bodyXml).toContain(
            '<w:t xml:space="preserve">a &lt; b &amp; "c"</w:t>',
        );
        expect(checkIsWellFormed(genWordDocumentXml(result, []))).toBe(true);
    });

    it('ends a document whose last block is a table with a paragraph', () => {
        const result = snapshot('<table><tr><td>x</td></tr></table>');
        expect(genWordDocumentXml(result, [])).toContain(
            '</w:tbl><w:p/><w:sectPr>',
        );
        expect(genWordDocumentXml(snapshot(''), [])).toContain(
            '<w:body><w:p/><w:sectPr>',
        );
    });
});

describe('the package parts', () => {
    it('are well-formed XML', () => {
        for (const xml of [
            genWordStylesXml(),
            genWordSettingsXml(),
            genWordContentTypesXml(),
            genWordPackageRelsXml(),
            genWordCorePropsXml(
                'A & B <study>',
                new Date('2026-11-14T10:00:00Z'),
            ),
            genWordNumberingXml([]),
        ]) {
            expect(checkIsWellFormed(xml)).toBe(true);
        }
        expect(
            genWordCorePropsXml('A & B', new Date('2026-11-14T10:00:00.123Z')),
        ).toContain(
            '<dcterms:created xsi:type="dcterms:W3CDTF">2026-11-14T10:00:00Z',
        );
    });
});

describe('genWordPageSize', () => {
    it('is Letter where the region prints on Letter, A4 elsewhere', () => {
        expect(genWordPageSize('en-US')).toEqual(LETTER);
        expect(genWordPageSize('en-GB')).toEqual({
            widthTwips: 11906,
            heightTwips: 16838,
        });
        expect(genWordPageSize('not a locale!')).toEqual({
            widthTwips: 11906,
            heightTwips: 16838,
        });
    });

    it('leaves pictures the room between the margins', () => {
        expect(toWordContentBox(LETTER)).toEqual({ width: 624, height: 864 });
    });
});

describe('fitWordPictureSize', () => {
    it('keeps a picture that fits, and shrinks one that does not in proportion', () => {
        const box = { width: 600, height: 800 };
        expect(fitWordPictureSize(300, 200, box)).toEqual({
            width: 300,
            height: 200,
        });
        expect(fitWordPictureSize(1200, 400, box)).toEqual({
            width: 600,
            height: 200,
        });
        expect(fitWordPictureSize(100, 1600, box)).toEqual({
            width: 50,
            height: 800,
        });
        expect(fitWordPictureSize(0, 10, box)).toBeNull();
    });
});
