import AppDocument from '../app-document-list/AppDocument';
import { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import Slide from '../app-document-list/Slide';
import {
    checkIsControlKeys,
    checkIsKeyboardEventMatch,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import Canvas from './canvas/Canvas';
import CanvasController from './canvas/CanvasController';
import CanvasItem from './canvas/CanvasItem';

function handleHistory(appDocument: AppDocument, event: any) {
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    key: 'z',
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                },
            ],
            event,
        )
    ) {
        appDocument.editingHistoryManager.undo();
        return true;
    }
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta', 'Shift'],
                    key: 'z',
                    wControlKey: ['Ctrl', 'Shift'],
                    lControlKey: ['Ctrl', 'Shift'],
                },
                {
                    key: 'y',
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                },
            ],
            event,
        )
    ) {
        appDocument.editingHistoryManager.redo();
        return true;
    }
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    key: 's',
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                },
            ],
            event,
        )
    ) {
        appDocument.editingHistoryManager.save();
        return true;
    }
}

export async function onSlideItemsKeyboardEvent(
    {
        holdingSlides,
        setHoldingSlides,
        varyAppDocument,
        selectedSlide,
    }: {
        holdingSlides: Slide[];
        setHoldingSlides: (holdingSlides: Slide[]) => void;
        varyAppDocument: VaryAppDocumentType | null;
        selectedSlide: Slide | null;
    },
    event: any,
) {
    if (!AppDocument.checkIsThisType(varyAppDocument)) {
        return;
    }
    const appDocument = varyAppDocument;
    let isHandled = false;
    if (event.type === 'blur') {
        setHoldingSlides([]);
        isHandled = true;
    } else if (event.type === 'keydown') {
        if (checkIsControlKeys(event)) {
            return;
        }
        const allSelectedSlides = holdingSlides;
        if (
            selectedSlide !== null &&
            holdingSlides.some((holdingSlide) => {
                return holdingSlide.checkIsSame(selectedSlide);
            }) === false
        ) {
            allSelectedSlides.push(selectedSlide);
        }
        if (
            checkIsKeyboardEventMatch([{ key: 'Escape' }], event) &&
            holdingSlides.length > 0
        ) {
            setHoldingSlides([]);
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    { key: 'Delete' },
                    {
                        mControlKey: ['Meta'],
                        key: 'Backspace',
                    },
                ],
                event,
            ) &&
            holdingSlides.length > 0
        ) {
            await appDocument.deleteSlides(holdingSlides);
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
            const slides = await appDocument.getSlides();
            setHoldingSlides(slides);
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta'],
                        key: 'c',
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                    },
                ],
                event,
            )
        ) {
            AppDocument.setCopiedSlides(allSelectedSlides);
            showSimpleToast(tran('Copied'), tran('Slides are copied'));
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta'],
                        key: 'v',
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                    },
                ],
                event,
            )
        ) {
            const copiedSlides = await AppDocument.getCopiedSlides();
            appDocument.addSlides(copiedSlides);
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta', 'Shift'],
                        key: 'd',
                        wControlKey: ['Ctrl', 'Shift'],
                        lControlKey: ['Ctrl', 'Shift'],
                    },
                ],
                event,
            )
        ) {
            appDocument.duplicateSlides(allSelectedSlides);
            isHandled = true;
        } else if (handleHistory(appDocument, event)) {
            isHandled = true;
        }
    }
    if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

export async function onCanvasKeyboardEvent(
    {
        stopAllModes,
        canvasController,
        selectedCanvasItems,
    }: {
        stopAllModes: () => void;
        canvasController: CanvasController;
        selectedCanvasItems: CanvasItem<any>[];
    },
    event: any,
) {
    if (event.type !== 'keydown' || checkIsControlKeys(event)) {
        return;
    }
    let isHandled = false;
    if (checkIsKeyboardEventMatch([{ key: 'Escape' }], event)) {
        stopAllModes();
        isHandled = true;
    } else if (
        checkIsKeyboardEventMatch(
            [
                { key: 'Delete' },
                {
                    mControlKey: ['Meta'],
                    key: 'Backspace',
                },
            ],
            event,
        )
    ) {
        canvasController.deleteItems(selectedCanvasItems);
        isHandled = true;
    } else if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    key: 'c',
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                },
            ],
            event,
        )
    ) {
        Canvas.setCopiedItems(selectedCanvasItems);
        showSimpleToast(tran('Copied'), tran('Items are copied'));
        isHandled = true;
    } else if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    key: 'v',
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                },
            ],
            event,
        )
    ) {
        const copiedItems = await Canvas.getCopiedCanvasItems();
        canvasController.duplicateItems(copiedItems);
        isHandled = true;
    } else if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta', 'Shift'],
                    key: 'd',
                    wControlKey: ['Ctrl', 'Shift'],
                    lControlKey: ['Ctrl', 'Shift'],
                },
            ],
            event,
        )
    ) {
        canvasController.duplicateItems(selectedCanvasItems);
        isHandled = true;
    } else if (handleHistory(canvasController.appDocument, event)) {
        isHandled = true;
    }
    if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
    }
}
