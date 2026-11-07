// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    initialize: vi.fn(),
    render: vi.fn(),
    loadState: { failure: null as unknown, loadCount: 0 },
}));

// `mermaid` is megabytes: the fake stands in for the module, and its
// `default` getter is what the helper's `import('mermaid').then(...)` reads,
// so a failure there is a failed load.
vi.mock('mermaid', () => ({
    get default() {
        h.loadState.loadCount += 1;
        if (h.loadState.failure !== null) {
            throw h.loadState.failure;
        }
        return { initialize: h.initialize, render: h.render };
    },
}));

import { renderMermaidDiagrams } from './markdownMermaidHelpers';

let container: HTMLDivElement;

function placeholders(indexes: number[]) {
    container.innerHTML = indexes
        .map((index) => {
            return (
                `<div class="app-markdown-mermaid" data-mermaid-index="${index}">` +
                `<pre><code>source ${index}</code></pre></div>`
            );
        })
        .join('');
    return Array.from(
        container.querySelectorAll<HTMLElement>('[data-mermaid-index]'),
    );
}

// What mermaid itself leaves in the document while it lays a diagram out: a
// `d<id>` wrapper and the `<id>` diagram inside it.
function leaveLayoutLeftovers(id: string) {
    const wrapper = document.createElement('div');
    wrapper.id = `d${id}`;
    const diagram = document.createElement('svg');
    diagram.id = id;
    wrapper.appendChild(diagram);
    document.body.appendChild(wrapper);
}

beforeEach(() => {
    h.loadState.failure = null;
    h.loadState.loadCount = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
});

// Declared first on purpose: once a load SUCCEEDS the helper keeps that
// promise for the window's lifetime, so the failure paths must run before it.
describe('renderMermaidDiagrams: mermaid fails to load', () => {
    test('a container without a diagram never loads mermaid', async () => {
        container.innerHTML = '<pre><code>graph TD</code></pre>';
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(h.loadState.loadCount).toBe(0);
        expect(h.initialize).not.toHaveBeenCalled();
    });

    test('every diagram keeps its code and shows the message as TEXT', async () => {
        const elements = placeholders([0, 1]);
        h.loadState.failure = new Error('<img src=x onerror="alert(1)">');
        await renderMermaidDiagrams(container, ['a', 'b'], {
            isDark: false,
            checkIsStale: () => false,
        });
        for (const element of elements) {
            expect(element.classList).toContain('app-markdown-mermaid--failed');
            const message = element.firstElementChild as HTMLElement;
            expect(message.className).toBe('app-markdown-mermaid-error');
            expect(message.textContent).toBe('<img src=x onerror="alert(1)">');
            // The parser's words never become markup.
            expect(element.querySelector('img')).toBeNull();
            // The code is still drawn under the message.
            expect(element.querySelector('pre code')).not.toBeNull();
        }
        expect(h.initialize).not.toHaveBeenCalled();
    });

    test('a thrown non-Error and an empty message are still said', async () => {
        const [first] = placeholders([0]);
        h.loadState.failure = 'network down';
        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(first.textContent).toContain('network down');

        const [second] = placeholders([0]);
        h.loadState.failure = new Error('');
        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(
            second.querySelector('.app-markdown-mermaid-error')?.textContent,
        ).toBe('Error');
    });

    test('a failed load in a stale pass writes nothing', async () => {
        const [element] = placeholders([0]);
        h.loadState.failure = new Error('gone');
        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => true,
        });
        expect(element.classList).not.toContain('app-markdown-mermaid--failed');
        expect(element.querySelector('.app-markdown-mermaid-error')).toBeNull();
    });

    test('a failed load is forgotten, so the next pass tries again', async () => {
        h.loadState.failure = new Error('offline');
        placeholders([0]);
        await renderMermaidDiagrams(container, ['a'], {
            isDark: false,
            checkIsStale: () => false,
        });
        const loadsAfterFailure = h.loadState.loadCount;
        expect(loadsAfterFailure).toBeGreaterThan(0);

        h.loadState.failure = null;
        h.render.mockResolvedValue({ svg: '<svg class="drawn"></svg>' });
        const [element] = placeholders([0]);
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(h.loadState.loadCount).toBeGreaterThan(loadsAfterFailure);
        expect(element.querySelector('svg.drawn')).not.toBeNull();
    });
});

describe('renderMermaidDiagrams: mermaid loaded', () => {
    test('initialised strict, with no error picture, in the theme', async () => {
        h.render.mockResolvedValue({ svg: '<svg></svg>' });
        placeholders([0]);
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: true,
            checkIsStale: () => false,
        });
        expect(h.initialize).toHaveBeenCalledWith({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'dark',
        });

        placeholders([0]);
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(h.initialize).toHaveBeenLastCalledWith(
            expect.objectContaining({
                securityLevel: 'strict',
                theme: 'default',
            }),
        );
        // The module is loaded once and kept.
        const loadCount = h.loadState.loadCount;
        placeholders([0]);
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: false,
            checkIsStale: () => false,
        });
        expect(h.loadState.loadCount).toBe(loadCount);
    });

    test('each placeholder gets ITS source under a fresh id', async () => {
        h.render.mockImplementation(async (id: string, source: string) => {
            leaveLayoutLeftovers(id);
            return { svg: `<svg data-source="${source}"></svg>` };
        });
        const elements = placeholders([1, 0, 7]);
        await renderMermaidDiagrams(container, ['zero', 'one'], {
            isDark: false,
            checkIsStale: () => false,
        });
        // Index 7 has no source and is skipped.
        expect(h.render).toHaveBeenCalledTimes(2);
        const [firstId, firstSource] = h.render.mock.calls[0];
        const [secondId, secondSource] = h.render.mock.calls[1];
        expect(firstSource).toBe('one');
        expect(secondSource).toBe('zero');
        expect(firstId).toMatch(/^app-markdown-mermaid-\d+$/);
        expect(secondId).not.toBe(firstId);
        expect(elements[0].innerHTML).toBe('<svg data-source="one"></svg>');
        expect(elements[1].innerHTML).toBe('<svg data-source="zero"></svg>');
        expect(elements[0].classList).toContain(
            'app-markdown-mermaid--rendered',
        );
        expect(elements[2].classList).not.toContain(
            'app-markdown-mermaid--rendered',
        );
        expect(elements[2].textContent).toBe('source 7');
        // The layout wrapper is removed; the placed svg is not touched.
        expect(document.getElementById(`d${firstId}`)).toBeNull();
        expect(document.getElementById(`d${secondId}`)).toBeNull();
    });

    test('one diagram that does not parse never stops the next', async () => {
        h.render.mockImplementation(async (id: string, source: string) => {
            leaveLayoutLeftovers(id);
            if (source === 'bad') {
                throw new Error('Parse error on line 1');
            }
            return { svg: '<svg class="good"></svg>' };
        });
        const [bad, good] = placeholders([0, 1]);
        await renderMermaidDiagrams(container, ['bad', 'graph TD'], {
            isDark: false,
            checkIsStale: () => false,
        });
        const badId = h.render.mock.calls[0][0] as string;
        expect(bad.classList).toContain('app-markdown-mermaid--failed');
        expect(
            bad.querySelector('.app-markdown-mermaid-error')?.textContent,
        ).toBe('Parse error on line 1');
        expect(bad.querySelector('pre code')?.textContent).toBe('source 0');
        // The half-built diagram and its wrapper are both taken away.
        expect(document.getElementById(badId)).toBeNull();
        expect(document.getElementById(`d${badId}`)).toBeNull();
        expect(good.querySelector('svg.good')).not.toBeNull();
    });

    test('a pass gone stale while mermaid loads draws nothing', async () => {
        const [element] = placeholders([0]);
        await renderMermaidDiagrams(container, ['graph TD'], {
            isDark: false,
            checkIsStale: () => true,
        });
        expect(h.initialize).not.toHaveBeenCalled();
        expect(h.render).not.toHaveBeenCalled();
        expect(element.textContent).toBe('source 0');
    });

    test('a pass gone stale mid-render writes into no DOM', async () => {
        let isStale = false;
        h.render.mockImplementation(async (id: string) => {
            leaveLayoutLeftovers(id);
            isStale = true;
            return { svg: '<svg class="late"></svg>' };
        });
        const [first, second] = placeholders([0, 1]);
        await renderMermaidDiagrams(container, ['a', 'b'], {
            isDark: false,
            checkIsStale: () => isStale,
        });
        expect(h.render).toHaveBeenCalledTimes(1);
        expect(first.querySelector('svg.late')).toBeNull();
        expect(second.querySelector('svg.late')).toBeNull();
        // The wrapper is still cleaned up on the way out.
        const id = h.render.mock.calls[0][0] as string;
        expect(document.getElementById(`d${id}`)).toBeNull();
    });

    test('a failure in a stale pass says nothing', async () => {
        let isStale = false;
        h.render.mockImplementation(async (id: string) => {
            leaveLayoutLeftovers(id);
            isStale = true;
            throw new Error('Parse error');
        });
        const [first, second] = placeholders([0, 1]);
        await renderMermaidDiagrams(container, ['a', 'b'], {
            isDark: false,
            checkIsStale: () => isStale,
        });
        expect(h.render).toHaveBeenCalledTimes(1);
        const id = h.render.mock.calls[0][0] as string;
        expect(document.getElementById(id)).toBeNull();
        expect(first.querySelector('.app-markdown-mermaid-error')).toBeNull();
        expect(second.querySelector('.app-markdown-mermaid-error')).toBeNull();
    });
});
