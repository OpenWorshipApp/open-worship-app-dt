// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
    collectLexicalAppFilePaths,
    rewriteLexicalAppFilePaths,
    toBibleNoteItemArchiveFileName,
    toBibleNoteItemTmpFileName,
} from './bibleNoteItemArchiveHelpers';

describe('bibleNoteItemArchiveHelpers', () => {
    test('collects unique Lexical appFilePath values recursively', () => {
        const localVideoPath = String.raw`C:\Users\racky\Downloads\Pink motion 4k.mp4`;
        const content = JSON.stringify({
            root: {
                children: [
                    { type: 'image', appFilePath: '/media/alpha.png' },
                    {
                        type: 'image',
                        src: localVideoPath,
                    },
                    {
                        type: 'image',
                        src: 'https://example.com/not-local.png',
                    },
                    {
                        type: 'gallery',
                        files: [
                            { appFilePath: '/media/beta.pdf' },
                            { appFilePath: '/media/alpha.png' },
                            { appFilePath: '' },
                        ],
                    },
                ],
            },
        });

        expect(collectLexicalAppFilePaths(content)).toEqual([
            '/media/alpha.png',
            localVideoPath,
            '/media/beta.pdf',
        ]);
        expect(collectLexicalAppFilePaths('plain text')).toEqual([]);
    });

    test('rewrites Lexical appFilePath values recursively', () => {
        const content = JSON.stringify({
            root: {
                children: [
                    { type: 'image', appFilePath: '/media/alpha.png' },
                    { type: 'image', src: '/media/alpha.png' },
                    { type: 'audio', appFilePath: '/media/beta.mp3' },
                ],
            },
        });

        const rewritten = rewriteLexicalAppFilePaths(
            content,
            new Map([['/media/alpha.png', '/app-data/tmp-files/alpha.png']]),
        );
        const parsed = JSON.parse(rewritten);

        expect(parsed.root.children[0].appFilePath).toBe(
            '/app-data/tmp-files/alpha.png',
        );
        expect(parsed.root.children[1].src).toBe(
            '/app-data/tmp-files/alpha.png',
        );
        expect(parsed.root.children[2].appFilePath).toBe('/media/beta.mp3');
        expect(rewriteLexicalAppFilePaths('plain text', new Map())).toBe(
            'plain text',
        );
    });

    test('creates a filesystem-safe gzipped tar archive name', () => {
        expect(toBibleNoteItemArchiveFileName(' Sermon:/Note* ')).toBe(
            'Sermon_Note.owabn.tar.gz',
        );
        expect(toBibleNoteItemArchiveFileName('')).toBe(
            'BibleNoteItem.owabn.tar.gz',
        );
    });

    test('creates a traceable imported tmp file name', () => {
        expect(
            toBibleNoteItemTmpFileName(
                'Default',
                12,
                'Pink motion 4k.mp4',
                1780086228518,
            ),
        ).toBe('bn-RGVmYXVsdC8xMi8xNzgwMDg2MjI4NTE4.mp4');
    });
});
