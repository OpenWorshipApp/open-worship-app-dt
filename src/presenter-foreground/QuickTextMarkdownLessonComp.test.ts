import MarkdownIt from 'markdown-it';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
// The component's own imports, none of which this list needs.
vi.mock('../lyric-list/markdownHelpers', () => ({ renderMarkdown: vi.fn() }));
vi.mock('../helper/sanitizeHelpers', () => ({ sanitizeHtml: vi.fn() }));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/appHooks', () => ({ useAppEffect: vi.fn() }));
vi.mock('../server/appProvider', () => ({ default: {} }));

import { genMarkdownLessonSourceList } from './QuickTextMarkdownLessonComp';

// The lesson has to tell the truth about the renderer the screen uses --
// `renderMarkdown` is markdown-it with these options -- so each row is
// rendered for real and held to what it claims to teach.
const markdown = new MarkdownIt({ html: true });

describe('the Quick Text markdown lesson', () => {
    test('each row draws what it teaches', () => {
        const htmlList = genMarkdownLessonSourceList().map((source) => {
            return markdown.render(source).trim();
        });
        expect(htmlList).toEqual([
            '<h2>Heading</h2>',
            '<h3>Heading</h3>',
            '<p><strong>Bold</strong></p>',
            '<p><em>Italic</em></p>',
            '<p><s>Text</s></p>',
            '<ul>\n<li>Text</li>\n<li>Text</li>\n</ul>',
            '<ol>\n<li>Text</li>\n<li>Text</li>\n</ol>',
            '<blockquote>\n<p>Quote</p>\n</blockquote>',
            // One Enter joins the lines: no break on the screen.
            '<p>Text\nText</p>',
            // A `\` at the end of the line breaks it.
            '<p>Text<br>\nText</p>',
            // An empty line is a new paragraph.
            '<p>Text</p>\n<p>Text</p>',
            '<hr>',
        ]);
    });

    test('every row is its own, so a row can be keyed by its source', () => {
        const sourceList = genMarkdownLessonSourceList();
        expect(new Set(sourceList).size).toBe(sourceList.length);
    });
});
