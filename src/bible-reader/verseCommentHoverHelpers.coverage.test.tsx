// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    annotationsMap: {} as Record<string, any>,
    // What jsdom cannot work out without layout, set per test.
    offset: 1 as number | null,
    range: {
        getBoundingClientRect: () => ({ left: 10, top: 20, bottom: 30 }),
    } as null | { getBoundingClientRect: () => object },
    pointedElement: null as Element | null,
    offsetCalls: 0,
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (target: unknown) => {
            const ref = useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => h.annotationsMap,
}));
vi.mock('./bibleVerseAnnotationHelpers', async (importOriginal) => {
    const actual = (await importOriginal()) as object;
    return {
        ...actual,
        getOffsetFromPoint: () => {
            h.offsetCalls++;
            return h.offset;
        },
        createRangeFromOffsets: () => h.range,
    };
});

import { VERSE_ANNOTATION_ANCHOR_ATTR } from './bibleVerseAnnotationHelpers';
import {
    clearHoveredComment,
    useHoveredVerseComment,
    useVerseCommentHover,
} from './verseCommentHoverHelpers';

const COMMENTED_KEY = '(KJV) GEN 4:1';
const PLAIN_KEY = '(KJV) GEN 4:2';

function genAnnotationsMap() {
    return {
        [COMMENTED_KEY]: {
            highlights: [],
            comments: [
                {
                    filePath: '/notes/a.own',
                    noteItemId: 1,
                    comment: {
                        id: 'c-1',
                        start: 0,
                        end: 5,
                        text: 'And A',
                        createdAt: '',
                        updatedAt: '',
                        comment: 'Adam',
                    },
                },
            ],
        },
        [PLAIN_KEY]: { highlights: [], comments: [] },
    };
}

let seenHovered: unknown[] = [];

function ObserverComp() {
    seenHovered.push(useHoveredVerseComment());
    return null;
}

function HostComp() {
    const containerRef = useRef<HTMLDivElement>(null);
    useVerseCommentHover(containerRef);
    return (
        <div ref={containerRef} data-testid="view">
            <span {...{ [VERSE_ANNOTATION_ANCHOR_ATTR]: COMMENTED_KEY }}>
                And Adam knew Eve
            </span>
            <span {...{ [VERSE_ANNOTATION_ANCHOR_ATTR]: PLAIN_KEY }}>
                and she conceived
            </span>
        </div>
    );
}

let hostElement: HTMLDivElement;
let root: Root;
let observerElement: HTMLDivElement;
let observerRoot: Root;
// A verse of ANOTHER bible view: same words, not this view's.
let otherViewAnchor: HTMLSpanElement;

beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    seenHovered = [];
    h.annotationsMap = genAnnotationsMap();
    h.offset = 1;
    h.range = {
        getBoundingClientRect: () => ({ left: 10, top: 20, bottom: 30 }),
    };
    h.offsetCalls = 0;
    otherViewAnchor = document.createElement('span');
    otherViewAnchor.setAttribute(VERSE_ANNOTATION_ANCHOR_ATTR, COMMENTED_KEY);
    document.body.appendChild(otherViewAnchor);
    h.pointedElement = null;
    document.elementFromPoint = () => h.pointedElement;
    observerElement = document.createElement('div');
    document.body.appendChild(observerElement);
    observerRoot = createRoot(observerElement);
    await act(async () => {
        observerRoot.render(<ObserverComp />);
    });
    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    root = createRoot(hostElement);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
        clearHoveredComment();
        observerRoot.unmount();
    });
    hostElement.remove();
    observerElement.remove();
    otherViewAnchor.remove();
    delete (document as any).elementFromPoint;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function mount() {
    await act(async () => {
        root.render(<HostComp />);
    });
}

function getAnchor(verseKey: string) {
    return hostElement.querySelector(
        `[${VERSE_ANNOTATION_ANCHOR_ATTR}="${verseKey}"]`,
    )!;
}

// Each move a while after the last, so the hit test answers at once.
async function moveOver(element: Element | null) {
    h.pointedElement = element;
    await act(async () => {
        vi.advanceTimersByTime(500);
        hostElement.querySelector('[data-testid="view"]')!.dispatchEvent(
            new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 12,
                clientY: 22,
            }),
        );
    });
}

function getHovered() {
    return (seenHovered.at(-1) ?? null) as null | { commentId: string };
}

describe('what the pointer is over', () => {
    test('commented words raise their tooltip', async () => {
        await mount();
        await moveOver(getAnchor(COMMENTED_KEY));
        expect(getHovered()?.commentId).toBe('c-1');
    });

    test("another view's words are that view's to answer", async () => {
        await mount();
        await moveOver(otherViewAnchor);
        expect(getHovered()).toBeNull();
        expect(h.offsetCalls).toBe(0);
    });

    test('a verse with no comment is not hit-tested further', async () => {
        await mount();
        await moveOver(getAnchor(PLAIN_KEY));
        expect(getHovered()).toBeNull();
        expect(h.offsetCalls).toBe(0);
    });

    test('a point between the letters hits no comment', async () => {
        h.offset = null;
        await mount();
        await moveOver(getAnchor(COMMENTED_KEY));
        expect(h.offsetCalls).toBe(1);
        expect(getHovered()).toBeNull();
    });

    test('a point past the commented words hits no comment', async () => {
        h.offset = 9;
        await mount();
        await moveOver(getAnchor(COMMENTED_KEY));
        expect(getHovered()).toBeNull();
    });

    test('a comment whose words have changed under it is not shown', async () => {
        h.range = null;
        await mount();
        await moveOver(getAnchor(COMMENTED_KEY));
        expect(getHovered()).toBeNull();
    });
});

describe('moving off the comment', () => {
    test('the tooltip waits out the grace, then goes', async () => {
        await mount();
        await moveOver(getAnchor(COMMENTED_KEY));
        expect(getHovered()?.commentId).toBe('c-1');
        // Onto plain words of the same view.
        await moveOver(getAnchor(PLAIN_KEY));
        expect(getHovered()?.commentId).toBe('c-1');
        await act(async () => {
            vi.advanceTimersByTime(1200);
        });
        expect(getHovered()).toBeNull();
    });
});

describe('a window with no comment at all', () => {
    test('never listens to the pointer', async () => {
        h.annotationsMap = {
            [PLAIN_KEY]: { highlights: [], comments: [] },
        };
        const addSpy = vi.spyOn(HTMLDivElement.prototype, 'addEventListener');
        await mount();
        expect(
            addSpy.mock.calls.some(([type]) => {
                return type === 'mousemove';
            }),
        ).toBe(false);
        await moveOver(getAnchor(PLAIN_KEY));
        expect(getHovered()).toBeNull();
    });
});
