// @vitest-environment jsdom

import { posix } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    files: new Map<string, string>(),
    sizes: new Map<string, number>(),
    readFile: vi.fn(),
    renderError: null as Error | null,
}));

vi.mock('../server/fileHelpers', async () => {
    const path = await import('node:path');
    return {
        fsCheckFileExist: async (filePath: string) => state.files.has(filePath),
        fsGetFileSize: async (filePath: string) =>
            state.sizes.get(filePath) ?? state.files.get(filePath)!.length,
        fsReadFile: (filePath: string) => state.readFile(filePath),
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
    toMarkdownPreviewTargetPath,
} from './markdownPreviewFileHelpers';

beforeEach(() => {
    state.files = new Map([['/docs/guide/readme.md', '# Hello']]);
    state.sizes = new Map();
    state.renderError = null;
    state.readFile.mockImplementation(async (filePath: string) =>
        state.files.get(filePath)!,
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
