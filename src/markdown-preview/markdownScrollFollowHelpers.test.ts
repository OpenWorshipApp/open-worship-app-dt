// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    findLineAtPageTop,
    findPageScrollTopForLine,
    type MarkdownEditorScrollType,
    SCROLL_STOP_MILLISECONDS,
    startMarkdownScrollFollowing,
    toMarkdownEditorScroll,
} from './markdownScrollFollowHelpers';

const PAGE_TOP = 100;
const LINE_COUNT = 20;

let page: HTMLElement;
let article: HTMLElement;
let pageScrollTop = 0;

// A box drawn `y` down all the page scrolls, as the page is scrolled now.
function placeBox(element: HTMLElement, y: number, height: number) {
    element.getBoundingClientRect = () => {
        const top = PAGE_TOP + y - pageScrollTop;
        return {
            top,
            bottom: top + height,
            height,
            left: 0,
            right: height === 0 ? 0 : 500,
            width: height === 0 ? 0 : 500,
            x: 0,
            y: top,
            toJSON: () => ({}),
        } as DOMRect;
    };
}

function addBlock(
    parent: HTMLElement,
    tagName: string,
    line: number | null,
    y: number,
    height: number,
) {
    const element = document.createElement(tagName);
    if (line !== null) {
        element.setAttribute('data-source-line', `${line}`);
    }
    placeBox(element, y, height);
    parent.appendChild(element);
    return element;
}

/**
 * A heading on line 0, a paragraph on 2, a quote on 5 holding paragraphs on
 * 5 and 7, a fenced block on 9, a folded paragraph on 15 and a last one on
 * 17, in a file of 20 lines.
 */
function drawPage() {
    addBlock(article, 'h1', 0, 20, 40);
    addBlock(article, 'p', 2, 80, 60);
    const quote = addBlock(article, 'blockquote', 5, 160, 100);
    addBlock(quote, 'p', 5, 170, 40);
    addBlock(quote, 'p', 7, 220, 30);
    const pre = addBlock(article, 'pre', null, 280, 100);
    // The fence's line is on its `<code>`, a little inside the `<pre>`.
    addBlock(pre, 'code', 9, 290, 80);
    const details = addBlock(article, 'details', null, 390, 0);
    addBlock(details, 'p', 15, 0, 0);
    addBlock(article, 'p', 17, 400, 40);
}

beforeEach(() => {
    pageScrollTop = 0;
    page = document.createElement('div');
    Object.defineProperty(page, 'scrollTop', {
        configurable: true,
        get: () => pageScrollTop,
        set: (value: number) => {
            pageScrollTop = value;
        },
    });
    page.getBoundingClientRect = () => {
        return { top: PAGE_TOP, height: 300 } as DOMRect;
    };
    article = document.createElement('div');
    page.appendChild(article);
    document.body.appendChild(page);
});

afterEach(() => {
    page.remove();
});

describe('the line at the top of the page', () => {
    it.each([
        // Above the first block is the file's first line.
        [0, 0],
        [20, 0],
        // Halfway from the heading (line 0) to the paragraph (line 2).
        [50, 1],
        // A quote's paragraph at the top is its line.
        [170, 5],
        [195, 6],
        // Past the folded paragraph, from the fence (9) to the last one (17).
        [330, 9 + (50 / 120) * 8],
        // The last block spreads the rest of the file over its height.
        [420, 17 + 0.5 * 3],
        [1000, LINE_COUNT],
    ])('scrolled %d down, it is line %d', (scrollTop, line) => {
        drawPage();
        pageScrollTop = scrollTop;
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBeCloseTo(
            line,
            5,
        );
    });

    it('is not known on a page with no marked block', () => {
        addBlock(article, 'p', null, 20, 40);
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBeNull();
        expect(
            findPageScrollTopForLine(article, page, 3, LINE_COUNT),
        ).toBeNull();
    });
});

describe('where the page scrolls for a line', () => {
    it.each([
        // The first line is the page's very top, margin and all.
        [0, 0],
        [1, 50],
        // A line a quote starts on is the quote's top, not its paragraph's.
        [5, 160],
        [6, 195],
        // A fence is followed by its `<pre>`, not the `<code>` in it.
        [9, 280],
        [9 + (50 / 120) * 8, 330],
        [18.5, 420],
        // Past the file's end, the last block's end.
        [25, 440],
    ])('line %d is %d down', (line, scrollTop) => {
        drawPage();
        // Read the same wherever the page is scrolled now.
        pageScrollTop = 123;
        expect(
            findPageScrollTopForLine(article, page, line, LINE_COUNT),
        ).toBeCloseTo(scrollTop, 5);
    });

    it('skips a line written out of order by the file itself', () => {
        drawPage();
        // A file's own HTML may write the attribute; a line going back is
        // not where that block was written.
        addBlock(article, 'p', 3, 460, 20);
        expect(
            findPageScrollTopForLine(article, page, 18.5, LINE_COUNT),
        ).toBeCloseTo(420, 5);
        pageScrollTop = 465;
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBe(LINE_COUNT);
    });

    it('goes from the top to the first block when the file starts lower', () => {
        addBlock(article, 'p', 4, 40, 40);
        expect(
            findPageScrollTopForLine(article, page, 2, LINE_COUNT),
        ).toBeCloseTo(20, 5);
        pageScrollTop = 20;
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBeCloseTo(2, 5);
    });
});

describe("Monaco's editor, as it is followed", () => {
    // Line 2 is wrapped, two rows tall.
    const lineTops = [0, 20, 60, 80];

    function genEditor() {
        const listeners = new Set<
            (event: { scrollTopChanged: boolean }) => void
        >();
        const editorInstance = {
            scrollTop: 0,
            element: document.createElement('div'),
            listeners,
            getContainerDomNode: () => editorInstance.element,
            getModel: () => ({ getLineCount: () => lineTops.length }),
            getScrollTop: () => editorInstance.scrollTop,
            setScrollTop: vi.fn((scrollTop: number) => {
                editorInstance.scrollTop = scrollTop;
            }),
            getTopForLineNumber: (lineNumber: number) => {
                return lineTops[lineNumber - 1];
            },
            onDidScrollChange: (
                listener: (event: { scrollTopChanged: boolean }) => void,
            ) => {
                listeners.add(listener);
                return {
                    dispose: () => {
                        listeners.delete(listener);
                    },
                };
            },
        };
        return editorInstance;
    }

    it('reads the line at its top, a wrapped line by its rows', () => {
        const editorInstance = genEditor();
        const editorScroll = toMarkdownEditorScroll(editorInstance);
        expect(editorScroll.element).toBe(editorInstance.element);
        expect(editorScroll.getLineCount()).toBe(4);
        editorInstance.scrollTop = 30;
        expect(editorScroll.getTopLine()).toBeCloseTo(1.25, 5);
        editorInstance.scrollTop = 0;
        expect(editorScroll.getTopLine()).toBe(0);
        // Past the last line's top: the last line.
        editorInstance.scrollTop = 95;
        expect(editorScroll.getTopLine()).toBe(3);
    });

    it('scrolls a line to its top, and no further than its last line', () => {
        const editorInstance = genEditor();
        const editorScroll = toMarkdownEditorScroll(editorInstance);
        editorScroll.scrollToLine(1.25);
        expect(editorInstance.setScrollTop).toHaveBeenLastCalledWith(30);
        editorScroll.scrollToLine(-2);
        expect(editorInstance.setScrollTop).toHaveBeenLastCalledWith(0);
        editorScroll.scrollToLine(10);
        expect(editorInstance.setScrollTop).toHaveBeenLastCalledWith(80);
    });

    it('reports a scroll down or up, nothing else, until it is let go of', () => {
        const editorInstance = genEditor();
        const editorScroll = toMarkdownEditorScroll(editorInstance);
        const listener = vi.fn();
        const stopListening = editorScroll.listenScroll(listener);
        for (const editorListener of editorInstance.listeners) {
            editorListener({ scrollTopChanged: false });
            editorListener({ scrollTopChanged: true });
        }
        expect(listener).toHaveBeenCalledTimes(1);
        stopListening();
        expect(editorInstance.listeners.size).toBe(0);
    });
});

describe('each side following the other', () => {
    let editorElement: HTMLElement;
    let editorTopLine: number;
    let editorScrollListener: (() => void) | null;
    let editorScroll: MarkdownEditorScrollType & {
        scrollToLine: ReturnType<typeof vi.fn>;
    };
    let stopFollowing: () => void;

    // The person's own wheel, press or key, on an element inside a side.
    function doInput(
        target: Element,
        eventName: string,
        init: MouseEventInit = {},
    ) {
        target.dispatchEvent(
            eventName === 'keydown'
                ? new KeyboardEvent(eventName, { bubbles: true })
                : new MouseEvent(eventName, { bubbles: true, ...init }),
        );
    }

    function scrollPage(scrollTop: number) {
        pageScrollTop = scrollTop;
        page.dispatchEvent(new Event('scroll'));
    }

    function scrollEditor(line: number) {
        editorTopLine = line;
        editorScrollListener?.();
    }

    beforeEach(() => {
        vi.useFakeTimers();
        drawPage();
        editorElement = document.createElement('div');
        editorElement.appendChild(document.createElement('textarea'));
        document.body.appendChild(editorElement);
        editorTopLine = 0;
        editorScrollListener = null;
        editorScroll = {
            element: editorElement,
            listenScroll: (listener) => {
                editorScrollListener = listener;
                return () => {
                    editorScrollListener = null;
                };
            },
            getLineCount: () => LINE_COUNT,
            getTopLine: () => editorTopLine,
            // Moving the editor scrolls it, as Monaco's does.
            scrollToLine: vi.fn((line: number) => {
                scrollEditor(line);
            }),
        };
        stopFollowing = startMarkdownScrollFollowing({
            editorScroll,
            page,
            getArticle: () => article,
        });
        // The editor opening where the page is, tested on its own below.
        editorScroll.scrollToLine.mockClear();
    });

    afterEach(() => {
        stopFollowing();
        editorElement.remove();
        vi.useRealTimers();
    });

    function startAgain() {
        stopFollowing();
        editorScroll.scrollToLine.mockClear();
        stopFollowing = startMarkdownScrollFollowing({
            editorScroll,
            page,
            getArticle: () => article,
        });
    }

    it('the editor opens where the page already is', () => {
        pageScrollTop = 195;
        startAgain();
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
        expect(editorScroll.scrollToLine).toHaveBeenCalledWith(6);
    });

    it('the editor opens where the page is once it is drawn with its lines, and only then', async () => {
        // A page only read is drawn without them.
        article.replaceChildren(document.createElement('p'));
        pageScrollTop = 195;
        startAgain();
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        article.replaceChildren();
        drawPage();
        await Promise.resolve();
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
        expect(editorScroll.scrollToLine).toHaveBeenCalledWith(6);
        // Drawn again under the typing: no longer watched.
        pageScrollTop = 330;
        article.replaceChildren();
        drawPage();
        await Promise.resolve();
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
    });

    it('the editor keeps its place when the person scrolls before the page is drawn, or it is let go', async () => {
        article.replaceChildren();
        pageScrollTop = 195;
        startAgain();
        doInput(editorElement.querySelector('textarea')!, 'keydown');
        drawPage();
        await Promise.resolve();
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        article.replaceChildren();
        startAgain();
        stopFollowing();
        drawPage();
        await Promise.resolve();
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('the editor follows the page once the wheel on it stops', () => {
        doInput(article.querySelector('p')!, 'wheel');
        scrollPage(100);
        vi.advanceTimersByTime(100);
        scrollPage(195);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS - 1);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
        expect(editorScroll.scrollToLine).toHaveBeenCalledWith(6);
    });

    it('the page follows the editor once the keys scrolling it stop, and is never followed back', () => {
        doInput(editorElement.querySelector('textarea')!, 'keydown');
        scrollEditor(6);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(pageScrollTop).toBe(195);
        // The page's own scroll, that following, moves nothing.
        page.dispatchEvent(new Event('scroll'));
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('a page drawn again under the typing is not followed', () => {
        doInput(editorElement.querySelector('textarea')!, 'keydown');
        // The page's scroll with the person's keys in the editor.
        scrollPage(330);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        // Nor long after the person's last wheel on it.
        doInput(page, 'wheel');
        vi.advanceTimersByTime(1500);
        scrollPage(195);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('a long scroll is followed once, after its last move', () => {
        doInput(page, 'wheel');
        for (let step = 1; step <= 17; step++) {
            scrollPage(step * 10);
            vi.advanceTimersByTime(100);
        }
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
        expect(editorScroll.scrollToLine).toHaveBeenCalledWith(5);
    });

    it('a scroll bar held still is followed when it moves again, until it is let go', () => {
        doInput(page, 'pointerdown');
        vi.advanceTimersByTime(3000);
        scrollPage(195);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
        // A move with no button down is the release the window missed.
        doInput(page, 'pointermove', { buttons: 0 });
        vi.advanceTimersByTime(3000);
        scrollPage(330);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(1);
    });

    it('the side scrolled last wins', () => {
        doInput(page, 'wheel');
        scrollPage(330);
        vi.advanceTimersByTime(100);
        doInput(editorElement.querySelector('textarea')!, 'keydown');
        scrollEditor(6);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
        expect(pageScrollTop).toBe(195);
    });

    it('stops following once stopped', () => {
        stopFollowing();
        expect(editorScrollListener).toBeNull();
        doInput(page, 'wheel');
        scrollPage(195);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('follows nothing while the page has no drawn file', () => {
        stopFollowing();
        stopFollowing = startMarkdownScrollFollowing({
            editorScroll,
            page,
            getArticle: () => null,
        });
        doInput(page, 'wheel');
        scrollPage(195);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        doInput(editorElement, 'wheel');
        scrollEditor(6);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledTimes(0);
        expect(pageScrollTop).toBe(195);
    });
});
