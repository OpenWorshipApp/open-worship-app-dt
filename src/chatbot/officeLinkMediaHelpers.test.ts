import { describe, expect, test } from 'vitest';

import {
    checkIsAllowedLinkUrl,
    checkIsOfficeLinkValue,
    checkIsPublicAddress,
    findLinkMediaKind,
    readTypedLinks,
    toFreeLinkFileName,
    toLinkFileName,
    toLinkKey,
} from './officeLinkMediaHelpers';

// EC-777: a picture, video or sound at a link the person typed.
function toBytes(...parts: (number[] | string)[]) {
    const out: number[] = [];
    for (const part of parts) {
        if (typeof part === 'string') {
            for (const char of part) {
                out.push(char.charCodeAt(0));
            }
        } else {
            out.push(...part);
        }
    }
    return new Uint8Array(out);
}

describe('the links a person typed', () => {
    test('each link once, without the mark that ends the sentence', () => {
        expect(
            readTypedLinks([
                'Use https://cdn.example.org/a/choir.jpg.',
                'and (https://cdn.example.org/a/choir.jpg) again, ' +
                    'then http://media.example.net/song.mp3?x=1, please',
            ]),
        ).toEqual([
            'https://cdn.example.org/a/choir.jpg',
            'http://media.example.net/song.mp3?x=1',
        ]);
    });

    test('no link, nothing; a link compares as URL writes it', () => {
        expect(readTypedLinks(['put a cross on slide 2'])).toEqual([]);
        expect(toLinkKey('HTTPS://Example.ORG/x.png')).toBe(
            'https://example.org/x.png',
        );
        expect(toLinkKey('choir.jpg')).toBeNull();
        expect(toLinkKey(3)).toBeNull();
        expect(toLinkKey('https://')).toBeNull();
    });

    test('a change value is a link only when it starts as one', () => {
        expect(checkIsOfficeLinkValue(' https://example.org/x.png')).toBe(true);
        expect(checkIsOfficeLinkValue('Choir.jpg')).toBe(false);
        expect(checkIsOfficeLinkValue(null)).toBe(false);
    });
});

describe('where a link may be downloaded from', () => {
    test('a public address is allowed', () => {
        expect(checkIsAllowedLinkUrl('https://upload.example.org/a.png')).toBe(
            true,
        );
        expect(checkIsAllowedLinkUrl('http://93.184.216.34/a.png')).toBe(true);
    });

    test.each([
        'http://localhost:3000/a.png',
        'http://127.0.0.1/a.png',
        'http://192.168.1.20/a.png',
        'http://10.0.0.5/a.png',
        'http://172.16.3.4/a.png',
        'http://169.254.169.254/latest/meta-data',
        'http://[::1]/a.png',
        'http://0.0.0.0/a.png',
        'http://printer/a.png',
        'http://church.local/a.png',
        'http://[::ffff:127.0.0.1]/a.png',
        'http://[::ffff:c0a8:101]/a.png',
        'http://[fe80::1]/a.png',
        'http://[fd12::1]/a.png',
        'http://[ff02::1]/a.png',
        'http://224.0.0.1/a.png',
        'http://2130706433/a.png',
        'https://user:secret@example.org/a.png',
        'file:///etc/passwd',
        'ftp://example.org/a.png',
        'not a link',
    ])('%s is refused', (url) => {
        expect(checkIsAllowedLinkUrl(url)).toBe(false);
    });
});

describe('the address a download connected to', () => {
    test.each([
        ['93.184.216.34', true],
        ['2606:2800:220:1:248:1893:25c8:1946', true],
        ['[2001:db8::1]', true],
        ['::ffff:93.184.216.34', true],
        ['10.1.2.3', false],
        ['172.20.0.1', false],
        ['192.168.0.10', false],
        ['100.100.1.1', false],
        ['169.254.169.254', false],
        ['127.0.0.1', false],
        ['0.0.0.0', false],
        ['239.1.1.1', false],
        ['::1', false],
        ['::', false],
        ['::ffff:10.0.0.1', false],
        ['::ffff:7f00:1', false],
        ['fe80::1%en0', false],
        ['fc00::1', false],
        ['fec0::1', false],
        ['ff05::2', false],
        ['example.org', false],
    ])('%s public: %s', (address, isPublic) => {
        expect(checkIsPublicAddress(address)).toBe(isPublic);
    });
});

describe('what the first bytes say a file is', () => {
    test('the pictures a deck takes', () => {
        expect(
            findLinkMediaKind(
                toBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            ),
        ).toEqual({ kind: 'picture', ext: 'png' });
        expect(findLinkMediaKind(toBytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
            kind: 'picture',
            ext: 'jpg',
        });
        expect(findLinkMediaKind(toBytes('GIF89a'))).toEqual({
            kind: 'picture',
            ext: 'gif',
        });
        expect(findLinkMediaKind(toBytes('BM', new Array(20).fill(0)))).toEqual(
            { kind: 'picture', ext: 'bmp' },
        );
    });

    test('videos and sounds, by their own bytes', () => {
        expect(findLinkMediaKind(toBytes([0, 0, 0, 0x18], 'ftypisom'))).toEqual(
            { kind: 'media', ext: 'mp4' },
        );
        expect(findLinkMediaKind(toBytes([0, 0, 0, 0x14], 'ftypqt  '))).toEqual(
            { kind: 'media', ext: 'mov' },
        );
        expect(findLinkMediaKind(toBytes([0, 0, 0, 0x20], 'ftypM4A '))).toEqual(
            { kind: 'media', ext: 'm4a' },
        );
        expect(
            findLinkMediaKind(toBytes('RIFF', [0, 0, 0, 0], 'WAVE')),
        ).toEqual({ kind: 'media', ext: 'wav' });
        expect(
            findLinkMediaKind(toBytes('RIFF', [0, 0, 0, 0], 'AVI ')),
        ).toEqual({ kind: 'media', ext: 'avi' });
        expect(findLinkMediaKind(toBytes('ID3', [4, 0]))).toEqual({
            kind: 'media',
            ext: 'mp3',
        });
        expect(findLinkMediaKind(toBytes([0xff, 0xfb, 0x90]))).toEqual({
            kind: 'media',
            ext: 'mp3',
        });
        const asf = [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11];
        expect(findLinkMediaKind(toBytes(asf), '/a/song.wma')).toEqual({
            kind: 'media',
            ext: 'wma',
        });
        expect(findLinkMediaKind(toBytes(asf), '/a/clip')).toEqual({
            kind: 'media',
            ext: 'wmv',
        });
    });

    test('a picture a deck does not take is named', () => {
        expect(
            findLinkMediaKind(toBytes('RIFF', [0, 0, 0, 0], 'WEBP')),
        ).toEqual({ unsupported: 'WebP' });
        expect(findLinkMediaKind(toBytes([0, 0, 0, 0x1c], 'ftypavif'))).toEqual(
            { unsupported: 'AVIF' },
        );
        expect(findLinkMediaKind(toBytes([0, 0, 0, 0x1c], 'ftypheic'))).toEqual(
            { unsupported: 'HEIC' },
        );
        expect(findLinkMediaKind(toBytes('  <svg xmlns="x">'))).toEqual({
            unsupported: 'SVG',
        });
        expect(
            findLinkMediaKind(toBytes('<?xml version="1.0"?>'), '/a.svg'),
        ).toEqual({ unsupported: 'SVG' });
    });

    test('a web page or anything else is nothing', () => {
        expect(findLinkMediaKind(toBytes('<!doctype html><html>'))).toBeNull();
        expect(
            findLinkMediaKind(toBytes('<?xml version="1.0"?><rss>')),
        ).toBeNull();
        expect(
            findLinkMediaKind(toBytes('RIFF', [0, 0, 0, 0], 'CDDA')),
        ).toBeNull();
        expect(findLinkMediaKind(toBytes('{"a":1}'))).toBeNull();
        expect(findLinkMediaKind(new Uint8Array(0))).toBeNull();
    });
});

describe('the name a file from a link goes by', () => {
    test("the link's last part under the bytes' own ending", () => {
        expect(
            toLinkFileName(
                'https://cdn.example.org/img/Easter%20Cross.webp?w=800',
                'picture',
                'png',
            ),
        ).toBe('Easter Cross.png');
        expect(
            toLinkFileName(
                'https://example.org/a/My%3Cb%3E%22Song%22.mp4',
                'media',
                'mp4',
            ),
        ).toBe('My b Song.mp4');
        // a slash written into the name is no folder, and no dot leads it
        expect(
            toLinkFileName(
                'https://example.org/a/..%2F..%2Fetc%2Fhosts',
                'picture',
                'png',
            ),
        ).toBe('etc hosts.png');
    });

    test('a link with no last part gets the kind as its name', () => {
        expect(toLinkFileName('https://example.org/', 'picture', 'jpg')).toBe(
            'picture.jpg',
        );
        expect(toLinkFileName('https://example.org/%%%', 'media', 'mp3')).toBe(
            'video.mp3',
        );
    });

    test('a name already attached gets a number', () => {
        expect(toFreeLinkFileName('choir.jpg', ['Other.png'])).toBe(
            'choir.jpg',
        );
        expect(
            toFreeLinkFileName('choir.jpg', ['Choir.JPG', 'choir (2).jpg']),
        ).toBe('choir (3).jpg');
        expect(toFreeLinkFileName('picture', ['picture'])).toBe('picture (2)');
    });
});
