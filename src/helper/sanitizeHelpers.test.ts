import { describe, expect, test } from 'vitest';

import { decodeHtmlEntities, escapeHtmlText } from './sanitizeHelpers';

describe('decodeHtmlEntities', () => {
    test('reads the named entities a <title> carries', () => {
        expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
        expect(decodeHtmlEntities('&quot;Oceans&quot; &lt;Live&gt;')).toBe(
            '"Oceans" <Live>',
        );
        expect(decodeHtmlEntities('It&apos;s')).toBe("It's");
    });

    test('reads decimal and hexadecimal references', () => {
        expect(decodeHtmlEntities('It&#39;s &#x2014; ok')).toBe("It's — ok");
        expect(decodeHtmlEntities('&#6016;')).toBe('ក');
    });

    test('leaves what it does not know as written', () => {
        expect(decodeHtmlEntities('a &bogus; b')).toBe('a &bogus; b');
        expect(decodeHtmlEntities('a & b')).toBe('a & b');
        expect(decodeHtmlEntities('&#0;')).toBe('&#0;');
    });

    test('undoes escapeHtmlText', () => {
        const text = 'a < b & "c" > d';
        expect(decodeHtmlEntities(escapeHtmlText(text))).toBe(text);
    });
});
