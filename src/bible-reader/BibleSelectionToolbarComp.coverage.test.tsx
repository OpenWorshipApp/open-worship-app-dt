// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ModalLayerContext } from '../app-modal/modalLayerContext';

type EditorPropsType = {
    target: { commentId: string; comment: string };
    onClose: () => void;
};

const h = vi.hoisted(() => ({
    annotationsMap: {} as Record<string, unknown>,
    readVerseSelection: vi.fn(),
    toVerseAnchor: vi.fn(),
    toOverlappingAnnotationRefs: vi.fn(),
    removeAnnotationRefs: vi.fn(),
    addVerseHighlight: vi.fn(),
    addVerseComment: vi.fn(),
    showSimpleToast: vi.fn(),
    hoverToolOnEdit: null as null | ((target: unknown) => void),
    editorTargets: [] as unknown[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
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
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
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
    default: ({ target, onClose }: EditorPropsType) => {
        h.editorTargets.push(target);
        return (
            <div className="test-editor" data-comment-id={target.commentId}>
                <button
                    type="button"
                    className="test-editor-close"
                    onClick={onClose}
                />
            </div>
        );
    },
}));
vi.mock('./VerseCommentHoverToolComp', () => ({
    default: ({ onEdit }: { onEdit: (target: unknown) => void }) => {
        h.hoverToolOnEdit = onEdit;
        return null;
    },
}));

import BibleSelectionToolbarComp from './BibleSelectionToolbarComp';

const VERSE_KEY = '(KJV) GEN 1:1';
const OFFSETS = { start: 3, end: 12, text: 'beginning' };
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
let wordsElement: HTMLSpanElement;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.annotationsMap = {};
    h.hoverToolOnEdit = null;
    h.editorTargets = [];
    h.readVerseSelection.mockReturnValue(genSelection());
    h.toVerseAnchor.mockResolvedValue(ANCHOR);
    h.toOverlappingAnnotationRefs.mockReturnValue([]);
    h.removeAnnotationRefs.mockResolvedValue(0);
    h.addVerseHighlight.mockResolvedValue(undefined);
    h.addVerseComment.mockResolvedValue(null);
    host = document.createElement('div');
    document.body.appendChild(host);
    wordsElement = document.createElement('span');
    wordsElement.textContent = 'In the beginning';
    document.body.appendChild(wordsElement);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    wordsElement.remove();
    globalThis.getSelection()?.removeAllRanges();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function render(isInModal = false) {
    await act(async () => {
        root.render(
            <ModalLayerContext value={isInModal}>
                <BibleSelectionToolbarComp />
            </ModalLayerContext>,
        );
    });
}

async function fireSelectionChange() {
    await act(async () => {
        document.dispatchEvent(new Event('selectionchange'));
    });
}

async function waitDebounce() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
    });
}

async function raiseToolbar() {
    globalThis.getSelection()!.selectAllChildren(wordsElement);
    await fireSelectionChange();
    await waitDebounce();
    const toolbar = getToolbar();
    expect(toolbar).not.toBeNull();
    return toolbar!;
}

function getToolbar() {
    return document.body.querySelector<HTMLDivElement>(
        '.app-verse-selection-toolbar',
    );
}

function getButton(label: string) {
    return document.body.querySelector<HTMLButtonElement>(
        `.app-verse-selection-toolbar [aria-label="${label}"]`,
    )!;
}

async function press(button: HTMLButtonElement) {
    await act(async () => {
        button.click();
    });
}

describe('raising and dropping the toolbar', () => {
    test('a run of selected text is read once the debounce settles', async () => {
        await render();
        globalThis.getSelection()!.selectAllChildren(wordsElement);
        await fireSelectionChange();
        // Not yet: the read is debounced.
        expect(h.readVerseSelection).not.toHaveBeenCalled();
        expect(getToolbar()).toBeNull();
        await waitDebounce();
        expect(h.readVerseSelection).toHaveBeenCalledOnce();
        const toolbar = getToolbar()!;
        expect(toolbar.getAttribute('data-bs-theme')).toBe('dark');
        // Centered over the selection, the gap above it.
        expect(toolbar.style.left).toBe('120px');
        expect(toolbar.style.top).toBe('192px');
        expect(
            toolbar.classList.contains(
                'app-verse-floating-surface--above-modal',
            ),
        ).toBe(false);
    });

    test('collapsing the selection drops the toolbar and cancels a pending read', async () => {
        await render();
        await raiseToolbar();
        expect(h.readVerseSelection).toHaveBeenCalledOnce();

        // A new selection schedules a read ...
        globalThis.getSelection()!.selectAllChildren(wordsElement);
        await fireSelectionChange();
        // ... and collapsing it before the read lands cancels that read.
        globalThis.getSelection()!.collapse(wordsElement, 0);
        await fireSelectionChange();
        expect(getToolbar()).toBeNull();
        await waitDebounce();
        expect(h.readVerseSelection).toHaveBeenCalledOnce();
        expect(getToolbar()).toBeNull();
    });

    test('a selection outside any verse reads as no toolbar', async () => {
        h.readVerseSelection.mockReturnValue(null);
        await render();
        globalThis.getSelection()!.selectAllChildren(wordsElement);
        await fireSelectionChange();
        await waitDebounce();
        expect(h.readVerseSelection).toHaveBeenCalledOnce();
        expect(getToolbar()).toBeNull();
    });

    test('scrolling re-reads the selection only while a toolbar is up', async () => {
        await render();
        await act(async () => {
            document.dispatchEvent(new Event('scroll'));
        });
        await waitDebounce();
        // Nothing selected: scrolling costs nothing.
        expect(h.readVerseSelection).not.toHaveBeenCalled();

        await raiseToolbar();
        h.readVerseSelection.mockReturnValue(genSelection({ top: 50 }));
        await act(async () => {
            document.dispatchEvent(new Event('scroll'));
        });
        await waitDebounce();
        expect(h.readVerseSelection).toHaveBeenCalledTimes(2);
        // The toolbar followed the words up the page.
        expect(getToolbar()!.style.top).toBe('42px');
    });

    test('the toolbar never leaves the window at either edge', async () => {
        await render();
        h.readVerseSelection.mockReturnValue(genSelection({ left: -60 }));
        await raiseToolbar();
        expect(getToolbar()!.style.left).toBe('8px');

        h.readVerseSelection.mockReturnValue(
            genSelection({ left: globalThis.innerWidth + 100 }),
        );
        globalThis.getSelection()!.selectAllChildren(wordsElement);
        await fireSelectionChange();
        await waitDebounce();
        expect(getToolbar()!.style.left).toBe(`${globalThis.innerWidth - 8}px`);
    });

    test('inside a modal the toolbar is raised above it', async () => {
        await render(true);
        const toolbar = await raiseToolbar();
        expect(
            toolbar.classList.contains(
                'app-verse-floating-surface--above-modal',
            ),
        ).toBe(true);
    });

    test('pressing on the toolbar does not collapse the selection', async () => {
        await render();
        const toolbar = await raiseToolbar();
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            toolbar.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('highlighting', () => {
    test('a swatch marks the selected words in its colour', async () => {
        await render();
        await raiseToolbar();
        const swatches = document.body.querySelectorAll<HTMLButtonElement>(
            '.app-verse-selection-toolbar__swatch',
        );
        expect(swatches).toHaveLength(6);
        await press(getButton('green'));
        expect(h.toVerseAnchor).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.addVerseHighlight).toHaveBeenCalledWith(
            ANCHOR,
            OFFSETS,
            'green',
        );
        // The selection that raised the toolbar is spent.
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
    });

    test('a key that names no verse marks nothing', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        await render();
        await raiseToolbar();
        await press(getButton('yellow'));
        expect(h.addVerseHighlight).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });
});

describe('erasing', () => {
    test('says so when no mark lies under the selection', async () => {
        const annotations = { highlights: [], comments: [] };
        h.annotationsMap = { [VERSE_KEY]: annotations };
        await render();
        await raiseToolbar();
        await press(getButton('Remove Marks'));
        expect(h.toOverlappingAnnotationRefs).toHaveBeenCalledWith(
            annotations,
            OFFSETS.start,
            OFFSETS.end,
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Remove Marks',
            'No mark in the selected text',
        );
        expect(h.removeAnnotationRefs).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });

    test('removes every mark the selection touches', async () => {
        const refs = [
            { filePath: '/notes/a.own', noteItemId: 1, id: 'h1' },
            { filePath: '/notes/a.own', noteItemId: 1, id: 'c1' },
        ];
        h.toOverlappingAnnotationRefs.mockReturnValue(refs);
        await render();
        await raiseToolbar();
        await press(getButton('Remove Marks'));
        expect(h.removeAnnotationRefs).toHaveBeenCalledWith(refs);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
    });
});

describe('commenting', () => {
    test('adds an empty comment and opens the editor on it', async () => {
        h.addVerseComment.mockResolvedValue({
            filePath: '/notes/Default.own',
            noteItemId: 7,
            annotationId: 'comment-1',
        });
        await render();
        await raiseToolbar();
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).toHaveBeenCalledWith(ANCHOR, OFFSETS);
        expect(h.editorTargets.at(-1)).toEqual({
            filePath: '/notes/Default.own',
            noteItemId: 7,
            commentId: 'comment-1',
            comment: '',
            title: ANCHOR.title,
            verseKey: VERSE_KEY,
        });
        expect(globalThis.getSelection()!.rangeCount).toBe(0);

        // The editor outlives the selection, and closes on its own button.
        const close =
            document.body.querySelector<HTMLButtonElement>(
                '.test-editor-close',
            )!;
        await press(close);
        expect(document.body.querySelector('.test-editor')).toBeNull();
    });

    test('opens no editor when the comment could not be added', async () => {
        await render();
        await raiseToolbar();
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).toHaveBeenCalledOnce();
        expect(document.body.querySelector('.test-editor')).toBeNull();
        expect(globalThis.getSelection()!.rangeCount).toBe(1);
    });

    test('a key that names no verse adds no comment', async () => {
        h.toVerseAnchor.mockResolvedValue(null);
        await render();
        await raiseToolbar();
        await press(getButton('Add Comment'));
        expect(h.addVerseComment).not.toHaveBeenCalled();
    });

    test("the hover tool's edit opens the editor on that comment", async () => {
        await render();
        const target = {
            filePath: '/notes/Default.own',
            noteItemId: 2,
            commentId: 'c-9',
            comment: 'A word on this',
            title: '(KJV) Genesis 1:1',
            verseKey: VERSE_KEY,
        };
        await act(async () => {
            h.hoverToolOnEdit!(target);
        });
        const editor = document.body.querySelector('.test-editor')!;
        expect(editor.getAttribute('data-comment-id')).toBe('c-9');
        expect(h.editorTargets.at(-1)).toBe(target);
    });
});
