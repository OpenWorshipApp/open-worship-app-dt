import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import NoteEditorRenderComp from '../../others/NoteEditorRenderComp';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import {
    type VaryAppDocumentType,
    type VarySlideWithNoteType,
} from '../../app-document-list/appDocumentTypeHelpers';
import type Slide from '../../app-document-list/Slide';

class VarySlideNoteStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<boolean>;
    constructor(
        appDocument: VaryAppDocumentType,
        varySlide: VarySlideWithNoteType,
    ) {
        this.defaultText = varySlide.note ?? '';
        this.currentText = varySlide.note ?? '';
        if (AppDocument.checkIsThisType(appDocument)) {
            this.save = async () => {
                if (this.checkCanSave()) {
                    const slide = varySlide as Slide;
                    slide.note = this.currentText;
                    await appDocument.updateSlide(slide);
                }
                return true;
            };
        } else {
            this.save = () => {
                return Promise.resolve(true);
            };
        }
    }
}

export default function VarySlideNoteEditorComp({
    appDocument,
    slide,
    title = tran('Slide Note'),
}: Readonly<{
    appDocument: AppDocument;
    slide: VarySlideWithNoteType;
    title?: string;
}>) {
    const [store, setStore] = useState(
        new VarySlideNoteStore(appDocument, slide),
    );
    useAppEffect(() => {
        setStore(new VarySlideNoteStore(appDocument, slide));
    }, [appDocument, slide]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);
    const uuid = `slide-note-editor-${slide.uuid}`;

    // The closure below holds the slide as it was when the event FIRED; these
    // refs hold the slide as it is when the read resolves. They differ only
    // when the editor was re-fed mid-read, which is what the guard checks.
    const appDocumentRef = useAppCurrentRef(appDocument);
    const slideRef = useAppCurrentRef(slide);
    useFileSourceEvents(
        ['update'],
        async () => {
            const newSlide = await appDocument.getItemById(slide.id);
            // This editor is re-fed a different slide IN PLACE (its widget key
            // is static), so without this the old slide's note would replace
            // the store just built for the new one — and the unmount `save()`
            // would then write it into the wrong slide.
            if (
                appDocument !== appDocumentRef.current ||
                slide !== slideRef.current
            ) {
                return;
            }
            if (newSlide === null || newSlide.note === store.currentText) {
                return;
            }
            setStore(new VarySlideNoteStore(appDocument, newSlide));
        },
        [appDocument, slide, store],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title={title} uuid={uuid} />;
}
