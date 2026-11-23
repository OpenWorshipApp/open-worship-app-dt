import { describe, expect, test } from 'vitest';

import {
    fitWordPicture,
    genWordPictureParagraphXml,
    nextWordDrawingId,
    readWordPageColor,
    readWordTextWidthEmu,
    setWordDisplayBackgroundXml,
    setWordPageColorXml,
} from './officeWordLookHelpers';

const WORD_NAMESPACE =
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RELATIONSHIP_NAMESPACE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const SECTION_XML =
    '<w:sectPr w:rsidR="00A1"><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" ' +
    'w:header="720" w:footer="720" w:gutter="0"/><w:cols w:space="720"/>' +
    '<w:docGrid w:linePitch="360"/></w:sectPr>';

// A body as Word writes one: the root declares `w` and `r`, a heading, two
// lines with runs, and the section's page last.
function genDocumentXml({
    before = '',
    section = SECTION_XML,
}: { before?: string; section?: string } = {}) {
    return (
        HEADER +
        `<w:document xmlns:w="${WORD_NAMESPACE}" ` +
        `xmlns:r="${RELATIONSHIP_NAMESPACE}" ` +
        'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
        'mc:Ignorable="w14">' +
        before +
        '<w:body>' +
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
        '<w:r><w:t>Order of Service</w:t></w:r></w:p>' +
        '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Call ' +
        '</w:t></w:r><w:r><w:t>to worship</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Closing hymn &amp; blessing</w:t></w:r></w:p>' +
        section +
        '</w:body></w:document>'
    );
}

const SETTINGS_TAIL =
    '<w:proofState w:spelling="clean" w:grammar="clean"/>' +
    '<w:defaultTabStop w:val="720"/>' +
    '<w:characterSpacingControl w:val="doNotCompress"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" ' +
    'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    '<w:rsids><w:rsidRoot w:val="00A1"/><w:rsid w:val="00A1"/></w:rsids>' +
    '<w:themeFontLang w:val="en-US"/><w:decimalSymbol w:val="."/>' +
    '<w:listSeparator w:val=","/>';

function genSettingsXml(head = '<w:zoom w:percent="100"/>') {
    return (
        HEADER +
        `<w:settings xmlns:w="${WORD_NAMESPACE}" ` +
        `xmlns:r="${RELATIONSHIP_NAMESPACE}">` +
        head +
        SETTINGS_TAIL +
        '</w:settings>'
    );
}

const NAMESPACE_PATTERN = /\sxmlns:([\w.-]+)\s*=/g;
const TAG_PATTERN =
    /<(\/?)([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

/**
 * What keeps `xml` from being well-formed: a close with no open, an open
 * never closed, or a prefix -- of an element or an attribute -- no element
 * around it declares. Empty when there is nothing.
 */
function listXmlProblems(xml: string) {
    const problems: string[] = [];
    const stack: { name: string; prefixes: Set<string> }[] = [];
    const body = xml.replace(/<\?[\s\S]*?\?>/g, '');
    for (const matched of body.matchAll(TAG_PATTERN)) {
        const [, close, name, attributes, selfClose] = matched;
        if (close === '/') {
            const open = stack.pop();
            if (open?.name !== name) {
                problems.push(`</${name}> closes <${open?.name ?? 'nothing'}>`);
            }
            continue;
        }
        const prefixes = new Set(stack[stack.length - 1]?.prefixes ?? ['xml']);
        for (const declared of attributes.matchAll(NAMESPACE_PATTERN)) {
            prefixes.add(declared[1]);
        }
        const attributeNames = [
            ...attributes.matchAll(/\s([\w.-]+(?::[\w.-]+)?)\s*=/g),
        ].map((one) => {
            return one[1];
        });
        for (const used of [name, ...attributeNames]) {
            const prefix = used.includes(':') ? used.split(':')[0] : null;
            if (
                prefix !== null &&
                prefix !== 'xmlns' &&
                !prefixes.has(prefix)
            ) {
                problems.push(`${used} has no namespace`);
            }
        }
        if (selfClose !== '/') {
            stack.push({ name, prefixes });
        }
    }
    for (const open of stack) {
        problems.push(`<${open.name}> never closed`);
    }
    return problems;
}

function countOf(xml: string, text: string) {
    return xml.split(text).length - 1;
}

describe('listXmlProblems, the test helper itself', () => {
    test('finds an unclosed element and an undeclared prefix', () => {
        expect(listXmlProblems('<a><b></a>')).not.toEqual([]);
        expect(listXmlProblems('<w:p/>')).toEqual(['w:p has no namespace']);
        expect(listXmlProblems(`<w:p xmlns:w="${WORD_NAMESPACE}"/>`)).toEqual(
            [],
        );
    });
});

describe('setWordPageColorXml', () => {
    test('puts the colour first in the document, before the body', () => {
        const xml = genDocumentXml();
        const next = setWordPageColorXml(xml, 'fff2cc');
        if (typeof next !== 'string') {
            throw new Error(next.reason);
        }
        expect(next).toContain(
            'mc:Ignorable="w14"><w:background w:color="FFF2CC"/><w:body>',
        );
        expect(next.replace('<w:background w:color="FFF2CC"/>', '')).toBe(xml);
        expect(listXmlProblems(next)).toEqual([]);
        expect(readWordPageColor(next)).toBe('FFF2CC');
    });

    test('replaces a background already there with the plain colour', () => {
        const xml = genDocumentXml({
            before:
                '<w:background w:color="FF0000" w:themeColor="accent1">' +
                '<v:background id="_x0000_s1025" ' +
                'xmlns:v="urn:schemas-microsoft-com:vml"/></w:background>',
        });
        const next = setWordPageColorXml(xml, '00B050');
        if (typeof next !== 'string') {
            throw new Error(next.reason);
        }
        expect(countOf(next, '<w:background')).toBe(1);
        expect(next).toContain('<w:background w:color="00B050"/><w:body>');
        expect(next).not.toContain('themeColor');
        expect(next).not.toContain('v:background');
        expect(readWordPageColor(next)).toBe('00B050');
    });

    test('null takes the colour off, and leaves a body without one as it is', () => {
        const xml = genDocumentXml();
        const colored = setWordPageColorXml(xml, 'DDEEFF') as string;
        expect(setWordPageColorXml(colored, null)).toBe(xml);
        expect(setWordPageColorXml(xml, null)).toBe(xml);
        expect(readWordPageColor(xml)).toBeNull();
    });

    test('a pretty-printed body keeps no empty line where it was', () => {
        const xml = genDocumentXml({
            before: '\n  <w:background w:color="FFFF00"/>\n  ',
        });
        const next = setWordPageColorXml(xml, null) as string;
        expect(next).toContain('mc:Ignorable="w14">\n  <w:body>');
    });

    test.each(['#FFF2CC', 'FFF', 'yellow', 'GGGGGG', '', 'FFF2CC00'])(
        'refuses %j as a colour',
        (color) => {
            const result = setWordPageColorXml(genDocumentXml(), color);
            expect(result).toEqual({
                reason: expect.stringContaining('6 hex digits'),
            });
        },
    );

    test('refuses a part with no document', () => {
        const result = setWordPageColorXml(HEADER + '<w:body/>', 'FFFFFF');
        expect(result).toEqual({
            reason: expect.stringContaining('no document body'),
        });
    });
});

describe('readWordPageColor', () => {
    test('reads the colour upper case, and auto as none', () => {
        expect(
            readWordPageColor(
                genDocumentXml({ before: '<w:background w:color="a1b2c3"/>' }),
            ),
        ).toBe('A1B2C3');
        expect(
            readWordPageColor(
                genDocumentXml({ before: '<w:background w:color="auto"/>' }),
            ),
        ).toBeNull();
        expect(readWordPageColor('<w:body/>')).toBeNull();
    });
});

describe('setWordDisplayBackgroundXml', () => {
    const SHAPE = '<w:displayBackgroundShape/>';

    test('goes after w:zoom and before everything else', () => {
        const xml = genSettingsXml();
        const next = setWordDisplayBackgroundXml(xml, true);
        expect(next).toContain(
            `<w:zoom w:percent="100"/>${SHAPE}<w:proofState`,
        );
        expect(next.replace(SHAPE, '')).toBe(xml);
        expect(listXmlProblems(next)).toEqual([]);
    });

    test('goes after every element the schema puts before it', () => {
        const xml = genSettingsXml(
            '<w:writeProtection w:recommended="1"/><w:view w:val="print"/>' +
                '<w:zoom w:percent="90"/><w:removePersonalInformation/>' +
                '<w:removeDateAndTime/><w:doNotDisplayPageBoundaries/>',
        );
        const next = setWordDisplayBackgroundXml(xml, true);
        expect(next).toContain(
            `<w:doNotDisplayPageBoundaries/>${SHAPE}<w:proofState`,
        );
    });

    test('is the first child when nothing comes before it', () => {
        const next = setWordDisplayBackgroundXml(genSettingsXml(''), true);
        expect(next).toContain(`xmlns:r="${RELATIONSHIP_NAMESPACE}">${SHAPE}`);
    });

    test('is the last child when only what comes before it is there', () => {
        const xml =
            `<w:settings xmlns:w="${WORD_NAMESPACE}">` +
            '<w:view w:val="web"/><w:zoom w:percent="100"/></w:settings>';
        expect(setWordDisplayBackgroundXml(xml, true)).toContain(
            `<w:zoom w:percent="100"/>${SHAPE}</w:settings>`,
        );
    });

    test('one switched on already is kept as it is', () => {
        const xml = setWordDisplayBackgroundXml(genSettingsXml(), true);
        expect(setWordDisplayBackgroundXml(xml, true)).toBe(xml);
        const withValue = genSettingsXml(
            '<w:zoom w:percent="100"/><w:displayBackgroundShape w:val="true"/>',
        );
        expect(setWordDisplayBackgroundXml(withValue, true)).toBe(withValue);
    });

    test('one switched off is switched on in its place', () => {
        const xml = genSettingsXml(
            '<w:zoom w:percent="100"/><w:displayBackgroundShape w:val="0"/>',
        );
        const next = setWordDisplayBackgroundXml(xml, true);
        expect(countOf(next, '<w:displayBackgroundShape')).toBe(1);
        expect(next).toContain(
            `<w:zoom w:percent="100"/>${SHAPE}<w:proofState`,
        );
    });

    test('off takes it out, and leaves settings without one as they are', () => {
        const xml = genSettingsXml();
        const on = setWordDisplayBackgroundXml(xml, true);
        expect(setWordDisplayBackgroundXml(on, false)).toBe(xml);
        expect(setWordDisplayBackgroundXml(xml, false)).toBe(xml);
    });

    test('an empty w:settings is opened to hold it', () => {
        const xml = HEADER + `<w:settings xmlns:w="${WORD_NAMESPACE}"/>`;
        const next = setWordDisplayBackgroundXml(xml, true);
        expect(next).toBe(
            HEADER +
                `<w:settings xmlns:w="${WORD_NAMESPACE}">${SHAPE}</w:settings>`,
        );
        expect(setWordDisplayBackgroundXml(xml, false)).toBe(xml);
    });

    test('a part with no w:settings is left as it is', () => {
        expect(setWordDisplayBackgroundXml('<w:body/>', true)).toBe(
            '<w:body/>',
        );
    });
});

describe('genWordPictureParagraphXml', () => {
    const PICTURE = {
        relId: 'rId9',
        pictureId: 4,
        name: 'sunrise.jpg',
        widthEmu: 1905000,
        heightEmu: 952500,
    };

    test('one paragraph holding an inline picture', () => {
        const xml = genWordPictureParagraphXml(PICTURE);
        expect(xml.startsWith('<w:p><w:r><w:drawing><wp:inline ')).toBe(true);
        expect(xml.endsWith('</wp:inline></w:drawing></w:r></w:p>')).toBe(true);
        expect(xml).not.toContain('<w:pPr>');
        expect(xml).toContain('distT="0" distB="0" distL="0" distR="0"');
        expect(xml).toContain('<wp:extent cx="1905000" cy="952500"/>');
        expect(xml).toContain('<wp:effectExtent l="0" t="0" r="0" b="0"/>');
        expect(xml).toContain('<wp:docPr id="4" name="sunrise.jpg"/>');
        expect(xml).toContain('<a:graphicFrameLocks noChangeAspect="1"/>');
        expect(xml).toContain(
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
        );
        expect(xml).toContain('<pic:cNvPr id="0" name="sunrise.jpg"/>');
        expect(xml).toContain('<a:blip r:embed="rId9"/>');
        expect(xml).toContain('<a:stretch><a:fillRect/></a:stretch>');
        expect(xml).toContain(
            '<a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></a:xfrm>',
        );
        expect(xml).toContain(
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
        );
    });

    test('is well-formed in a body whose root declares only w', () => {
        const xml = genWordPictureParagraphXml({ ...PICTURE, align: 'center' });
        expect(listXmlProblems(xml)).not.toEqual([]);
        const document =
            `<w:document xmlns:w="${WORD_NAMESPACE}"><w:body>` +
            `${xml}</w:body></w:document>`;
        expect(listXmlProblems(document)).toEqual([]);
    });

    test.each(['left', 'center', 'right'] as const)('aligns it %s', (align) => {
        const xml = genWordPictureParagraphXml({ ...PICTURE, align });
        expect(
            xml.startsWith(`<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr><w:r>`),
        ).toBe(true);
    });

    test('escapes the name, and names a nameless one', () => {
        const xml = genWordPictureParagraphXml({
            ...PICTURE,
            name: 'Tom & "Jerry" <1>.png',
        });
        expect(xml).toContain(
            '<wp:docPr id="4" name="Tom &amp; &quot;Jerry&quot; &lt;1&gt;.png"/>',
        );
        expect(xml).not.toContain('<1>');
        expect(
            listXmlProblems(
                `<w:document xmlns:w="${WORD_NAMESPACE}">` +
                    `${xml}</w:document>`,
            ),
        ).toEqual([]);
        expect(genWordPictureParagraphXml({ ...PICTURE, name: ' ' })).toContain(
            '<wp:docPr id="4" name="Picture 4"/>',
        );
    });

    test('rounds the size to whole EMU', () => {
        const xml = genWordPictureParagraphXml({
            ...PICTURE,
            widthEmu: 100.6,
            heightEmu: 50.2,
        });
        expect(xml).toContain('<wp:extent cx="101" cy="50"/>');
    });
});

describe('fitWordPicture', () => {
    const TEXT_WIDTH = 5943600;

    test('a picture narrower than the text keeps its own size', () => {
        expect(fitWordPicture(200, 100, TEXT_WIDTH)).toEqual({
            widthEmu: 1905000,
            heightEmu: 952500,
        });
    });

    test('a picture wider than the text is made as wide as the text', () => {
        expect(fitWordPicture(2000, 1000, TEXT_WIDTH)).toEqual({
            widthEmu: 5943600,
            heightEmu: 2971800,
        });
    });

    test('widthPercent is that share of the text, small or large', () => {
        expect(fitWordPicture(400, 300, TEXT_WIDTH, 50)).toEqual({
            widthEmu: 2971800,
            heightEmu: 2228850,
        });
        expect(fitWordPicture(4000, 3000, TEXT_WIDTH, 25)).toEqual({
            widthEmu: 1485900,
            heightEmu: 1114425,
        });
    });

    test('widthPercent is kept between 1 and 100', () => {
        expect(fitWordPicture(100, 100, TEXT_WIDTH, 150).widthEmu).toBe(
            TEXT_WIDTH,
        );
        expect(fitWordPicture(100, 100, TEXT_WIDTH, 0).widthEmu).toBe(59436);
    });
});

describe('readWordTextWidthEmu', () => {
    test('the page width less the margins', () => {
        expect(readWordTextWidthEmu(genDocumentXml())).toBe(5943600);
        const a4 = genDocumentXml({
            section:
                '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
                '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" ' +
                'w:left="1800" w:gutter="0"/></w:sectPr>',
        });
        expect(readWordTextWidthEmu(a4)).toBe((11906 - 3600) * 635);
    });

    test('a gutter takes from the width too', () => {
        const xml = genDocumentXml({
            section: SECTION_XML.replace('w:gutter="0"', 'w:gutter="360"'),
        });
        expect(readWordTextWidthEmu(xml)).toBe((12240 - 2880 - 360) * 635);
    });

    test('6.5 inches when the body has no section properties', () => {
        expect(readWordTextWidthEmu(genDocumentXml({ section: '' }))).toBe(
            5943600,
        );
    });

    test("the body's last section, not an earlier one or an old copy", () => {
        const earlier =
            '<w:p><w:pPr><w:sectPr><w:pgSz w:w="15840" w:h="12240" ' +
            'w:orient="landscape"/><w:pgMar w:left="720" w:right="720"/>' +
            '</w:sectPr></w:pPr></w:p>';
        const section = SECTION_XML.replace(
            '</w:sectPr>',
            '<w:sectPrChange w:id="1" w:author="A" w:date="2026-01-01T00:00:00Z">' +
                '<w:sectPr><w:pgSz w:w="20000" w:h="15840"/>' +
                '<w:pgMar w:left="100" w:right="100"/></w:sectPr>' +
                '</w:sectPrChange></w:sectPr>',
        );
        const xml = genDocumentXml({ section: earlier + section });
        expect(readWordTextWidthEmu(xml)).toBe(5943600);
    });
});

describe('nextWordDrawingId', () => {
    test('1 when the body has no drawing', () => {
        expect(nextWordDrawingId(genDocumentXml())).toBe(1);
    });

    test('one more than the largest id, never one inside a value', () => {
        const pictures =
            genWordPictureParagraphXml({
                relId: 'rId5',
                pictureId: 7,
                name: 'a.png',
                widthEmu: 10,
                heightEmu: 10,
            }) +
            '<w:p><w:r><w:drawing><wp:anchor><wp:docPr ' +
            `descr='a " id="99"' id="2" name="Shape 2"/>` +
            '</wp:anchor></w:drawing></w:r></w:p>';
        const xml = genDocumentXml().replace('<w:body>', `<w:body>${pictures}`);
        expect(nextWordDrawingId(xml)).toBe(8);
    });
});
