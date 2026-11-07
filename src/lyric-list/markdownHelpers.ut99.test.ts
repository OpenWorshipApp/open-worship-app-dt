// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The REAL markdown-it, counted: how many parsers were built and a switch to
// make `render` throw. The cache (`CacheManager`) and the per-text lock
// (`unlocking`) are real too, on fake timers.
const { mocks, state } = vi.hoisted(() => ({
    mocks: {
        handleError: vi.fn(),
    },
    state: {
        parserCount: 0,
        renderError: null as Error | null,
    },
}));

vi.mock('../server/appProvider', async () => {
    const { createHash } = await import('node:crypto');
    return {
        default: {
            isPageScreen: false,
            systemUtils: {
                isDev: false,
                generateMD5: (text: string) => {
                    return createHash('md5').update(text).digest('hex');
                },
            },
            envUtils: {},
        },
    };
});
vi.mock('../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => mocks.handleError(...args),
}));
vi.mock('markdown-it', async (importOriginal) => {
    const actual: any = await importOriginal();
    class CountedMarkdownIt extends actual.default {
        constructor(...args: any[]) {
            super(...args);
            state.parserCount += 1;
        }
        render(text: string, env?: unknown) {
            if (state.renderError !== null) {
                throw state.renderError;
            }
            return super.render(text, env);
        }
    }
    return { default: CountedMarkdownIt };
});

import { createHash } from 'node:crypto';

import { renderMarkdown } from './markdownHelpers';
import { toIframe } from './markdownHtmlHelpers';

function md5(text: string) {
    return createHash('md5').update(text).digest('hex');
}

let textCount = 0;
// The cache is module state shared by the whole file: a fresh text per test.
function genText(body: string) {
    textCount += 1;
    return `${body}\n\n<!-- ${textCount} -->`;
}

beforeEach(() => {
    vi.useFakeTimers();
    state.parserCount = 0;
    state.renderError = null;
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('renderMarkdown', () => {
    test('no text renders to nothing, without hashing or parsing', async () => {
        expect(await renderMarkdown('')).toEqual({ id: '', html: '' });
        expect(state.parserCount).toBe(0);
    });

    test('renders markdown with raw html kept, keyed by the text hash', async () => {
        const text = genText('# Welcome\n\n<b>Church</b> *family*');
        const data = await renderMarkdown(text);
        expect(data.id).toBe(md5(text));
        expect(data.html).toContain('<h1>Welcome</h1>');
        expect(data.html).toContain('<p><b>Church</b> <em>family</em></p>');
        expect(state.parserCount).toBe(1);
    });

    test('the same text within ten seconds is served from the cache', async () => {
        const text = genText('Announcements');
        const first = await renderMarkdown(text);
        await vi.advanceTimersByTimeAsync(9000);
        expect(await renderMarkdown(text)).toEqual(first);
        expect(state.parserCount).toBe(1);
        // The window is measured from the render, not slid by the reads.
        await vi.advanceTimersByTimeAsync(1001);
        await renderMarkdown(text);
        expect(state.parserCount).toBe(2);
    });

    test('two asks for one text at once render it once', async () => {
        const text = genText('**Offering**');
        const firstPromise = renderMarkdown(text);
        const secondPromise = renderMarkdown(text);
        const first = await firstPromise;
        // The second waited on the first's lock and found its result.
        await vi.advanceTimersByTimeAsync(100);
        expect(await secondPromise).toEqual(first);
        expect(state.parserCount).toBe(1);
    });

    test('a parser failure is reported and the text shown as is', async () => {
        const error = new Error('parser broke');
        state.renderError = error;
        const text = genText('*broken*');
        const data = await renderMarkdown(text);
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(data).toEqual({ id: md5(text), html: `<pre>${text}</pre>` });
    });
});

describe('toIframe', () => {
    test('wraps the html in a sandboxed, see-through frame', () => {
        const markup = toIframe(
            '<p style="background-color: #ffffff; color: red;">Hi</p>' +
                '<div style="background-color:black;">x</div>',
            'Quick Text',
        );
        const host = document.createElement('div');
        host.innerHTML = markup;
        const frame = host.querySelector('iframe')!;
        expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
        expect(frame.getAttribute('title')).toBe('Quick Text');
        expect(frame.getAttribute('srcdoc')).toBe(
            '<p style="background-color: transparent; color: red;">Hi</p>' +
                '<div style="background-color: transparent;">x</div>',
        );
        expect(frame.getAttribute('style')).toContain(
            'border:none;background-color:transparent',
        );
    });
});
