import { ModalCloseButton } from '../app-modal/ModalComp';
import { tran } from '../lang/langHelpers';
import { closeSlideQuickEdit } from '../app-document-presenter/SlideEditHandlerComp';

export default function SlideEditorPopupHeaderComp() {
    return (
        <div className="card-header text-center w-100 app-overflow-hidden">
            <span>
                <i className="bi bi-pencil-square" />
                {tran('Slide Quick Edit')}
            </span>
            <ModalCloseButton close={closeSlideQuickEdit} />
        </div>
    );
}
