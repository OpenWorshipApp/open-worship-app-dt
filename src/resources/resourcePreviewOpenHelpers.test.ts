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

    test('the note popup uses the shared preview id and the note window width', () => {
        openBibleNotePreview('/archive/GEN.1.own', 8);

        expect(h.openPopupWindowMock).toHaveBeenCalledWith(
            '/bible-note.html?preview-file=%2Farchive%2FGEN.1.own&item=8',
            expect.stringMatching(/^bible-note-preview_\d+$/),
            'preview',
            { width: 870 },
        );
    });

    test('the markdown popup opens the requested file in the same preview window', () => {
        expect(genMarkdownPreviewPathname('/archive/Study.md')).toBe(
            '/markdown-preview.html?preview-file=%2Farchive%2FStudy.md',
        );
        expect(openMarkdownPreview('/archive/Study.md')).toBe('opened');
        expect(h.openPopupWindowMock).toHaveBeenCalledWith(
            '/markdown-preview.html?preview-file=%2Farchive%2FStudy.md',
            expect.stringMatching(/^markdown-preview_\d+$/),
            'preview',
            { width: 870 },
        );
    });
});
