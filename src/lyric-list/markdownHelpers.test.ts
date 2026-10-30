// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The real `markdown-it`, the real 10-second `CacheManager` and the real
// `unlocking`, under fake timers so the cache's lifetime can be walked
// through. Only the provider (the hash) and the loggers are stood in for.
const h = vi.hoisted(() => ({
    handleError: vi.fn(),
    generateMD5: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { generateMD5: h.generateMD5 },
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/loggerHelpers', () => ({
    appWarning: vi.fn(),
    appError: vi.fn(),
}));

import MarkdownIt from 'markdown-it';
import { renderMarkdown } from './markdownHelpers';

beforeEach(() => {
    vi.useFakeTimers();
    h.generateMD5.mockImplementation((text: string) => `md5:${text}`);
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('renderMarkdown', () => {
    test('no text is no html, and no hashing', async () => {
        await expect(renderMarkdown('')).resolves.toEqual({
            id: '',
            html: '',
        });
        expect(h.generateMD5).not.toHaveBeenCalled();
    });

    test('renders markdown, raw html included, keyed by its hash', async () => {
        const text = '# Welcome\n\nService at <b>10am</b>';
        const data = await renderMarkdown(text);
        expect(data.id).toBe(`md5:${text}`);
        expect(data.html).toContain('<h1>Welcome</h1>');
        // `html: true`: a quick text may carry its own markup.
        expect(data.html).toContain('<b>10am</b>');
    });

    test('the same text again is served from the cache', async () => {
        const render = vi.spyOn(MarkdownIt.prototype, 'render');
        const first = await renderMarkdown('cached *text*');
        const second = await renderMarkdown('cached *text*');
        expect(second).toBe(first);
        expect(render).toHaveBeenCalledTimes(1);
    });

    test('two callers asking at once share ONE render', async () => {
        const render = vi.spyOn(MarkdownIt.prototype, 'render');
        const both = Promise.all([
            renderMarkdown('at once'),
            renderMarkdown('at once'),
        ]);
        // The second waits on the first's lock, polling every 100ms.
        await vi.advanceTimersByTimeAsync(500);
        const [first, second] = await both;
        expect(second).toBe(first);
        expect(render).toHaveBeenCalledTimes(1);
    });

    test('the cache is short-lived: past ten seconds it renders again', async () => {
        const render = vi.spyOn(MarkdownIt.prototype, 'render');
        await renderMarkdown('short-lived');
        await vi.advanceTimersByTimeAsync(9_000);
        await renderMarkdown('short-lived');
        expect(render).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(2_000);
        await renderMarkdown('short-lived');
        expect(render).toHaveBeenCalledTimes(2);
    });

    test('a render that throws falls back to the text, reported', async () => {
        const error = new Error('bad markdown');
        vi.spyOn(MarkdownIt.prototype, 'render').mockImplementation(() => {
            throw error;
        });
        const data = await renderMarkdown('broken <text>');
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(data).toEqual({
            id: 'md5:broken <text>',
            html: '<pre>broken <text></pre>',
        });
    });
});
