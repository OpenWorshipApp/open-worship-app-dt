// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    checkHasMarkdownHeadings,
    readMarkdownHeadings,
    scrollToMarkdownHeading,
} from './markdownHeadingHelpers';

let scrollIntoViewDescriptor: PropertyDescriptor | undefined;
let article: HTMLElement;
let page: HTMLElement;

// A page with a heading of each kind the list reads or leaves out.
const PAGE_HTML =
    '<h1>Title</h1>' +
    '<p>Words</p>' +
    '<h2>  Part \n  one </h2>' +
    '<h3><span class="app-markdown-ref">John 3:16</span> read</h3>' +
    '<h2> </h2>' +
    '<details><summary>More</summary><h4>Folded</h4></details>' +
    '<div class="app-markdown-print-appendix"><h2>Verses</h2></div>' +
    '<h2>Last</h2>';

function heading(text: string) {
    const element = Array.from(
        article.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    ).find((candidate) => {
        return candidate.textContent?.includes(text);
    });
    expect(element).toBeDefined();
    return element!;
}

function placeAt(element: HTMLElement, top: number, height = 30) {
    element.getBoundingClientRect = () => {
        return { top, height } as DOMRect;
    };
}

beforeEach(() => {
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollIntoView',
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();
    page = document.createElement('div');
    article = document.createElement('div');
    article.innerHTML = PAGE_HTML;
    page.append(article);
    document.body.append(page);
    placeAt(page, 40, 600);
});

afterEach(() => {
    page.remove();
    if (scrollIntoViewDescriptor) {
        Object.defineProperty(
            HTMLElement.prototype,
            'scrollIntoView',
            scrollIntoViewDescriptor,
        );
    } else {
        delete (HTMLElement.prototype as any).scrollIntoView;
    }
});

describe('checkHasMarkdownHeadings', () => {
    test('a heading tag of any level is one; one written in code is not', () => {
        expect(checkHasMarkdownHeadings('<h1>A</h1>')).toBe(true);
        expect(checkHasMarkdownHeadings('<p>x</p><h6 id="y">B</h6>')).toBe(
            true,
        );
        expect(checkHasMarkdownHeadings('<H2>C</H2>')).toBe(true);
        expect(
            checkHasMarkdownHeadings(
                '<pre><code>&lt;h2&gt;x&lt;/h2&gt;</code></pre>',
            ),
        ).toBe(false);
        expect(
            checkHasMarkdownHeadings(
                '<header>a</header><hr><h7>b</h7><p>h1</p>',
            ),
        ).toBe(false);
        expect(checkHasMarkdownHeadings('')).toBe(false);
    });
});

describe('readMarkdownHeadings', () => {
    test("lists the page's headings in order by level and words, none empty and none of the print's", () => {
        const { headings } = readMarkdownHeadings(article, page);
        expect(headings).toEqual([
            { level: 1, text: 'Title' },
            { level: 2, text: 'Part one' },
            { level: 3, text: 'John 3:16 read' },
            { level: 4, text: 'Folded' },
            { level: 2, text: 'Last' },
        ]);
    });

    test('the section being read is the last heading that has reached the top', () => {
        placeAt(heading('Title'), -500);
        // At rest where a jump puts it: under the top by its scroll margin.
        placeAt(heading('Part'), 40 + 12);
        placeAt(heading('John'), 40 + 25);
        placeAt(heading('Folded'), 0, 0);
        placeAt(heading('Last'), 900);
        expect(readMarkdownHeadings(article, page).currentIndex).toBe(1);

        placeAt(heading('John'), -100);
        // Folded away it is passed over, not taken for the section read.
        expect(readMarkdownHeadings(article, page).currentIndex).toBe(2);

        placeAt(heading('Last'), 40);
        expect(readMarkdownHeadings(article, page).currentIndex).toBe(4);
    });

    test('above the first heading, no section is being read', () => {
        for (const element of article.querySelectorAll<HTMLElement>(
            'h1, h2, h3, h4',
        )) {
            placeAt(element, 300);
        }
        expect(readMarkdownHeadings(article, page).currentIndex).toBe(-1);
    });
});

describe('scrollToMarkdownHeading', () => {
    test('scrolls to the heading listed at that place, past the ones left out', () => {
        expect(scrollToMarkdownHeading(article, 4)).toBe(true);
        const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(scrollIntoView.mock.contexts[0]).toBe(heading('Last'));
    });

    test('opens every details folded over the heading first', () => {
        const outer = document.createElement('details');
        outer.append(article.querySelector('details')!);
        article.append(outer);
        expect(scrollToMarkdownHeading(article, 4)).toBe(true);
        const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
        // In page order the folded heading is now the last one.
        expect(scrollIntoView.mock.contexts[0]).toBe(heading('Folded'));
        for (const details of article.querySelectorAll('details')) {
            expect(details.open).toBe(true);
        }
    });

    test('a place the page no longer has scrolls nowhere', () => {
        expect(scrollToMarkdownHeading(article, 5)).toBe(false);
        expect(scrollToMarkdownHeading(article, -1)).toBe(false);
        expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
        expect(article.querySelector('details')!.open).toBe(false);
    });
});
