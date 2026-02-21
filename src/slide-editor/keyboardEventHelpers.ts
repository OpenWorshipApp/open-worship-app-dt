import AppDocument from '../app-document-list/AppDocument';
import { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import Slide from '../app-document-list/Slide';
import {
    checkIsControlKeys,
    checkIsKeyboardEventMatch,
} from '../event/KeyboardEventListener';

export async function onSlideItemsKeyboardEvent(
    {
        holdingSlides,
        setHoldingSlides,
        varyAppDocument,
    }: {
        holdingSlides: Slide[];
        setHoldingSlides: (holdingSlides: Slide[]) => void;
        varyAppDocument: VaryAppDocumentType | null;
    },
    event: any,
) {
    if (!AppDocument.checkIsThisType(varyAppDocument)) {
        return;
    }
    let isHandled = false;
    if (event.type === 'blur') {
        setHoldingSlides([]);
        isHandled = true;
    } else if (event.type === 'keydown') {
        if (checkIsControlKeys(event)) {
            return;
        }
        if (
            checkIsKeyboardEventMatch([{ key: 'Escape' }], event) &&
            holdingSlides.length > 0
        ) {
            setHoldingSlides([]);
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch([{ key: 'Delete' }], event) &&
            holdingSlides.length > 0
        ) {
            await varyAppDocument.deleteSlides(holdingSlides);
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta'],
                        key: 'a',
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                    },
                ],
                event,
            )
        ) {
            const slides = await varyAppDocument.getSlides();
            setHoldingSlides(slides);
            isHandled = true;
        }
    }
    // TODO: on copy
    // TODO: on paste
    if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
    }
}
