import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openPopupWindowMock: vi.fn(),
    setParamIdNumMock: vi.fn(),
    setParamKeyValueMock: vi.fn(),
}));

vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: h.openPopupWindowMock,
    setParamIdNum: h.setParamIdNumMock,
    setParamKeyValue: h.setParamKeyValueMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        bibleNoteHomePage: '/bible-note.html',
        markdownPreviewHomePage: '/markdown-preview.html',
    },
}));

import {
    genBibleNotePreviewPathname,
    genMarkdownPreviewPathname,
    openBibleNotePreview,
    openMarkdownPreview,
} from './resourcePreviewOpenHelpers';

describe('resource preview popup routes', () => {
    beforeEach(() => {
        h.openPopupWindowMock.mockReset().mockReturnValue('opened');
        h.setParamIdNumMock
            .mockReset()
            .mockImplementation((path, id) => `${path}&item=${id}`);
        h.setParamKeyValueMock
            .mockReset()
            .mockImplementation(
                (path, key, value) =>
                    `${path}?${key}=${encodeURIComponent(value)}`,
            );
    });

    test('a read-only note route carries its file and note id', () => {
        h.setParamKeyValueMock.mockImplementation(
            (path, key, value) => `${path}?${key}=${value}`,
        );
        expect(genBibleNotePreviewPathname('/archive/GEN.1.own', 12)).toBe(
            '/bible-note.html?preview-file=/archive/GEN.1.own&item=12',
        );
    });

    // 2026-11-10, the user: _as a user I want to open 2 windows of one
    // resource file so I can read different parts at the same time_.
    test('a note press opens ANOTHER window: a fresh id each time, the note window width', () => {
        openBibleNotePreview('/archive/GEN.1.own', 8, { isAnother: true });
        openBibleNotePreview('/archive/GEN.1.own', 8, { isAnother: true });

        const [first, second] = h.openPopupWindowMock.mock.calls;
        expect(first[0]).toBe(
            '/bible-note.html?preview-file=%2Farchive%2FGEN.1.own&item=8',
        );
        expect(first[1]).toMatch(/^bible-note-preview_\d+$/);
        expect(first[2]).toMatch(/^preview-[\da-f-]{36}$/);
        expect(second[2]).toMatch(/^preview-[\da-f-]{36}$/);
        expect(second[2]).not.toBe(first[2]);
        // No reuse: the main process would bring the first one forward.
        expect([first[3], second[3]]).toEqual([{ width: 870 }, { width: 870 }]);
    });

    test('a note opened without isAnother asks for the window already open', () => {
        openBibleNotePreview('/archive/GEN.1.own', 8);

        expect(h.openPopupWindowMock).toHaveBeenCalledWith(
            '/bible-note.html?preview-file=%2Farchive%2FGEN.1.own&item=8',
            expect.stringMatching(/^bible-note-preview_\d+$/),
            'preview',
            { width: 870, appReuseOpen: true },
        );
    });

    test('the markdown popup reuses an open window, and a row press opens another', () => {
        expect(genMarkdownPreviewPathname('/archive/Study.md')).toBe(
            '/markdown-preview.html?preview-file=%2Farchive%2FStudy.md',
        );
        expect(openMarkdownPreview('/archive/Study.md')).toBe('opened');
        expect(h.openPopupWindowMock).toHaveBeenLastCalledWith(
            '/markdown-preview.html?preview-file=%2Farchive%2FStudy.md',
            expect.stringMatching(/^markdown-preview_\d+$/),
            'preview',
            { width: 870, appReuseOpen: true },
        );

        expect(
            openMarkdownPreview('/archive/Study.md', { isAnother: true }),
        ).toBe('opened');
        expect(h.openPopupWindowMock).toHaveBeenLastCalledWith(
            '/markdown-preview.html?preview-file=%2Farchive%2FStudy.md',
            expect.stringMatching(/^markdown-preview_\d+$/),
            expect.stringMatching(/^preview-[\da-f-]{36}$/),
            { width: 870 },
        );
    });
});
