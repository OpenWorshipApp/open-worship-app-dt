// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ModalLayerContext } from '../app-modal/modalLayerContext';

const h = vi.hoisted(() => ({
    hoveredComment: null as null | Record<string, unknown>,
    toVerseAnchor: vi.fn(),
    removeVerseAnnotation: vi.fn(),
    clearHoveredComment: vi.fn(),
    cancelHoveredCommentClearing: vi.fn(),
    scheduleHoveredCommentClearing: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    removeVerseAnnotation: h.removeVerseAnnotation,
}));
vi.mock('./verseAnnotationActionHelpers', () => ({
    toVerseAnchor: h.toVerseAnchor,
}));
vi.mock('./verseCommentHoverHelpers', () => ({
    useHoveredVerseComment: () => h.hoveredComment,
    clearHoveredComment: h.clearHoveredComment,
    cancelHoveredCommentClearing: h.cancelHoveredCommentClearing,
    scheduleHoveredCommentClearing: h.scheduleHoveredCommentClearing,
}));

import VerseCommentHoverToolComp from './VerseCommentHoverToolComp';

const HOVERED = {
    filePath: '/notes/Default.own',
    noteItemId: 3,
    commentId: 'c-7',
    comment: 'Abraham obeyed',
    verseKey: '(KHM) GEN 22:1',
    rect: { left: 40, top: 100, bottom: 116, width: 50, height: 16 },
};

let host: HTMLDivElement;
let root: Root;
const onEdit = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.hoveredComment = { ...HOVERED, containerElement: document.body };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(isInModal = false) {
    await act(async () => {
        root.render(
            <ModalLayerContext value={isInModal}>
                <VerseCommentHoverToolComp onEdit={onEdit} />
            </ModalLayerContext>,
        );
    });
    return document.body.querySelector<HTMLDivElement>(
        '.app-verse-comment-hover',
    );
}

async function press(label: string) {
    await act(async () => {
        document.body
            .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
            .click();
    });
}

describe('the comment tooltip', () => {
    test('nothing hovered, nothing shown', async () => {
        h.hoveredComment = null;
        expect(await render()).toBeNull();
    });

    test('quotes the comment under the words, in their bible face', async () => {
        const tooltip = (await render())!;
        expect(tooltip.getAttribute('data-bs-theme')).toBe('dark');
        expect(tooltip.style.left).toBe('40px');
        expect(tooltip.style.top).toBe('122px');
        const text = tooltip.querySelector<HTMLDivElement>(
            '.app-verse-comment-hover__text',
        )!;
        expect(text.textContent).toBe('Abraham obeyed');
        expect(text.style.fontFamily).toBe('KHM Font');
        expect(tooltip.className).toBe('app-verse-comment-hover');
    });

    test('an empty comment says there is none yet', async () => {
        h.hoveredComment = { ...h.hoveredComment, comment: '' };
        const tooltip = (await render())!;
        expect(
            tooltip.querySelector('.app-verse-comment-hover__text .fst-italic')!
                .textContent,
        ).toBe('No comment yet');
    });

    test('stays inside the window, and above a modal it was opened from', async () => {
        h.hoveredComment = {
            ...h.hoveredComment,
            rect: { ...HOVERED.rect, left: globalThis.innerWidth + 50 },
        };
        const tooltip = (await render(true))!;
        expect(tooltip.style.left).toBe(`${globalThis.innerWidth - 8}px`);
        expect(tooltip.className).toContain(
            'app-verse-floating-surface--above-modal',
        );
    });

    test('the pointer resting on it keeps it, leaving it starts the grace', async () => {
        const tooltip = (await render())!;
        // Somewhere on the page React does not draw: where the pointer was.
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        try {
            await act(async () => {
                tooltip.dispatchEvent(
                    new MouseEvent('mouseover', {
                        bubbles: true,
                        relatedTarget: outside,
                    }),
                );
            });
            expect(h.cancelHoveredCommentClearing).toHaveBeenCalledOnce();
            expect(h.scheduleHoveredCommentClearing).not.toHaveBeenCalled();
            await act(async () => {
                tooltip.dispatchEvent(
                    new MouseEvent('mouseout', {
                        bubbles: true,
                        relatedTarget: outside,
                    }),
                );
            });
            expect(h.scheduleHoveredCommentClearing).toHaveBeenCalledOnce();
        } finally {
            outside.remove();
        }
    });

    test('close takes it away', async () => {
        await render();
        await press('Close');
        expect(h.clearHoveredComment).toHaveBeenCalledOnce();
    });
});

describe('its actions', () => {
    test('edit opens the editor on the comment, under its verse title', async () => {
        h.toVerseAnchor.mockResolvedValue({
            verseKey: HOVERED.verseKey,
            shortVerse: 'GEN 22:1',
            title: '(KHM) លោកុប្បត្តិ 22:1',
        });
        await render();
        await press('Edit Comment');
        expect(h.toVerseAnchor).toHaveBeenCalledWith('(KHM) GEN 22:1');
        expect(onEdit).toHaveBeenCalledWith({
            filePath: '/notes/Default.own',
            noteItemId: 3,
            commentId: 'c-7',
            comment: 'Abraham obeyed',
            title: '(KHM) លោកុប្បត្តិ 22:1',
            verseKey: '(KHM) GEN 22:1',
        });
        // The editor is up: the tooltip under it goes.
        expect(h.clearHoveredComment).toHaveBeenCalledOnce();
    });

    test('a verse that cannot be titled is edited under its key', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        await render();
        await press('Edit Comment');
        expect(onEdit.mock.calls[0][0].title).toBe('(KHM) GEN 22:1');
    });

    test('delete removes the comment, then the tooltip quoting it', async () => {
        let finishRemoving: () => void = () => {};
        h.removeVerseAnnotation.mockReturnValue(
            new Promise<void>((resolve) => {
                finishRemoving = resolve;
            }),
        );
        await render();
        await press('Delete Comment');
        expect(h.removeVerseAnnotation).toHaveBeenCalledWith(
            '/notes/Default.own',
            3,
            'c-7',
        );
        // Still quoting it until the note file has let it go.
        expect(h.clearHoveredComment).not.toHaveBeenCalled();
        await act(async () => {
            finishRemoving();
        });
        expect(h.clearHoveredComment).toHaveBeenCalledOnce();
    });
});
