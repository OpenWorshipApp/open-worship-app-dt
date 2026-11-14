// @vitest-environment jsdom
/**
 * The diagrams of a markdown page (`markdownMermaidHelpers.ts`) at the edges
 * the other suites leave: a drawn diagram whose source is gone, a page
 * asked whether a diagram is still to be drawn, and a draft's diagrams
 * checked for parsing without drawing one.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    initialize: vi.fn(),
    parse: vi.fn(),
}));

// `mermaid` is megabytes: the fake stands in for the module.
vi.mock('mermaid', () => ({
    default: { initialize: h.initialize, parse: h.parse },
}));

import {
    checkHasUndrawnDiagrams,
    findMermaidParseErrors,
    takeDrawnDiagrams,
} from './markdownMermaidHelpers';

beforeEach(() => {
    h.parse.mockImplementation(async (source: string) => {
        if (source.startsWith('graph')) {
            return { diagramType: 'flowchart-v2' };
        }
        throw new Error(`Parse error on line 1:\n${source}\n^`);
    });
});

describe('takeDrawnDiagrams', () => {
    test('a drawn diagram whose index names no source is left behind', () => {
        const container = document.createElement('div');
        container.innerHTML =
            '<div data-mermaid-index="0" class="app-markdown-mermaid--rendered">' +
            '<svg>zero</svg></div>' +
            '<div data-mermaid-index="7" class="app-markdown-mermaid--rendered">' +
            '<svg>seven</svg></div>';
        const drawnMap = takeDrawnDiagrams(container, ['graph TD; A-->B']);
        expect([...drawnMap.entries()]).toEqual([
            ['graph TD; A-->B', ['<svg>zero</svg>']],
        ]);
    });
});

describe('checkHasUndrawnDiagrams', () => {
    test('true while one diagram still shows its source, false once all are drawn or there are none', () => {
        const container = document.createElement('div');
        expect(checkHasUndrawnDiagrams(container)).toBe(false);
        container.innerHTML =
            '<div data-mermaid-index="0" class="app-markdown-mermaid--rendered">' +
            '<svg>zero</svg></div>' +
            '<div data-mermaid-index="1"><pre><code>graph TD</code></pre></div>';
        expect(checkHasUndrawnDiagrams(container)).toBe(true);
        container
            .querySelector('[data-mermaid-index="1"]')!
            .classList.add('app-markdown-mermaid--rendered');
        expect(checkHasUndrawnDiagrams(container)).toBe(false);
    });
});

describe('findMermaidParseErrors', () => {
    test('null for a diagram that parses, the message for one that does not', async () => {
        const long = `pie ${'x'.repeat(400)}`;
        const errors = await findMermaidParseErrors([
            'graph TD; A-->B',
            'not a diagram',
            long,
        ]);
        // Nothing is drawn: the parser is set up strict, and only asked.
        expect(h.initialize).toHaveBeenCalledWith({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
        });
        expect(h.parse).toHaveBeenCalledTimes(3);
        expect(errors[0]).toBeNull();
        // The message on one line, as a person reads it.
        expect(errors[1]).toBe('Parse error on line 1: not a diagram ^');
        // A message is 300 characters at most.
        expect(errors[2]).toHaveLength(300);
        expect(errors[2]!.startsWith('Parse error on line 1: pie xxx')).toBe(
            true,
        );
    });

    test('a thrown value that is no Error is said as it is', async () => {
        h.parse.mockRejectedValue('bad   arrow');
        expect(await findMermaidParseErrors(['graph'])).toEqual(['bad arrow']);
    });

    test('no diagrams, no answers', async () => {
        expect(await findMermaidParseErrors([])).toEqual([]);
        expect(h.parse).not.toHaveBeenCalled();
    });
});
