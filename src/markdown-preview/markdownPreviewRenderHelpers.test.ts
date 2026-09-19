// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
    classifyMarkdownHref,
    renderPreviewMarkdown,
    toHeadingElementId,
    toHeadingSlug,
} from './markdownPreviewRenderHelpers';

function render(text: string) {
    return renderPreviewMarkdown(text, (filePath) => {
        return `file:///base/${filePath}`;
    });
}

describe('renderPreviewMarkdown: nothing in the file runs', () => {
    test('raw HTML is parsed, and everything that runs is taken out', () => {
        const { html } = render(
            [
                '<script>alert(1)</script>',
                '',
                '<img src=x onerror="alert(1)">',
                '',
                '<a href="javascript:alert(1)" onclick="alert(1)">a</a>',
                '',
                '<iframe src="https://example.com"></iframe>',
                '<object data="x.swf"></object>',
                '<form action="https://example.com"><input name="q">' +
                    '<button>go</button></form>',
                '<style>body { display: none; }</style>',
                '<svg><script>alert(1)</script></svg>',
            ].join('\n'),
        );
        for (const text of [
            '<script',
            'onerror',
            'onclick',
            'javascript:',
            '<iframe',
            '<object',
            '<form',
            '<input',
            '<button',
            '<style',
            '<svg',
        ]) {
            expect(html).not.toContain(text);
        }
    });

    test('a README renders the way GitHub shows it', () => {
        const { html } = render(
            [
                '<p align="center">',
                '  <img src="screenshots/Shot 1.png" alt="Presenter" width="700">',
                '</p>',
                '',
                '<details>',
                '<summary><strong>More</strong></summary>',
                '',
                'Hidden **words**',
                '',
                '</details>',
            ].join('\n'),
        );
        expect(html).toContain('<p align="center">');
        expect(html).toContain('width="700"');
        expect(html).toContain('src="file:///base/screenshots/Shot 1.png"');
        expect(html).toContain('<summary><strong>More</strong></summary>');
        expect(html).toContain('<strong>words</strong>');
    });

    test('no style but a column alignment, and only its own classes', () => {
        const { html } = render(
            [
                '<div style="position:fixed;inset:0" class="position-fixed ' +
                    'app-markdown-table w-100">x</div>',
                '',
                '| a |',
                '| -: |',
                '| 1 |',
            ].join('\n'),
        );
        expect(html).not.toContain('position');
        expect(html).toContain('<div class="app-markdown-table">x</div>');
        expect(html).toContain('style="text-align:right"');
    });

    test('an id cannot take the page’s own names', () => {
        const { html } = render(
            '<a id="root"></a><a name="app-markdown-mermaid-1"></a>' +
                '<a id="top"></a>',
        );
        expect(html).not.toContain('"root"');
        expect(html).not.toContain('app-markdown-mermaid-1');
        expect(html).toContain('id="top"');
    });

    test('a javascript: link is not rendered as a link', () => {
        const { html } = render('[press](javascript:alert(1))');
        expect(html).not.toContain('href="javascript');
        expect(html).not.toContain('<a');
    });

    test('a mermaid block is its escaped code, with a placeholder', () => {
        const source = 'graph TD\n  A["<b>x</b>"] --> B\n';
        const { html, mermaidSources } = render(
            `\`\`\`mermaid\n${source}\`\`\`\n\n\`\`\`js\nconst a = 1;\n\`\`\``,
        );
        expect(mermaidSources).toEqual([source]);
        expect(html).toContain('data-mermaid-index="0"');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(html).not.toContain('<b>');
        // Every other language stays an ordinary code block.
        expect(html).toContain('class="language-js"');
    });
});

describe('renderPreviewMarkdown: headings and images', () => {
    test('headings get prefixed, GitHub-numbered ids', () => {
        const { html } = render('# Usage\n\n## Usage\n\n### Root `node`');
        expect(html).toContain(`id="${toHeadingElementId('usage')}"`);
        expect(html).toContain(`id="${toHeadingElementId('usage-1')}"`);
        expect(html).toContain(`id="${toHeadingElementId('root-node')}"`);
        // Never the bare slug: `id="root"` is the page's own mount point.
        expect(html).not.toContain('id="root-node"');
    });

    test('a local image is resolved; web and safe data images are kept', () => {
        const { html } = render(
            '![a](images/map.png) ![b](https://example.com/b.png) ' +
                '![c](data:image/png;base64,AAAA) ![d](ftp://example.com/d.png)',
        );
        expect(html).toContain('src="file:///base/images/map.png"');
        expect(html).toContain('src="https://example.com/b.png"');
        expect(html).toContain('src="data:image/png;base64,AAAA"');
        expect(html).not.toContain('ftp://');
        expect(html).toContain('loading="lazy"');
    });

    test('a drive path survives the sanitizer, resolved', () => {
        const { html } = render(
            '![e](C:\\pics\\e.png)\n\n<img src="D:/pics/f.png">',
        );
        expect(html).toContain('src="file:///base/C:\\pics\\e.png"');
        expect(html).toContain('src="file:///base/D:/pics/f.png"');
    });

    test('a table is wrapped so it scrolls on its own', () => {
        const { html } = render('| a | b |\n| - | - |\n| 1 | 2 |');
        expect(html).toContain('<div class="app-markdown-table"><table>');
    });
});

describe('toHeadingSlug', () => {
    test('keeps letters of every script and drops punctuation', () => {
        expect(toHeadingSlug('Getting Started!')).toBe('getting-started');
        expect(toHeadingSlug('  What’s new?  ')).toBe('whats-new');
        expect(toHeadingSlug('សេចក្ដីផ្ដើម ១')).toBe('សេចក្ដីផ្ដើម-១');
    });
});

describe('classifyMarkdownHref', () => {
    test('anchors, web addresses and local paths', () => {
        expect(classifyMarkdownHref('#getting-started')).toEqual({
            kind: 'anchor',
            slug: 'getting-started',
        });
        expect(classifyMarkdownHref('https://example.com/a?b#c')).toEqual({
            kind: 'web',
            url: 'https://example.com/a?b#c',
        });
        expect(classifyMarkdownHref('docs/My%20Notes.md#part')).toEqual({
            kind: 'local',
            filePath: 'docs/My Notes.md',
        });
        // markdown-it percent-encodes the backslash of a drive path.
        expect(classifyMarkdownHref('C:%5Cnotes%5Ca.md')).toEqual({
            kind: 'local',
            filePath: 'C:\\notes\\a.md',
        });
    });

    test('anything that could launch a program is unsupported', () => {
        for (const href of [
            'file:///C:/Windows/notepad.exe',
            'mailto:someone@example.com',
            'javascript:alert(1)',
            'ms-settings:privacy',
            '//example.com/a',
            '',
            '?only-a-query',
        ]) {
            expect(classifyMarkdownHref(href)).toEqual({ kind: 'unsupported' });
        }
    });
});
