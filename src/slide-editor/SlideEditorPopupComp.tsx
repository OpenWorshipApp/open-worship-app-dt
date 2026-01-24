import './SlideEditorPopupComp.scss';

import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import SlideEditorPopupHeaderComp from './SlideEditorPopupHeaderComp';
import type Slide from '../app-document-list/Slide';
import SlideEditorComp from './SlideEditorComp';
import { closeSlideQuickEdit } from '../app-document-presenter/SlideEditHandlerComp';
import { ModalComp } from '../app-modal/ModalComp';
import { SelectedEditingSlideContext } from '../app-document-list/appDocumentHelpers';

export default function SlideEditorPopupComp({
    slide,
}: Readonly<{
    slide: Slide;
}>) {
    useKeyboardRegistering([{ key: 'Escape' }], closeSlideQuickEdit, []);
    return (
        <ModalComp>
            <div id="slide-editor-popup" className="shadow card">
                <SlideEditorPopupHeaderComp />
                <div className="body card-body w-100 app-overflow-hidden">
                    <SelectedEditingSlideContext
                        value={{
                            selectedSlide: slide,
                            setSelectedDocument: () => {},
                        }}
                    >
                        <SlideEditorComp />
                    </SelectedEditingSlideContext>
                </div>
            </div>
        </ModalComp>
    );
}
