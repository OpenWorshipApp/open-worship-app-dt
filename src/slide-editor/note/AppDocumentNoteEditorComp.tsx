import { useState } from 'react';

import type AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import NoteEditorRenderComp from '../../others/NoteEditorRenderComp';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

class AppDocumentNoteStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<boolean>;
    appDocument: AppDocument;
    constructor(appDocument: AppDocument, note: string) {
        this.defaultText = note;
        this.currentText = note;
        this.save = async () => {
            return true;
        };
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
            if (newStore.checkCanSave()) {
                await appDocument.setNote(newStore.currentText);
            }
            return true;
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
