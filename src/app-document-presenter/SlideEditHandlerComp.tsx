import { lazy, useState } from 'react';

import type { WindowEventMapperType as WEventMapper } from '../event/WindowEventListener';
import WindowEventListener, {
    useWindowEvent,
} from '../event/WindowEventListener';
import type Slide from '../app-document-list/Slide';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppEffect } from '../helper/appHooks';
import FileSource from '../helper/FileSource';
import AppDocument from '../app-document-list/AppDocument';
import { checkIsHistoryMovementEventType } from '../editing-manager/EditingHistoryManager';
import { checkIsSameValues } from '../helper/helpers';

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
            // Mirror the main document editor (layoutHelpers.handleFileUpdate):
            // refresh on genuine external changes (another window/process saved
            // the file) and on history navigation, but ignore this window's own
            // in-progress history-editing echoes, which would revert live edits.
            const isHistoryNavigation = checkIsHistoryMovementEventType(
                data?.eventType,
            );
            if (data?.isHistoryEditing === true && !isHistoryNavigation) {
                return;
            }
            const appDocument = AppDocument.getInstance(slide.filePath);
            const newSlide = await appDocument.getItemById(slide.id);
            if (newSlide === null) {
                return;
            }
            // Skip redundant refreshes: only reload when the on-disk content
            // actually differs from what the popup currently shows, so a
            // self-save echo doesn't needlessly reload the canvas.
            if (
                !isHistoryNavigation &&
                checkIsSameValues(newSlide.toJson(), slide.toJson())
            ) {
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
