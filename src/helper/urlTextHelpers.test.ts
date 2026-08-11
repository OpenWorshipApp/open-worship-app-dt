import { describe, expect, test } from 'vitest';

import { splitTextByUrl } from './urlTextHelpers';

describe('splitTextByUrl', () => {
    test('returns a single text segment when there is no URL', () => {
        expect(
            splitTextByUrl('© BFBS/UBS 1954, 1962. All Rights Reserved.'),
        ).toEqual([
            {
                text: '© BFBS/UBS 1954, 1962. All Rights Reserved.',
                url: null,
            },
        ]);
        expect(splitTextByUrl('')).toEqual([]);
    });

    test('links a bare http(s) URL and keeps the surrounding prose', () => {
        expect(
            splitTextByUrl('See https://bible.org/terms for details'),
        ).toEqual([
            { text: 'See ', url: null },
            { text: 'https://bible.org/terms', url: 'https://bible.org/terms' },
            { text: ' for details', url: null },
        ]);
    });

    test('links the `www.` shorthand through https', () => {
        expect(splitTextByUrl('www.openworship.app')).toEqual([
            { text: 'www.openworship.app', url: 'https://www.openworship.app' },
        ]);
    });

    test('gives sentence punctuation back to the sentence', () => {
        expect(splitTextByUrl('Read https://a.example/x.')).toEqual([
            { text: 'Read ', url: null },
            { text: 'https://a.example/x', url: 'https://a.example/x' },
            { text: '.', url: null },
        ]);
    });

    test('keeps a bracket the URL opened, drops one it did not', () => {
        expect(
            splitTextByUrl('https://en.wikipedia.org/wiki/Bible_(book)'),
        ).toEqual([
            {
                text: 'https://en.wikipedia.org/wiki/Bible_(book)',
                url: 'https://en.wikipedia.org/wiki/Bible_(book)',
            },
        ]);
        expect(splitTextByUrl('(see https://a.example/x)')).toEqual([
            { text: '(see ', url: null },
            { text: 'https://a.example/x', url: 'https://a.example/x' },
            { text: ')', url: null },
        ]);
    });

    test('handles several URLs in one string', () => {
        expect(
            splitTextByUrl('https://a.example and https://b.example'),
        ).toEqual([
            { text: 'https://a.example', url: 'https://a.example' },
            { text: ' and ', url: null },
            { text: 'https://b.example', url: 'https://b.example' },
        ]);
    });

    test('never emits markup, so an injected tag stays literal text', () => {
        // The strings come from imported bible files; nothing here may become
        // HTML, and the closing quote/angle must not be eaten into the href.
        expect(
            splitTextByUrl('<img src=x onerror=alert(1)> https://a.example'),
        ).toEqual([
            { text: '<img src=x onerror=alert(1)> ', url: null },
            { text: 'https://a.example', url: 'https://a.example' },
        ]);
        expect(splitTextByUrl('<a href="https://a.example">x</a>')).toEqual([
            { text: '<a href="', url: null },
            { text: 'https://a.example', url: 'https://a.example' },
            { text: '">x</a>', url: null },
        ]);
    });
});
