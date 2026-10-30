// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showAppContextMenu: vi.fn(),
    notifyElementHighlight: vi.fn(),
    toVerseBibleItem: vi.fn(),
    openVerseBibleItem: vi.fn(),
    removeVerseAnnotation: vi.fn(),
    updateVerseHighlightColor: vi.fn(),
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: unknown) => void }) => (
        <button type="button" onClick={(event) => onOpening(event)}>
            More mark actions
        </button>
    ),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => <i data-icon={name} />,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/domHelpers', () => ({
    escapeSelectorValue: (value: string) => value,
    notifyElementHighlight: h.notifyElementHighlight,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    return { BibleItemsViewControllerContext: createContext(null) };
});
vi.mock('../../bible-reader/VerseCommentEditorComp', () => ({
    default: ({
        target,
        onClose,
    }: {
        target: unknown;
        onClose: () => void;
    }) => (
        <div className="comment-editor">
            <pre>{JSON.stringify(target)}</pre>
            <button type="button" onClick={onClose}>
                Close editor
            </button>
        </div>
    ),
}));
vi.mock('../../bible-reader/verseAnnotationActionHelpers', () => ({
    toVerseBibleItem: h.toVerseBibleItem,
    openVerseBibleItem: h.openVerseBibleItem,
}));
vi.mock('./verseAnnotationHelpers', () => ({
    removeVerseAnnotation: h.removeVerseAnnotation,
    updateVerseHighlightColor: h.updateVerseHighlightColor,
}));

import { BibleItemsViewControllerContext } from '../../bible-reader/BibleItemsViewController';
import RenderVerseAnnotationComp from './RenderVerseAnnotationComp';

const FILE_PATH = '/notes/Default.own';
const VERSE_KEY = '(KJV) GEN 1:1';
const highlight = {
    id: 'h1',
    start: 0,
    end: 2,
    text: 'In the beginning',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    color: 'yellow' as const,
};
const comment = {
    id: 'c1',
    start: 3,
    end: 9,
    text: 'God created',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    comment: 'Creation',
};

let host: HTMLDivElement;
let root: Root;
let viewController: any;

async function renderMark(
    annotation: typeof highlight | typeof comment,
    {
        verseKey = VERSE_KEY,
        controller = viewController,
    }: { verseKey?: string; controller?: unknown } = {},
) {
    await act(async () => {
        root.render(
            <BibleItemsViewControllerContext value={controller as any}>
                <ul>
                    <RenderVerseAnnotationComp
                        filePath={FILE_PATH}
                        noteItemId={7}
                        verseKey={verseKey}
                        verseTitle="Genesis 1:1 (KJV)"
                        annotation={annotation}
                    />
                </ul>
            </BibleItemsViewControllerContext>,
        );
    });
}

function getRow() {
    return host.querySelector<HTMLLIElement>('li')!;
}

async function openMenu() {
    await act(async () => {
        getRow().dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
    expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
    return h.showAppContextMenu.mock.calls[0][1] as any[];
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    viewController = { id: 'reader' };
    h.toVerseBibleItem.mockReturnValue({ id: 'bible-item' });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('a mark under a verse row', () => {
    test('shows the marked words in their colour', async () => {
        await renderMark(highlight);
        const row = getRow();
        expect(row.title).toBe('Click to open the verse');
        expect(row.textContent).toContain('In the beginning');
        const words = row.querySelector<HTMLElement>(
            '.app-verse-annotation__text',
        )!;
        expect(words.style.backgroundColor).toBe('var(--owa-verse-hl-yellow)');
    });

    test('a press flashes the verse on screen and opens it as a bible view', async () => {
        const verse = document.createElement('div');
        verse.dataset.kjvVerseKey = 'GEN 1:1';
        const bibleView = document.createElement('div');
        bibleView.className = 'bible-view';
        bibleView.append(verse);
        document.body.append(bibleView);

        await renderMark(highlight);
        await act(async () => getRow().click());
        expect(h.notifyElementHighlight).toHaveBeenCalledTimes(1);
        // The flash looks the verse up by its translation-free key.
        const findVerse = h.notifyElementHighlight.mock.calls[0][0];
        expect(findVerse()).toBe(verse);
        expect(h.toVerseBibleItem).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.openVerseBibleItem).toHaveBeenCalledWith(viewController, {
            id: 'bible-item',
        });
    });

    test('a key with no Bible prefix is looked up as it is', async () => {
        const verse = document.createElement('div');
        verse.dataset.kjvVerseKey = 'JHN 3:16';
        const bibleView = document.createElement('div');
        bibleView.className = 'bible-view';
        bibleView.append(verse);
        document.body.append(bibleView);

        await renderMark(highlight, { verseKey: 'JHN 3:16' });
        await act(async () => getRow().click());
        expect(h.notifyElementHighlight.mock.calls[0][0]()).toBe(verse);
    });

    test('without a reader to open it in, a press only flashes', async () => {
        await renderMark(highlight, { controller: null });
        await act(async () => getRow().click());
        expect(h.notifyElementHighlight).toHaveBeenCalledTimes(1);
        expect(h.toVerseBibleItem).not.toHaveBeenCalled();
        expect(h.openVerseBibleItem).not.toHaveBeenCalled();
    });

    test('a verse key that names no verse opens nothing', async () => {
        h.toVerseBibleItem.mockReturnValue(null);
        await renderMark(highlight);
        await act(async () => getRow().click());
        expect(h.toVerseBibleItem).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.openVerseBibleItem).not.toHaveBeenCalled();
    });

    test('a highlight menu offers every other colour, then Delete', async () => {
        await renderMark(highlight);
        const items = await openMenu();
        expect(items.map((item) => item.menuElement)).toEqual([
            'green',
            'blue',
            'pink',
            'orange',
            'purple',
            'Delete',
        ]);
        expect(items[0].childBefore.props.style.backgroundColor).toBe(
            'var(--owa-verse-hl-green)',
        );
        items[2].onSelect();
        expect(h.updateVerseHighlightColor).toHaveBeenCalledWith(
            FILE_PATH,
            7,
            'h1',
            'pink',
        );
        items[5].onSelect();
        expect(h.removeVerseAnnotation).toHaveBeenCalledWith(
            FILE_PATH,
            7,
            'h1',
        );
    });

    test('the dots button opens the same menu as a right-click', async () => {
        await renderMark(comment);
        const dots = [...host.querySelectorAll('button')].find(
            (button) => button.textContent === 'More mark actions',
        )!;
        await act(async () => dots.click());
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const items = h.showAppContextMenu.mock.calls[0][1];
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Edit Comment',
            'Delete',
        ]);
    });

    test('Edit Comment opens the comment editor on this comment, and it closes', async () => {
        await renderMark(comment);
        expect(getRow().textContent).toContain('Creation');
        const items = await openMenu();
        await act(async () => items[0].onSelect());
        const editor = host.querySelector('.comment-editor');
        expect(editor).not.toBeNull();
        expect(JSON.parse(editor!.querySelector('pre')!.textContent!)).toEqual({
            filePath: FILE_PATH,
            noteItemId: 7,
            commentId: 'c1',
            comment: 'Creation',
            title: 'Genesis 1:1 (KJV)',
            verseKey: VERSE_KEY,
        });
        const close = [...host.querySelectorAll('button')].find(
            (button) => button.textContent === 'Close editor',
        )!;
        await act(async () => close.click());
        expect(host.querySelector('.comment-editor')).toBeNull();
    });

    test('a comment that has become a highlight opens no comment editor', async () => {
        await renderMark(comment);
        const items = await openMenu();
        await renderMark(highlight);
        await act(async () => items[0].onSelect());
        expect(host.querySelector('.comment-editor')).toBeNull();
    });
});
