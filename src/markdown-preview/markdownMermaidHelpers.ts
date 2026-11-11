import type MermaidType from 'mermaid';

/**
 * Drawing the `mermaid` blocks of a rendered markdown file.
 *
 * `mermaid` is megabytes of parser and layout code, so it is imported only
 * when a file actually holds a diagram, and only in the Markdown Preview
 * window -- a file without one never loads it, and neither does any other
 * window. The promise is kept, not re-imported per file.
 */
let mermaidPromise: Promise<typeof MermaidType> | null = null;
function getMermaid() {
    mermaidPromise ??= import('mermaid')
        .then((module) => {
            return module.default;
        })
        .catch((error) => {
            // A failed load is forgotten, so reopening the file tries again.
            mermaidPromise = null;
            throw error;
        });
    return mermaidPromise;
}

// Mermaid needs an id per render that nothing else in the document uses; it
// builds a temporary element under it while it lays the diagram out.
let renderCount = 0;

function toErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}

function showDiagramError(element: HTMLElement, message: string) {
    element.classList.add('app-markdown-mermaid--failed');
    const messageElement = document.createElement('div');
    messageElement.className = 'app-markdown-mermaid-error';
    // As TEXT: the parser echoes the file's own words back in its message.
    messageElement.textContent = message;
    element.prepend(messageElement);
}

const DRAWN_CLASS_NAME = 'app-markdown-mermaid--rendered';

/**
 * The diagrams already DRAWN in `container`, by the source each was drawn
 * from (`sources`: the sources the page was rendered with), read just before
 * the page is replaced. The Markdown Preview's editor re-renders the page as
 * the person types, and drawing every diagram again on each pause is the
 * whole cost of that render; one whose source did not change is put back by
 * `putBackDrawnDiagrams` instead. Taken off the page about to go, handed to
 * the next one and dropped: nothing is kept between renders.
 */
export function takeDrawnDiagrams(container: HTMLElement, sources: string[]) {
    const drawnMap = new Map<string, string[]>();
    const elements = container.querySelectorAll<HTMLElement>(
        `[data-mermaid-index].${DRAWN_CLASS_NAME}`,
    );
    for (const element of elements) {
        const source = sources[Number(element.dataset.mermaidIndex)];
        if (source === undefined) {
            continue;
        }
        const drawnList = drawnMap.get(source) ?? [];
        drawnList.push(element.innerHTML);
        drawnMap.set(source, drawnList);
    }
    return drawnMap;
}

/**
 * Puts `takeDrawnDiagrams`' pictures back into the new page's placeholders
 * of the same source, each picture once, and marks them drawn, so
 * `renderMermaidDiagrams` draws only the rest.
 */
export function putBackDrawnDiagrams(
    container: HTMLElement,
    sources: string[],
    drawnMap: Map<string, string[]>,
) {
    if (drawnMap.size === 0) {
        return;
    }
    const elements = container.querySelectorAll<HTMLElement>(
        '[data-mermaid-index]',
    );
    for (const element of elements) {
        const source = sources[Number(element.dataset.mermaidIndex)];
        const drawn =
            source === undefined ? undefined : drawnMap.get(source)?.shift();
        if (drawn === undefined) {
            continue;
        }
        element.innerHTML = drawn;
        element.classList.add(DRAWN_CLASS_NAME);
    }
}

/**
 * Swaps each `[data-mermaid-index]` placeholder in `container` for its diagram,
 * skipping one already drawn (`putBackDrawnDiagrams`).
 * A block that does not parse keeps its code and gains the parser's message
 * above it; one bad diagram never stops the next. `checkIsStale` is asked
 * after every await, so a file changed (or a theme switched) mid-render drops
 * this pass instead of writing into the next one's DOM.
 */
export async function renderMermaidDiagrams(
    container: HTMLElement,
    sources: string[],
    {
        isDark,
        checkIsStale,
    }: {
        isDark: boolean;
        checkIsStale: () => boolean;
    },
) {
    const elements = Array.from(
        container.querySelectorAll<HTMLElement>(
            `[data-mermaid-index]:not(.${DRAWN_CLASS_NAME})`,
        ),
    );
    if (elements.length === 0) {
        return;
    }
    let mermaid: typeof MermaidType;
    try {
        mermaid = await getMermaid();
    } catch (error) {
        if (checkIsStale()) {
            return;
        }
        for (const element of elements) {
            showDiagramError(element, toErrorMessage(error));
        }
        return;
    }
    if (checkIsStale()) {
        return;
    }
    mermaid.initialize({
        startOnLoad: false,
        // Labels are sanitized and click handlers in a diagram are ignored:
        // the diagram is text somebody else wrote, in a window with Node.
        securityLevel: 'strict',
        // Otherwise a diagram that does not parse is drawn as an error picture
        // appended to the document body.
        suppressErrorRendering: true,
        theme: isDark ? 'dark' : 'default',
    });
    for (const element of elements) {
        const source = sources[Number(element.dataset.mermaidIndex)];
        if (source === undefined) {
            continue;
        }
        renderCount += 1;
        const id = `app-markdown-mermaid-${renderCount}`;
        try {
            const { svg } = await mermaid.render(id, source);
            if (checkIsStale()) {
                return;
            }
            element.innerHTML = svg;
            element.classList.add(DRAWN_CLASS_NAME);
        } catch (error) {
            // A failure can leave the half-built diagram in the body. On a
            // success that id is the SVG just placed, so only here.
            document.getElementById(id)?.remove();
            if (checkIsStale()) {
                return;
            }
            showDiagramError(element, toErrorMessage(error));
        } finally {
            // The wrapper mermaid lays the diagram out in.
            document.getElementById(`d${id}`)?.remove();
        }
    }
}

/**
 * Whether each diagram PARSES, without drawing one: null for a diagram that
 * does, the parser's own message for one that does not. The help window's
 * study file (EC-464) asks this of a draft before the person is shown its
 * Create button -- the one check of a diagram the developer's door lacks,
 * which has the structural one in `agentStudyFileRules.ts` alone. Loaded
 * only when a draft holds a diagram.
 */
export async function findMermaidParseErrors(sources: string[]) {
    const mermaid = await getMermaid();
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
    });
    const errors: (string | null)[] = [];
    for (const source of sources) {
        try {
            await mermaid.parse(source);
            errors.push(null);
        } catch (error) {
            errors.push(
                toErrorMessage(error).replace(/\s+/g, ' ').slice(0, 300),
            );
        }
    }
    return errors;
}
