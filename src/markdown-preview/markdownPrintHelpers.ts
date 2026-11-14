import { renderMermaidDiagrams } from './markdownMermaidHelpers';

/**
 * The Markdown Preview prints ITSELF (`printToPDF` of its own window), and
 * always in the LIGHT theme: its print sheet (`MarkdownPreviewAppComp.scss`)
 * gives a dark window's page the light theme's colours. A diagram is the one
 * thing a sheet cannot turn -- mermaid bakes its theme's colours into the
 * picture it draws -- so a dark window draws its diagrams' light pictures
 * just before a print, each beside the picture on screen and shown only on
 * paper, and drops them once the print is done. Nothing is drawn ahead: a
 * page that is never printed costs nothing.
 */

// The mark `renderMermaidDiagrams` leaves on a drawn diagram.
const DRAWN_CLASS_NAME = 'app-markdown-mermaid--rendered';
// A light picture for paper, and the screen's picture it stands in for.
const PRINT_CLASS_NAME = 'app-markdown-mermaid--print';
const HAS_PRINT_CLASS_NAME = 'app-markdown-mermaid--has-print';

/**
 * Drops every light picture `drawLightDiagramsForPrint` placed in
 * `container`.
 */
export function removeLightDiagramsForPrint(container: HTMLElement) {
    for (const element of container.querySelectorAll(`.${PRINT_CLASS_NAME}`)) {
        element.remove();
    }
    for (const element of container.querySelectorAll(
        `.${HAS_PRINT_CLASS_NAME}`,
    )) {
        element.classList.remove(HAS_PRINT_CLASS_NAME);
    }
}

/**
 * Draws the light picture of every diagram drawn in `container` that has
 * none yet (`sources`: the sources the page was rendered with). They are
 * drawn out of sight inside the page, so in the faces the page's own
 * diagrams were drawn in, and placed beside theirs only once all are drawn
 * and the page is still the one asked about (`checkIsStale`). A diagram whose
 * light picture fails keeps its own. The pictures are dropped after the
 * print (`afterprint`), or with the page.
 */
export async function drawLightDiagramsForPrint(
    container: HTMLElement,
    sources: string[],
    checkIsStale: () => boolean,
) {
    const drawnElements = Array.from(
        container.querySelectorAll<HTMLElement>(
            `[data-mermaid-index].${DRAWN_CLASS_NAME}` +
                `:not(.${HAS_PRINT_CLASS_NAME})`,
        ),
    );
    if (drawnElements.length === 0) {
        return;
    }
    const box = document.createElement('div');
    box.hidden = true;
    const printElements = drawnElements.map((element) => {
        const printElement = document.createElement('div');
        printElement.className = 'app-markdown-mermaid';
        printElement.dataset.mermaidIndex = element.dataset.mermaidIndex;
        box.append(printElement);
        return printElement;
    });
    container.append(box);
    try {
        await renderMermaidDiagrams(box, sources, {
            isDark: false,
            checkIsStale,
        });
        if (checkIsStale()) {
            return;
        }
        drawnElements.forEach((element, index) => {
            const printElement = printElements[index];
            if (!printElement.classList.contains(DRAWN_CLASS_NAME)) {
                return;
            }
            // Not a placeholder of the page: the next render of it neither
            // keeps nor draws this one.
            delete printElement.dataset.mermaidIndex;
            printElement.classList.add(PRINT_CLASS_NAME);
            element.after(printElement);
            element.classList.add(HAS_PRINT_CLASS_NAME);
        });
        globalThis.addEventListener(
            'afterprint',
            () => {
                removeLightDiagramsForPrint(container);
            },
            { once: true },
        );
    } finally {
        box.remove();
    }
}

function waitForPicture(image: HTMLImageElement) {
    return new Promise<void>((resolve) => {
        const done = () => {
            image.removeEventListener('load', done);
            image.removeEventListener('error', done);
            resolve();
        };
        image.addEventListener('load', done);
        image.addEventListener('error', done);
    });
}

/**
 * Fetches every picture in `container` not fetched yet, and resolves once
 * each has loaded or failed (the caller bounds the wait). On screen a
 * picture far down the page is fetched only once it is scrolled near
 * (`loading="lazy"`, `markdownPreviewRenderHelpers.ts`), and a print does
 * not wait for one: a page printed just after it was drawn -- opened, saved
 * beside it, or typed into -- went on paper with blank space where its last
 * pictures were. Only for a print, so a page never printed fetches nothing
 * it does not show.
 */
export function loadPicturesForPrint(container: HTMLElement) {
    const waitList: Promise<void>[] = [];
    for (const image of container.querySelectorAll('img')) {
        if (image.complete) {
            continue;
        }
        waitList.push(waitForPicture(image));
        // Asked for at once, as a picture near the screen is.
        image.setAttribute('loading', 'eager');
    }
    return Promise.all(waitList);
}

type PrintPreparationHolderType = {
    appPreparePrint?: () => Promise<boolean>;
};

/**
 * Main asks a window printed AS ITSELF -- its own Print, and File > Print,
 * Print Without Preview -- to get its page ready first, by calling
 * `appPreparePrint` (`waitForPagePrintPreparation` in
 * `electron/electronHelpers.ts`), and prints once it has answered: nothing
 * at all when the answer is `false`, the person having said Cancel to what
 * the page asked them first. Returns the undo.
 */
export function registerPrintPreparation(prepare: () => Promise<boolean>) {
    const holder = globalThis as PrintPreparationHolderType;
    holder.appPreparePrint = prepare;
    return () => {
        if (holder.appPreparePrint === prepare) {
            delete holder.appPreparePrint;
        }
    };
}

// The verses, people and places a page names, put after its last line for a
// print the person asked to carry them (`markdownPrintAppendixHelpers.ts`):
// on paper only, and gone once the print is done.
export const PRINT_APPENDIX_CLASS_NAME = 'app-markdown-print-appendix';

/** Drops the print's appendix from `container`, if it has one. */
export function removePrintAppendix(container: HTMLElement) {
    for (const element of container.querySelectorAll(
        `.${PRINT_APPENDIX_CLASS_NAME}`,
    )) {
        element.remove();
    }
}
