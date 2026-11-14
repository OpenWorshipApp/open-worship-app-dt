import { MARKDOWN_SOURCE_LINE_ATTRIBUTE } from './markdownPreviewParamHelpers';

/**
 * The Markdown Preview window's editor and the page beside it follow each
 * other (2026-11-12, the user: _when editor manual scrolling stopped then the
 * preview should follow, when preview manual scrolling stopped then editor
 * should follow_). Loaded with the editor, so a window that is only read
 * never loads it.
 *
 * Only the person's own scrolling is followed, and only once it stops: a
 * wheel, a press (a scroll bar dragged, a link or the arrow to the top
 * pressed) or a key on one side, then that side still for
 * `SCROLL_STOP_MILLISECONDS`. The other side then jumps to the same line, at
 * once. Its own scroll is never followed back, nor is the page drawn again
 * under the typing or a diagram drawn into it. The editor opens where the page
 * is: it follows the page once, as soon as the page is drawn with its lines.
 *
 * A line is the file's, counted from 0, with the part of it already scrolled
 * past as a fraction: 12.5 is halfway down the line the editor numbers 13.
 * The page knows its lines from the one each block starts at
 * (`MARKDOWN_SOURCE_LINE_ATTRIBUTE`, written only while the editor is shown)
 * and places a line between two blocks in proportion. Nothing is kept
 * between two follows: the blocks are read again each time, from the page as
 * it is then.
 */

export const SCROLL_STOP_MILLISECONDS = 250;
// A scroll this soon after the person's own wheel, press or key on a side is
// theirs; so is one while a press is held, or while one they started has not
// stopped.
const PERSON_INPUT_MILLISECONDS = 1000;
const INPUT_EVENT_NAMES = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
const RELEASE_EVENT_NAMES = [
    'pointerup',
    'pointercancel',
    'touchend',
    'touchcancel',
];
// Seen before the editor or the page handles them, and never held up: a
// passive listener cannot slow the scrolling down.
const LISTENER_OPTIONS = { capture: true, passive: true };

/** The editor, as the following reads and moves it. */
export type MarkdownEditorScrollType = {
    // The editor's own box: a wheel, press or key inside it is the editor's.
    element: HTMLElement;
    listenScroll: (listener: () => void) => () => void;
    getLineCount: () => number;
    getTopLine: () => number;
    scrollToLine: (line: number) => void;
};

/** What of Monaco's editor is used; Monaco itself is not imported here. */
type ScrollableEditorType = {
    getContainerDomNode: () => HTMLElement;
    getModel: () => { getLineCount: () => number } | null;
    getScrollTop: () => number;
    setScrollTop: (scrollTop: number) => void;
    getTopForLineNumber: (lineNumber: number) => number;
    onDidScrollChange: (
        listener: (event: { scrollTopChanged: boolean }) => void,
    ) => { dispose: () => void };
};

type LineBlockType = { element: HTMLElement; line: number };
// A place on the page -- `y` from the top of all the page scrolls -- and the
// line there.
type AnchorType = { y: number; line: number; height: number };
type ShownAnchorType = { index: number; anchor: AnchorType };

// The page's top is the file's first line.
const TOP_ANCHOR: AnchorType = { y: 0, line: 0, height: 0 };

function toProgress(value: number) {
    return Math.min(1, Math.max(0, value));
}

/** The page's marked blocks, in page order, their lines only growing. */
function findLineBlocks(article: HTMLElement) {
    const blocks: LineBlockType[] = [];
    let lastLine = 0;
    for (const element of article.querySelectorAll<HTMLElement>(
        `[${MARKDOWN_SOURCE_LINE_ATTRIBUTE}]`,
    )) {
        const line = Number(
            element.getAttribute(MARKDOWN_SOURCE_LINE_ATTRIBUTE),
        );
        // A line before the one already passed is the file's own HTML
        // writing the attribute: it is not where that block was written.
        if (!Number.isInteger(line) || line < lastLine) {
            continue;
        }
        lastLine = line;
        const parentElement = element.parentElement;
        blocks.push({
            element:
                element.tagName === 'CODE' && parentElement?.tagName === 'PRE'
                    ? parentElement
                    : element,
            line,
        });
    }
    return blocks;
}

function genAnchorReader(blocks: LineBlockType[], page: HTMLElement) {
    const originTop =
        page.getBoundingClientRect().top + page.clientTop - page.scrollTop;
    return (index: number): AnchorType | null => {
        const block = blocks[index];
        const rect = block.element.getBoundingClientRect();
        // Folded away in a closed `<details>`: no place on the page.
        if (rect.width === 0 && rect.height === 0) {
            return null;
        }
        return {
            y: rect.top - originTop,
            line: block.line,
            height: rect.height,
        };
    };
}

function findShownAnchor(
    readAnchor: (index: number) => AnchorType | null,
    fromIndex: number,
    toIndex: number,
): ShownAnchorType | null {
    for (let index = fromIndex; index <= toIndex; index++) {
        const anchor = readAnchor(index);
        if (anchor !== null) {
            return { index, anchor };
        }
    }
    return null;
}

// Past the last block, the rest of the file is spread over its height.
function toEndAnchor(anchor: AnchorType, lineCount: number): AnchorType {
    return {
        y: anchor.y + anchor.height,
        line: Math.max(lineCount, anchor.line + 1),
        height: 0,
    };
}

/**
 * The line at the top of the page now; null for a page with no marked block
 * (one not drawn from the editor's text yet).
 */
export function findLineAtPageTop(
    article: HTMLElement,
    page: HTMLElement,
    lineCount: number,
) {
    const blocks = findLineBlocks(article);
    if (blocks.length === 0) {
        return null;
    }
    const readAnchor = genAnchorReader(blocks, page);
    const scrollTop = page.scrollTop;
    // The last block that has reached the top, by halving: the blocks are in
    // page order, so a few of them are measured, not all.
    let previous: ShownAnchorType | null = null;
    let low = 0;
    let high = blocks.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const shown = findShownAnchor(readAnchor, middle, high);
        if (shown === null || shown.anchor.y > scrollTop) {
            high = middle - 1;
        } else {
            previous = shown;
            low = shown.index + 1;
        }
    }
    const start = previous?.anchor ?? TOP_ANCHOR;
    const next = findShownAnchor(
        readAnchor,
        (previous?.index ?? -1) + 1,
        blocks.length - 1,
    );
    let end: AnchorType;
    if (next !== null) {
        end = next.anchor;
    } else if (previous !== null) {
        end = toEndAnchor(previous.anchor, lineCount);
    } else {
        return 0;
    }
    if (end.y <= start.y) {
        return start.line;
    }
    return (
        start.line +
        toProgress((scrollTop - start.y) / (end.y - start.y)) *
            (end.line - start.line)
    );
}

/**
 * Where the page scrolls to put `line` at its top; null as above.
 */
export function findPageScrollTopForLine(
    article: HTMLElement,
    page: HTMLElement,
    line: number,
    lineCount: number,
) {
    const blocks = findLineBlocks(article);
    if (blocks.length === 0) {
        return null;
    }
    // The file's first line is the page's top, its margin and all.
    if (line <= 0) {
        return 0;
    }
    // The last block starting on or before the line, by its number alone.
    let index = -1;
    let low = 0;
    let high = blocks.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (blocks[middle].line <= line) {
            index = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    // On that very line, the first block there: a quote's top rather than
    // its first paragraph's.
    if (index >= 0 && blocks[index].line === line) {
        while (index > 0 && blocks[index - 1].line === line) {
            index--;
        }
    }
    const readAnchor = genAnchorReader(blocks, page);
    let start = TOP_ANCHOR;
    let startIndex = index;
    for (; startIndex >= 0; startIndex--) {
        const anchor = readAnchor(startIndex);
        if (anchor !== null) {
            start = anchor;
            break;
        }
    }
    if (startIndex >= 0 && start.line === line) {
        return start.y;
    }
    const next = findShownAnchor(readAnchor, startIndex + 1, blocks.length - 1);
    let end: AnchorType;
    if (next !== null) {
        end = next.anchor;
    } else if (startIndex >= 0) {
        end = toEndAnchor(start, lineCount);
    } else {
        return 0;
    }
    if (end.line <= start.line) {
        return start.y;
    }
    return (
        start.y +
        toProgress((line - start.line) / (end.line - start.line)) *
            (end.y - start.y)
    );
}

/** Monaco's editor as the following reads and moves it. */
export function toMarkdownEditorScroll(
    editorInstance: ScrollableEditorType,
): MarkdownEditorScrollType {
    const getLineCount = () => {
        return Math.max(1, editorInstance.getModel()?.getLineCount() ?? 1);
    };
    // How far down `lineNumber` (Monaco's, from 1) its top and the next
    // line's are: a wrapped line is many rows tall.
    const readLineSpan = (lineNumber: number, lineCount: number) => {
        const top = editorInstance.getTopForLineNumber(lineNumber);
        const nextTop =
            lineNumber < lineCount
                ? editorInstance.getTopForLineNumber(lineNumber + 1)
                : top;
        return { top, nextTop };
    };
    return {
        element: editorInstance.getContainerDomNode(),
        listenScroll: (listener) => {
            const disposable = editorInstance.onDidScrollChange((event) => {
                if (event.scrollTopChanged) {
                    listener();
                }
            });
            return () => {
                disposable.dispose();
            };
        },
        getLineCount,
        getTopLine: () => {
            const lineCount = getLineCount();
            const scrollTop = editorInstance.getScrollTop();
            // The last line whose top has reached the editor's, by halving.
            let lineNumber = 1;
            let low = 1;
            let high = lineCount;
            while (low <= high) {
                const middle = Math.floor((low + high) / 2);
                if (editorInstance.getTopForLineNumber(middle) <= scrollTop) {
                    lineNumber = middle;
                    low = middle + 1;
                } else {
                    high = middle - 1;
                }
            }
            const { top, nextTop } = readLineSpan(lineNumber, lineCount);
            const fraction =
                nextTop > top
                    ? toProgress((scrollTop - top) / (nextTop - top))
                    : 0;
            return lineNumber - 1 + fraction;
        },
        scrollToLine: (line) => {
            const lineCount = getLineCount();
            const lineNumber = Math.min(
                lineCount,
                Math.max(1, Math.floor(line) + 1),
            );
            const { top, nextTop } = readLineSpan(lineNumber, lineCount);
            const fraction = toProgress(line - (lineNumber - 1));
            editorInstance.setScrollTop(top + fraction * (nextTop - top));
        },
    };
}

type ScrollSideType = 'editor' | 'page';

/**
 * Each side follows the other until the returned function is called.
 */
export function startMarkdownScrollFollowing({
    editorScroll,
    page,
    getArticle,
}: {
    editorScroll: MarkdownEditorScrollType;
    page: HTMLElement;
    // The page's drawn file: a new element each time it is drawn afresh.
    getArticle: () => HTMLElement | null;
}) {
    // Where the person last wheeled, pressed or typed, and when.
    let inputSide: ScrollSideType | null = null;
    let inputAt = 0;
    let isPressing = false;
    // The side whose scrolling is waiting to stop.
    let stoppingSide: ScrollSideType | null = null;
    let stopTimeout: ReturnType<typeof setTimeout> | undefined;

    const follow = (side: ScrollSideType) => {
        const article = getArticle();
        if (article === null) {
            return;
        }
        const lineCount = editorScroll.getLineCount();
        if (side === 'editor') {
            const scrollTop = findPageScrollTopForLine(
                article,
                page,
                editorScroll.getTopLine(),
                lineCount,
            );
            if (scrollTop !== null) {
                page.scrollTop = scrollTop;
            }
            return;
        }
        const line = findLineAtPageTop(article, page, lineCount);
        if (line !== null) {
            editorScroll.scrollToLine(line);
        }
    };
    const handleScrolling = (side: ScrollSideType) => {
        const isPersons =
            inputSide === side &&
            (isPressing ||
                stoppingSide === side ||
                Date.now() - inputAt <= PERSON_INPUT_MILLISECONDS);
        if (!isPersons) {
            return;
        }
        clearTimeout(stopTimeout);
        stoppingSide = side;
        stopTimeout = setTimeout(() => {
            stoppingSide = null;
            follow(side);
        }, SCROLL_STOP_MILLISECONDS);
    };
    const handlePageScrolling = () => {
        handleScrolling('page');
    };
    // A release the window never hears of -- a scroll bar let go of, on some
    // systems -- is known by the next move with no button down.
    const handlePointerMoving = (event: PointerEvent) => {
        if (event.buttons === 0) {
            setIsPressing(false);
        }
    };
    function setIsPressing(newIsPressing: boolean) {
        if (newIsPressing === isPressing) {
            return;
        }
        isPressing = newIsPressing;
        // Only while a press is held: no event comes as often as a move.
        if (isPressing) {
            globalThis.addEventListener(
                'pointermove',
                handlePointerMoving,
                LISTENER_OPTIONS,
            );
        } else {
            globalThis.removeEventListener(
                'pointermove',
                handlePointerMoving,
                LISTENER_OPTIONS,
            );
        }
    }
    const handleInput = (event: Event) => {
        const target = event.target;
        inputSide =
            target instanceof Node && editorScroll.element.contains(target)
                ? 'editor'
                : 'page';
        inputAt = Date.now();
        if (event.type === 'pointerdown' || event.type === 'touchstart') {
            setIsPressing(true);
        }
    };
    const handleReleasing = () => {
        inputAt = Date.now();
        setIsPressing(false);
    };
    // The window's own, not an element's: those do not bubble to it.
    const handleWindowBlurring = () => {
        setIsPressing(false);
    };
    for (const eventName of INPUT_EVENT_NAMES) {
        globalThis.addEventListener(eventName, handleInput, LISTENER_OPTIONS);
    }
    for (const eventName of RELEASE_EVENT_NAMES) {
        globalThis.addEventListener(
            eventName,
            handleReleasing,
            LISTENER_OPTIONS,
        );
    }
    globalThis.addEventListener('blur', handleWindowBlurring);
    page.addEventListener('scroll', handlePageScrolling, { passive: true });
    const stopListeningEditor = editorScroll.listenScroll(() => {
        handleScrolling('editor');
    });
    // The editor opens where the page is, not at the file's first line: it
    // follows the page once the page is drawn with its lines marked --
    // already, or by the draw the Edit press asked for -- unless the person
    // has scrolled first. The page is watched only until then.
    const checkIsPageMarked = () => {
        const article = getArticle();
        return (
            article !== null &&
            article.querySelector(`[${MARKDOWN_SOURCE_LINE_ATTRIBUTE}]`) !==
                null
        );
    };
    let pageDrawObserver: MutationObserver | null = null;
    const stopWaitingForPage = () => {
        pageDrawObserver?.disconnect();
        pageDrawObserver = null;
    };
    if (checkIsPageMarked()) {
        follow('page');
    } else {
        pageDrawObserver = new MutationObserver(() => {
            if (inputSide !== null) {
                stopWaitingForPage();
            } else if (checkIsPageMarked()) {
                stopWaitingForPage();
                follow('page');
            }
        });
        pageDrawObserver.observe(page, { childList: true, subtree: true });
    }
    return () => {
        clearTimeout(stopTimeout);
        stopWaitingForPage();
        setIsPressing(false);
        for (const eventName of INPUT_EVENT_NAMES) {
            globalThis.removeEventListener(
                eventName,
                handleInput,
                LISTENER_OPTIONS,
            );
        }
        for (const eventName of RELEASE_EVENT_NAMES) {
            globalThis.removeEventListener(
                eventName,
                handleReleasing,
                LISTENER_OPTIONS,
            );
        }
        globalThis.removeEventListener('blur', handleWindowBlurring);
        page.removeEventListener('scroll', handlePageScrolling);
        stopListeningEditor();
    };
}
