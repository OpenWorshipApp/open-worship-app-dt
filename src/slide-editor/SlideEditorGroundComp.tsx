import './SlideEditorPreviewerComp.scss';

import { use } from 'react';

import SlideEditorComp from './SlideEditorComp';
import { SelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';
import { tran } from '../lang/langHelpers';

export default function SlideEditorGroundComp() {
    const selectedSlideContext = use(SelectedEditingSlideContext);
    if (!selectedSlideContext?.selectedSlideEditing) {
        return <div>{tran('No slide selected')}</div>;
    }
    return <SlideEditorComp />;
}
