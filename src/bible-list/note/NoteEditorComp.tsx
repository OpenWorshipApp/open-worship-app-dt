import { type CSSProperties, useState } from 'react';

import SimpleNoteEditorComp, {
    type SimpleNoteEditorStoreType,
} from '../../others/SimpleNoteEditorComp';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import type NoteItem from './NoteItem';
import type Note from './Note';
import { tran } from '../../lang/langHelpers';

class NoteTitleStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<void>;
    constructor(note: Note, noteItem: NoteItem) {
        this.defaultText = noteItem.title;
        this.currentText = noteItem.title;
        this.save = async () => {
            if (!this.checkCanSave()) {
                return;
            }
            noteItem.title = this.currentText;
            return note.updateAndSaveNoteItem(noteItem, true);
        };
    }
}

export function NoteTitleEditorComp({
    note,
    noteItem,
}: Readonly<{ note: Note; noteItem: NoteItem; title?: string }>) {
    const [store, setStore] = useState<SimpleNoteEditorStoreType>(
        new NoteTitleStore(note, noteItem),
    );
    useAppEffect(() => {
        setStore(new NoteTitleStore(note, noteItem));
    }, [note, noteItem]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);

    useFileSourceEvents(
        ['update'],
        async () => {
            await note.reload();
            const newNoteItem = note.getItemById(noteItem.id);
            if (
                newNoteItem === null ||
                newNoteItem.content === store.currentText
            ) {
                return;
            }
            setStore(new NoteTitleStore(note, newNoteItem));
        },
        [note, noteItem, store],
        note.filePath,
    );

    return (
        <div
            className="w-100 app-overflow-hidden"
            style={{
                height: '30px',
            }}
        >
            <SimpleNoteEditorComp
                store={store}
                placeholder={tran('Enter your note here') + '...'}
                isResizable
                isInput
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
    save: () => Promise<void>;
    constructor(note: Note, noteItem: NoteItem) {
        this.defaultText = noteItem.content;
        this.currentText = noteItem.content;
        this.save = async () => {
            if (!this.checkCanSave()) {
                return;
            }
            noteItem.content = this.currentText;
            return note.updateAndSaveNoteItem(noteItem, true);
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
    const [store, setStore] = useState<SimpleNoteEditorStoreType>(
        new NoteContentStore(note, noteItem),
    );
    useAppEffect(() => {
        setStore(new NoteContentStore(note, noteItem));
    }, [note, noteItem]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);

    useFileSourceEvents(
        ['update'],
        async () => {
            await note.reload();
            const newNoteItem = note.getItemById(noteItem.id);
            if (
                newNoteItem === null ||
                newNoteItem.content === store.currentText
            ) {
                return;
            }
            setStore(new NoteContentStore(note, newNoteItem));
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
