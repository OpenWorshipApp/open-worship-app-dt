import { useState } from 'react';

import AppDocument from '../../app-document-list/AppDocument';
import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import { useAppEffect } from '../../helper/appHooks';
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
    title = 'Slide Note',
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

    useFileSourceEvents(
        ['update'],
        async () => {
            const newSlide = await appDocument.getItemById(slide.id);
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
