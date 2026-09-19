// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { VerseAnnotationsMapType } from '../bible-list/note/verseAnnotationHelpers';

const h = vi.hoisted(() => {
    return {
        annotationsMap: {} as Record<string, any>,
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => h.annotationsMap,
}));
// jsdom has no layout: every point is over the anchor's first character.
vi.mock('./bibleVerseAnnotationHelpers', async (importOriginal) => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        getOffsetFromPoint: () => 1,
        createRangeFromOffsets: () => ({
            getBoundingClientRect: () => ({ left: 10, top: 20, bottom: 30 }),
        }),
    };
});

import { VERSE_ANNOTATION_ANCHOR_ATTR } from './bibleVerseAnnotationHelpers';
import {
    checkIsCommentInMap,
    clearHoveredComment,
    scheduleHoveredCommentClearing,
    useHoveredVerseComment,
    useVerseCommentHover,
} from './verseCommentHoverHelpers';

const VERSE_KEY = '(KJV) GEN 4:1';
const COMMENT_ID = 'c-1';

function genAnnotationsMap(commentIds: string[]): VerseAnnotationsMapType {
    return {
        [VERSE_KEY]: {
            highlights: [],
            comments: commentIds.map((id) => ({
                filePath: '/notes/a.note',
                noteItemId: 1,
                comment: {
                    id,
                    start: 0,
                    end: 5,
                    text: 'And A',
                    createdAt: '',
                    updatedAt: '',
                    comment: 'this is testing',
                },
            })),
        },
    };
}

let seenHovered: any[] = [];

// Watches the store from its own root, so it still reports after the host
// with the bible view has been unmounted.
function ObserverComp() {
    seenHovered.push(useHoveredVerseComment());
    return null;
}

function HostComp() {
    const containerRef = useRef<HTMLDivElement>(null);
    useVerseCommentHover(containerRef);
    return (
        <div ref={containerRef} data-testid="view">
            <span {...{ [VERSE_ANNOTATION_ANCHOR_ATTR]: VERSE_KEY }}>
                And Adam knew Eve his wife
            </span>
        </div>
    );
}

let root: Root | null = null;
let hostElement: HTMLDivElement | null = null;
let observerRoot: Root | null = null;
let observerElement: HTMLDivElement | null = null;

function getView() {
    const view = document.querySelector('[data-testid="view"]');
    if (view === null) {
        throw new Error('view not mounted');
    }
    return view;
}

function getAnchor() {
    const anchor = document.querySelector(`[${VERSE_ANNOTATION_ANCHOR_ATTR}]`);
    if (anchor === null) {
        throw new Error('anchor not mounted');
    }
    return anchor;
}

function getHovered() {
    return seenHovered.at(-1) ?? null;
}

async function mount() {
    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    root = createRoot(hostElement);
    await act(async () => {
        root?.render(<HostComp />);
    });
}

async function unmount() {
    await act(async () => {
        root?.unmount();
    });
    root = null;
    hostElement?.remove();
    hostElement = null;
}

async function moveOverWords() {
    await act(async () => {
        getView().dispatchEvent(
            new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 12,
                clientY: 22,
            }),
        );
    });
}

async function leaveView() {
    await act(async () => {
        getView().dispatchEvent(new MouseEvent('mouseleave'));
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        vi.advanceTimersByTime(milliseconds);
    });
}

beforeEach(async () => {
    vi.useFakeTimers();
    seenHovered = [];
    h.annotationsMap = genAnnotationsMap([COMMENT_ID]);
    document.elementFromPoint = () => getAnchor();
    observerElement = document.createElement('div');
    document.body.appendChild(observerElement);
    observerRoot = createRoot(observerElement);
    await act(async () => {
        observerRoot?.render(<ObserverComp />);
    });
});

afterEach(async () => {
    await unmount();
    await act(async () => {
        clearHoveredComment();
        observerRoot?.unmount();
    });
    observerRoot = null;
    observerElement?.remove();
    observerElement = null;
    vi.useRealTimers();
});

describe('useVerseCommentHover', () => {
    test('hovering commented words shows the tooltip', async () => {
        await mount();
        await moveOverWords();
        expect(getHovered()?.commentId).toBe(COMMENT_ID);
    });

    test('leaving the view clears the tooltip after the grace', async () => {
        await mount();
        await moveOverWords();
        await leaveView();
        await advance(1199);
        expect(getHovered()?.commentId).toBe(COMMENT_ID);
        await advance(1);
        expect(getHovered()).toBeNull();
    });

    // The bug: a second move inside the debounce window leaves a trailing hit
    // test pending; the pointer then leaves the view; the trailing run fires
    // with the old coordinates, finds the comment, and cancels the clearing
    // `mouseleave` scheduled. Nothing ever scheduled it again.
    test('a debounced hit test firing after mouseleave cannot keep it', async () => {
        await mount();
        await moveOverWords();
        await advance(30);
        await moveOverWords();
        await leaveView();
        await advance(2000);
        expect(getHovered()).toBeNull();
    });

    test('the view unmounting takes its tooltip with it', async () => {
        await mount();
        await moveOverWords();
        expect(getHovered()?.commentId).toBe(COMMENT_ID);
        await unmount();
        expect(getHovered()).toBeNull();
    });

    test('the comment being deleted elsewhere clears the tooltip', async () => {
        await mount();
        await moveOverWords();
        h.annotationsMap = genAnnotationsMap(['another']);
        await act(async () => {
            root?.render(<HostComp />);
        });
        expect(getHovered()).toBeNull();
    });

    test('clearHoveredComment is immediate and cancels a pending clearing', async () => {
        await mount();
        await moveOverWords();
        scheduleHoveredCommentClearing();
        await act(async () => {
            clearHoveredComment();
        });
        expect(getHovered()).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('checkIsCommentInMap', () => {
    test('finds a comment by verse key and id', () => {
        const map = genAnnotationsMap([COMMENT_ID]);
        expect(checkIsCommentInMap(map, VERSE_KEY, COMMENT_ID)).toBe(true);
        expect(checkIsCommentInMap(map, VERSE_KEY, 'other')).toBe(false);
        expect(checkIsCommentInMap(map, '(KJV) GEN 4:2', COMMENT_ID)).toBe(
            false,
        );
        expect(checkIsCommentInMap({}, VERSE_KEY, COMMENT_ID)).toBe(false);
    });
});
