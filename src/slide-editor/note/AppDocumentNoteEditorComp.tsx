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

// A store for a note READ from the document, so its save writes back. Only
// the placeholder shown before the first read keeps the do-nothing save: the
// store rebuilt for a change on disk had it too, and what was typed after
// that change was never written (2026-11-03).
function genReadNoteStore(appDocument: AppDocument, note: string) {
    const store = new AppDocumentNoteStore(appDocument, note);
    store.save = async () => {
        if (store.checkCanSave()) {
            await appDocument.setNote(store.currentText);
        }
        return true;
    };
    return store;
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
            methodContext.setData(genReadNoteStore(appDocument, note));
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
            setStore(genReadNoteStore(appDocument, newNote));
        },
        [appDocument, store],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title={tran('Document Note')} />;
}
