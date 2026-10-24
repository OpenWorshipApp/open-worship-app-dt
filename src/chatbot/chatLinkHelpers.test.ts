import { describe, expect, it } from 'vitest';

import {
    MAX_CHAT_LINK_COUNT,
    checkIsOpenableLink,
    toOpenableLinks,
    toShownLinkText,
} from './chatLinkHelpers';

// EC-297: a Google search for Khmer words was drawn as 300 characters of
// percent-escapes.
describe('toShownLinkText', () => {
    it('draws a search decoded, its + as spaces, and short', () => {
        const url =
            'https://www.google.com/search?q=bible+verse+' +
            encodeURIComponent('ព្រះស្រឡាញ់មនុស្សលោក');
        expect(toShownLinkText(url)).toBe(
            'google.com/search?q=bible verse ព្រះស្រឡាញ់មនុស្សលោក',
        );
    });

    it('cuts a long address and keeps a short one whole', () => {
        const long = `https://example.org/${'a'.repeat(100)}`;
        expect([...toShownLinkText(long)]).toHaveLength(60);
        expect(toShownLinkText(long).endsWith('…')).toBe(true);
        expect(toShownLinkText('https://openworship.app/help')).toBe(
            'openworship.app/help',
        );
    });

    it('leaves an address it cannot decode as written', () => {
        expect(toShownLinkText('https://example.org/%E1%9E')).toBe(
            'example.org/%E1%9E',
        );
    });
});

describe('checkIsOpenableLink', () => {
    it('takes a web address and nothing else', () => {
        expect(
            checkIsOpenableLink(
                'https://github.com/Beblia/Holy-Bible-XML-Format',
            ),
        ).toBe(true);
        expect(checkIsOpenableLink('http://example.org/bible.xml')).toBe(true);
        for (const value of [
            'file:///C:/Windows/win.ini',
            'javascript:alert(1)',
            'data:text/html,hi',
            'owa://local/presenter.html',
            'https://user:pw@example.org/x',
            'not an address',
            `https://example.org/${'a'.repeat(600)}`,
            42,
            null,
            undefined,
        ]) {
            expect([value, checkIsOpenableLink(value)]).toEqual([value, false]);
        }
    });
});

describe('toOpenableLinks', () => {
    it('keeps each web address once, a few at most', () => {
        const list = Array.from({ length: 6 }, (_item, index) => {
            return `https://example.org/${index}`;
        });
        expect(
            toOpenableLinks([
                list[0],
                list[0],
                'file:///x',
                undefined,
                ...list,
            ]),
        ).toEqual(list.slice(0, MAX_CHAT_LINK_COUNT));
        expect(toOpenableLinks('https://example.org/')).toEqual([]);
        expect(toOpenableLinks(undefined)).toEqual([]);
    });
});
