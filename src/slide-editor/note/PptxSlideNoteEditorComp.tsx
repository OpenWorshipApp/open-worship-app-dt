import { useMemo } from 'react';

import { type SimpleNoteEditorStoreType } from '../../others/SimpleNoteEditorComp';
import NoteEditorRenderComp from '../../others/NoteEditorRenderComp';
import type PptxSlide from '../../app-document-list/PptxSlide';

class PptxSlideNoteStore implements SimpleNoteEditorStoreType {
    readonly defaultText: string;
    currentText: string;
    checkCanSave() {
        return this.currentText !== this.defaultText;
    }
    constructor(pptxSlide: PptxSlide) {
        this.defaultText = pptxSlide.note ?? '';
        this.currentText = pptxSlide.note ?? '';
    }
}

export default function PptxSlideNoteEditorComp({
    pptxSlide,
    title = 'Slide Note',
}: Readonly<{
    pptxSlide: PptxSlide;
    title: string;
}>) {
    const store = useMemo(() => new PptxSlideNoteStore(pptxSlide), [pptxSlide]);
    const uuid = `slide-note-editor-${pptxSlide.uuid}`;
    return <NoteEditorRenderComp store={store} title={title} uuid={uuid} />;
}
