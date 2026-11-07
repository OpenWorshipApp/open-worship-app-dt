import { beforeEach, describe, expect, test, vi } from 'vitest';

// A note's Lexical content names the files it embeds; both bundles (one note
// item, a whole note file) carry exactly those files and point the imported
// copy at where they landed.
const h = vi.hoisted(() => ({ handleError: vi.fn() }));

vi.mock('../../helper/errorHelpers', () => ({ handleError: h.handleError }));

import {
    collectLexicalAppFilePaths,
    parseJson,
    rewriteLexicalAppFilePaths,
} from './noteEmbeddedFileHelpers';

function genContent() {
    return JSON.stringify({
        root: {
            children: [
                { type: 'image', src: 'C:\\Users\\me\\Pictures\\cross.png' },
                { type: 'image', src: 'c:/Users/me/a.png' },
                { type: 'image', src: '/home/me/b.png' },
                { type: 'image', src: '\\\\church-pc\\share\\c.png' },
                // Not a file on this machine: nothing to carry.
                { type: 'image', src: 'https://example.com/d.png' },
                { type: 'image', src: 'HTTP://EXAMPLE.COM/e.png' },
                { type: 'image', src: 'data:image/png;base64,AAAA' },
                { type: 'image', src: 'blob:app/1234' },
                { type: 'image', src: 'images/relative.png' },
                { type: 'image', src: 'C:relative.png' },
                { type: 'image', src: '' },
                { type: 'image', src: '   ' },
                { type: 'image', src: 42 },
                // An app file is carried whatever its form.
                { type: 'video', appFilePath: 'videos/clip.mp4' },
                { type: 'video', appFilePath: '' },
                {
                    type: 'audio',
                    appFilePath: '/media/song.mp3',
                    src: 'C:/media/cover.png',
                },
                // Named twice, carried once.
                { type: 'image', src: '/home/me/b.png' },
                { children: [{ deeper: { src: '/srv/f.png' } }] },
            ],
        },
    });
}

beforeEach(() => {
    h.handleError.mockReturnValue(undefined);
});

describe('parseJson', () => {
    test('reads JSON only, and tells the user of JSON that will not parse', () => {
        expect(parseJson('  {"a":1}  ')).toEqual({ a: 1 });
        expect(parseJson('[1,2]')).toEqual([1, 2]);
        // Plain text is a note's old plain content, not an error.
        expect(parseJson('In the beginning')).toBeNull();
        expect(parseJson('   ')).toBeNull();
        expect(h.handleError).not.toHaveBeenCalled();
        expect(parseJson('{"broken":')).toBeNull();
        expect(h.handleError).toHaveBeenCalledOnce();
        expect(h.handleError.mock.lastCall![0]).toBeInstanceOf(SyntaxError);
    });
});

describe('collectLexicalAppFilePaths', () => {
    test('lists every local file a note embeds, once, in document order', () => {
        expect(collectLexicalAppFilePaths(genContent())).toEqual([
            'C:\\Users\\me\\Pictures\\cross.png',
            'c:/Users/me/a.png',
            '/home/me/b.png',
            '\\\\church-pc\\share\\c.png',
            'videos/clip.mp4',
            '/media/song.mp3',
            'C:/media/cover.png',
            '/srv/f.png',
        ]);
        expect(collectLexicalAppFilePaths('[{"src":"/a.png"}]')).toEqual([
            '/a.png',
        ]);
    });

    test('content that is not Lexical JSON embeds nothing', () => {
        expect(collectLexicalAppFilePaths('A plain note')).toEqual([]);
        expect(collectLexicalAppFilePaths('{"root":')).toEqual([]);
        expect(collectLexicalAppFilePaths('"just a string"')).toEqual([]);
        expect(h.handleError).toHaveBeenCalledOnce();
    });
});

describe('rewriteLexicalAppFilePaths', () => {
    test('points every carried file at its imported copy and leaves the rest', () => {
        const content = genContent();
        const rewritten = rewriteLexicalAppFilePaths(
            content,
            new Map([
                ['c:/Users/me/a.png', '/data/note-assets/a.png'],
                ['videos/clip.mp4', '/data/note-assets/clip.mp4'],
                ['/srv/f.png', '/data/note-assets/f.png'],
            ]),
        );
        const children = JSON.parse(rewritten).root.children;
        const original = JSON.parse(content).root.children;
        expect(children[1].src).toBe('/data/note-assets/a.png');
        expect(children[13].appFilePath).toBe('/data/note-assets/clip.mp4');
        expect(children[17].children[0].deeper.src).toBe(
            '/data/note-assets/f.png',
        );
        // Everything else is the note as written.
        const untouched = [0, 2, 3, 4, 9, 14, 15, 16];
        for (const index of untouched) {
            expect(children[index]).toEqual(original[index]);
        }
    });

    test('a later untouched sibling does not undo an earlier rewrite', () => {
        const rewritten = rewriteLexicalAppFilePaths(
            '[{"src":"/old/a.png"},{"src":"/keep.png"},[{"appFilePath":"x"}]]',
            new Map([['/old/a.png', '/new/a.png']]),
        );
        expect(JSON.parse(rewritten)).toEqual([
            { src: '/new/a.png' },
            { src: '/keep.png' },
            [{ appFilePath: 'x' }],
        ]);
    });

    test('nothing to rewrite returns the content as it came, byte for byte', () => {
        const content = '{ "root": { "children": [ { "src": "/a.png" } ] } }';
        const map = new Map([['/b.png', '/new/b.png']]);
        expect(rewriteLexicalAppFilePaths(content, map)).toBe(content);
        expect(rewriteLexicalAppFilePaths('A plain note', map)).toBe(
            'A plain note',
        );
        expect(rewriteLexicalAppFilePaths('{"root":', map)).toBe('{"root":');
        expect(h.handleError).toHaveBeenCalledOnce();
    });
});
