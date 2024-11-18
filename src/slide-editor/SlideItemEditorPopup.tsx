import './SlideItemEditorPopup.scss';

import {
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import SlideItemEditorPopupHeader from './SlideItemEditorPopupHeader';
import SlideItem from '../slide-list/SlideItem';
import SlideItemEditor from './SlideItemEditor';
import {
    closeSlideItemQuickEdit,
} from '../slide-presenter/HandleItemSlideEdit';
import CanvasController from './canvas/CanvasController';
import { useModal } from '../app-modal/Modal';

export default function SlideItemEditorPopup({ slideItem }: Readonly<{
    slideItem: SlideItem
}>) {
    const { Modal } = useModal();
    useKeyboardRegistering([{ key: 'Escape' }], closeSlideItemQuickEdit);
    CanvasController.getInstance().init(slideItem);
    return (
        <Modal>
            <div id='slide-item-editor-popup'
                className='app-modal shadow card'>
                <SlideItemEditorPopupHeader />
                <div className='body card-body w-100 overflow-hidden'>
                    <SlideItemEditor slideItem={slideItem} />
                </div>
            </div>
        </Modal>
    );
}
