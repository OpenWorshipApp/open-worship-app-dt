import { useState } from 'react';

import SimpleNoteEditorComp, {
    DocumentNoteStoreType,
} from '../../others/SimpleNoteEditorComp';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import NoteItem from './NoteItem';
import Note from './Note';
import { tran } from '../../lang/langHelpers';

class NoteStore implements DocumentNoteStoreType {
    readonly defaultText: string;
    currentText: string;
    save: () => Promise<void>;
    constructor(note: Note, noteItem: NoteItem) {
        this.defaultText = noteItem.content;
        this.currentText = noteItem.content;
        this.save = async () => {
            if (this.currentText === this.defaultText) {
                return;
            }
            noteItem.content = this.currentText;
            return note.updateAndSaveNoteItem(noteItem);
        };
    }
}

export default function NoteEditorComp({
    note,
    noteItem,
}: Readonly<{ note: Note; noteItem: NoteItem; title?: string }>) {
    const [store, setStore] = useState<DocumentNoteStoreType>(
        new NoteStore(note, noteItem),
    );
    useAppEffect(() => {
        setStore(new NoteStore(note, noteItem));
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
            setStore(new NoteStore(note, newNoteItem));
        },
        [note, noteItem, store],
        note.filePath,
    );

    return (
        <div
            className="w-100 app-overflow-hidden"
            style={{
                height: '200px',
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
