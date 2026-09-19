import './SlideEditorPreviewerComp.scss';

import { use } from 'react';

import SlideEditorComp from './SlideEditorComp';
import AppErrorBoundaryComp from '../others/AppErrorBoundaryComp';
import { SelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';
import AppDocument from '../app-document-list/AppDocument';
import type Slide from '../app-document-list/Slide';
import FileSource from '../helper/FileSource';
import { getMimetypeExtensions } from '../server/fileHelpers';
import { tran } from '../lang/langHelpers';

// The very test `AppDocument.getInstance` makes, asked BEFORE it is made. A
// slide of a document this editor cannot open -- a song's, left behind as the
// editing slide -- used to reach `SlideEditorComp`, whose first act is that
// `getInstance`, and throw into the error boundary below.
function checkIsEditableSlide(slide: Slide) {
    const extensions = getMimetypeExtensions(AppDocument.mimetypeName);
    return extensions.includes(
        FileSource.getInstance(slide.filePath).extension,
    );
}

export default function SlideEditorGroundComp() {
    const selectedSlideContext = use(SelectedEditingSlideContext);
    const selectedSlideEditing =
        selectedSlideContext?.selectedSlideEditing ?? null;
    if (
        selectedSlideEditing === null ||
        !checkIsEditableSlide(selectedSlideEditing)
    ) {
        return <div>{tran('No slide selected')}</div>;
    }
    // Bounded: a throw in here (a document whose extension does not match what
    // this editor can open is one way) used to unmount the whole window, header
    // included, leaving nothing to navigate away with.
    return (
        <AppErrorBoundaryComp>
            <SlideEditorComp />
        </AppErrorBoundaryComp>
    );
}
