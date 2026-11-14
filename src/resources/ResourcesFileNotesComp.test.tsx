// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    read: vi.fn(),
    openNote: vi.fn(),
    openVerse: vi.fn(),
    toVerse: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    return { BibleItemsViewControllerContext: createContext<unknown>(null) };
});
vi.mock('../bible-list/note/VerseAnnotationLineComp', () => ({
    default: ({ annotation }: any) => (
        <span className="test-mark">
            {annotation.text}
            {'comment' in annotation ? ` — ${annotation.comment}` : ''}
        </span>
    ),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `"${bibleKey} Face", serif`,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('./resourcePreviewHelpers', () => ({
    readResourceNoteItems: h.read,
}));
vi.mock('./resourcePreviewOpenHelpers', () => ({
    openBibleNotePreview: h.openNote,
}));
vi.mock('../bible-reader/verseAnnotationActionHelpers', () => ({
    openVerseBibleItem: h.openVerse,
    toVerseBibleItem: h.toVerse,
}));

import type BibleItemsViewController from '../bible-reader/BibleItemsViewController';
import { BibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import ResourcesFileNotesComp from './ResourcesFileNotesComp';
import type {
    ResourceNoteItemsResultType,
    ResourceVerseRowType,
} from './resourcePreviewHelpers';

// Only handed on: the mark's press gives it to the opener untouched.
const VIEW_CONTROLLER = {
    name: 'reader view controller',
} as unknown as BibleItemsViewController;

let container: HTMLDivElement;
let root: Root;

function genVerseRow(
    overrides: Partial<ResourceVerseRowType> = {},
): ResourceVerseRowType {
    return {
        kind: 'verse',
        id: 2,
        title: '(KJV) Genesis 22:1',
        verseKey: '(KJV) GEN 22:1',
        bibleKey: 'KJV',
        isOpened: false,
        highlights: [
            { id: 'h1', text: 'tempt Abraham', color: 'yellow' as any },
        ],
        comments: [{ id: 'c1', text: 'Abraham', comment: 'a test of faith' }],
        ...overrides,
    };
}

// The reads are promises resolved by the test, so a slow read is a test of
// its own.
function deferRead() {
    let resolve!: (result: ResourceNoteItemsResultType) => void;
    const promise = new Promise<ResourceNoteItemsResultType>((onResolve) => {
        resolve = onResolve;
    });
    return { promise, resolve };
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderNotes(
    filePath: string,
    controller: BibleItemsViewController | null = null,
) {
    await act(async () =>
        root.render(
            <BibleItemsViewControllerContext value={controller}>
                <ResourcesFileNotesComp filePath={filePath} />
            </BibleItemsViewControllerContext>,
        ),
    );
    await flush();
}

function buttons() {
    return Array.from(container.querySelectorAll('button'));
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('ResourcesFileNotesComp', () => {
    test('reads the file when opened, and lists its notes and verses in order', async () => {
        h.read.mockResolvedValue({
            items: [
                { kind: 'note', id: 1, title: 'Sermon outline' },
                genVerseRow(),
                { kind: 'note', id: 3, title: '' },
            ],
            failureReason: null,
        });
        await renderNotes('/shelf/notes.own');
        expect(h.read).toHaveBeenCalledWith('/shelf/notes.own');
        const [first, verse, untitled] = buttons();
        expect(first.textContent).toBe('Sermon outline');
        expect(first.title).toBe('Sermon outline (Read-only)');
        expect(verse.textContent).toContain('(KJV) Genesis 22:1');
        // Folded, as the file left it: the count of its marks.
        expect(verse.getAttribute('aria-expanded')).toBe('false');
        expect(
            verse.querySelector('.app-resources-verse-count')?.textContent,
        ).toBe('2');
        // The verse block is set in its own translation's face.
        expect(
            container.querySelector<HTMLElement>('.app-resources-verse-item')
                ?.style.fontFamily,
        ).toBe('"KJV Face", serif');
        expect(untitled.textContent).toBe('No title');
        expect(
            untitled.querySelector('.app-resources-link-title')?.className,
        ).toContain('fst-italic');
        expect(container.textContent).not.toContain('No notes');
    });

    test('a note opens read-only in the Bible Note window', async () => {
        h.read.mockResolvedValue({
            items: [{ kind: 'note', id: 7, title: 'Prayer list' }],
            failureReason: null,
        });
        await renderNotes('/shelf/notes.own');
        act(() => buttons()[0].click());
        await flush();
        // One more window a press, as a Bible note's own Open.
        expect(h.openNote).toHaveBeenCalledWith('/shelf/notes.own', 7, {
            isAnother: true,
        });
    });

    test('a verse unfolds to its marks; a mark opens its verse beside the passage', async () => {
        const bibleItem = { id: 'verse-item' };
        h.toVerse.mockReturnValue(bibleItem);
        h.read.mockResolvedValue({
            items: [genVerseRow()],
            failureReason: null,
        });
        await renderNotes('/shelf/notes.own', VIEW_CONTROLLER);
        expect(container.querySelectorAll('.test-mark')).toHaveLength(0);
        act(() => buttons()[0].click());
        expect(buttons()[0].getAttribute('aria-expanded')).toBe('true');
        expect(
            container.querySelector('.app-resources-verse-count'),
        ).toBeNull();
        const marks = Array.from(container.querySelectorAll('.test-mark'));
        expect(marks.map((mark) => mark.textContent)).toEqual([
            'tempt Abraham',
            'Abraham — a test of faith',
        ]);
        const markButton = marks[1].closest('button')!;
        expect(markButton.title).toBe('Click to open the verse');
        act(() => markButton.click());
        await flush();
        expect(h.toVerse).toHaveBeenCalledWith('(KJV) GEN 22:1');
        expect(h.openVerse).toHaveBeenCalledWith(VIEW_CONTROLLER, bibleItem);

        // Folded again, the marks go.
        act(() => buttons()[0].click());
        expect(container.querySelectorAll('.test-mark')).toHaveLength(0);
    });

    test('an open verse with no reader behind it, or one that does not parse, opens nothing', async () => {
        h.read.mockResolvedValue({
            items: [genVerseRow({ isOpened: true })],
            failureReason: null,
        });
        await renderNotes('/shelf/notes.own', null);
        const markButton = container
            .querySelector('.test-mark')!
            .closest('button')!;
        act(() => markButton.click());
        await flush();
        expect(h.toVerse).not.toHaveBeenCalled();
        expect(h.openVerse).not.toHaveBeenCalled();

        h.toVerse.mockReturnValue(null);
        await renderNotes('/shelf/notes.own', VIEW_CONTROLLER);
        act(() =>
            container.querySelector('.test-mark')!.closest('button')!.click(),
        );
        await flush();
        expect(h.toVerse).toHaveBeenCalledWith('(KJV) GEN 22:1');
        expect(h.openVerse).not.toHaveBeenCalled();
    });

    test('says why a file shows nothing, or that it holds no notes', async () => {
        h.read.mockResolvedValue({ items: [], failureReason: 'not-a-note' });
        await renderNotes('/shelf/a.own');
        expect(container.textContent).toBe('Not a bible note file');
        h.read.mockResolvedValue({ items: [], failureReason: 'too-large' });
        await renderNotes('/shelf/b.own');
        expect(container.textContent).toBe('This file is too large to preview');
        h.read.mockResolvedValue({ items: [], failureReason: 'unreadable' });
        await renderNotes('/shelf/c.own');
        expect(container.textContent).toBe('Cannot read this file');
        expect(container.querySelector('.text-warning')).not.toBeNull();
        h.read.mockResolvedValue({ items: [], failureReason: null });
        await renderNotes('/shelf/d.own');
        expect(container.textContent).toBe('No notes');
        expect(container.querySelector('.text-warning')).toBeNull();
    });

    test('a read that lands after the row moved on is dropped', async () => {
        const slow = deferRead();
        const fast = deferRead();
        h.read
            .mockReturnValueOnce(slow.promise)
            .mockReturnValueOnce(fast.promise);
        await renderNotes('/shelf/old.own');
        // Nothing until the file is read.
        expect(container.innerHTML).toBe('');
        await renderNotes('/shelf/new.own');
        await act(async () => {
            fast.resolve({
                items: [{ kind: 'note', id: 1, title: 'New file' }],
                failureReason: null,
            });
        });
        await act(async () => {
            slow.resolve({
                items: [{ kind: 'note', id: 1, title: 'Old file' }],
                failureReason: null,
            });
        });
        await flush();
        expect(container.textContent).toBe('New file');
    });
});
