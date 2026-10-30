// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    menuProps: null as any,
    keyboard: null as null | { mappers: unknown[]; handler: () => void },
    fileSource: null as null | {
        events: string[];
        callback: (data: any) => void;
        filePath?: string;
    },
    savingEventMapper: { key: 's', allControlKey: ['Ctrl'] },
}));

vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    checkIsHistoryMovementEventType: (eventType: unknown) =>
        ['undo', 'redo', 'discard'].includes(eventType as string),
}));
vi.mock('../../editing-manager/editingHelpers', () => ({
    savingEventMapper: h.savingEventMapper,
    FileEditingMenuComp: (props: any) => {
        h.menuProps = props;
        return <div className="file-editing-menu" />;
    },
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (mappers: unknown[], handler: () => void) => {
        h.keyboard = { mappers, handler };
    },
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
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: (data: any) => void,
        _deps: unknown[],
        filePath?: string,
    ) => {
        h.fileSource = { events, callback, filePath };
    },
}));
vi.mock('./bibleNoteHelpers', () => ({
    toStoredContent: (content: string) => `stored(${content})`,
    toEditorContent: (content: string) => `editor(${content})`,
}));

import BibleNoteEditingMenuComp from './BibleNoteEditingMenuComp';

let host: HTMLDivElement;
let root: Root;
let note: any;
let noteItem: any;
let bibleNote: any;

function genNote(filePath = '/notes/Sermon.own') {
    return {
        filePath,
        historyUndo: vi.fn(),
        historyRedo: vi.fn(),
        historyDiscard: vi.fn(),
        saveEditingHistory: vi.fn(),
        reloadEditing: vi.fn(async () => {}),
        getItemById: vi.fn(),
    };
}

async function renderMenu() {
    await act(async () => {
        root.render(
            <BibleNoteEditingMenuComp
                note={note}
                noteItem={noteItem}
                bibleNote={bibleNote}
            />,
        );
    });
}

async function fireUpdate(eventType: unknown) {
    await act(async () => {
        h.fileSource!.callback({ eventType });
    });
}

async function passDebounce() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    h.menuProps = null;
    h.keyboard = null;
    h.fileSource = null;
    note = genNote();
    noteItem = { id: 4, content: 'stored(old)' };
    bibleNote = { content: 'editor(stored(old))' };
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

describe('the note window editing menu', () => {
    test('Undo, Redo, Discard and Save go through the note editing history', async () => {
        await renderMenu();
        expect(host.querySelector('.bible-note-editing-menu')).not.toBeNull();
        expect(h.menuProps.undoLabel).toBe('Undo Saved Change');
        expect(h.menuProps.redoLabel).toBe('Redo Saved Change');
        const editable = h.menuProps.editableDocument;
        expect(editable.filePath).toBe('/notes/Sermon.own');
        editable.historyUndo();
        editable.historyRedo();
        editable.historyDiscard();
        editable.save();
        expect(note.historyUndo).toHaveBeenCalledTimes(1);
        expect(note.historyRedo).toHaveBeenCalledTimes(1);
        expect(note.historyDiscard).toHaveBeenCalledTimes(1);
        expect(note.saveEditingHistory).toHaveBeenCalledTimes(1);
    });

    test('Ctrl+S saves the editing history', async () => {
        await renderMenu();
        expect(h.keyboard!.mappers).toEqual([h.savingEventMapper]);
        h.keyboard!.handler();
        expect(note.saveEditingHistory).toHaveBeenCalledTimes(1);
    });

    test('the history menu follows a note swapped in under it', async () => {
        await renderMenu();
        const editable = h.menuProps.editableDocument;
        const oldNote = note;
        note = genNote();
        await renderMenu();
        // Same file, same menu object -- but it acts on the current note.
        expect(h.menuProps.editableDocument).toBe(editable);
        editable.historyUndo();
        expect(note.historyUndo).toHaveBeenCalledTimes(1);
        expect(oldNote.historyUndo).not.toHaveBeenCalled();
    });

    test('an Undo brings the head text back into the editor, without re-saving it', async () => {
        await renderMenu();
        expect(h.fileSource!.events).toEqual(['update']);
        expect(h.fileSource!.filePath).toBe('/notes/Sermon.own');
        note.getItemById.mockReturnValue({ id: 4, content: 'new' });
        await fireUpdate('undo');
        expect(note.reloadEditing).not.toHaveBeenCalled();
        await passDebounce();
        expect(note.reloadEditing).toHaveBeenCalledTimes(1);
        expect(note.getItemById).toHaveBeenCalledWith(4);
        expect(noteItem.content).toBe('stored(new)');
        expect(bibleNote.content).toBe('editor(stored(new))');
    });

    test('quick history moves collapse into one reload', async () => {
        await renderMenu();
        note.getItemById.mockReturnValue({ id: 4, content: 'new' });
        await fireUpdate('undo');
        await fireUpdate('redo');
        await fireUpdate('discard');
        await passDebounce();
        expect(note.reloadEditing).toHaveBeenCalledTimes(1);
    });

    test('an ordinary write is not a history move and reloads nothing', async () => {
        await renderMenu();
        await fireUpdate('update');
        await act(async () => {
            h.fileSource!.callback(undefined);
        });
        await passDebounce();
        expect(note.reloadEditing).not.toHaveBeenCalled();
    });

    test('an item gone from the head, or with the same text, leaves the editor alone', async () => {
        await renderMenu();
        note.getItemById.mockReturnValue(null);
        await fireUpdate('undo');
        await passDebounce();
        expect(note.reloadEditing).toHaveBeenCalledTimes(1);
        expect(noteItem.content).toBe('stored(old)');
        expect(bibleNote.content).toBe('editor(stored(old))');

        // The head already holds what the editor shows.
        note.getItemById.mockReturnValue({ id: 4, content: 'old' });
        bibleNote.content = 'typed meanwhile';
        await fireUpdate('redo');
        await passDebounce();
        expect(note.reloadEditing).toHaveBeenCalledTimes(2);
        expect(bibleNote.content).toBe('typed meanwhile');
    });
});
