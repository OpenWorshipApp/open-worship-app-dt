import type MermaidType from 'mermaid';
import type { MermaidConfig } from 'mermaid';

import {
    addTimelineBreakHints,
    removeTimelineBreakHints,
} from './mermaidTimelineBreakHelpers';

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
// A placeholder with no diagram drawn in it yet: its source still shows.
const UNDRAWN_SELECTOR = `[data-mermaid-index]:not(.${DRAWN_CLASS_NAME})`;

/** True when `container` holds a diagram not drawn yet. */
export function checkHasUndrawnDiagrams(container: HTMLElement) {
    return container.querySelector(UNDRAWN_SELECTOR) !== null;
}

/**
 * Mermaid's settings with every face it names set to `fontFamily`: the one
 * most diagrams draw with, and the ones some diagram types keep for
 * themselves (a timeline's tasks, a sequence diagram's actors and notes) --
 * mermaid's defaults are Latin faces, which draw any other script in
 * whatever the system falls back to.
 */
function genFontFamilyConfig(
    mermaid: typeof MermaidType,
    fontFamily: string,
): MermaidConfig {
    const config: Record<string, unknown> = { fontFamily };
    for (const [diagramKey, diagramConfig] of Object.entries(
        mermaid.mermaidAPI.defaultConfig,
    )) {
        if (typeof diagramConfig !== 'object' || diagramConfig === null) {
            continue;
        }
        const fontKeys = Object.keys(diagramConfig).filter((key) => {
            return key.endsWith('FontFamily');
        });
        if (fontKeys.length > 0) {
            config[diagramKey] = Object.fromEntries(
                fontKeys.map((key) => {
                    return [key, fontFamily];
                }),
            );
        }
    }
    return config as MermaidConfig;
}

/**
 * Mermaid sizes each box to its label as measured in the face it is given;
 * a face still loading is measured as the fallback and then drawn wider than
 * its box. The diagrams' words are laid out once, unseen, in the face they
 * will be drawn in, which asks for exactly the faces those letters need,
 * and the drawing waits for them.
 */
async function waitForFaces(element: HTMLElement, sources: string[]) {
    // Absent where there is no font loading at all (a test's DOM).
    const fontFaceSet: FontFaceSet | undefined = document.fonts;
    if (fontFaceSet === undefined) {
        return;
    }
    const probeElement = document.createElement('span');
    probeElement.style.cssText =
        'position:absolute;width:0;height:0;overflow:hidden;' +
        'visibility:hidden;pointer-events:none';
    probeElement.textContent = sources.join('\n');
    element.append(probeElement);
    try {
        probeElement.getBoundingClientRect();
        await fontFaceSet.ready;
    } finally {
        probeElement.remove();
    }
}

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
        container.querySelectorAll<HTMLElement>(UNDRAWN_SELECTOR),
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
    // The face the page draws in where the diagram goes -- the app's font,
    // the language's and every installed language's, or the one picked in
    // Settings -- so a diagram's words read like the words around it.
    const fontFamily = getComputedStyle(elements[0]).fontFamily;
    if (fontFamily) {
        await waitForFaces(
            elements[0],
            elements.map((element) => {
                return sources[Number(element.dataset.mermaidIndex)] ?? '';
            }),
        );
        if (checkIsStale()) {
            return;
        }
    }
    mermaid.initialize({
        ...(fontFamily ? genFontFamilyConfig(mermaid, fontFamily) : {}),
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
            const drawnSource = addTimelineBreakHints(source);
            const { svg } = await mermaid.render(id, drawnSource);
            if (checkIsStale()) {
                return;
            }
            element.innerHTML =
                drawnSource === source ? svg : removeTimelineBreakHints(svg);
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
