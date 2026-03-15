import { useState } from 'react';

import type AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import NoteEditorRenderComp from '../../others/NoteEditorRenderComp';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

class AppDocumentNoteStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    save: () => Promise<void>;
    appDocument: AppDocument;
    constructor(appDocument: AppDocument, note: string) {
        this.defaultText = note;
        this.currentText = note;
        this.save = async () => {};
        this.appDocument = appDocument;
    }
}

export default function AppDocumentNoteEditorComp({
    appDocument,
}: Readonly<{ appDocument: AppDocument }>) {
    const [store, setStore] = useState<SimpleNoteEditorStoreType>(
        new AppDocumentNoteStore(appDocument, ''),
    );
    useAppEffectAsync(async () => {
        const note = await appDocument.getNote();
        const newStore = new AppDocumentNoteStore(appDocument, note);
        newStore.save = async () => {
            if (newStore.currentText === newStore.defaultText) {
                return;
            }
            await appDocument.setNote(newStore.currentText);
        };
        setStore(newStore);
    }, [appDocument]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);

    useFileSourceEvents(
        ['update'],
        async () => {
            const newNote = await appDocument.getNote();
            if (newNote === store.currentText) {
                return;
            }
            setStore(new AppDocumentNoteStore(appDocument, newNote));
        },
        [appDocument, store],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title="Document Note" />;
}
