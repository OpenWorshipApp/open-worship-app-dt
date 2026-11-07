// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        hovered: null as any,
        theme: 'dark',
        isAboveModal: false,
        toVerseAnchor: vi.fn(),
        removeVerseAnnotation: vi.fn(),
        cancelHoveredCommentClearing: vi.fn(),
        clearHoveredComment: vi.fn(),
        scheduleHoveredCommentClearing: vi.fn(),
        useBibleFontFamily: vi.fn(),
    };
});

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
}));
vi.mock('../app-modal/modalLayerContext', () => ({
    useIsInModalLayer: () => h.isAboveModal,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: h.useBibleFontFamily,
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    removeVerseAnnotation: h.removeVerseAnnotation,
}));
vi.mock('./verseAnnotationActionHelpers', () => ({
    toVerseAnchor: h.toVerseAnchor,
}));
// The window's one tooltip store, driven by hand.
vi.mock('./verseCommentHoverHelpers', () => ({
    useHoveredVerseComment: () => h.hovered,
    cancelHoveredCommentClearing: h.cancelHoveredCommentClearing,
    clearHoveredComment: h.clearHoveredComment,
    scheduleHoveredCommentClearing: h.scheduleHoveredCommentClearing,
}));

import VerseCommentHoverToolComp from './VerseCommentHoverToolComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

function genHovered(overrides: object = {}) {
    return {
        filePath: '/notes/sunday.note',
        noteItemId: 3,
        commentId: 'c-1',
        comment: '✎ ♪ ✝',
        verseKey: '(XXB) GEN 4:1',
        rect: { left: 120, top: 40, bottom: 60 },
        containerElement: document.body,
        ...overrides,
    };
}

let host: HTMLDivElement;
let root: Root;
const innerWidth = globalThis.innerWidth;

beforeEach(() => {
    h.hovered = genHovered();
    h.theme = 'dark';
    h.isAboveModal = false;
    h.useBibleFontFamily.mockImplementation((bibleKey: string) => {
        return bibleKey === 'XXB' ? 'Script Face' : 'system-ui';
    });
    Object.defineProperty(globalThis, 'innerWidth', {
        configurable: true,
        value: 800,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    Object.defineProperty(globalThis, 'innerWidth', {
        configurable: true,
        value: innerWidth,
    });
});

function renderTool(onEdit: (target: unknown) => void = () => {}) {
    act(() => {
        root.render(<VerseCommentHoverToolComp onEdit={onEdit} />);
    });
}

function getTooltip() {
    return document.body.querySelector<HTMLElement>('.app-verse-comment-hover');
}

function getButton(label: string) {
    return getTooltip()!.querySelector<HTMLButtonElement>(
        `[aria-label="${label}"]`,
    )!;
}

async function press(label: string) {
    await act(async () => {
        getButton(label).click();
    });
}

describe('VerseCommentHoverToolComp', () => {
    test('nothing is drawn while no comment is hovered', () => {
        h.hovered = null;
        renderTool();
        expect(getTooltip()).toBeNull();
        expect(document.body.textContent).toBe('');
    });

    test("quotes the comment under the words, in the bible's face and the app's theme", () => {
        renderTool();
        const tooltip = getTooltip()!;
        // Outside the app's tree, so it carries the theme itself.
        expect(tooltip.parentElement).toBe(document.body);
        expect(tooltip.dataset.bsTheme).toBe('dark');
        expect(tooltip.className).toBe('app-verse-comment-hover');
        expect(tooltip.style.left).toBe('120px');
        expect(tooltip.style.top).toBe('66px');
        const text = tooltip.querySelector<HTMLElement>(
            '.app-verse-comment-hover__text',
        )!;
        expect(text.textContent).toBe('✎ ♪ ✝');
        expect(text.style.fontFamily).toBe('Script Face');
        expect(h.useBibleFontFamily).toHaveBeenLastCalledWith('XXB');
        expect(
            Array.from(tooltip.querySelectorAll('button')).map((button) => {
                return [button.title, button.getAttribute('aria-label')];
            }),
        ).toEqual([
            ['Close', 'Close'],
            ['Edit Comment', 'Edit Comment'],
            ['Delete Comment', 'Delete Comment'],
        ]);
    });

    test('an empty comment says so, and a key naming no bible asks for the default face', () => {
        h.hovered = genHovered({ comment: '', verseKey: 'GEN 4:1' });
        renderTool();
        const text = getTooltip()!.querySelector<HTMLElement>(
            '.app-verse-comment-hover__text',
        )!;
        expect(text.innerHTML).toBe(
            '<span class="fst-italic text-muted">No comment yet</span>',
        );
        expect(h.useBibleFontFamily).toHaveBeenLastCalledWith('');
    });

    test('kept inside the window, and above the popup it was opened from', () => {
        h.isAboveModal = true;
        h.hovered = genHovered({ rect: { left: -30, top: 0, bottom: 10 } });
        renderTool();
        expect(getTooltip()!.className).toBe(
            'app-verse-comment-hover app-verse-floating-surface--above-modal',
        );
        expect(getTooltip()!.style.left).toBe('8px');
        expect(getTooltip()!.style.top).toBe('16px');

        h.hovered = genHovered({ rect: { left: 900, top: 0, bottom: 10 } });
        renderTool();
        expect(getTooltip()!.style.left).toBe('792px');
    });

    test('the pointer on it holds it, leaving it lets it go, and Close takes it now', async () => {
        renderTool();
        const tooltip = getTooltip()!;
        act(() => {
            tooltip.dispatchEvent(
                new MouseEvent('mouseover', {
                    bubbles: true,
                    relatedTarget: document.body,
                }),
            );
        });
        expect(h.cancelHoveredCommentClearing).toHaveBeenCalledTimes(1);
        act(() => {
            tooltip.dispatchEvent(
                new MouseEvent('mouseout', {
                    bubbles: true,
                    relatedTarget: document.body,
                }),
            );
        });
        expect(h.scheduleHoveredCommentClearing).toHaveBeenCalledTimes(1);
        expect(h.clearHoveredComment).not.toHaveBeenCalled();
        await press('Close');
        expect(h.clearHoveredComment).toHaveBeenCalledTimes(1);
    });

    test('Edit opens the editor on the comment under its passage title, then lets the tooltip go', async () => {
        const anchor = genDeferred<unknown>();
        h.toVerseAnchor.mockReturnValue(anchor.promise);
        const onEdit = vi.fn();
        renderTool(onEdit);
        await press('Edit Comment');
        expect(h.toVerseAnchor).toHaveBeenCalledWith('(XXB) GEN 4:1');
        expect(onEdit).not.toHaveBeenCalled();
        expect(h.clearHoveredComment).not.toHaveBeenCalled();

        await act(async () => {
            anchor.resolve({ title: '(XXB) ☀☾ 4:1' });
        });
        expect(onEdit.mock.calls).toEqual([
            [
                {
                    filePath: '/notes/sunday.note',
                    noteItemId: 3,
                    commentId: 'c-1',
                    comment: '✎ ♪ ✝',
                    title: '(XXB) ☀☾ 4:1',
                    verseKey: '(XXB) GEN 4:1',
                },
            ],
        ]);
        expect(h.clearHoveredComment).toHaveBeenCalledTimes(1);
        expect(
            h.clearHoveredComment.mock.invocationCallOrder[0],
        ).toBeGreaterThan(onEdit.mock.invocationCallOrder[0]);
    });

    test('a passage that cannot be titled is edited under its key', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        const onEdit = vi.fn();
        renderTool(onEdit);
        await press('Edit Comment');
        expect(onEdit.mock.calls[0][0].title).toBe('(XXB) GEN 4:1');
    });

    test('Delete removes the comment from its note, and only then takes the tooltip', async () => {
        const removal = genDeferred<boolean>();
        h.removeVerseAnnotation.mockReturnValue(removal.promise);
        renderTool();
        await press('Delete Comment');
        expect(h.removeVerseAnnotation.mock.calls).toEqual([
            ['/notes/sunday.note', 3, 'c-1'],
        ]);
        expect(h.clearHoveredComment).not.toHaveBeenCalled();
        await act(async () => {
            removal.resolve(true);
        });
        expect(h.clearHoveredComment).toHaveBeenCalledTimes(1);
    });

    test('the buttons act on the comment hovered now, not the first one', async () => {
        h.removeVerseAnnotation.mockResolvedValue(true);
        renderTool();
        h.hovered = genHovered({ commentId: 'c-2', noteItemId: 9 });
        renderTool();
        await press('Delete Comment');
        expect(h.removeVerseAnnotation.mock.calls).toEqual([
            ['/notes/sunday.note', 9, 'c-2'],
        ]);
    });
});
