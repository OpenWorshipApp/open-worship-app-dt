// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import { appXMLParser, appXMLSerializer, optimizeXMLText } from './xmlHelpers';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

describe('appXMLSerializer node kinds', () => {
    test('serializes an attribute node as its escaped value', () => {
        const attribute = document.createAttribute('title');
        attribute.value = 'Say "Amen" <now> & then\nrest';
        expect(appXMLSerializer.serializeToString(attribute)).toBe(
            `${XML_DECLARATION}Say &quot;Amen&quot; &lt;now&gt; &amp; then&#10;rest`,
        );
    });

    test('keeps comments, and drops a node kind it does not know', () => {
        const xmlDoc = new DOMParser().parseFromString(
            '<bible><!-- translated 1611 --><book/></bible>',
            'text/xml',
        );
        expect(appXMLSerializer.serializeToString(xmlDoc)).toBe(
            `${XML_DECLARATION}<bible><!-- translated 1611 --><book/></bible>`,
        );
        // A notation node (12) is not something a Bible file carries.
        expect(
            appXMLSerializer.serializeToString({ nodeType: 12 } as Node),
        ).toBe(XML_DECLARATION);
    });
});

describe('appXMLParser lenient tags', () => {
    function parse(xmlText: string) {
        return appXMLParser.parseFromString(xmlText, 'application/xml');
    }

    test('reads a tag name after whitespace and a slash before trailing whitespace', () => {
        const xmlDoc = parse('< bible ><verse n="1" / >text</ bible >');
        const bible = xmlDoc.documentElement;
        expect(bible.tagName).toBe('bible');
        expect(bible.childNodes).toHaveLength(2);
        const verse = bible.getElementsByTagName('verse')[0];
        expect(verse.getAttribute('n')).toBe('1');
        // Self-closing: the text after it belongs to <bible>, not to it.
        expect(verse.childNodes).toHaveLength(0);
        expect(bible.textContent).toBe('text');
    });

    test('treats a nameless tag and everything after it as text', () => {
        const xmlDoc = parse('<bible>a<>b</bible>');
        const bible = xmlDoc.documentElement;
        expect(bible.tagName).toBe('bible');
        expect(bible.textContent).toBe('a<>b</bible>');
        expect(xmlDoc.getElementsByTagName('*')).toHaveLength(1);
    });
});

describe('optimizeXMLText with keys', () => {
    const allKeys = { keys: 'all' as const };

    test('a self-closing namesake inside does not end the element early', () => {
        expect(
            optimizeXMLText('<a x="1"><a/><b>t</b></a><c y="2">z</c>', allKeys),
        ).toBe('<a x="1"></a><c y="2"></c>');
    });

    test('an element left open runs to the end of the text', () => {
        expect(optimizeXMLText('<a x="1"><b>text', allKeys)).toBe(
            '<a x="1"></a>',
        );
        expect(optimizeXMLText('<a x="1">text<', allKeys)).toBe(
            '<a x="1"></a>',
        );
    });

    test('keeps text and an unfinished tag after the last element', () => {
        expect(optimizeXMLText('<a x="1">t</a>tail', allKeys)).toBe(
            '<a x="1"></a>tail',
        );
        expect(optimizeXMLText('<a x="1">t</a><', allKeys)).toBe(
            '<a x="1"></a><',
        );
    });

    test('skips a stray closing tag before the first element', () => {
        expect(optimizeXMLText('</x><a k="v">t</a>', { keys: ['k'] })).toBe(
            '</x><a k="v"></a>',
        );
    });
});

describe('optimizeXMLText with child tags', () => {
    const onlyBooks = { childTags: ['book'] };

    test('keeps comments and processing instructions where they are', () => {
        expect(
            optimizeXMLText(
                '<?xml version="1.0"?><!--c--><bible><!--keep-->' +
                    '<book>1</book><info>2</info></bible>',
                onlyBooks,
            ),
        ).toBe(
            '<?xml version="1.0"?><!--c--><bible><!--keep--><book>1</book></bible>',
        );
    });

    test('keeps text and an unfinished tag after the root', () => {
        expect(
            optimizeXMLText(
                '<bible><book>1</book><info>2</info></bible>tail',
                onlyBooks,
            ),
        ).toBe('<bible><book>1</book></bible>tail');
        expect(
            optimizeXMLText(
                '<bible><book>1</book><info>2</info></bible><',
                onlyBooks,
            ),
        ).toBe('<bible><book>1</book></bible><');
    });
});
