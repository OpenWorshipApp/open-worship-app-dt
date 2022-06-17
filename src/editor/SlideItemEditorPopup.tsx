import './SlideItemEditorPopup.scss';

import { KeyEnum, useKeyboardRegistering } from '../event/KeyboardEventListener';
import HeaderEditorPopup from './HeaderEditorPopup';
import { StateEnum, WindowEnum, windowEventListener } from '../event/WindowEventListener';
import Modal from '../others/Modal';
import { editorMapper } from './EditorBoxMapper';
import SlideItem from '../slide-presenting/SlideItem';
import SlideItemThumbEditorController from './SlideItemThumbEditorController';

export const openItemSlideEditEvent = {
    window: WindowEnum.ItemSlideEdit,
    state: StateEnum.Open,
};
export const closeItemSlideEditEvent = {
    window: WindowEnum.ItemSlideEdit,
    state: StateEnum.Close,
};
export function openItemSlideEdit(slideItemThumb: SlideItem) {
    windowEventListener.fireEvent(openItemSlideEditEvent, slideItemThumb);
}
export function closeItemSlideEdit() {
    const close = () => {
        windowEventListener.fireEvent(closeItemSlideEditEvent);
    };
    editorMapper.stopAllModes().then(close);
}

export default function SlideItemEditorPopup({ slideItemThumb }: {
    slideItemThumb: SlideItem
}) {
    useKeyboardRegistering({
        key: KeyEnum.Escape,
    }, closeItemSlideEdit);
    return (
        <Modal>
            <div id="slide-item-editor-popup"
                className="app-modal shadow card">
                <HeaderEditorPopup />
                <div className="body card-body w-100">
                    <SlideItemThumbEditorController
                        slideItemThumb={slideItemThumb} />
                </div>
            </div>
        </Modal>
    );
}
