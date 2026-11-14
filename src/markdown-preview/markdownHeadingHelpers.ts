import { PRINT_APPENDIX_CLASS_NAME } from './markdownPrintHelpers';

/**
 * The headings of the page on screen, for the head row's Sections list
 * (2026-11-12, the user: _as a user when I'm viewing the markdown that has
 * many titles (sections) I want to jump to the title (section) by open panel
 * of the title list then click to scroll to the section_). Read from the page
 * itself when the list is opened, so a heading the file wrote in HTML is one
 * too, and held only while it is open: the list keeps each heading's words
 * and level, and finds the heading again by its place in page order when it
 * is pressed -- never an element, which a redrawn page would leave behind.
 */

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
// A heading tag in the page's HTML. One written in code is escaped by then
// (`&lt;h2&gt;`), so only a heading the page shows matches.
const HEADING_TAG_PATTERN = /<h[1-6][\s>]/i;
// How far under the page's top a heading may be and still be the section
// being read: one jumped to rests at its `scroll-margin-top` (0.75rem).
const CURRENT_HEADING_OFFSET = 24;

export type MarkdownHeadingType = {
    // 1 for `#`, 2 for `##`, ... 6.
    level: number;
    text: string;
};

export type MarkdownHeadingListType = {
    headings: MarkdownHeadingType[];
    // The section being read, -1 above the first heading.
    currentIndex: number;
};

/** Whether the page drawn from this HTML has a heading to list. */
export function checkHasMarkdownHeadings(html: string) {
    return HEADING_TAG_PATTERN.test(html);
}

function toHeadingText(element: Element) {
    return (element.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
}

// In page order. A heading with no words is nothing to name, and the print's
// appendix -- in the page only while it prints -- is not the page's.
function findHeadingElements(article: HTMLElement) {
    return Array.from(
        article.querySelectorAll<HTMLElement>(HEADING_SELECTOR),
    ).filter((element) => {
        return (
            toHeadingText(element) !== '' &&
            element.closest(`.${PRINT_APPENDIX_CLASS_NAME}`) === null
        );
    });
}

/**
 * The page's headings and the one whose section is at the top of the page
 * now: the last that has reached the top, read in order and stopped at the
 * first still below it.
 */
export function readMarkdownHeadings(
    article: HTMLElement,
    page: HTMLElement,
): MarkdownHeadingListType {
    const elementList = findHeadingElements(article);
    const pageTop = page.getBoundingClientRect().top;
    let currentIndex = -1;
    for (const [index, element] of elementList.entries()) {
        const rect = element.getBoundingClientRect();
        // Folded away in a closed `<details>`: it has no place to be read at.
        if (rect.height === 0) {
            continue;
        }
        if (rect.top - pageTop > CURRENT_HEADING_OFFSET) {
            break;
        }
        currentIndex = index;
    }
    return {
        headings: elementList.map((element) => {
            return {
                level: Number(element.tagName.slice(1)),
                text: toHeadingText(element),
            };
        }),
        currentIndex,
    };
}

/**
 * Scrolls the page to the heading listed at `index`, opening any
 * `<details>` folded over it first. False when the page no longer has it.
 */
export function scrollToMarkdownHeading(article: HTMLElement, index: number) {
    const element = findHeadingElements(article)[index];
    if (element === undefined) {
        return false;
    }
    let details = element.closest('details');
    while (details !== null) {
        details.open = true;
        details = details.parentElement?.closest('details') ?? null;
    }
    element.scrollIntoView({ block: 'start' });
    return true;
}
