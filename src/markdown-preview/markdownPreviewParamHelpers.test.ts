import { describe, expect, test } from 'vitest';

import markdownTypeList from '../server/mime/markdown-types.json';
import {
    checkIsMarkdownPreviewFileName,
    getMarkdownPreviewFilePath,
    MARKDOWN_PREVIEW_FILE_PARAM_NAME,
} from './markdownPreviewParamHelpers';

function genUrl(filePath: string) {
    const url = new URL('https://localhost:3000/markdownPreview.html');
    url.searchParams.set(MARKDOWN_PREVIEW_FILE_PARAM_NAME, filePath);
    return url.toString();
}

describe('checkIsMarkdownPreviewFileName', () => {
    test('.md and .markdown, whatever the case', () => {
        expect(checkIsMarkdownPreviewFileName('GEN.1.md')).toBe(true);
        expect(checkIsMarkdownPreviewFileName('GEN.1.MD')).toBe(true);
        expect(checkIsMarkdownPreviewFileName('notes.markdown')).toBe(true);
        expect(checkIsMarkdownPreviewFileName('GEN.1.md.pdf')).toBe(false);
        expect(checkIsMarkdownPreviewFileName('GEN.1.mdx')).toBe(false);
    });

    // The Bible Notes list shows every Markdown name the mimetype table
    // knows, and a row it shows must open here.
    test('every Markdown name the mimetype table lists', () => {
        const dotExtensionList = markdownTypeList.flatMap((type) => {
            return type.extensions;
        });
        expect(dotExtensionList.length).toBeGreaterThan(2);
        for (const dotExtension of dotExtensionList) {
            expect(
                checkIsMarkdownPreviewFileName(
                    'notes' + dotExtension.toUpperCase(),
                ),
            ).toBe(true);
        }
        expect(checkIsMarkdownPreviewFileName('notes.mkdx')).toBe(false);
    });
});

describe('getMarkdownPreviewFilePath', () => {
    test('reads the full path back out of the window URL', () => {
        const filePath = 'C:\\Users\\me\\resources\\GEN 1.md';
        expect(getMarkdownPreviewFilePath(genUrl(filePath))).toBe(filePath);
    });

    test('refuses a path that is not a markdown file', () => {
        expect(
            getMarkdownPreviewFilePath(genUrl('C:\\Users\\me\\secret.txt')),
        ).toBeNull();
        expect(
            getMarkdownPreviewFilePath(
                'https://localhost:3000/markdownPreview.html',
            ),
        ).toBeNull();
        expect(getMarkdownPreviewFilePath('not a url')).toBeNull();
    });
});
