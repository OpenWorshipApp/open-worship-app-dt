import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import type AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import {
    useAppCurrentRef,
    useAppEffect,
    useAppEffectAsync,
} from '../../helper/appHooks';
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
    const [store, setStore] = useState(
        new AppDocumentNoteStore(appDocument, ''),
    );
    // `setData` goes through the method context so a document swap mid-read
    // neuters this write instead of letting the old document's note land.
    useAppEffectAsync(
        async (methodContext) => {
            const note = await appDocument.getNote();
            const newStore = new AppDocumentNoteStore(appDocument, note);
            newStore.save = async () => {
                if (newStore.checkCanSave()) {
                    await appDocument.setNote(newStore.currentText);
                }
                return true;
            };
            methodContext.setData(newStore);
        },
        [appDocument],
        { setData: setStore },
    );
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);

    // The closure below holds the document as it was when the event FIRED; this
    // ref holds it as it is when the read resolves. They differ only when the
    // editor was re-fed mid-read, which is what the guard checks.
    const appDocumentRef = useAppCurrentRef(appDocument);
    useFileSourceEvents(
        ['update'],
        async () => {
            const newNote = await appDocument.getNote();
            // This editor is re-fed a different document IN PLACE (its widget
            // key is static), so without this the old document's note would
            // replace the store just built for the new one — and the unmount
            // `save()` would then write it into the wrong file.
            if (appDocument !== appDocumentRef.current) {
                return;
            }
            if (newNote === store.currentText) {
                return;
            }
            setStore(new AppDocumentNoteStore(appDocument, newNote));
        },
        [appDocument, store],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title={tran('Document Note')} />;
}
