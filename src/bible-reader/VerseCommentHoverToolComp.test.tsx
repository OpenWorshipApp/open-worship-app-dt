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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('../app-modal/modalLayerContext', () => ({
    useIsInModalLayer: () => false,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    toVerseBibleKey: () => 'KJV',
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    removeVerseAnnotation: async () => {},
}));
vi.mock('./verseAnnotationActionHelpers', () => ({
    toVerseAnchor: async () => null,
}));
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
    clearHoveredComment,
    useVerseCommentHover,
} from './verseCommentHoverHelpers';
import VerseCommentHoverToolComp from './VerseCommentHoverToolComp';

const VERSE_KEY = '(KJV) GEN 4:1';

function genAnnotationsMap(): VerseAnnotationsMapType {
    return {
        [VERSE_KEY]: {
            highlights: [],
            comments: [
                {
                    filePath: '/notes/a.note',
                    noteItemId: 1,
                    comment: {
                        id: 'c-1',
                        start: 0,
                        end: 5,
                        text: 'And A',
                        createdAt: '',
                        updatedAt: '',
                        comment: 'this is testing',
                    },
                },
            ],
        },
    };
}

function BibleViewComp() {
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

function getView() {
    return document.querySelector('[data-testid="view"]') as HTMLElement;
}

function getAnchor() {
    return document.querySelector(
        `[${VERSE_ANNOTATION_ANCHOR_ATTR}]`,
    ) as HTMLElement;
}

function getTooltip() {
    return document.querySelector('.app-verse-comment-hover');
}

async function dispatch(target: EventTarget, event: Event) {
    await act(async () => {
        target.dispatchEvent(event);
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        vi.advanceTimersByTime(milliseconds);
    });
}

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    h.annotationsMap = genAnnotationsMap();
    document.elementFromPoint = () => getAnchor();
    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    root = createRoot(hostElement);
    await act(async () => {
        root?.render(
            <>
                <BibleViewComp />
                <VerseCommentHoverToolComp onEdit={() => {}} />
            </>,
        );
    });
});

afterEach(async () => {
    await act(async () => {
        root?.unmount();
        clearHoveredComment();
    });
    root = null;
    hostElement?.remove();
    hostElement = null;
    vi.useRealTimers();
});

describe('VerseCommentHoverToolComp', () => {
    // RD-110, as the browser sends it when the pointer moves from the words
    // onto the tooltip's Edit button: `mouseout` on the words (React builds
    // the tooltip's `onMouseEnter` from it), THEN `mouseleave` on the bible
    // view. The leave used to schedule the clearing behind the enter's
    // cancel, and the tooltip went away under a pointer that never moved.
    test('stays while the pointer rests on it, and goes after leaving it', async () => {
        await dispatch(
            getView(),
            new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 12,
                clientY: 22,
            }),
        );
        const tooltip = getTooltip();
        expect(tooltip?.textContent).toContain('this is testing');
        const editButton = tooltip!.querySelector(
            '[aria-label="Edit Comment"]',
        ) as HTMLElement;

        await dispatch(
            getAnchor(),
            new MouseEvent('mouseout', {
                bubbles: true,
                relatedTarget: editButton,
            }),
        );
        await dispatch(
            getView(),
            new MouseEvent('mouseleave', { relatedTarget: editButton }),
        );
        await advance(5000);
        expect(getTooltip()).not.toBeNull();

        await dispatch(
            editButton,
            new MouseEvent('mouseout', {
                bubbles: true,
                relatedTarget: document.body,
            }),
        );
        await advance(1199);
        expect(getTooltip()).not.toBeNull();
        await advance(1);
        expect(getTooltip()).toBeNull();
    });
});
