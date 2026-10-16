// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    annotations: {} as Record<string, any>,
    registered: new Map<string, any>(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    VERSE_HIGHLIGHT_COLOR_KEYS: ['yellow', 'green'],
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => state.annotations,
}));

class FakeHighlight {
    ranges = new Set<Range>();
    add(range: Range) {
        this.ranges.add(range);
    }
    clear() {
        this.ranges.clear();
    }
}

let painter: typeof import('./verseHighlightPainter');
let host: HTMLDivElement;
let root: Root;

function Harness({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    painter.useVerseHighlightPainting(containerRef);
    return (
        <div ref={containerRef}>
            <span data-bible-verse-key="verse-1">{text}</span>
        </div>
    );
}

function highlight(name: string) {
    return state.registered.get(name) as FakeHighlight | undefined;
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', {
        highlights: {
            set: (name: string, item: FakeHighlight) => {
                state.registered.set(name, item);
            },
        },
    });
    vi.useFakeTimers();
    state.annotations = {};
    painter ??= await import('./verseHighlightPainter');
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('verse highlight painting', () => {
    it('paints valid highlight and comment ranges without wrapping verse text', async () => {
        state.annotations = {
            'verse-1': {
                highlights: [
                    {
                        highlight: {
                            start: 0,
                            end: 5,
                            text: 'Moses',
                            color: 'yellow',
                        },
                    },
                ],
                comments: [{ comment: { start: 6, end: 11, text: 'spoke' } }],
            },
        };
        await act(async () => root.render(<Harness text="Moses spoke" />));
        await act(async () => vi.advanceTimersByTime(200));

        expect(painter.toHighlightName('yellow')).toBe('owa-verse-hl-yellow');
        expect(
            [...highlight('owa-verse-hl-yellow')!.ranges].map((r) =>
                r.toString(),
            ),
        ).toEqual(['Moses']);
        expect(
            [...highlight('owa-verse-comment')!.ranges].map((r) =>
                r.toString(),
            ),
        ).toEqual(['spoke']);
        expect(host.querySelectorAll('span')).toHaveLength(1);
    });

    it('drops stale offsets after the verse text changes and clears ranges on unmount', async () => {
        state.annotations = {
            'verse-1': {
                highlights: [
                    {
                        highlight: {
                            start: 0,
                            end: 5,
                            text: 'Moses',
                            color: 'yellow',
                        },
                    },
                ],
                comments: [],
            },
        };
        await act(async () => root.render(<Harness text="Moses spoke" />));
        await act(async () => vi.advanceTimersByTime(200));
        expect(highlight('owa-verse-hl-yellow')!.ranges.size).toBe(1);

        await act(async () => root.render(<Harness text="Aaron spoke" />));
        await act(async () => vi.advanceTimersByTime(200));
        expect(highlight('owa-verse-hl-yellow')!.ranges.size).toBe(0);

        await act(async () => root.unmount());
        expect(highlight('owa-verse-hl-yellow')!.ranges.size).toBe(0);
        root = createRoot(host);
    });

    it('ignores absent verses and invalid ranges', async () => {
        state.annotations = {
            'verse-1': {
                highlights: [
                    {
                        highlight: {
                            start: 0,
                            end: 0,
                            text: '',
                            color: 'green',
                        },
                    },
                ],
                comments: [],
            },
        };
        await act(async () => root.render(<Harness text="Moses spoke" />));
        await act(async () => vi.advanceTimersByTime(200));
        expect(highlight('owa-verse-hl-green')).toBeUndefined();

        state.annotations = {};
        await act(async () => root.render(<Harness text="New text" />));
        await act(async () => vi.advanceTimersByTime(200));
        expect(highlight('owa-verse-hl-green')).toBeUndefined();
    });
});
