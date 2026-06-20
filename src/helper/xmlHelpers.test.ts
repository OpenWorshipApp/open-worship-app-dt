// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

import { appXMLParser, appXMLSerializer, optimizeXMLText } from './xmlHelpers';

function parse(xmlText: string) {
    return appXMLParser.parseFromString(xmlText, 'application/xml');
}

describe('appXMLSerializer', () => {
    test('serializes XML nodes without using XMLSerializer', () => {
        const OriginalXMLSerializer = globalThis.XMLSerializer;
        vi.stubGlobal(
            'XMLSerializer',
            class XMLSerializerMock {
                serializeToString() {
                    throw new Error('XMLSerializer should not be used');
                }
            } as any,
        );

        try {
            const xmlDoc = appXMLParser.parseFromString(
                '<bible></bible>',
                'application/xml',
            );
            const bibleElement = xmlDoc.documentElement;
            bibleElement.setAttribute('title', 'A "quoted" <Bible> & more');

            const verseElement = xmlDoc.createElement('verse');
            verseElement.setAttribute('number', '1');
            verseElement.textContent = 'A < B & C > D';
            bibleElement.appendChild(verseElement);

            const dataElement = xmlDoc.createElement('data');
            dataElement.appendChild(
                xmlDoc.createCDATASection(
                    JSON.stringify([{ content: 'Heading <title> & body' }]),
                ),
            );
            bibleElement.appendChild(dataElement);

            expect(appXMLSerializer.serializeToString(xmlDoc)).toBe(
                '<?xml version="1.0" encoding="UTF-8"?><bible title="A &quot;quoted&quot; &lt;Bible&gt; &amp; more"><verse number="1">A &lt; B &amp; C &gt; D</verse><data><![CDATA[[{"content":"Heading <title> & body"}]]]></data></bible>',
            );
            expect(appXMLSerializer.serializeToString(verseElement)).toBe(
                '<?xml version="1.0" encoding="UTF-8"?><verse number="1">A &lt; B &amp; C &gt; D</verse>',
            );
        } finally {
            vi.stubGlobal('XMLSerializer', OriginalXMLSerializer);
        }
    });
});

describe('optimizeXMLText', () => {
    test('returns the original XML when there are no optimization options', () => {
        const xmlText = '<bible><book key="GEN">Genesis</book></bible>';

        expect(optimizeXMLText(xmlText, {})).toBe(xmlText);
    });

    test('removes first-level element contents when keys are requested', () => {
        const xmlText =
            '<?xml version="1.0"?><bible title="A > B"><book key="GEN"><chapter><verse>Text</verse></chapter></book></bible>';

        expect(optimizeXMLText(xmlText, { keys: ['key'] })).toBe(
            '<?xml version="1.0"?><bible title="A > B"></bible>',
        );
    });

    test('keeps the first-level element with all attributes when all keys are requested', () => {
        const xmlText =
            '<bible key="KJV" title="King James" locale="en"><book key="GEN"><chapter><verse>Text</verse></chapter></book></bible>';

        expect(optimizeXMLText(xmlText, { keys: 'all' })).toBe(
            '<bible key="KJV" title="King James" locale="en"></bible>',
        );
    });

    test('keeps only matching second-level elements when child tags are requested', () => {
        const xmlText =
            '<bible><map><book-map key="GEN" value="Genesis"/></map><book key="GEN"><chapter><verse>Text</verse></chapter></book><new-lines><item>Selah</item></new-lines></bible>';

        expect(optimizeXMLText(xmlText, { childTags: ['map'] })).toBe(
            '<bible><map><book-map key="GEN" value="Genesis"/></map></bible>',
        );
    });

    test('matches nested element boundaries before removing a sibling', () => {
        const xmlText =
            '<bible><book key="GEN"><chapter><book key="nested">Nested</book></chapter></book><map><book-map key="GEN" value="Genesis"/></map></bible>';

        expect(optimizeXMLText(xmlText, { childTags: ['map'] })).toBe(
            '<bible><map><book-map key="GEN" value="Genesis"/></map></bible>',
        );
    });

    test('can empty matching second-level element contents', () => {
        const xmlText =
            '<bible><map><book-map key="GEN" value="Genesis"/></map><book key="GEN"><chapter><verse>Text</verse></chapter></book></bible>';

        expect(
            optimizeXMLText(xmlText, {
                childTags: ['book'],
                emptyChildTagContents: true,
            }),
        ).toBe('<bible><book key="GEN"></book></bible>');
    });
});

describe('appXMLParser.parseFromString', () => {
    describe('document structure', () => {
        test('parses a single root element', () => {
            const xmlDoc = parse('<bible></bible>');

            expect(xmlDoc.nodeType).toBe(Node.DOCUMENT_NODE);
            expect(xmlDoc.documentElement?.tagName).toBe('bible');
            expect(xmlDoc.childNodes).toHaveLength(1);
        });

        test('returns an empty document for an empty string', () => {
            const xmlDoc = parse('');

            expect(xmlDoc.childNodes).toHaveLength(0);
            expect(xmlDoc.documentElement).toBeNull();
        });

        test('links child elements back to their parents', () => {
            const xmlDoc = parse('<bible><book><chapter/></book></bible>');
            const bible = xmlDoc.documentElement;
            const book = bible?.getElementsByTagName('book')[0];
            const chapter = bible?.getElementsByTagName('chapter')[0];

            expect(book?.parentNode).toBe(bible);
            expect(chapter?.parentNode).toBe(book);
            expect(bible?.parentNode).toBe(xmlDoc);
        });

        test('parses deeply nested elements', () => {
            const xmlDoc = parse(
                '<bible><book key="GEN"><chapter number="1">' +
                    '<verse number="1">In the beginning</verse>' +
                    '</chapter></book></bible>',
            );
            const verse = xmlDoc.getElementsByTagName('verse')[0];

            expect(verse.getAttribute('number')).toBe('1');
            expect(verse.textContent).toBe('In the beginning');
        });
    });

    describe('getElementsByTagName', () => {
        test('returns matching descendants in document order', () => {
            const xmlDoc = parse(
                '<bible><book key="A"/><book key="B"/><book key="C"/></bible>',
            );
            const keys = Array.from(
                xmlDoc.getElementsByTagName('book'),
                (book) => book.getAttribute('key'),
            );

            expect(keys).toEqual(['A', 'B', 'C']);
        });

        test('supports the wildcard tag name', () => {
            const xmlDoc = parse(
                '<bible><book><chapter><verse/></chapter></book></bible>',
            );
            const tagNames = Array.from(
                xmlDoc.getElementsByTagName('*'),
                (element) => element.tagName,
            );

            expect(tagNames).toEqual(['bible', 'book', 'chapter', 'verse']);
        });

        test('returns an empty list when nothing matches', () => {
            const xmlDoc = parse('<bible><book/></bible>');

            expect(xmlDoc.getElementsByTagName('verse')).toHaveLength(0);
        });

        test('excludes the element itself when queried from an element', () => {
            const xmlDoc = parse('<book><book/></book>');
            const outerBook = xmlDoc.documentElement;

            expect(outerBook?.getElementsByTagName('book')).toHaveLength(1);
        });
    });

    describe('attributes', () => {
        test('parses double- and single-quoted attribute values', () => {
            const xmlDoc = parse(
                `<bible key="KJV" locale='en-US'></bible>`,
            );
            const bible = xmlDoc.documentElement;

            expect(bible?.getAttribute('key')).toBe('KJV');
            expect(bible?.getAttribute('locale')).toBe('en-US');
        });

        test('parses unquoted attribute values', () => {
            const xmlDoc = parse('<verse number=1></verse>');

            expect(
                xmlDoc.documentElement?.getAttribute('number'),
            ).toBe('1');
        });

        test('parses an unquoted attribute on a self-closing element', () => {
            const xmlDoc = parse('<verse number=12/>');
            const verse = xmlDoc.documentElement;

            expect(verse?.getAttribute('number')).toBe('12');
            expect(verse?.childNodes).toHaveLength(0);
        });

        test('treats valueless attributes as empty strings', () => {
            const xmlDoc = parse('<option selected></option>');
            const option = xmlDoc.documentElement;

            expect(option?.getAttribute('selected')).toBe('');
        });

        test('handles whitespace around the equals sign', () => {
            const xmlDoc = parse('<bible key  =  "WEB"></bible>');

            expect(xmlDoc.documentElement?.getAttribute('key')).toBe('WEB');
        });

        test('keeps ">" inside a quoted attribute value', () => {
            const xmlDoc = parse('<bible title="A > B"></bible>');

            expect(
                xmlDoc.documentElement?.getAttribute('title'),
            ).toBe('A > B');
        });

        test('exposes attributes with name, value and nodeValue', () => {
            const xmlDoc = parse('<bible key="KJV" locale="en"></bible>');
            const attributes = Array.from(
                xmlDoc.documentElement?.attributes ?? [],
                (attribute) => ({
                    name: attribute.name,
                    value: attribute.value,
                    nodeValue: attribute.nodeValue,
                }),
            );

            expect(attributes).toEqual([
                { name: 'key', value: 'KJV', nodeValue: 'KJV' },
                { name: 'locale', value: 'en', nodeValue: 'en' },
            ]);
        });

        test('returns null from getAttribute for a missing attribute', () => {
            const xmlDoc = parse('<bible key="KJV"></bible>');

            expect(
                xmlDoc.documentElement?.getAttribute('missing'),
            ).toBeNull();
        });

        test('keeps the last value for a duplicated attribute', () => {
            const xmlDoc = parse('<bible key="A" key="B"></bible>');
            const bible = xmlDoc.documentElement;

            expect(bible?.getAttribute('key')).toBe('B');
            expect(bible?.attributes).toHaveLength(1);
        });

        test('decodes entities inside attribute values', () => {
            const xmlDoc = parse(
                `<bible title="A &amp; B &lt;x&gt;" note='it&apos;s'></bible>`,
            );
            const bible = xmlDoc.documentElement;

            expect(bible?.getAttribute('title')).toBe('A & B <x>');
            expect(bible?.getAttribute('note')).toBe("it's");
        });
    });

    describe('self-closing elements', () => {
        test('parses a self-closing element', () => {
            const xmlDoc = parse('<bible><book key="GEN"/></bible>');
            const book = xmlDoc.getElementsByTagName('book')[0];

            expect(book.childNodes).toHaveLength(0);
            expect(book.getAttribute('key')).toBe('GEN');
        });

        test('parses a self-closing element with a space before the slash', () => {
            const xmlDoc = parse('<bible><book key="GEN" /></bible>');
            const bible = xmlDoc.documentElement;

            expect(bible?.getElementsByTagName('book')).toHaveLength(1);
            expect(bible?.childNodes).toHaveLength(1);
        });

        test('does not treat a slash inside an attribute value as self-closing', () => {
            const xmlDoc = parse(
                '<bible url="http://example.com/">text</bible>',
            );
            const bible = xmlDoc.documentElement;

            expect(bible?.getAttribute('url')).toBe('http://example.com/');
            expect(bible?.textContent).toBe('text');
        });
    });

    describe('text and entities', () => {
        test('preserves whitespace within elements', () => {
            const xmlDoc = parse('<verse>  spaced  text  </verse>');

            expect(xmlDoc.documentElement?.textContent).toBe(
                '  spaced  text  ',
            );
        });

        test('decodes the five named entities in text', () => {
            const xmlDoc = parse(
                '<verse>&amp; &lt; &gt; &quot; &apos;</verse>',
            );

            expect(xmlDoc.documentElement?.textContent).toBe('& < > " \'');
        });

        test('decodes decimal and hex numeric entities', () => {
            const xmlDoc = parse('<verse>&#65;&#x42;&#x1F600;</verse>');

            expect(xmlDoc.documentElement?.textContent).toBe('AB\u{1F600}');
        });

        test('keeps an unknown named entity unchanged', () => {
            const xmlDoc = parse('<verse>&unknown; &amp;</verse>');

            expect(xmlDoc.documentElement?.textContent).toBe('&unknown; &');
        });

        test('keeps an out-of-range numeric entity unchanged', () => {
            const xmlDoc = parse('<verse>&#x110000;</verse>');

            expect(xmlDoc.documentElement?.textContent).toBe('&#x110000;');
        });

        test('concatenates text from mixed inline content', () => {
            const xmlDoc = parse('<verse>text <i>italic</i> more</verse>');

            expect(xmlDoc.documentElement?.textContent).toBe(
                'text italic more',
            );
        });

        test('keeps trailing text after the root element out of the tree', () => {
            const xmlDoc = parse('<bible/>trailing');

            expect(xmlDoc.childNodes).toHaveLength(1);
            expect(xmlDoc.documentElement?.tagName).toBe('bible');
        });
    });

    describe('CDATA sections', () => {
        test('parses CDATA content as a raw CDATA node', () => {
            const json = JSON.stringify([{ content: 'Heading <title> & body' }]);
            const xmlDoc = parse(`<item><![CDATA[${json}]]></item>`);
            const cdataNode = xmlDoc.documentElement?.childNodes[0];

            expect(cdataNode?.nodeType).toBe(Node.CDATA_SECTION_NODE);
            expect(cdataNode?.nodeValue).toBe(json);
        });

        test('includes CDATA content in textContent', () => {
            const xmlDoc = parse(
                '<item>before<![CDATA[<raw> & data]]>after</item>',
            );

            expect(xmlDoc.documentElement?.textContent).toBe(
                'before<raw> & dataafter',
            );
        });

        test('handles an unterminated CDATA section', () => {
            const xmlDoc = parse('<item><![CDATA[no end here</item>');
            const cdataNode = xmlDoc.documentElement?.childNodes[0];

            expect(cdataNode?.nodeType).toBe(Node.CDATA_SECTION_NODE);
            expect(cdataNode?.nodeValue).toBe('no end here</item>');
        });
    });

    describe('ignored nodes', () => {
        test('ignores comments', () => {
            const xmlDoc = parse('<bible><!-- a comment --><book/></bible>');
            const bible = xmlDoc.documentElement;

            expect(bible?.childNodes).toHaveLength(1);
            expect(bible?.getElementsByTagName('book')).toHaveLength(1);
        });

        test('ignores the XML declaration and processing instructions', () => {
            const xmlDoc = parse(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<bible><?custom-pi data?><book/></bible>',
            );
            const bible = xmlDoc.documentElement;

            expect(bible?.tagName).toBe('bible');
            expect(bible?.childNodes).toHaveLength(1);
        });

        test('ignores DOCTYPE declarations', () => {
            const xmlDoc = parse('<!DOCTYPE bible><bible><book/></bible>');

            expect(xmlDoc.documentElement?.tagName).toBe('bible');
        });

        test('drops prolog and epilog whitespace at the document level', () => {
            const xmlDoc = parse(
                '<?xml version="1.0"?>\n  <bible/>\n  ',
            );
            const childTypes = Array.from(
                xmlDoc.childNodes,
                (node) => node.nodeType,
            );

            expect(childTypes).toEqual([Node.ELEMENT_NODE]);
        });
    });

    describe('malformed and lenient input', () => {
        test('ignores a stray closing tag', () => {
            const xmlDoc = parse('<bible></book><book key="GEN"/></bible>');
            const bible = xmlDoc.documentElement;

            expect(bible?.tagName).toBe('bible');
            expect(bible?.getElementsByTagName('book')).toHaveLength(1);
            expect(
                bible?.getElementsByTagName('book')[0].getAttribute('key'),
            ).toBe('GEN');
        });

        test('closes the nearest matching ancestor for mismatched nesting', () => {
            const xmlDoc = parse('<a><b><c>text</b></a>');
            const tagNames = Array.from(
                xmlDoc.getElementsByTagName('*'),
                (element) => element.tagName,
            );

            expect(tagNames).toEqual(['a', 'b', 'c']);
            expect(xmlDoc.documentElement?.textContent).toBe('text');
        });

        test('treats an unterminated tag as text', () => {
            const xmlDoc = parse('<bible>verse<book');
            const bible = xmlDoc.documentElement;

            expect(bible?.tagName).toBe('bible');
            expect(bible?.textContent).toBe('verse<book');
        });

        test('parses sibling root elements as document children', () => {
            const xmlDoc = parse('<a></a><b></b>');
            const rootTagNames = Array.from(
                xmlDoc.childNodes,
                (node) => (node as Element).tagName,
            );

            expect(rootTagNames).toEqual(['a', 'b']);
            expect(xmlDoc.documentElement?.tagName).toBe('a');
        });
    });
});
