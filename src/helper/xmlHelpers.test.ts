// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

import { appXMLParser, appXMLSerializer, optimizeXMLText } from './xmlHelpers';

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
                '<bible title="A &quot;quoted&quot; &lt;Bible&gt; &amp; more"><verse number="1">A &lt; B &amp; C &gt; D</verse><data><![CDATA[[{"content":"Heading <title> & body"}]]]></data></bible>',
            );
            expect(appXMLSerializer.serializeToString(verseElement)).toBe(
                '<verse number="1">A &lt; B &amp; C &gt; D</verse>',
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
