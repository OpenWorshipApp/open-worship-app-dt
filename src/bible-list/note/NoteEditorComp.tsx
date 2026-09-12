import { type CSSProperties, useMemo, useState } from 'react';

import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from '../../others/SimpleNoteEditorComp';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import type NoteItem from './NoteItem';
import type Note from './Note';
import { tran } from '../../lang/langHelpers';

class NoteTitleStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<boolean>;
    constructor(note: Note, noteItem: NoteItem) {
        this.defaultText = noteItem.title;
        this.currentText = noteItem.title;
        this.save = async () => {
            if (!this.checkCanSave()) {
                return true;
            }
            noteItem.title = this.currentText;
            return await note.updateAndSaveNoteItem(noteItem, true);
        };
    }
}

export function NoteTitleEditorComp({
    note,
    noteItem,
    onEscape,
    onBlur,
    onEnter,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
    title?: string;
    onEscape?: () => void;
    onBlur?: () => void;
    onEnter?: () => void;
}>) {
    const [store, setStore] = useState(new NoteTitleStore(note, noteItem));
    useAppEffect(() => {
        setStore(new NoteTitleStore(note, noteItem));
    }, [note, noteItem]);
    useAppEffect(() => {
        return () => {
            store.save?.();
        };
    }, [store]);

    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    // The closure below holds the item as it was when the event FIRED; these
    // refs hold it as it is when the reload resolves. They differ only when the
    // editor was re-fed mid-reload, which is what the guard checks.
    const noteRef = useAppCurrentRef(note);
    const noteItemRef = useAppCurrentRef(noteItem);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(async () => {
                await note.reload();
                const newNoteItem = note.getItemById(noteItem.id);
                // Re-fed a different item mid-reload, this text belongs to the
                // PREVIOUS one; applying it would show it under the new item's
                // heading and the unmount `save()` would write it back there.
                // The re-feed rebuilds the store from the new item anyway, so
                // dropping this refresh costs nothing but a stale read.
                if (
                    note !== noteRef.current ||
                    noteItem !== noteItemRef.current
                ) {
                    return;
                }
                if (
                    newNoteItem === null ||
                    newNoteItem.content === store.currentText
                ) {
                    return;
                }
                setStore(new NoteTitleStore(note, newNoteItem));
            });
        },
        [note, noteItem, store],
        note.filePath,
    );

    return (
        <div
            className="w-100 app-overflow-hidden"
            style={{
                maxHeight: '30px',
            }}
        >
            <SimpleNoteEditorComp
                store={store}
                placeholder={tran('Enter your note here') + '...'}
                isResizable
                isInput
                onEscape={onEscape}
                onBlur={onBlur}
                onEnter={onEnter}
            />
        </div>
    );
}

class NoteContentStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<boolean>;
    constructor(note: Note, noteItem: NoteItem) {
        this.defaultText = noteItem.content;
        this.currentText = noteItem.content;
        this.save = async () => {
            if (!this.checkCanSave()) {
                return true;
            }
            noteItem.content = this.currentText;
            return await note.updateAndSaveNoteItem(noteItem, true);
        };
    }
}

export default function NoteEditorComp({
    note,
    noteItem,
    extraStyle,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
    title?: string;
    extraStyle?: CSSProperties;
}>) {
    const [store, setStore] = useState(new NoteContentStore(note, noteItem));
    useAppEffect(() => {
        setStore(new NoteContentStore(note, noteItem));
    }, [note, noteItem]);
    useAppEffect(() => {
        return () => {
            store.save?.();
        };
    }, [store]);

    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    // The closure below holds the item as it was when the event FIRED; these
    // refs hold it as it is when the reload resolves. They differ only when the
    // editor was re-fed mid-reload, which is what the guard checks.
    const noteRef = useAppCurrentRef(note);
    const noteItemRef = useAppCurrentRef(noteItem);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(async () => {
                await note.reload();
                const newNoteItem = note.getItemById(noteItem.id);
                // Re-fed a different item mid-reload, this text belongs to the
                // PREVIOUS one; applying it would show it under the new item's
                // heading and the unmount `save()` would write it back there.
                // The re-feed rebuilds the store from the new item anyway, so
                // dropping this refresh costs nothing but a stale read.
                if (
                    note !== noteRef.current ||
                    noteItem !== noteItemRef.current
                ) {
                    return;
                }
                if (
                    newNoteItem === null ||
                    newNoteItem.content === store.currentText
                ) {
                    return;
                }
                setStore(new NoteContentStore(note, newNoteItem));
            });
        },
        [note, noteItem, store],
        note.filePath,
    );

    return (
        <div
            className="w-100 app-overflow-hidden"
            style={{
                height: '200px',
                ...extraStyle,
            }}
        >
            <SimpleNoteEditorComp
                store={store}
                placeholder={tran('Enter your note here') + '...'}
                isResizable
            />
        </div>
    );
}
