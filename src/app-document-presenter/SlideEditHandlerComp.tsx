import { lazy, useState } from 'react';

import type { EventMapper as WEventMapper } from '../event/WindowEventListener';
import WindowEventListener, {
    useWindowEvent,
} from '../event/WindowEventListener';
import type Slide from '../app-document-list/Slide';
import AppSuspenseComp from '../others/AppSuspenseComp';

const LazySlideEditorPopupComp = lazy(() => {
    return import('../slide-editor/SlideEditorPopupComp');
});

export const openItemSlideEditEvent: WEventMapper = {
    widget: 'slide-edit',
    state: 'open',
};
export const closeItemSlideEditEvent: WEventMapper = {
    widget: 'slide-edit',
    state: 'close',
};
export function openSlideQuickEdit(slide: Slide) {
    WindowEventListener.fireEvent(openItemSlideEditEvent, slide);
}
export function closeSlideQuickEdit() {
    WindowEventListener.fireEvent(closeItemSlideEditEvent);
}

export default function SlideEditHandlerComp() {
    const [slide, setSlide] = useState<Slide | null>(null);
    useWindowEvent(openItemSlideEditEvent, (item: Slide | null) => {
        return setSlide(item);
    });
    useWindowEvent(closeItemSlideEditEvent, () => {
        setSlide(null);
    });
    if (slide === null) {
        return null;
    }
    return (
        <AppSuspenseComp>
            <LazySlideEditorPopupComp slide={slide} />
        </AppSuspenseComp>
    );
}
