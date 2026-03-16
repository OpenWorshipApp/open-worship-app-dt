import { useState } from 'react';

import type Slide from '../../app-document-list/Slide';
import type AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import { useAppEffect } from '../../helper/debuggerHelpers';
import NoteEditorRenderComp from '../../others/NoteEditorRenderComp';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

class SlideNoteStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    save: () => Promise<void>;
    constructor(appDocument: AppDocument, slide: Slide) {
        this.defaultText = slide.note;
        this.currentText = slide.note;
        this.save = async () => {
            if (!this.checkCanSave()) {
                return;
            }
            slide.note = this.currentText;
            return appDocument.updateSlide(slide);
        };
    }
}

export default function SlideNoteEditorComp({
    appDocument,
    slide,
    title = 'Slide Note',
}: Readonly<{ appDocument: AppDocument; slide: Slide; title?: string }>) {
    const [store, setStore] = useState<SimpleNoteEditorStoreType>(
        new SlideNoteStore(appDocument, slide),
    );
    useAppEffect(() => {
        setStore(new SlideNoteStore(appDocument, slide));
    }, [appDocument, slide]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);
    const uuid = `slide-note-editor-${slide.uuid}`;

    useFileSourceEvents(
        ['update'],
        async () => {
            const newSlide = await appDocument.getItemById(slide.id);
            if (newSlide === null || newSlide.note === store.currentText) {
                return;
            }
            setStore(new SlideNoteStore(appDocument, newSlide));
        },
        [appDocument, slide, store],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title={title} uuid={uuid} />;
}
