import { describe, expect, it } from 'vitest';

import {
    checkIsPreviewWindowFileName,
    toHeldPreviewFilePath,
    toPreviewPathKey,
    toPreviewWindowFilePath,
} from './windowOnTopRequestHelpers';

const HOST = 'https://localhost:3000';

// The file a window of its own shows, as the help window reads it off the
// window's address to work in it (2026-11-10, the user: _should behave like
// what working for bible-note_). Main reads the same with Node's own path
// reading (`electron/windowOnTopHelpers.ts`).
describe('toPreviewWindowFilePath', () => {
    it("reads a Markdown Preview's file off its parameter", () => {
        const filePath = "C:\\data\\resources\\JHN.3 God's Love.md";
        expect(
            toPreviewWindowFilePath(
                `${HOST}/markdownPreview.html?preview-file=` +
                    `${encodeURIComponent(filePath)}&uuid=preview`,
            ),
        ).toBe(filePath);
        // Not a markdown file by name: no file at all.
        expect(
            toPreviewWindowFilePath(
                `${HOST}/markdownPreview.html?preview-file=%2Fa%2Fsetting.json`,
            ),
        ).toBeNull();
    });

    it("reads a PDF viewer's file off its own address", () => {
        expect(
            toPreviewWindowFilePath(
                'file:///C:/data/My%20Resources/JHN.3.pdf?uuid=JHN.3.pdf',
            ),
        ).toBe('C:/data/My Resources/JHN.3.pdf');
        expect(toPreviewWindowFilePath('file:///home/me/notes/ROM.8.PDF')).toBe(
            '/home/me/notes/ROM.8.PDF',
        );
        // A share keeps its server.
        expect(
            toPreviewWindowFilePath('file://church-pc/shared/JHN.3.pdf'),
        ).toBe('//church-pc/shared/JHN.3.pdf');
    });

    it('is no file for a page of the app, another file or no address', () => {
        expect(
            toPreviewWindowFilePath(`${HOST}/reader.html?uuid=reader`),
        ).toBeNull();
        expect(toPreviewWindowFilePath(`${HOST}/files/JHN.3.pdf`)).toBeNull();
        expect(
            toPreviewWindowFilePath('file:///tmp/print-preview-1-2.html'),
        ).toBeNull();
        expect(toPreviewWindowFilePath('file:///C:/a/%E0%A4%A.pdf')).toBeNull();
        expect(toPreviewWindowFilePath('not an address')).toBeNull();
    });
});

describe('toPreviewPathKey', () => {
    it('names one file the same whatever its slashes and case', () => {
        expect(toPreviewPathKey('C:\\Data\\JHN.3.pdf')).toBe(
            toPreviewPathKey('c:/data/jhn.3.PDF'),
        );
        expect(toPreviewPathKey('/a/JHN.3.md')).not.toBe(
            toPreviewPathKey('/a/JHN.4.md'),
        );
    });
});

describe('the file whose window is held', () => {
    it('is the newest of the files with a window of their own', () => {
        expect(checkIsPreviewWindowFileName('JHN.3.PDF')).toBe(true);
        expect(checkIsPreviewWindowFileName('notes.markdown')).toBe(true);
        expect(checkIsPreviewWindowFileName('JHN.0.json')).toBe(false);
        expect(
            toHeldPreviewFilePath(['/a/JHN.3.pdf', '/a/b.png', '/a/JHN.3.md']),
        ).toBe('/a/JHN.3.md');
        expect(toHeldPreviewFilePath(['/a/b.png', undefined])).toBeNull();
    });
});
