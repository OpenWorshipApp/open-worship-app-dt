// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    render: vi.fn(),
}));

vi.mock('./markdownMermaidHelpers', () => ({
    renderMermaidDiagrams: h.render,
}));

import {
    drawLightDiagramsForPrint,
    loadPicturesForPrint,
    PRINT_APPENDIX_CLASS_NAME,
    registerPrintPreparation,
    removeLightDiagramsForPrint,
    removePrintAppendix,
} from './markdownPrintHelpers';

const DRAWN = 'app-markdown-mermaid--rendered';

let container: HTMLDivElement;

// A page: `drawn` diagrams already drawn on screen, the rest still code.
function genPage(states: ('drawn' | 'code')[]) {
    container = document.createElement('div');
    states.forEach((state, index) => {
        const element = document.createElement('div');
        element.className = 'app-markdown-mermaid';
        element.dataset.mermaidIndex = String(index);
        if (state === 'drawn') {
            element.classList.add(DRAWN);
            element.innerHTML = `<svg class="dark">${index}</svg>`;
        } else {
            element.textContent = `code ${index}`;
        }
        container.append(element);
    });
    document.body.append(container);
    return [...container.children] as HTMLElement[];
}

// Mermaid, light: each placeholder it is given is drawn, unless listed.
function drawLight(failingIndexes: string[] = []) {
    h.render.mockImplementation(async (box: HTMLElement) => {
        for (const element of box.querySelectorAll<HTMLElement>(
            '[data-mermaid-index]',
        )) {
            if (failingIndexes.includes(element.dataset.mermaidIndex!)) {
                element.textContent = 'parse error';
                continue;
            }
            element.innerHTML = `<svg class="light">${element.dataset.mermaidIndex}</svg>`;
            element.classList.add(DRAWN);
        }
    });
}

beforeEach(() => {
    h.render.mockReset();
});

afterEach(() => {
    container?.remove();
    document.body.innerHTML = '';
});

describe("a dark page's diagrams, drawn light for the paper", () => {
    test('a page with no drawn diagram draws nothing', async () => {
        genPage(['code']);

        await drawLightDiagramsForPrint(container, ['graph TD'], () => false);

        expect(h.render).not.toHaveBeenCalled();
        expect(container.children).toHaveLength(1);
    });

    test('each drawn diagram is drawn light out of sight in the page, then placed beside its own and shown on paper alone', async () => {
        const [first, code, second] = genPage(['drawn', 'code', 'drawn']);
        const sources = ['graph TD', 'graph LR', 'pie'];
        h.render.mockImplementation(
            async (
                box: HTMLElement,
                renderSources: string[],
                options: { isDark: boolean },
            ) => {
                // In the page, for its faces, and never seen.
                expect(box.parentElement).toBe(container);
                expect(box.hidden).toBe(true);
                expect(renderSources).toBe(sources);
                expect(options.isDark).toBe(false);
                // Only the diagrams drawn on screen, by their own source.
                expect(
                    [
                        ...box.querySelectorAll<HTMLElement>(
                            '[data-mermaid-index]',
                        ),
                    ].map((element) => element.dataset.mermaidIndex),
                ).toEqual(['0', '2']);
                for (const element of box.children) {
                    element.innerHTML = '<svg class="light"></svg>';
                    element.classList.add(DRAWN);
                }
            },
        );

        await drawLightDiagramsForPrint(container, sources, () => false);

        expect(h.render).toHaveBeenCalledTimes(1);
        expect(
            [...container.children].map((element) => element.className),
        ).toEqual([
            `app-markdown-mermaid ${DRAWN} app-markdown-mermaid--has-print`,
            `app-markdown-mermaid ${DRAWN} app-markdown-mermaid--print`,
            'app-markdown-mermaid',
            `app-markdown-mermaid ${DRAWN} app-markdown-mermaid--has-print`,
            `app-markdown-mermaid ${DRAWN} app-markdown-mermaid--print`,
        ]);
        expect(first.nextElementSibling?.innerHTML).toBe(
            '<svg class="light"></svg>',
        );
        expect(code.classList.contains('app-markdown-mermaid--has-print')).toBe(
            false,
        );
        expect(second.innerHTML).toBe('<svg class="dark">2</svg>');
        // Not a placeholder of the page: the next render neither keeps nor
        // draws it.
        expect(
            container.querySelectorAll('.app-markdown-mermaid--print'),
        ).toHaveLength(2);
        for (const element of container.querySelectorAll<HTMLElement>(
            '.app-markdown-mermaid--print',
        )) {
            expect(element.dataset.mermaidIndex).toBeUndefined();
        }
    });

    test('a diagram whose light picture fails keeps its own on paper', async () => {
        const [first, second] = genPage(['drawn', 'drawn']);
        drawLight(['1']);

        await drawLightDiagramsForPrint(container, ['a', 'b'], () => false);

        expect(
            first.classList.contains('app-markdown-mermaid--has-print'),
        ).toBe(true);
        expect(
            second.classList.contains('app-markdown-mermaid--has-print'),
        ).toBe(false);
        expect(container.children).toHaveLength(3);
        expect(container.textContent).not.toContain('parse error');
    });

    test('a second print draws only what has no light picture yet', async () => {
        genPage(['drawn']);
        drawLight();

        await drawLightDiagramsForPrint(container, ['a'], () => false);
        await drawLightDiagramsForPrint(container, ['a'], () => false);

        expect(h.render).toHaveBeenCalledTimes(1);
        expect(
            container.querySelectorAll('.app-markdown-mermaid--print'),
        ).toHaveLength(1);
    });

    test('a page drawn again while the light pictures are drawn gets none of them', async () => {
        const [first] = genPage(['drawn']);
        let isStale = false;
        h.render.mockImplementation(async (box: HTMLElement) => {
            box.firstElementChild!.classList.add(DRAWN);
            isStale = true;
        });

        await drawLightDiagramsForPrint(container, ['a'], () => isStale);

        expect([...container.children]).toEqual([first]);
        expect(
            first.classList.contains('app-markdown-mermaid--has-print'),
        ).toBe(false);
    });

    test('the light pictures are dropped once the print is done', async () => {
        const [first] = genPage(['drawn']);
        drawLight();
        await drawLightDiagramsForPrint(container, ['a'], () => false);
        expect(container.children).toHaveLength(2);

        globalThis.dispatchEvent(new Event('afterprint'));

        expect([...container.children]).toEqual([first]);
        expect(
            first.classList.contains('app-markdown-mermaid--has-print'),
        ).toBe(false);
        expect(first.innerHTML).toBe('<svg class="dark">0</svg>');
    });

    test('removing drops every light picture and its mark', async () => {
        const [first] = genPage(['drawn']);
        drawLight();
        await drawLightDiagramsForPrint(container, ['a'], () => false);

        removeLightDiagramsForPrint(container);

        expect([...container.children]).toEqual([first]);
        expect(first.className).toBe(`app-markdown-mermaid ${DRAWN}`);
    });
});

describe("a page's pictures, fetched for the paper", () => {
    // A picture as the page draws it; `isFetched` stands in for the
    // browser's own answer, which jsdom cannot give.
    function genPicture(page: HTMLElement, name: string, isFetched: boolean) {
        const image = document.createElement('img');
        image.src = name;
        image.setAttribute('loading', 'lazy');
        Object.defineProperty(image, 'complete', { value: isFetched });
        page.append(image);
        return image;
    }

    test('one not fetched yet is asked for at once and waited for until it loads or fails; one fetched is left alone', async () => {
        const page = document.createElement('div');
        const shown = genPicture(page, 'shown.png', true);
        const farDown = genPicture(page, 'far-down.png', false);
        const broken = genPicture(page, 'broken.png', false);
        let isLoaded = false;
        const loading = loadPicturesForPrint(page).then(() => {
            isLoaded = true;
        });

        expect(shown.getAttribute('loading')).toBe('lazy');
        expect(farDown.getAttribute('loading')).toBe('eager');
        expect(broken.getAttribute('loading')).toBe('eager');
        farDown.dispatchEvent(new Event('load'));
        await Promise.resolve();
        expect(isLoaded).toBe(false);

        broken.dispatchEvent(new Event('error'));
        await loading;
        expect(isLoaded).toBe(true);
    });

    test('a page with nothing to fetch is ready at once', async () => {
        const page = document.createElement('div');
        genPicture(page, 'shown.png', true);
        await expect(loadPicturesForPrint(page)).resolves.toEqual([]);
    });
});

describe("the page's own preparation, which main runs before a print", () => {
    type HolderType = { appPreparePrint?: () => Promise<boolean> };
    const holder = globalThis as HolderType;

    test('is reachable while registered, and its undo leaves a newer one in place', async () => {
        const firstPrepare = vi.fn(async () => true);
        // A page whose person said Cancel answers false.
        const secondPrepare = vi.fn(async () => false);

        const undoFirst = registerPrintPreparation(firstPrepare);
        expect(holder.appPreparePrint).toBe(firstPrepare);
        const undoSecond = registerPrintPreparation(secondPrepare);
        undoFirst();
        expect(holder.appPreparePrint).toBe(secondPrepare);
        expect(await holder.appPreparePrint?.()).toBe(false);
        undoSecond();

        expect(holder.appPreparePrint).toBeUndefined();
    });
});

describe('the appendix a print carries', () => {
    test('is taken out of the page, every copy of it, and nothing else', () => {
        const page = document.createElement('div');
        page.innerHTML =
            `<p>Words</p><div class="${PRINT_APPENDIX_CLASS_NAME}">a</div>` +
            `<section><div class="${PRINT_APPENDIX_CLASS_NAME}">b</div></section>`;

        removePrintAppendix(page);

        expect(page.innerHTML).toBe('<p>Words</p><section></section>');
    });
});
