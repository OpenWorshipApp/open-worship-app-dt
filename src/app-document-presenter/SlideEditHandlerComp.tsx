import { lazy, useState } from 'react';

import type { EventMapper as WEventMapper } from '../event/WindowEventListener';
import WindowEventListener, {
    useWindowEvent,
} from '../event/WindowEventListener';
import type Slide from '../app-document-list/Slide';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppEffect } from '../helper/debuggerHelpers';
import FileSource from '../helper/FileSource';
import AppDocument from '../app-document-list/AppDocument';

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
    useAppEffect(() => {
        if (slide === null) {
            return;
        }
        const callback = async (data: any) => {
            if (!['undo', 'redo'].includes(data?.eventType)) {
                return;
            }
            const appDocument = AppDocument.getInstance(slide.filePath);
            const newSlide = await appDocument.getItemById(slide.id);
            if (newSlide === null) {
                return;
            }
            setSlide(newSlide);
        };
        const staticEvents = FileSource.registerFileSourceEventListener(
            ['update'],
            callback,
            slide.filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [slide]);
    useWindowEvent(openItemSlideEditEvent, (newSlide: Slide | null) => {
        return setSlide(newSlide);
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
