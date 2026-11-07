// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    fsCheckFileExist: vi.fn(),
    fsGetFileSize: vi.fn(),
    fsReadFile: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: h.fsCheckFileExist,
    fsGetFileSize: h.fsGetFileSize,
    fsReadFile: h.fsReadFile,
    pathDirname: (filePath: string) => {
        return filePath.slice(0, filePath.lastIndexOf('/'));
    },
    pathResolve: (base: string, target: string) => {
        if (target.startsWith('/')) {
            return target;
        }
        const parts = base.split('/');
        for (const part of target.split('/')) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.') {
                parts.push(part);
            }
        }
        return parts.join('/');
    },
}));
vi.mock('../server/calcHelpers', () => ({
    pathToFileURL: (filePath: string) => `file://${filePath}`,
}));

import {
    loadMarkdownPreviewFile,
    MAX_MARKDOWN_PREVIEW_FILE_SIZE,
    toMarkdownPreviewTargetPath,
} from './markdownPreviewFileHelpers';

beforeEach(() => {
    h.fsCheckFileExist.mockResolvedValue(true);
    h.fsGetFileSize.mockResolvedValue(120);
    h.fsReadFile.mockResolvedValue('# Title');
});

describe('loadMarkdownPreviewFile', () => {
    test('a missing file is "not-found" and nothing is read', async () => {
        h.fsCheckFileExist.mockResolvedValue(false);
        await expect(loadMarkdownPreviewFile('/docs/a.md')).resolves.toEqual({
            status: 'not-found',
        });
        expect(h.fsCheckFileExist).toHaveBeenCalledWith('/docs/a.md');
        expect(h.fsGetFileSize).not.toHaveBeenCalled();
        expect(h.fsReadFile).not.toHaveBeenCalled();
    });

    test('past the cap only the SIZE is read', async () => {
        expect(MAX_MARKDOWN_PREVIEW_FILE_SIZE).toBe(5 * 1024 * 1024);
        h.fsGetFileSize.mockResolvedValue(MAX_MARKDOWN_PREVIEW_FILE_SIZE + 1);
        await expect(loadMarkdownPreviewFile('/docs/big.md')).resolves.toEqual({
            status: 'too-large',
        });
        expect(h.fsReadFile).not.toHaveBeenCalled();
    });

    test('a file exactly at the cap is still rendered', async () => {
        h.fsGetFileSize.mockResolvedValue(MAX_MARKDOWN_PREVIEW_FILE_SIZE);
        const result = await loadMarkdownPreviewFile('/docs/edge.md');
        expect(result.status).toBe('ready');
    });

    test('renders, resolving pictures beside the FILE', async () => {
        h.fsReadFile.mockResolvedValue(
            '# Map\n\n![map](images/map.png) ![up](../shared/up.png)\n\n' +
                '```mermaid\ngraph TD\n```',
        );
        const result = await loadMarkdownPreviewFile('/church/docs/notes.md');
        expect(h.fsReadFile).toHaveBeenCalledWith('/church/docs/notes.md');
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        expect(result.html).toContain(
            'src="file:///church/docs/images/map.png"',
        );
        expect(result.html).toContain('src="file:///church/shared/up.png"');
        expect(result.html).toContain('id="md-heading-map"');
        expect(result.mermaidSources).toEqual(['graph TD\n']);
    });

    test('never throws: a failing read is "unreadable"', async () => {
        h.fsReadFile.mockRejectedValue(new Error('EACCES'));
        await expect(
            loadMarkdownPreviewFile('/docs/locked.md'),
        ).resolves.toEqual({ status: 'unreadable' });
        h.fsCheckFileExist.mockRejectedValue(new Error('EIO'));
        await expect(loadMarkdownPreviewFile('/docs/x.md')).resolves.toEqual({
            status: 'unreadable',
        });
    });
});

describe('toMarkdownPreviewTargetPath', () => {
    test('a link is resolved against the folder of the file on screen', () => {
        expect(
            toMarkdownPreviewTargetPath('/church/docs/start.md', 'next.md'),
        ).toBe('/church/docs/next.md');
        expect(
            toMarkdownPreviewTargetPath(
                '/church/docs/start.md',
                '../README.md',
            ),
        ).toBe('/church/README.md');
        expect(
            toMarkdownPreviewTargetPath('/church/docs/start.md', '/other/a.md'),
        ).toBe('/other/a.md');
    });
});
