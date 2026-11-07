// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        annotationsMap: {} as Record<string, unknown>,
        isAboveModal: false,
        hoverTarget: null as unknown,
        readVerseSelection: vi.fn(),
        toVerseAnchor: vi.fn(),
        addVerseHighlight: vi.fn(),
        addVerseComment: vi.fn(),
        toOverlappingAnnotationRefs: vi.fn(),
        removeAnnotationRefs: vi.fn(),
        showSimpleToast: vi.fn(),
    };
});

// The real ref shape: the handlers are memoized once and read `.current`
// later, so a fresh `{ current }` per render would leave them on the first.
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../app-modal/modalLayerContext', () => ({
    useIsInModalLayer: () => h.isAboveModal,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    VERSE_HIGHLIGHT_COLOR_KEYS: ['yellow', 'green'],
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => h.annotationsMap,
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    addVerseComment: h.addVerseComment,
    addVerseHighlight: h.addVerseHighlight,
}));
vi.mock('./verseAnnotationActionHelpers', () => ({
    readVerseSelection: h.readVerseSelection,
    removeAnnotationRefs: h.removeAnnotationRefs,
    toOverlappingAnnotationRefs: h.toOverlappingAnnotationRefs,
    toVerseAnchor: h.toVerseAnchor,
}));
vi.mock('./VerseCommentEditorComp', () => ({
    default: ({
        target,
        onClose,
    }: {
        target: unknown;
        onClose: () => void;
    }) => (
        <div className="comment-editor" data-target={JSON.stringify(target)}>
            <button
                type="button"
                className="comment-editor-close"
                onClick={onClose}
            />
        </div>
    ),
}));
vi.mock('./VerseCommentHoverToolComp', () => ({
    default: ({ onEdit }: { onEdit: (target: unknown) => void }) => (
        <button
            type="button"
            className="hover-tool-edit"
            onClick={() => {
                onEdit(h.hoverTarget);
            }}
        />
    ),
}));

import BibleSelectionToolbarComp from './BibleSelectionToolbarComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const VERSE_KEY = '(KJV) GEN 1:1';
const OFFSETS = { start: 0, end: 2, text: 'In' };
const ANCHOR = {
    verseKey: VERSE_KEY,
    shortVerse: 'GEN 1:1',
    title: '(KJV) Genesis 1:1',
};

function genSelection(rect: Partial<DOMRect> = {}) {
    return {
        verseKey: VERSE_KEY,
        offsets: OFFSETS,
        rect: { left: 100, top: 200, width: 40, height: 16, ...rect },
    };
}

let host: HTMLDivElement;
let root: Root;

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

async function renderToolbar() {
    await act(async () => {
        root.render(<BibleSelectionToolbarComp />);
    });
}

function selectWords() {
    const words = document.createElement('span');
    words.textContent = 'In the beginning';
    host.appendChild(words);
    globalThis.getSelection()!.selectAllChildren(words);
}

async function fireSelectionChange() {
    await act(async () => {
        document.dispatchEvent(new Event('selectionchange'));
    });
}

function getToolbar() {
    return document.body.querySelector<HTMLElement>(
        '.app-verse-selection-toolbar',
    );
}

async function showToolbar() {
    await renderToolbar();
    selectWords();
    await fireSelectionChange();
    await advance(150);
    const toolbar = getToolbar();
    if (toolbar === null) {
        throw new Error('toolbar not shown');
    }
    return toolbar;
}

async function press(element: Element | null) {
    if (element === null) {
        throw new Error('nothing to press');
    }
    await act(async () => {
        (element as HTMLElement).click();
        await flush();
    });
}

function getButton(label: string) {
    return document.body.querySelector(
        `.app-verse-selection-toolbar__button[aria-label="${label}"]`,
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    h.annotationsMap = {};
    h.isAboveModal = false;
    h.hoverTarget = null;
    h.readVerseSelection.mockReturnValue(genSelection());
    h.toVerseAnchor.mockResolvedValue(ANCHOR);
    h.addVerseHighlight.mockResolvedValue(undefined);
    h.addVerseComment.mockResolvedValue(null);
    h.toOverlappingAnnotationRefs.mockReturnValue([]);
    h.removeAnnotationRefs.mockResolvedValue(0);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    globalThis.getSelection()?.removeAllRanges();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('the selection toolbar follows the selection', () => {
    test('comes up over a selection once the read settles, centred above it', async () => {
        await renderToolbar();
        selectWords();
        await fireSelectionChange();
        await advance(149);
        expect(h.readVerseSelection).not.toHaveBeenCalled();
        expect(getToolbar()).toBeNull();

        await advance(1);
        expect(h.readVerseSelection).toHaveBeenCalledTimes(1);
        const toolbar = getToolbar()!;
        // Centre of the selection, the gap above its top.
        expect(toolbar.style.left).toBe('120px');
        expect(toolbar.style.top).toBe('192px');
        expect(toolbar.getAttribute('data-bs-theme')).toBe('dark');
        expect(toolbar.className).toBe('app-verse-selection-toolbar');
        expect(
            Array.from(
                toolbar.querySelectorAll(
                    '.app-verse-selection-toolbar__swatch',
                ),
            ).map((swatch) => {
                return [
                    swatch.getAttribute('aria-label'),
                    swatch.getAttribute('title'),
                ];
            }),
        ).toEqual([
            ['yellow', 'Highlight'],
            ['green', 'Highlight'],
        ]);
    });

    test('goes the moment the selection collapses', async () => {
        await showToolbar();
        globalThis.getSelection()!.removeAllRanges();
        await fireSelectionChange();
        expect(getToolbar()).toBeNull();
    });

    test('a collapse cancels a read still waiting', async () => {
        await renderToolbar();
        selectWords();
        await fireSelectionChange();
        await advance(100);
        globalThis.getSelection()!.removeAllRanges();
        await fireSelectionChange();
        await advance(500);
        expect(h.readVerseSelection).not.toHaveBeenCalled();
        expect(getToolbar()).toBeNull();
    });

    test('stays inside the window at either edge', async () => {
        h.readVerseSelection.mockReturnValue(
            genSelection({ left: -50, width: 20 }),
        );
        const toolbar = await showToolbar();
        expect(toolbar.style.left).toBe('8px');

        h.readVerseSelection.mockReturnValue(
            genSelection({ left: globalThis.innerWidth + 100, width: 40 }),
        );
        selectWords();
        await fireSelectionChange();
        await advance(150);
        expect(getToolbar()!.style.left).toBe(`${globalThis.innerWidth - 8}px`);
    });

    test('a scroll re-reads the selection it is showing, and only then', async () => {
        await renderToolbar();
        await act(async () => {
            host.dispatchEvent(new Event('scroll'));
        });
        await advance(500);
        expect(h.readVerseSelection).not.toHaveBeenCalled();

        selectWords();
        await fireSelectionChange();
        await advance(150);
        expect(getToolbar()!.style.top).toBe('192px');

        h.readVerseSelection.mockReturnValue(genSelection({ top: 300 }));
        // Scroll does not bubble: the toolbar hears it in the capture phase.
        await act(async () => {
            host.dispatchEvent(new Event('scroll'));
        });
        await advance(150);
        expect(h.readVerseSelection).toHaveBeenCalledTimes(2);
        expect(getToolbar()!.style.top).toBe('292px');
    });

    test('a press on the toolbar keeps the selection it acts on', async () => {
        const toolbar = await showToolbar();
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            toolbar.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
    });

    test('inside a modal layer it is lifted above the modal', async () => {
        h.isAboveModal = true;
        const toolbar = await showToolbar();
        expect(toolbar.className).toBe(
            'app-verse-selection-toolbar app-verse-floating-surface--above-modal',
        );
    });

    test('unmounted, it stops listening', async () => {
        await renderToolbar();
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        selectWords();
        await fireSelectionChange();
        await advance(500);
        expect(h.readVerseSelection).not.toHaveBeenCalled();
    });
});

describe('the toolbar buttons', () => {
    test('a swatch highlights the selected words in its colour', async () => {
        const toolbar = await showToolbar();
        const swatchList = toolbar.querySelectorAll(
            '.app-verse-selection-toolbar__swatch',
        );
        await press(swatchList[1]);
        expect(h.toVerseAnchor).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.addVerseHighlight).toHaveBeenCalledWith(
            ANCHOR,
            OFFSETS,
            'green',
        );
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
    });

    test('a verse key that names no verse highlights nothing', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        const toolbar = await showToolbar();
        await press(
            toolbar.querySelector('.app-verse-selection-toolbar__swatch'),
        );
        expect(h.addVerseHighlight).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });

    test('Remove Marks with no mark under the selection says so', async () => {
        const annotations = { highlights: [], comments: [] };
        h.annotationsMap = { [VERSE_KEY]: annotations };
        await showToolbar();
        await press(getButton('Remove Marks'));
        expect(h.toOverlappingAnnotationRefs).toHaveBeenCalledWith(
            annotations,
            0,
            2,
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Remove Marks',
            'No mark in the selected text',
        );
        expect(h.removeAnnotationRefs).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });

    test('Remove Marks removes every mark the selection touches', async () => {
        const refList = [
            { filePath: '/notes/Default.own', noteItemId: 1, id: 'h-1' },
            { filePath: '/notes/Default.own', noteItemId: 1, id: 'c-1' },
        ];
        h.toOverlappingAnnotationRefs.mockReturnValue(refList);
        h.removeAnnotationRefs.mockResolvedValue(2);
        await showToolbar();
        await press(getButton('Remove Marks'));
        expect(h.toOverlappingAnnotationRefs).toHaveBeenCalledWith(
            undefined,
            0,
            2,
        );
        expect(h.removeAnnotationRefs).toHaveBeenCalledWith(refList);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
    });

    test('Add Comment files a comment and opens its editor, which closes', async () => {
        h.addVerseComment.mockResolvedValue({
            filePath: '/notes/Default.own',
            noteItemId: 3,
            annotationId: 'c-9',
        });
        await showToolbar();
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).toHaveBeenCalledWith(ANCHOR, OFFSETS);
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
        const editor =
            document.body.querySelector<HTMLElement>('.comment-editor');
        expect(JSON.parse(editor!.dataset.target!)).toEqual({
            filePath: '/notes/Default.own',
            noteItemId: 3,
            commentId: 'c-9',
            comment: '',
            title: '(KJV) Genesis 1:1',
            verseKey: VERSE_KEY,
        });

        await press(document.body.querySelector('.comment-editor-close'));
        expect(document.body.querySelector('.comment-editor')).toBeNull();
    });

    test('Add Comment on no verse, or a comment that was not filed, opens nothing', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        await showToolbar();
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).not.toHaveBeenCalled();

        h.toVerseAnchor.mockResolvedValue(ANCHOR);
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).toHaveBeenCalledTimes(1);
        expect(document.body.querySelector('.comment-editor')).toBeNull();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });

    test('the hover tool opens the editor on the comment it shows', async () => {
        h.hoverTarget = {
            filePath: '/notes/a.own',
            noteItemId: 2,
            commentId: 'c-2',
            comment: 'Already written',
            title: VERSE_KEY,
            verseKey: VERSE_KEY,
        };
        await renderToolbar();
        await press(document.body.querySelector('.hover-tool-edit'));
        const editor =
            document.body.querySelector<HTMLElement>('.comment-editor');
        expect(JSON.parse(editor!.dataset.target!)).toEqual(h.hoverTarget);
    });
});
