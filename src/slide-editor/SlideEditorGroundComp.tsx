import './SlideEditorPreviewerComp.scss';
import './canvas/SlideEditorCanvasComp.scss';

import { use } from 'react';

import SlideEditorComp from './SlideEditorComp';
import AppErrorBoundaryComp from '../others/AppErrorBoundaryComp';
import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';
import SlidesMenuComp from '../app-document-presenter/items/SlidesMenuComp';
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

/**
 * The editor with no slide to edit -- most often because the last one was just
 * deleted. The Undo / Redo / Discard / Save row lives in the canvas footer, so
 * it used to go with the canvas, and a document that had just lost every slide
 * was left dirty with nothing on screen to undo or save it.
 */
function RenderNoSlideComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    const selectedVaryAppDocument =
        selectedAppDocumentContext?.selectedVaryAppDocument ?? null;
    const editableDocument =
        AppDocument.checkIsThisType(selectedVaryAppDocument) &&
        selectedVaryAppDocument.isEditable
            ? selectedVaryAppDocument
            : null;
    return (
        <div className="card w-100 h-100">
            <div className="card-body d-flex justify-content-center align-items-center">
                <span className="text-muted">{tran('No slide selected')}</span>
            </div>
            {editableDocument === null ? null : (
                <div className="card-footer w-100 m-0 p-0">
                    <div className="slide-editor-canvas-footer w-100 d-flex">
                        <VaryAppDocumentContext value={editableDocument}>
                            <SlidesMenuComp />
                        </VaryAppDocumentContext>
                    </div>
                </div>
            )}
        </div>
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
        return <RenderNoSlideComp />;
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
