// @vitest-environment jsdom

import { posix } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    files: new Map<string, string>(),
    sizes: new Map<string, number>(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    renderError: null as Error | null,
}));

vi.mock('../server/fileHelpers', async () => {
    const path = await import('node:path');
    return {
        fsCheckFileExist: async (filePath: string) => state.files.has(filePath),
        fsGetFileSize: async (filePath: string) =>
            state.sizes.get(filePath) ?? state.files.get(filePath)!.length,
        fsReadFile: (filePath: string) => state.readFile(filePath),
        fsWriteFile: (filePath: string, text: string) =>
            state.writeFile(filePath, text),
        pathDirname: path.posix.dirname,
        pathResolve: path.posix.resolve,
    };
});
vi.mock('../server/calcHelpers', () => ({
    pathToFileURL: (filePath: string) => `file://${filePath}`,
}));
vi.mock('./markdownPreviewRenderHelpers', () => ({
    renderPreviewMarkdown: (
        text: string,
        resolveImage: (imagePath: string) => string,
    ) => {
        if (state.renderError !== null) {
            throw state.renderError;
        }
        return {
            html: `<p>${text}</p>`,
            image: resolveImage('images/map.png'),
        };
    },
}));

import {
    loadMarkdownPreviewFile,
    MAX_MARKDOWN_PREVIEW_FILE_SIZE,
    readMarkdownPreviewText,
    renderMarkdownPreviewText,
    saveMarkdownPreviewFile,
    toMarkdownPreviewTargetPath,
} from './markdownPreviewFileHelpers';

beforeEach(() => {
    state.files = new Map([['/docs/guide/readme.md', '# Hello']]);
    state.sizes = new Map();
    state.renderError = null;
    state.readFile.mockImplementation(async (filePath: string) =>
        state.files.get(filePath)!,
    );
    state.writeFile.mockReset();
    state.writeFile.mockImplementation(
        async (filePath: string, text: string) => {
            state.files.set(filePath, text);
            return filePath;
        },
    );
});

describe('loading a markdown file for preview', () => {
    test('renders the file with its pictures resolved beside the file, not the app', async () => {
        const result = await loadMarkdownPreviewFile('/docs/guide/readme.md');

        expect(result).toEqual({
            status: 'ready',
            html: '<p># Hello</p>',
            image: 'file:///docs/guide/images/map.png',
        });
    });

    test('says a missing file is not found without reading it', async () => {
        await expect(
            loadMarkdownPreviewFile('/docs/missing.md'),
        ).resolves.toEqual({ status: 'not-found' });
        expect(state.readFile).not.toHaveBeenCalled();
    });

    test('refuses a file over the cap by its size alone, never reading its bytes', async () => {
        state.sizes.set(
            '/docs/guide/readme.md',
            MAX_MARKDOWN_PREVIEW_FILE_SIZE + 1,
        );

        await expect(
            loadMarkdownPreviewFile('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'too-large' });
        expect(state.readFile).not.toHaveBeenCalled();

        state.sizes.set(
            '/docs/guide/readme.md',
            MAX_MARKDOWN_PREVIEW_FILE_SIZE,
        );
        await expect(
            loadMarkdownPreviewFile('/docs/guide/readme.md'),
        ).resolves.toMatchObject({ status: 'ready' });
    });

    test('never throws: a read or render failure is reported as unreadable', async () => {
        state.readFile.mockRejectedValueOnce(new Error('EACCES'));
        await expect(
            loadMarkdownPreviewFile('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'unreadable' });

        state.renderError = new Error('bad markdown');
        await expect(
            loadMarkdownPreviewFile('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'unreadable' });
    });

    test('follows a link from the file it is written in', () => {
        expect(
            toMarkdownPreviewTargetPath('/docs/guide/readme.md', '../faq.md'),
        ).toBe(posix.resolve('/docs/faq.md'));
        expect(
            toMarkdownPreviewTargetPath(
                '/docs/guide/readme.md',
                'steps/one.md',
            ),
        ).toBe('/docs/guide/steps/one.md');
    });
});

describe('reading and saving a markdown file for its editor', () => {
    test('reads the text the editor starts from, under the same size cap', async () => {
        await expect(
            readMarkdownPreviewText('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'ready', text: '# Hello' });

        await expect(
            readMarkdownPreviewText('/docs/missing.md'),
        ).resolves.toEqual({ status: 'not-found' });

        state.readFile.mockClear();
        state.sizes.set(
            '/docs/guide/readme.md',
            MAX_MARKDOWN_PREVIEW_FILE_SIZE + 1,
        );
        await expect(
            readMarkdownPreviewText('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'too-large' });
        expect(state.readFile).not.toHaveBeenCalled();

        state.sizes.clear();
        state.readFile.mockRejectedValueOnce(new Error('EACCES'));
        await expect(
            readMarkdownPreviewText('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'unreadable' });
    });

    test('draws a draft that is not saved as the file on disk would be drawn', () => {
        expect(
            renderMarkdownPreviewText('/docs/guide/readme.md', '# Draft'),
        ).toEqual({
            status: 'ready',
            html: '<p># Draft</p>',
            image: 'file:///docs/guide/images/map.png',
        });

        state.renderError = new Error('bad markdown');
        expect(
            renderMarkdownPreviewText('/docs/guide/readme.md', '# Draft'),
        ).toEqual({ status: 'unreadable' });
    });

    test('saves the text over the file and says whether it was written', async () => {
        await expect(
            saveMarkdownPreviewFile('/docs/guide/readme.md', '# Changed'),
        ).resolves.toBe(true);
        expect(state.writeFile).toHaveBeenCalledWith(
            '/docs/guide/readme.md',
            '# Changed',
        );
        await expect(
            readMarkdownPreviewText('/docs/guide/readme.md'),
        ).resolves.toEqual({ status: 'ready', text: '# Changed' });

        state.writeFile.mockRejectedValueOnce(new Error('EPERM'));
        await expect(
            saveMarkdownPreviewFile('/docs/guide/readme.md', '# Lost'),
        ).resolves.toBe(false);
        expect(state.files.get('/docs/guide/readme.md')).toBe('# Changed');
    });
});
