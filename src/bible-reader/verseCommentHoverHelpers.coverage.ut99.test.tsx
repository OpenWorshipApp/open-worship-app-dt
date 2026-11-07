// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        annotationsMap: {} as Record<string, any>,
        hovered: null as any,
        elementFromPoint: vi.fn(),
        caretPositionFromPoint: vi.fn(),
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => h.annotationsMap,
}));

import {
    clearHoveredComment,
    scheduleHoveredCommentClearing,
    useHoveredVerseComment,
    useVerseCommentHover,
} from './verseCommentHoverHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const VERSE_KEY = '(KJV) GEN 4:1';
const HIGHLIGHTED_VERSE_KEY = '(KJV) GEN 4:2';
const BARE_VERSE_KEY = '(KJV) GEN 4:3';

function genComment(id: string, start: number, end: number, text: string) {
    return {
        filePath: '/notes/sunday.note',
        noteItemId: 3,
        comment: {
            id,
            start,
            end,
            text,
            createdAt: '',
            updatedAt: '',
            comment: `About ${text}`,
        },
    };
}

function genAnnotationsMap(isWithComments = true) {
    return {
        // `And Adam knew Eve his wife`: "Adam" is 4-8, "his" 18-21, and a
        // comment stored for words that have since changed runs past the end.
        [VERSE_KEY]: {
            highlights: [],
            comments: isWithComments
                ? [
                      genComment('c-1', 4, 8, 'Adam'),
                      genComment('c-2', 18, 21, 'his'),
                      genComment('c-3', 22, 40, 'wife and child'),
                  ]
                : [],
        },
        [HIGHLIGHTED_VERSE_KEY]: {
            highlights: [
                {
                    filePath: '/notes/sunday.note',
                    noteItemId: 3,
                    highlight: { id: 'h-1', start: 0, end: 3, text: 'And' },
                },
            ],
            comments: [],
        },
    };
}

function HostComp({ isAttached = true }: Readonly<{ isAttached?: boolean }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    useVerseCommentHover(containerRef);
    h.hovered = useHoveredVerseComment();
    return (
        <div ref={isAttached ? containerRef : undefined} className="view">
            <span data-bible-verse-key={VERSE_KEY}>
                And <b>Adam</b> knew Eve his wife
            </span>
            <span data-bible-verse-key={HIGHLIGHTED_VERSE_KEY}>
                And she conceived
            </span>
            <span data-bible-verse-key={BARE_VERSE_KEY}>Cain was a tiller</span>
            <span className="outside">not a verse</span>
        </div>
    );
}

type PointType = {
    element: Element | null;
    caret: { offsetNode: Node; offset: number } | null;
};

let host: HTMLDivElement;
let otherView: HTMLDivElement;
let root: Root;
let pointList: PointType[] = [];
const originalRangeRect = Object.getOwnPropertyDescriptor(
    Range.prototype,
    'getBoundingClientRect',
);

beforeEach(() => {
    vi.useFakeTimers();
    h.annotationsMap = genAnnotationsMap();
    h.hovered = null;
    pointList = [];
    // jsdom lays nothing out: each point is named by its x, and answers the
    // element and caret a browser would.
    h.elementFromPoint.mockImplementation((x: number) => {
        return pointList[x]?.element ?? null;
    });
    h.caretPositionFromPoint.mockImplementation((x: number) => {
        return pointList[x]?.caret ?? null;
    });
    Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: h.elementFromPoint,
    });
    Object.defineProperty(document, 'caretPositionFromPoint', {
        configurable: true,
        value: h.caretPositionFromPoint,
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: function (this: Range) {
            return { left: 10, top: 20, bottom: 30, text: this.toString() };
        },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    otherView = document.createElement('div');
    otherView.innerHTML = `<span data-bible-verse-key="${VERSE_KEY}">And Adam knew Eve his wife</span>`;
    document.body.appendChild(otherView);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
        // The store is the window's: leave it empty, its pointer flag down.
        scheduleHoveredCommentClearing();
        clearHoveredComment();
    });
    host.remove();
    otherView.remove();
    delete (document as any).elementFromPoint;
    delete (document as any).caretPositionFromPoint;
    if (originalRangeRect === undefined) {
        delete (Range.prototype as any).getBoundingClientRect;
    } else {
        Object.defineProperty(
            Range.prototype,
            'getBoundingClientRect',
            originalRangeRect,
        );
    }
    vi.useRealTimers();
});

async function mount(isAttached = true) {
    await act(async () => {
        root.render(<HostComp isAttached={isAttached} />);
    });
}

function getView() {
    return host.querySelector('.view')!;
}

function getAnchor(verseKey: string) {
    return host.querySelector(`[data-bible-verse-key="${verseKey}"]`)!;
}

// The words of the commented verse, by name, as points over them.
function definePoints() {
    const anchor = getAnchor(VERSE_KEY);
    const bold = anchor.querySelector('b')!;
    const restText = anchor.childNodes[2];
    const highlightedAnchor = getAnchor(HIGHLIGHTED_VERSE_KEY);
    const points = {
        adam: {
            element: bold,
            caret: { offsetNode: bold.firstChild!, offset: 1 },
        },
        his: { element: anchor, caret: { offsetNode: restText, offset: 10 } },
        outside: {
            element: host.querySelector('.outside'),
            caret: null,
        },
        otherView: {
            element: otherView.firstElementChild,
            caret: {
                offsetNode: otherView.firstElementChild!.firstChild!,
                offset: 5,
            },
        },
        highlightedOnly: {
            element: highlightedAnchor,
            caret: { offsetNode: highlightedAnchor.firstChild!, offset: 1 },
        },
        unmarked: {
            element: getAnchor(BARE_VERSE_KEY),
            caret: {
                offsetNode: getAnchor(BARE_VERSE_KEY).firstChild!,
                offset: 1,
            },
        },
        noCaret: { element: anchor, caret: null },
        caretElsewhere: {
            element: anchor,
            caret: { offsetNode: highlightedAnchor.firstChild!, offset: 1 },
        },
        knew: { element: anchor, caret: { offsetNode: restText, offset: 2 } },
        wife: { element: anchor, caret: { offsetNode: restText, offset: 15 } },
    };
    const xMap = {} as Record<keyof typeof points, number>;
    for (const [name, point] of Object.entries(points)) {
        xMap[name as keyof typeof points] = pointList.length;
        pointList.push(point as PointType);
    }
    return xMap;
}

// Past the hit test's own debounce first, so every move answers at once.
async function moveTo(x: number) {
    await act(async () => {
        vi.advanceTimersByTime(200);
    });
    await act(async () => {
        getView().dispatchEvent(
            new MouseEvent('mousemove', {
                bubbles: true,
                clientX: x,
                clientY: 5,
            }),
        );
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        vi.advanceTimersByTime(milliseconds);
    });
}

describe('useVerseCommentHover hit test', () => {
    test('the comment under the caret is shown, over its own words', async () => {
        await mount();
        const points = definePoints();
        await moveTo(points.adam);
        expect(h.hovered).toEqual({
            filePath: '/notes/sunday.note',
            noteItemId: 3,
            commentId: 'c-1',
            comment: 'About Adam',
            verseKey: VERSE_KEY,
            // Measured over the words the comment covers.
            rect: { left: 10, top: 20, bottom: 30, text: 'Adam' },
            containerElement: getView(),
        });

        await moveTo(points.his);
        expect(h.hovered.commentId).toBe('c-2');
        expect(h.hovered.rect.text).toBe('his');
    });

    test.each([
        ['outside any verse', 'outside'],
        ['over words another view draws above this one', 'otherView'],
        ['over a verse that is only highlighted', 'highlightedOnly'],
        ['over a verse with no marks', 'unmarked'],
        ['where no caret can be placed', 'noCaret'],
        ['where the caret falls outside the verse', 'caretElsewhere'],
        ['between two comments', 'knew'],
        ['over a comment whose words have changed', 'wife'],
    ] as const)(
        'moved %s, the tooltip goes after the grace',
        async (_name, pointName) => {
            await mount();
            const points = definePoints();
            await moveTo(points.adam);
            expect(h.hovered?.commentId).toBe('c-1');

            await moveTo(points[pointName]);
            await advance(1199);
            expect(h.hovered?.commentId).toBe('c-1');
            await advance(1);
            expect(h.hovered).toBeNull();
        },
    );

    test('a window holding no comment does not hit-test, until one arrives', async () => {
        h.annotationsMap = genAnnotationsMap(false);
        await mount();
        const points = definePoints();
        await moveTo(points.adam);
        expect(h.elementFromPoint).not.toHaveBeenCalled();
        expect(h.hovered).toBeNull();

        h.annotationsMap = genAnnotationsMap();
        await mount();
        await moveTo(points.adam);
        expect(h.elementFromPoint).toHaveBeenCalledTimes(1);
        expect(h.hovered?.commentId).toBe('c-1');
    });

    test('a view whose element is not there yet listens to nothing', async () => {
        await mount(false);
        const points = definePoints();
        await moveTo(points.adam);
        expect(h.elementFromPoint).not.toHaveBeenCalled();
        expect(h.hovered).toBeNull();
    });
});
