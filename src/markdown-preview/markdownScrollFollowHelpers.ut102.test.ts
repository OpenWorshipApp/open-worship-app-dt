// @vitest-environment jsdom

// The page's edges -- every marked block folded away, a last block with no
// height -- and the press that ends: let go, or the window left.

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest';

import {
    findLineAtPageTop,
    findPageScrollTopForLine,
    type MarkdownEditorScrollType,
    SCROLL_STOP_MILLISECONDS,
    startMarkdownScrollFollowing,
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

describe('a page whose marked blocks are all folded away', () => {
    it('is at the first line however far it is scrolled, and every line is at its top', () => {
        const details = addBlock(article, 'details', null, 20, 0);
        addBlock(details, 'p', 3, 0, 0);
        addBlock(details, 'p', 8, 0, 0);
        pageScrollTop = 50;
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBe(0);
        expect(findPageScrollTopForLine(article, page, 5, LINE_COUNT)).toBe(0);
        expect(findPageScrollTopForLine(article, page, 1, LINE_COUNT)).toBe(0);
    });
});

describe('a last block with no height', () => {
    it('scrolled past, the top is its own line, not past the file end', () => {
        addBlock(article, 'h1', 0, 20, 40);
        // A rule: as wide as the page, no height to spread the rest over.
        const rule = addBlock(article, 'hr', 4, 100, 0);
        rule.getBoundingClientRect = () => {
            const top = PAGE_TOP + 100 - pageScrollTop;
            return {
                top,
                bottom: top,
                height: 0,
                left: 0,
                right: 500,
                width: 500,
                x: 0,
                y: top,
                toJSON: () => ({}),
            } as DOMRect;
        };
        pageScrollTop = 150;
        expect(findLineAtPageTop(article, page, LINE_COUNT)).toBe(4);
        // Its own line is where it is drawn.
        expect(findPageScrollTopForLine(article, page, 4, LINE_COUNT)).toBe(
            100,
        );
    });
});

describe('a press on the page that ends', () => {
    let editorElement: HTMLElement;
    let editorScroll: MarkdownEditorScrollType & {
        scrollToLine: Mock<(line: number) => void>;
    };
    let stopFollowing: () => void;

    function scrollPage(scrollTop: number) {
        pageScrollTop = scrollTop;
        page.dispatchEvent(new Event('scroll'));
    }

    function press(eventName: string) {
        page.dispatchEvent(new MouseEvent(eventName, { bubbles: true }));
    }

    beforeEach(() => {
        vi.useFakeTimers();
        addBlock(article, 'h1', 0, 20, 40);
        addBlock(article, 'p', 2, 80, 60);
        addBlock(article, 'p', 6, 200, 40);
        editorElement = document.createElement('div');
        document.body.appendChild(editorElement);
        editorScroll = {
            element: editorElement,
            listenScroll: () => {
                return () => {};
            },
            getLineCount: () => LINE_COUNT,
            getTopLine: () => 0,
            scrollToLine: vi.fn<(line: number) => void>(),
        };
        stopFollowing = startMarkdownScrollFollowing({
            editorScroll,
            page,
            getArticle: () => article,
        });
        // The editor opening where the page is: not what is under test.
        editorScroll.scrollToLine.mockClear();
    });

    afterEach(() => {
        stopFollowing();
        editorElement.remove();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('let go, the page is no longer the person scrolling once a moment has passed', () => {
        press('pointerdown');
        vi.advanceTimersByTime(3000);
        press('pointerup');
        vi.advanceTimersByTime(3000);
        scrollPage(200);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('the letting go is itself the person: a scroll right after it is followed', () => {
        press('pointerdown');
        vi.advanceTimersByTime(3000);
        press('pointerup');
        vi.advanceTimersByTime(500);
        scrollPage(200);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledExactlyOnceWith(6);
    });

    it('the window left mid-press ends the press', () => {
        press('pointerdown');
        globalThis.dispatchEvent(new Event('blur'));
        vi.advanceTimersByTime(3000);
        scrollPage(200);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS * 4);
        expect(editorScroll.scrollToLine).not.toHaveBeenCalled();
    });

    it('a press still held is followed long after it started', () => {
        press('pointerdown');
        vi.advanceTimersByTime(3000);
        scrollPage(200);
        vi.advanceTimersByTime(SCROLL_STOP_MILLISECONDS);
        expect(editorScroll.scrollToLine).toHaveBeenCalledExactlyOnceWith(6);
    });
});
