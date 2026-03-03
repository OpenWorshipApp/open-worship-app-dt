import { useMemo, useState } from 'react';

import Slide from '../../app-document-list/Slide';
import AppDocument from '../../app-document-list/AppDocument';
import { DocumentNoteStoreType } from '../canvas/SimpleNoteEditorComp';
import { useAppEffect } from '../../helper/debuggerHelpers';
import NoteEditorRenderComp from './NoteEditorRenderComp';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

class SlideNoteStore implements DocumentNoteStoreType {
    readonly defaultText: string;
    currentText: string;
    save: () => Promise<void>;
    constructor(appDocument: AppDocument, slide: Slide) {
        this.defaultText = slide.note;
        this.currentText = slide.note;
        this.save = async () => {
            if (this.currentText === this.defaultText) {
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
    const [store, setStore] = useState<DocumentNoteStoreType>(
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
    const uuid = useMemo(() => {
        return `slide-note-editor-${slide.uuid}`;
    }, [slide]);

    useFileSourceEvents(
        ['update'],
        async () => {
            const newSlide = await appDocument.getItemById(slide.id);
            if (newSlide === null) {
                return;
            }
            if (newSlide.note !== store.currentText) {
                setStore(new SlideNoteStore(appDocument, newSlide));
            }
        },
        [appDocument, slide],
        appDocument.filePath,
    );

    return <NoteEditorRenderComp store={store} title={title} uuid={uuid} />;
}
