import AppDocument from '../app-document-list/AppDocument';
import { type VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import type Slide from '../app-document-list/Slide';
import {
    checkIsControlKeys,
    checkIsKeyboardEventMatch,
    PlatformEnum,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import Canvas from './canvas/Canvas';
import type CanvasController from './canvas/CanvasController';
import type CanvasItem from './canvas/CanvasItem';

function handleHistory(appDocument: AppDocument, event: any) {
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                    key: 'z',
                },
            ],
            event,
        )
    ) {
        appDocument.historyUndo();
        return true;
    }
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta', 'Shift'],
                    wControlKey: ['Ctrl', 'Shift'],
                    lControlKey: ['Ctrl', 'Shift'],
                    key: 'z',
                },
                {
                    platform: PlatformEnum.Windows,
                    wControlKey: ['Ctrl'],
                    key: 'y',
                },
                {
                    platform: PlatformEnum.Linux,
                    lControlKey: ['Ctrl'],
                    key: 'y',
                },
            ],
            event,
        )
    ) {
        appDocument.historyRedo();
        return true;
    }
    if (
        checkIsKeyboardEventMatch(
            [
                {
                    mControlKey: ['Meta'],
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                    key: 's',
                },
            ],
            event,
        )
    ) {
        appDocument.historySave();
        return true;
    }
}

export async function onSlideItemsKeyboardEvent(
    {
        holdingSlides,
        setHoldingSlides,
        varyAppDocument,
        selectedSlideEditing,
    }: {
        holdingSlides: Slide[];
        setHoldingSlides: (holdingSlides: Slide[]) => void;
        varyAppDocument: VaryAppDocumentType | null;
        selectedSlideEditing: Slide | null;
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
            selectedSlideEditing !== null &&
            holdingSlides.some((holdingSlide) => {
                return holdingSlide.checkIsSame(selectedSlideEditing);
            }) === false
        ) {
            allSelectedSlides.push(selectedSlideEditing);
        }
        if (checkIsKeyboardEventMatch([{ key: 'Escape' }], event)) {
            if (holdingSlides.length > 0) {
                setHoldingSlides([]);
            }
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    { key: 'Delete' },
                    {
                        platform: PlatformEnum.MacOS,
                        mControlKey: ['Meta'],
                        key: 'Backspace',
                    },
                ],
                event,
            )
        ) {
            if (holdingSlides.length > 0) {
                await appDocument.deleteSlides(holdingSlides);
            }
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta'],
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                        key: 'a',
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
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                        key: 'c',
                    },
                ],
                event,
            )
        ) {
            if (allSelectedSlides.length > 0) {
                AppDocument.setCopiedSlides(allSelectedSlides);
                showSimpleToast(tran('Copied'), tran('Slides are copied'));
            }
            isHandled = true;
        } else if (
            checkIsKeyboardEventMatch(
                [
                    {
                        mControlKey: ['Meta'],
                        wControlKey: ['Ctrl'],
                        lControlKey: ['Ctrl'],
                        key: 'v',
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
                        wControlKey: ['Ctrl', 'Shift'],
                        lControlKey: ['Ctrl', 'Shift'],
                        key: 'd',
                    },
                ],
                event,
            )
        ) {
            if (allSelectedSlides.length > 0) {
                appDocument.duplicateSlides(allSelectedSlides);
            }
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
        setSelectedCanvasItems,
    }: {
        stopAllModes: () => void;
        canvasController: CanvasController;
        selectedCanvasItems: CanvasItem<any>[];
        setSelectedCanvasItems: (
            selectedCanvasItems: CanvasItem<any>[],
        ) => void;
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
            [{ key: 'Tab' }, { key: 'Tab', allControlKey: ['Shift'] }],
            event,
        )
    ) {
        const sortedItems = Array.from(
            canvasController.canvas.canvasItems,
        ).sort((a, b) => {
            return a.id - b.id;
        });
        const firstIndex = sortedItems.findIndex((canvasItem) => {
            return selectedCanvasItems.some((selectedCanvasItem) => {
                return selectedCanvasItem.props.id === canvasItem.props.id;
            });
        });
        const nextIndex =
            (firstIndex + (event.shiftKey ? -1 : 1) + sortedItems.length) %
            sortedItems.length;
        const nextItem = sortedItems[nextIndex];
        if (nextItem !== undefined) {
            setSelectedCanvasItems([nextItem]);
        }
        isHandled = true;
    } else if (
        checkIsKeyboardEventMatch(
            [
                { key: 'Delete' },
                {
                    platform: PlatformEnum.MacOS,
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
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                    key: 'c',
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
                    wControlKey: ['Ctrl'],
                    lControlKey: ['Ctrl'],
                    key: 'v',
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
                    wControlKey: ['Ctrl', 'Shift'],
                    lControlKey: ['Ctrl', 'Shift'],
                    key: 'd',
                },
            ],
            event,
        )
    ) {
        canvasController.duplicateItems(selectedCanvasItems);
        isHandled = true;
    } else if (handleHistory(canvasController.appDocument, event)) {
        isHandled = true;
    } else if (canvasController.matchEvent(event)) {
        isHandled = true;
    }
    if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
    }
}
