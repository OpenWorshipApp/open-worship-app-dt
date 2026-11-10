// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));
vi.mock('../../media-sessions/folderSessionPathHelpers', () => ({
    findSessionIdByFilePath: () => null,
    findNonDefaultSessionIdByFilePath: () => null,
}));
vi.mock('../../media-sessions/useFileListSessions', () => ({
    useFileListSessions: (settingName: string) => ({
        activeId: '',
        isDefaultSession: true,
        dirSourceSettingName: settingName,
        element: null,
    }),
}));

// ONE mock surface for the small Bible Notes components: the verse-mark row,
// the note window's history menu, its footer controls and lookup popup, the
// notes list and the row switch. Each is rendered for real against it.
const h = vi.hoisted(() => ({
    showMenu: vi.fn(),
    highlight: vi.fn(),
    toVerseBibleItem: vi.fn(),
    openVerseBibleItem: vi.fn(),
    removeAnnotation: vi.fn(),
    updateColor: vi.fn(),
    keyHandlers: new Map<unknown, () => unknown>(),
    fileEvent: null as null | {
        events: string[];
        callback: (data?: any) => void;
        filePath?: string;
    },
    getAllLangs: vi.fn(),
    openExternalURL: vi.fn(),
    showBibleKeyOption: vi.fn(),
    theme: 'dark',
    settingNames: [] as string[],
    editingResult: { result: { bibleItem: null as any } },
    lookupControllers: [] as any[],
    dirSource: null as unknown,
    dirSourceSettingNames: [] as string[],
    fileListProps: null as any,
    getDefaultNote: vi.fn(),
    createNote: vi.fn(),
    selectAndImport: vi.fn(),
    askAndImport: vi.fn(),
    importDropped: vi.fn(),
    sortNoteFilePaths: vi.fn(),
}));

vi.mock('./BibleNoteEditingMenuComp.scss', () => ({}));
vi.mock('./VerseAnnotationLineComp.scss', () => ({}));
vi.mock('../cueList.scss', () => ({}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
    getAllLangsAsync: h.getAllLangs,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showMenu,
}));
// As the real one does: the press stays off the row it sits on.
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: unknown) => void }) => (
        <button
            type="button"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpening(event);
            }}
        >
            More Options
        </button>
    ),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: useEffect,
        useAppEffectAsync: (
            callback: (context: object) => Promise<void>,
            deps: unknown[],
            context?: object,
        ) =>
            useEffect(() => {
                void callback(context ?? {});
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps),
    };
});
vi.mock('../../helper/domHelpers', () => ({
    escapeSelectorValue: (value: string) => value,
    notifyElementHighlight: h.highlight,
}));
vi.mock('../../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    return { BibleItemsViewControllerContext: createContext<any>(null) };
});
vi.mock('../../bible-reader/VerseCommentEditorComp', () => ({
    default: ({ target, onClose }: { target: any; onClose: () => void }) => (
        <div role="dialog" data-target={JSON.stringify(target)}>
            <button type="button" onClick={onClose}>
                Close comment editor
            </button>
        </div>
    ),
}));
vi.mock('../../bible-reader/verseAnnotationActionHelpers', () => ({
    toVerseBibleItem: h.toVerseBibleItem,
    openVerseBibleItem: h.openVerseBibleItem,
}));
vi.mock('./verseAnnotationHelpers', () => ({
    removeVerseAnnotation: h.removeAnnotation,
    updateVerseHighlightColor: h.updateColor,
}));
// The real rule, not the module: the manager drags `DirSource` behind it.
vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    checkIsHistoryMovementEventType: (eventType: unknown) => {
        return ['undo', 'redo', 'discard'].includes(eventType as string);
    },
}));
vi.mock('../../editing-manager/editingHelpers', () => ({
    savingEventMapper: { allControlKey: ['Ctrl'], key: 's' },
    FileEditingMenuComp: ({
        editableDocument,
        undoLabel,
        redoLabel,
    }: {
        editableDocument: any;
        undoLabel: string;
        redoLabel: string;
    }) => (
        <div data-file-path={editableDocument.filePath}>
            <button type="button" onClick={editableDocument.historyUndo}>
                {undoLabel}
            </button>
            <button type="button" onClick={editableDocument.historyRedo}>
                {redoLabel}
            </button>
            <button type="button" onClick={editableDocument.historyDiscard}>
                Discard
            </button>
            <button type="button" onClick={editableDocument.save}>
                Save
            </button>
        </div>
    ),
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        eventMappers: unknown[],
        listener: () => unknown,
    ) => {
        for (const eventMapper of eventMappers) {
            h.keyHandlers.set(eventMapper, listener);
        }
    },
    toShortcutKey: (eventMapper: { key: string; allControlKey: string[] }) =>
        [...eventMapper.allControlKey, eventMapper.key].join('+'),
}));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: (data?: any) => void,
        _deps: unknown[],
        filePath?: string,
    ) => {
        h.fileEvent = { events, callback, filePath };
    },
    useGenDirSourceReload: (settingName: string) => {
        h.dirSourceSettingNames.push(settingName);
        return h.dirSource;
    },
}));
vi.mock('./bibleNoteHelpers', () => ({
    BIBLE_KEY_SETTING_NAME: 'bible-note-bible-key',
    flushBibleNoteHistory: async () => undefined,
    toStoredContent: (content: string) => content.trim(),
    toEditorContent: (content: string) => `editor:${content}`,
}));
// The footer's Open in Chatbot is `bibleNoteHelpers1.test.tsx`'s: AI off here.
vi.mock('../../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => false,
}));
vi.mock('../../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: h.openExternalURL } },
}));
vi.mock('../../server/appHelpers', async () => {
    const { useState } = await import('react');
    return { useIsOnTop: () => useState(false) };
});
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOption,
}));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
}));
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useWatchStateSettingString: (settingName: string, value: string) => {
            h.settingNames.push(settingName);
            return useState(value);
        },
    };
});
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    // Spaced: jsdom drops a hyphenated family name from `style`.
    useBibleFontFamily: (bibleKey: string) => `Font ${bibleKey}`,
}));
vi.mock('../../app-modal/FloatingWidgetComp', () => ({
    default: ({
        onClose,
        collapsedChildren,
        children,
    }: {
        onClose: () => void;
        collapsedChildren?: ReactNode;
        children: ReactNode;
    }) => (
        <section aria-label="Floating widget">
            <header>{collapsedChildren}</header>
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../../bible-lookup/RenderBibleLookupComp', async () => {
    const { use } = await import('react');
    const { BibleItemsViewControllerContext } =
        await import('../../bible-reader/BibleItemsViewController');
    return {
        default: () => {
            const controller: any = use(BibleItemsViewControllerContext);
            return (
                <div
                    data-lookup-kind={controller.kind}
                    data-minimized={String(controller.isMinimized)}
                >
                    {controller.extraEditingActionButtons}
                </div>
            );
        },
    };
});
vi.mock('../../bible-reader/LookupBibleItemController', () => ({
    default: class FakeLookupBibleItemController {
        isMinimized = false;
        extraEditingActionButtons: ReactNode = null;
        kind: string;
        constructor(kind: string) {
            this.kind = kind;
            h.lookupControllers.push(this);
        }
        async getEditingResult() {
            return h.editingResult;
        }
    },
}));
vi.mock('../../bible-lookup/bibleActionHelpers', () => ({
    ctrlEnterEventMapper: { allControlKey: ['Ctrl'], key: 'Enter' },
    ctrlShiftEnterEventMapper: {
        allControlKey: ['Ctrl', 'Shift'],
        key: 'Enter',
    },
}));
vi.mock('../../others/labelIconHelpers', () => ({
    toIconedLabel: (key: string) => `label:${key}`,
}));
vi.mock('../../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.fileListProps = props;
        return (
            <div className={props.className}>
                {props.header}
                <ul>{props.bodyHandler(['/notes/a.own', '/notes/b.own'])}</ul>
            </div>
        );
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    getFileFullName: (file: any) =>
        typeof file === 'string' ? file.split('/').pop() : file?.name,
}));
vi.mock('./Note', () => ({
    default: { getDefault: h.getDefaultNote, create: h.createNote },
}));
vi.mock('./NoteFileComp', () => ({
    default: ({ index, filePath }: { index: number; filePath: string }) => (
        <li data-note-file={filePath}>{index}</li>
    ),
}));
vi.mock('./bibleNoteArchiveHelpers', () => ({
    askAndImportBibleNoteArchiveFromUrl: h.askAndImport,
    checkIsBibleNoteArchiveFileFullName: (fileFullName: string) =>
        fileFullName.endsWith('.owanote.tar.gz'),
    importDroppedBibleNoteArchive: h.importDropped,
    selectAndImportBibleNoteArchive: h.selectAndImport,
}));
vi.mock('./noteHelpers', () => ({ sortNoteFilePaths: h.sortNoteFilePaths }));
vi.mock('./BibleNoteItemRenderComp', () => ({
    default: (props: any) => (
        <li
            data-kind="note"
            data-index={props.index}
            data-file={props.filePath}
        >
            {`${props.noteItem.title}|${props.note.filePath}`}
        </li>
    ),
}));
vi.mock('./VerseNoteItemRenderComp', () => ({
    default: (props: any) => (
        <li
            data-kind="verse"
            data-index={props.index}
            data-file={props.filePath}
        >
            {`${props.noteItem.title}|${props.note.filePath}`}
        </li>
    ),
}));

import { BibleItemsViewControllerContext } from '../../bible-reader/BibleItemsViewController';
import {
    ctrlEnterEventMapper,
    ctrlShiftEnterEventMapper,
} from '../../bible-lookup/bibleActionHelpers';
import { savingEventMapper } from '../../editing-manager/editingHelpers';
import BibleNoteEditingMenuComp from './BibleNoteEditingMenuComp';
import BibleNoteListComp from './BibleNoteListComp';
import NoteItemEditorPopupComp from './NoteItemEditorPopupComp';
import RenderNoteItemsComp from './RenderNoteItemsComp';
import RenderVerseAnnotationComp from './RenderVerseAnnotationComp';

const NOTE_FILE_PATH = '/notes/Default.own';
const VERSE_KEY = '(KJV) GEN 22:1';
const VERSE_TITLE = '(KJV) Genesis 22:1';

let host: HTMLDivElement;
let root: Root;
let extraRoots: { root: Root; host: HTMLElement }[];

// Microtasks only, so it works the same under fake timers: every chain here
// (a lang list read, a lookup result, a passage's text) is a few awaits long.
async function settle() {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

async function run(callback: () => unknown) {
    await act(async () => {
        callback();
        await settle();
    });
}

async function flush() {
    await run(() => undefined);
}

async function render(node: ReactNode) {
    await act(async () => root.render(node));
}

function findButton(label: string, scope: ParentNode = host) {
    const button = [...scope.querySelectorAll('button')].find(
        (element) =>
            element.textContent === label ||
            element.getAttribute('aria-label') === label,
    );
    if (button === undefined) {
        throw new Error(`No button: ${label}`);
    }
    return button;
}

async function press(element: HTMLElement) {
    await run(() => element.click());
}

// What the `bible-note` package does with a footer button: mounts its
// `children` in a React root of its own.
async function mountFooterChildren(children: ReactNode) {
    const footerHost = document.createElement('div');
    document.body.append(footerHost);
    const footerRoot = createRoot(footerHost);
    extraRoots.push({ root: footerRoot, host: footerHost });
    await act(async () => footerRoot.render(children));
    return footerHost;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.keyHandlers.clear();
    h.fileEvent = null;
    h.theme = 'dark';
    h.settingNames.length = 0;
    h.editingResult = { result: { bibleItem: null } };
    h.lookupControllers.length = 0;
    h.dirSource = null;
    h.dirSourceSettingNames.length = 0;
    h.fileListProps = null;
    h.getAllLangs.mockResolvedValue([]);
    extraRoots = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    for (const extra of extraRoots) {
        await act(async () => extra.root.unmount());
        extra.host.remove();
    }
    host.remove();
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('RenderVerseAnnotationComp — one mark under a verse row', () => {
    const highlight = {
        id: 'h1',
        start: 0,
        end: 13,
        text: 'tempt Abraham',
        color: 'yellow' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const comment = {
        id: 'c1',
        start: 2,
        end: 7,
        text: 'words',
        comment: 'Remember this',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };

    function renderMark(
        annotation: any,
        viewController: unknown = null,
        verseKey = VERSE_KEY,
    ) {
        return render(
            <BibleItemsViewControllerContext value={viewController as any}>
                <ul>
                    <RenderVerseAnnotationComp
                        filePath={NOTE_FILE_PATH}
                        noteItemId={3}
                        verseKey={verseKey}
                        verseTitle={VERSE_TITLE}
                        annotation={annotation}
                    />
                </ul>
            </BibleItemsViewControllerContext>,
        );
    }

    function openRowMenu() {
        return act(async () => {
            host.querySelector('li')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
    }

    function lastMenuItems(): any[] {
        return h.showMenu.mock.lastCall![1];
    }

    test('a highlight wears its own wash and a click opens the verse it marks', async () => {
        const viewController = { straightBibleItems: [] };
        const bibleItem = { id: -1, bibleKey: 'KJV' };
        h.toVerseBibleItem.mockReturnValue(bibleItem);
        await renderMark(highlight, viewController);

        const row = host.querySelector('li')!;
        expect(row.title).toBe('Click to open the verse');
        const words = row.querySelector<HTMLElement>(
            '.app-verse-annotation__text',
        )!;
        expect(words.textContent).toBe('tempt Abraham');
        expect(words.style.backgroundColor).toBe('var(--owa-verse-hl-yellow)');
        expect(words.className).not.toContain('--comment');

        await press(row);
        expect(h.toVerseBibleItem).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.openVerseBibleItem).toHaveBeenCalledWith(
            viewController,
            bibleItem,
        );
        // The flash looks for the verse by its KJV key, already on screen.
        expect(h.highlight).toHaveBeenCalledOnce();
        const verseElement = document.createElement('div');
        verseElement.dataset.kjvVerseKey = 'GEN 22:1';
        const bibleView = document.createElement('div');
        bibleView.className = 'bible-view';
        bibleView.append(verseElement);
        document.body.append(bibleView);
        expect(h.highlight.mock.calls[0][0]()).toBe(verseElement);
    });

    test('with no Bible view to open it in, a click only flashes the verse', async () => {
        await renderMark(highlight, null, 'GEN 22:1');
        await press(host.querySelector('li')!);
        expect(h.highlight).toHaveBeenCalledOnce();
        expect(h.toVerseBibleItem).not.toHaveBeenCalled();
        expect(h.openVerseBibleItem).not.toHaveBeenCalled();
        // A key without a bible key prefix is already the KJV one.
        const verseElement = document.createElement('div');
        verseElement.dataset.kjvVerseKey = 'GEN 22:1';
        const bibleView = document.createElement('div');
        bibleView.className = 'bible-view';
        bibleView.append(verseElement);
        document.body.append(bibleView);
        expect(h.highlight.mock.calls[0][0]()).toBe(verseElement);
    });

    test('a key that names no passage opens nothing', async () => {
        h.toVerseBibleItem.mockReturnValue(null);
        await renderMark(highlight, { straightBibleItems: [] });
        await press(host.querySelector('li')!);
        expect(h.toVerseBibleItem).toHaveBeenCalledWith(VERSE_KEY);
        expect(h.openVerseBibleItem).not.toHaveBeenCalled();
    });

    test('a highlight menu offers every OTHER colour, then Delete', async () => {
        await renderMark(highlight);
        await press(findButton('More Options'));
        // The ⋮ is a menu, never a click on the row behind it.
        expect(h.highlight).not.toHaveBeenCalled();
        const items = lastMenuItems();
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
        expect(items[5].childBefore).toBe('icon:trash3');

        items[2].onSelect();
        expect(h.updateColor).toHaveBeenCalledWith(
            NOTE_FILE_PATH,
            3,
            'h1',
            'pink',
        );
        items[5].onSelect();
        expect(h.removeAnnotation).toHaveBeenCalledWith(
            NOTE_FILE_PATH,
            3,
            'h1',
        );
    });

    test('a comment is underlined, says what was written, and is edited from its menu', async () => {
        await renderMark(comment);
        const words = host.querySelector<HTMLElement>(
            '.app-verse-annotation__text',
        )!;
        expect(words.className).toContain(
            'app-verse-annotation__text--comment',
        );
        expect(words.style.backgroundColor).toBe('');
        expect(
            host.querySelector('.app-verse-annotation__comment')!.textContent,
        ).toBe('Remember this');

        await openRowMenu();
        const items = lastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Edit Comment',
            'Delete',
        ]);
        expect(items[0].childBefore).toBe('icon:pencil-square');
        expect(host.querySelector('[role="dialog"]')).toBeNull();
        await act(async () => items[0].onSelect());
        const editor = host.querySelector<HTMLElement>('[role="dialog"]')!;
        expect(JSON.parse(editor.dataset.target!)).toEqual({
            filePath: NOTE_FILE_PATH,
            noteItemId: 3,
            commentId: 'c1',
            comment: 'Remember this',
            title: VERSE_TITLE,
            verseKey: VERSE_KEY,
        });
        await press(findButton('Close comment editor'));
        expect(host.querySelector('[role="dialog"]')).toBeNull();
    });

    test('an empty comment shows the words alone', async () => {
        await renderMark({ ...comment, comment: '' });
        expect(host.querySelector('.app-verse-annotation__comment')).toBeNull();
        expect(host.textContent).toContain('words');
    });

    test('a menu left open while the mark became a highlight edits nothing', async () => {
        await renderMark(comment);
        await openRowMenu();
        const editComment = lastMenuItems()[0];
        await renderMark(highlight);
        await act(async () => editComment.onSelect());
        expect(host.querySelector('[role="dialog"]')).toBeNull();
    });
});

describe('BibleNoteEditingMenuComp — the note window history menu', () => {
    function genNote(item: unknown = null) {
        return {
            filePath: NOTE_FILE_PATH,
            historyUndo: vi.fn(),
            historyRedo: vi.fn(),
            historyDiscard: vi.fn(),
            saveEditingHistory: vi.fn(),
            reloadEditing: vi.fn(async () => {}),
            getItemById: vi.fn(() => item),
        };
    }

    function renderMenu(note: any, noteItem: any, bibleNote: any) {
        return render(
            <BibleNoteEditingMenuComp
                note={note}
                noteItem={noteItem}
                bibleNote={bibleNote}
            />,
        );
    }

    test('drives the note history, and Ctrl+S saves it', async () => {
        const note = genNote();
        await renderMenu(note, { id: 7, content: 'typed' }, { content: '' });
        expect(host.firstElementChild!.className).toBe(
            'bible-note-editing-menu',
        );
        expect(
            host.querySelector<HTMLElement>('[data-file-path]')!.dataset
                .filePath,
        ).toBe(NOTE_FILE_PATH);
        await press(findButton('Undo Saved Change'));
        await press(findButton('Redo Saved Change'));
        await press(findButton('Discard'));
        await press(findButton('Save'));
        expect(note.historyUndo).toHaveBeenCalledOnce();
        expect(note.historyRedo).toHaveBeenCalledOnce();
        expect(note.historyDiscard).toHaveBeenCalledOnce();
        expect(note.saveEditingHistory).toHaveBeenCalledOnce();
        h.keyHandlers.get(savingEventMapper)!();
        expect(note.saveEditingHistory).toHaveBeenCalledTimes(2);
    });

    test('an Undo puts the head text back in the editor, once per burst', async () => {
        vi.useFakeTimers();
        const note = genNote({ id: 7, content: '  undone text  ' });
        const noteItem = { id: 7, content: 'typed' };
        const bibleNote = { content: 'editor:typed' };
        await renderMenu(note, noteItem, bibleNote);
        expect(h.fileEvent!.events).toEqual(['update']);
        expect(h.fileEvent!.filePath).toBe(NOTE_FILE_PATH);

        // A plain save is no history movement: nothing is reloaded.
        h.fileEvent!.callback({ eventType: 'save' });
        h.fileEvent!.callback(undefined);
        await vi.advanceTimersByTimeAsync(1_000);
        await settle();
        expect(note.reloadEditing).not.toHaveBeenCalled();

        h.fileEvent!.callback({ eventType: 'undo' });
        h.fileEvent!.callback({ eventType: 'redo' });
        await vi.advanceTimersByTimeAsync(299);
        await settle();
        expect(note.reloadEditing).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await settle();
        expect(note.reloadEditing).toHaveBeenCalledOnce();
        expect(note.getItemById).toHaveBeenCalledWith(7);
        // The item the editor compares against moves on with it.
        expect(noteItem.content).toBe('undone text');
        expect(bibleNote.content).toBe('editor:undone text');
    });

    test('leaves the editor alone when the head lost the item or holds the same text', async () => {
        vi.useFakeTimers();
        const note = genNote(null);
        const noteItem = { id: 7, content: 'typed' };
        const bibleNote = { content: 'editor:typed' };
        await renderMenu(note, noteItem, bibleNote);
        h.fileEvent!.callback({ eventType: 'discard' });
        await vi.advanceTimersByTimeAsync(300);
        await settle();
        expect(note.reloadEditing).toHaveBeenCalledOnce();
        expect(bibleNote.content).toBe('editor:typed');

        note.getItemById.mockReturnValue({ id: 7, content: ' typed ' } as any);
        h.fileEvent!.callback({ eventType: 'undo' });
        await vi.advanceTimersByTimeAsync(300);
        await settle();
        expect(note.reloadEditing).toHaveBeenCalledTimes(2);
        expect(noteItem.content).toBe('typed');
        expect(bibleNote.content).toBe('editor:typed');
    });
});

describe('NoteItemEditorPopupComp — footer controls and the lookup popup', () => {
    function genBibleNote() {
        const buttons = new Map<string, any>();
        return {
            buttons,
            prependFooterActionButton: vi.fn((button: { id: string }) => {
                buttons.set(button.id, button);
            }),
            setColorScheme: vi.fn(),
            addText: vi.fn(),
        };
    }
    const note = { filePath: NOTE_FILE_PATH } as any;
    const noteItem = { id: 7, content: 'typed' } as any;

    async function renderPopup(bibleNote: any, isReadOnly = false) {
        await render(
            <NoteItemEditorPopupComp
                bibleNote={bibleNote}
                note={note}
                noteItem={noteItem}
                isReadOnly={isReadOnly}
            />,
        );
        await flush();
    }

    function registeredIds(bibleNote: ReturnType<typeof genBibleNote>) {
        return bibleNote.prependFooterActionButton.mock.calls.map(
            ([button]) => button.id,
        );
    }

    test('an editable window gets Save, the editor links, the lookup, on-top and the key', async () => {
        h.getAllLangs.mockResolvedValue([
            { langCode: 'xx', editorLink: 'https://xx.example/editor' },
            { langCode: 'en' },
        ]);
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote);
        expect(host.innerHTML).toBe('');
        expect(new Set(registeredIds(bibleNote))).toEqual(
            new Set([
                'editing-history',
                'lang-markdown-editor xx',
                'bible-lookup',
                'toggle-on-top',
                'bible-key',
            ]),
        );
        expect(bibleNote.setColorScheme).toHaveBeenCalledWith('dark');

        const saving = bibleNote.buttons.get('editing-history');
        expect(saving.description).toBe('Save');
        // The footer would press its first button, Undo, on the shortcut.
        expect(saving.shortcutKey).toBeUndefined();
        const menu = saving.children as ReactElement<any>;
        expect(menu.type).toBe(BibleNoteEditingMenuComp);
        expect(menu.props).toEqual({ note, noteItem, bibleNote });

        const editorLink = bibleNote.buttons.get('lang-markdown-editor xx');
        expect(editorLink.description).toBe('Open in Markdown Editor (xx)');
        expect(editorLink.shortcutKey).toBe('Ctrl+Shift+Alt+K');
        const footer = await mountFooterChildren(editorLink.children);
        await press(findButton('Open in Markdown Editor (xx)', footer));
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://xx.example/editor',
        );
        expect(bibleNote.buttons.has('lang-markdown-editor en')).toBe(false);
        expect(bibleNote.buttons.get('bible-lookup').shortcutKey).toBe(
            'Ctrl+Shift+B',
        );
    });

    test('a read-only preview gets neither Save nor the lookup', async () => {
        h.theme = 'light';
        h.getAllLangs.mockResolvedValue([
            { langCode: 'xx', editorLink: 'https://xx.example/editor' },
        ]);
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote, true);
        const ids = registeredIds(bibleNote);
        expect(ids).not.toContain('editing-history');
        expect(ids).not.toContain('bible-lookup');
        expect(ids).toEqual(
            expect.arrayContaining([
                'lang-markdown-editor xx',
                'toggle-on-top',
                'bible-key',
            ]),
        );
        expect(bibleNote.setColorScheme).toHaveBeenCalledWith('light');
    });

    test('the on-top toggle flips and says which way it is', async () => {
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote);
        const footer = await mountFooterChildren(
            bibleNote.buttons.get('toggle-on-top').children,
        );
        const toggle = findButton('Toggle Always On Top', footer);
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.querySelector('i')!.className).toBe(
            'bi bi-window-desktop',
        );
        await press(toggle);
        const pressed = await mountFooterChildren(
            bibleNote.buttons.get('toggle-on-top').children,
        );
        const pressedToggle = findButton('Toggle Always On Top', pressed);
        expect(pressedToggle.getAttribute('aria-pressed')).toBe('true');
        const icon = pressedToggle.querySelector('i')!;
        expect(icon.className).toBe('bi bi-window-stack');
        expect(icon.style.color).toBe('green');
    });

    test('the Bible key control picks another version and shows it in its own face', async () => {
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote);
        expect(h.settingNames).toContain('bible-note-bible-key');
        const footer = await mountFooterChildren(
            bibleNote.buttons.get('bible-key').children,
        );
        const keyButton = findButton('Change Bible Key', footer);
        expect(keyButton.textContent).toBe('KJV');
        expect(keyButton.querySelector('span')!.style.fontFamily).toBe(
            'Font KJV',
        );
        await press(keyButton);
        expect(h.showBibleKeyOption).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Function),
            ['KJV'],
        );
        await act(async () => h.showBibleKeyOption.mock.calls[0][1]('NIV'));
        const changed = await mountFooterChildren(
            bibleNote.buttons.get('bible-key').children,
        );
        const changedButton = findButton('Change Bible Key', changed);
        expect(changedButton.textContent).toBe('NIV');
        expect(changedButton.querySelector('span')!.style.fontFamily).toBe(
            'Font NIV',
        );
    });

    test('the lookup opens from the footer and inserts the passage collapsed or as text', async () => {
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote);
        const footer = await mountFooterChildren(
            bibleNote.buttons.get('bible-lookup').children,
        );
        await press(findButton('Open Bible Lookup', footer));
        expect(host.textContent).toContain('Bible Lookup');
        const lookup = host.querySelector<HTMLElement>('[data-lookup-kind]')!;
        expect(lookup.dataset.lookupKind).toBe('bible-note');
        expect(lookup.dataset.minimized).toBe('true');

        const collapsed = findButton('Insert Collapse Bible Text');
        expect(collapsed.title).toBe('Insert Collapse Bible Text [Ctrl+Enter]');
        const asText = findButton('Insert Bible Text');
        expect(asText.title).toBe('Insert Bible Text [Ctrl+Shift+Enter]');

        // Nothing chosen in the lookup: nothing is written, not even the `^`.
        await press(collapsed);
        await press(asText);
        await run(() => h.keyHandlers.get(ctrlShiftEnterEventMapper)!());
        expect(bibleNote.addText).not.toHaveBeenCalled();

        h.editingResult = {
            result: { bibleItem: { toFullText: async () => 'John 3:16 text' } },
        };
        await press(collapsed);
        expect(bibleNote.addText.mock.calls).toEqual([['John 3:16 text']]);
        await press(asText);
        expect(bibleNote.addText.mock.calls.slice(1)).toEqual([
            ['^'],
            ['John 3:16 text'],
        ]);
        bibleNote.addText.mockClear();
        await run(() => h.keyHandlers.get(ctrlEnterEventMapper)!());
        await run(() => h.keyHandlers.get(ctrlShiftEnterEventMapper)!());
        expect(bibleNote.addText.mock.calls).toEqual([
            ['John 3:16 text'],
            ['^'],
            ['John 3:16 text'],
        ]);

        await press(findButton('Close widget'));
        expect(host.innerHTML).toBe('');
    });

    test('a note turned read-only closes the lookup it can no longer insert into', async () => {
        const bibleNote = genBibleNote();
        await renderPopup(bibleNote);
        const footer = await mountFooterChildren(
            bibleNote.buttons.get('bible-lookup').children,
        );
        await press(findButton('Open Bible Lookup', footer));
        expect(host.querySelector('[data-lookup-kind]')).not.toBeNull();
        await renderPopup(bibleNote, true);
        expect(host.innerHTML).toBe('');
    });
});

describe('BibleNoteListComp — the Bible Notes file list', () => {
    test('renders nothing until the notes folder is known', async () => {
        await render(<BibleNoteListComp />);
        expect(h.dirSourceSettingNames).toEqual(['select-dir-bible-notes']);
        expect(host.innerHTML).toBe('');
        expect(h.getDefaultNote).not.toHaveBeenCalled();
    });

    test('lists every note file and makes sure the default one exists', async () => {
        const dirSource = { dirPath: '/notes' };
        h.dirSource = dirSource;
        await render(<BibleNoteListComp />);
        expect(h.getDefaultNote).toHaveBeenCalledOnce();
        const props = h.fileListProps;
        expect(props).toMatchObject({
            className: 'note-list app-cue-list',
            mimetypeName: 'note',
            defaultFolderName: 'bible-notes',
            userClassName: 'p-0',
        });
        expect(props.dirSource).toBe(dirSource);
        expect(props.sortFilePaths).toBe(h.sortNoteFilePaths);
        expect(host.textContent).toContain('label:Bible Notes');
        const rows = [
            ...host.querySelectorAll<HTMLElement>('[data-note-file]'),
        ];
        expect(
            rows.map((row) => [row.dataset.noteFile, row.textContent]),
        ).toEqual([
            ['/notes/a.own', '0'],
            ['/notes/b.own', '1'],
        ]);
    });

    test('a new file reports failure when nothing was created', async () => {
        h.dirSource = { dirPath: '/notes' };
        await render(<BibleNoteListComp />);
        h.createNote.mockResolvedValueOnce({ filePath: '/notes/Sermon.own' });
        expect(await h.fileListProps.onNewFile('/notes', 'Sermon')).toBe(false);
        h.createNote.mockResolvedValueOnce(null);
        expect(await h.fileListProps.onNewFile('/notes', 'Sermon')).toBe(true);
        expect(h.createNote).toHaveBeenCalledWith('/notes', 'Sermon');
    });

    test('the list menu imports a whole note file, picked or from a URL', async () => {
        h.dirSource = { dirPath: '/notes' };
        await render(<BibleNoteListComp />);
        const items = h.fileListProps.genContextMenuItems();
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Import',
            'Import From URL',
        ]);
        expect(items.map((item: any) => item.childBefore)).toEqual([
            'icon:box-arrow-in-down',
            'icon:cloud-download',
        ]);
        items[0].onSelect();
        expect(h.selectAndImport).toHaveBeenCalledOnce();
        expect(h.askAndImport).not.toHaveBeenCalled();
        items[1].onSelect();
        expect(h.askAndImport).toHaveBeenCalledOnce();
    });

    test('a dropped bundle is imported and any other file falls through', async () => {
        h.dirSource = { dirPath: '/notes' };
        await render(<BibleNoteListComp />);
        const { takeDroppedFile } = h.fileListProps;
        const bundle = '/downloads/Sunday.owanote.tar.gz';
        expect(takeDroppedFile(bundle)).toBe(true);
        expect(h.importDropped).toHaveBeenCalledWith(bundle);
        expect(takeDroppedFile('/downloads/Sunday.own')).toBe(false);
        expect(takeDroppedFile({})).toBe(false);
        expect(h.importDropped).toHaveBeenCalledOnce();
    });
});

describe('RenderNoteItemsComp — one row kind per item kind', () => {
    test('a verse item gets the verse row, every other item the note row', async () => {
        const note = {
            filePath: NOTE_FILE_PATH,
            items: [
                { id: 1, title: 'Prayer', isVerseItem: false },
                { id: 2, title: 'Genesis 22:1', isVerseItem: true },
                { id: 3, title: 'Sermon', isVerseItem: false },
            ],
        };
        await render(<RenderNoteItemsComp note={note as any} />);
        const rows = [...host.querySelectorAll<HTMLElement>('ul > li')];
        expect(
            rows.map((row) => [
                row.dataset.kind,
                row.dataset.index,
                row.dataset.file,
                row.textContent,
            ]),
        ).toEqual([
            ['note', '0', NOTE_FILE_PATH, `Prayer|${NOTE_FILE_PATH}`],
            ['verse', '1', NOTE_FILE_PATH, `Genesis 22:1|${NOTE_FILE_PATH}`],
            ['note', '2', NOTE_FILE_PATH, `Sermon|${NOTE_FILE_PATH}`],
        ]);
    });
});
