// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    loadError: null as Error | null,
    loadCount: 0,
    initialize: vi.fn(),
    render: vi.fn(),
}));

// The module's `default` is read inside the loader's `.then`, so a getter that
// throws stands in for a failed load of the real package.
vi.mock('mermaid', () => ({
    get default() {
        state.loadCount++;
        if (state.loadError !== null) {
            throw state.loadError;
        }
        return { initialize: state.initialize, render: state.render };
    },
}));

import { renderMermaidDiagrams } from './markdownMermaidHelpers';

// A fresh module: the loaded mermaid is kept for the window's life.
async function importFresh() {
    vi.resetModules();
    return (await import('./markdownMermaidHelpers')).renderMermaidDiagrams;
}

let container: HTMLDivElement;

function genContainer(indexes: string[]) {
    container = document.createElement('div');
    for (const index of indexes) {
        const element = document.createElement('div');
        element.dataset.mermaidIndex = index;
        element.textContent = `code ${index}`;
        container.append(element);
    }
    document.body.append(container);
    return [...container.querySelectorAll<HTMLElement>('[data-mermaid-index]')];
}

beforeEach(() => {
    state.loadError = null;
    state.render.mockImplementation(async (id: string, source: string) => ({
        svg: `<svg id="${id}"><text>${source}</text></svg>`,
    }));
});

afterEach(() => {
    container?.remove();
    document.body.innerHTML = '';
});

describe('drawing the mermaid blocks of a markdown file', () => {
    test('draws nothing and loads nothing for a file without a diagram', async () => {
        genContainer([]);

        await renderMermaidDiagrams(container, ['graph TD; A-->B'], {
            isDark: false,
            checkIsStale: () => false,
        });

        expect(state.initialize).not.toHaveBeenCalled();
        expect(state.render).not.toHaveBeenCalled();
    });

    test('draws each block in a strict, quiet mermaid themed for the window, and skips a block with no source', async () => {
        const [first, second, orphan] = genContainer(['0', '1', '7']);

        await renderMermaidDiagrams(
            container,
            ['graph TD; A-->B', 'graph LR; C-->D'],
            { isDark: true, checkIsStale: () => false },
        );

        expect(state.initialize).toHaveBeenCalledWith({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'dark',
        });
        expect(state.render).toHaveBeenCalledTimes(2);
        const [firstId, secondId] = state.render.mock.calls.map(
            ([id]) => id as string,
        );
        expect(firstId).not.toBe(secondId);
        expect(first.innerHTML).toContain('graph TD; A--&gt;B');
        expect(first.classList.contains('app-markdown-mermaid--rendered')).toBe(
            true,
        );
        expect(second.querySelector('svg')?.id).toBe(secondId);
        expect(orphan.textContent).toBe('code 7');
    });

    test('keeps a block that does not parse as code, with the message as text above it, and tidies what mermaid left', async () => {
        const [bad, good] = genContainer(['0', '1']);
        state.render.mockImplementationOnce(async (id: string) => {
            const leftover = document.createElement('div');
            leftover.id = id;
            const wrapper = document.createElement('div');
            wrapper.id = `d${id}`;
            document.body.append(leftover, wrapper);
            throw new Error('Parse error near <img src=x onerror=alert(1)>');
        });

        await renderMermaidDiagrams(container, ['nonsense', 'graph TD; A'], {
            isDark: false,
            checkIsStale: () => false,
        });

        expect(bad.classList.contains('app-markdown-mermaid--failed')).toBe(
            true,
        );
        const message = bad.querySelector('.app-markdown-mermaid-error')!;
        expect(message.textContent).toBe(
            'Parse error near <img src=x onerror=alert(1)>',
        );
        expect(bad.querySelector('img')).toBeNull();
        expect(bad.textContent).toContain('code 0');
        // The half-built diagram and its layout wrapper are gone.
        const [badId] = state.render.mock.calls[0] as [string];
        expect(document.getElementById(badId)).toBeNull();
        expect(document.getElementById(`d${badId}`)).toBeNull();
        // One bad diagram never stops the next.
        expect(good.classList.contains('app-markdown-mermaid--rendered')).toBe(
            true,
        );
        expect(state.initialize).toHaveBeenLastCalledWith(
            expect.objectContaining({ theme: 'default' }),
        );
    });

    test('writes nothing once the file or theme changed mid-render', async () => {
        const [first] = genContainer(['0', '1']);
        let isStale = false;
        state.render.mockImplementation(async () => {
            isStale = true;
            return { svg: '<svg></svg>' };
        });

        await renderMermaidDiagrams(container, ['a', 'b'], {
            isDark: false,
            checkIsStale: () => isStale,
        });

        expect(state.render).toHaveBeenCalledOnce();
        expect(first.textContent).toBe('code 0');

        // Stale before mermaid is even set up: nothing is initialised.
        state.initialize.mockClear();
        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => true,
        });
        expect(state.initialize).not.toHaveBeenCalled();
    });

    test('loads mermaid once for every later diagram', async () => {
        const render = await importFresh();
        state.loadCount = 0;
        genContainer(['0']);
        await render(container, ['a'], {
            isDark: false,
            checkIsStale: () => false,
        });
        await render(container, ['b'], {
            isDark: true,
            checkIsStale: () => false,
        });

        expect(state.loadCount).toBe(1);
        expect(state.initialize).toHaveBeenCalledTimes(2);
    });

    test('marks every block when mermaid cannot load, and tries the load again next time', async () => {
        const renderMermaidDiagrams = await importFresh();
        const [first, second] = genContainer(['0', '1']);
        state.loadError = new Error('chunk failed');

        await renderMermaidDiagrams(container, ['a', 'b'], {
            isDark: false,
            checkIsStale: () => false,
        });

        for (const element of [first, second]) {
            expect(
                element.querySelector('.app-markdown-mermaid-error')
                    ?.textContent,
            ).toBe('chunk failed');
        }

        // A failed load is forgotten: the next file loads mermaid again.
        state.loadError = null;
        const [third] = genContainer(['0']);
        await renderMermaidDiagrams(container, ['graph TD; A'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(third.classList.contains('app-markdown-mermaid--rendered')).toBe(
            true,
        );
    });

    test('a failed load found stale writes no error', async () => {
        const renderMermaidDiagrams = await importFresh();
        const [first] = genContainer(['0']);
        state.loadError = new Error('chunk failed');

        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => true,
        });

        expect(first.querySelector('.app-markdown-mermaid-error')).toBeNull();
        state.loadError = null;
    });

    test('a non-Error failure is reported by its own words', async () => {
        const [first] = genContainer(['0']);
        state.render.mockRejectedValueOnce('bad diagram');

        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => false,
        });

        expect(
            first.querySelector('.app-markdown-mermaid-error')?.textContent,
        ).toBe('bad diagram');
    });
});
