// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        annotations: {} as Record<string, any>,
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return { useAppEffect: React.useEffect };
});
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    VERSE_HIGHLIGHT_COLOR_KEYS: ['yellow'],
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => h.annotations,
}));

// jsdom has no CSS Custom Highlight API: loaded here, the painter is on an
// engine that cannot paint marks at all.
import {
    requestVerseHighlightRepaint,
    useVerseHighlightPainting,
} from './verseHighlightPainter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function ViewComp() {
    const containerRef = useRef<HTMLDivElement>(null);
    useVerseHighlightPainting(containerRef);
    return (
        <div ref={containerRef}>
            <span data-bible-verse-key="verse-1">Moses spoke</span>
        </div>
    );
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    h.annotations = {
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
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.useRealTimers();
});

test('an engine without the Highlight API watches no view and paints nothing', async () => {
    expect(typeof (globalThis as any).Highlight).toBe('undefined');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    await act(async () => {
        root.render(<ViewComp />);
    });
    await act(async () => {
        requestVerseHighlightRepaint();
        vi.advanceTimersByTime(400);
    });
    // No observer per view for marks it could never paint.
    expect(observe).not.toHaveBeenCalled();
    // And the verse is left as it was drawn.
    expect(host.innerHTML).toBe(
        '<div><span data-bible-verse-key="verse-1">Moses spoke</span></div>',
    );
});
