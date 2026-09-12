import './SlideEditorPreviewerComp.scss';

import { use } from 'react';

import SlideEditorComp from './SlideEditorComp';
import AppErrorBoundaryComp from '../others/AppErrorBoundaryComp';
import { SelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';
import { tran } from '../lang/langHelpers';

export default function SlideEditorGroundComp() {
    const selectedSlideContext = use(SelectedEditingSlideContext);
    if (!selectedSlideContext?.selectedSlideEditing) {
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
