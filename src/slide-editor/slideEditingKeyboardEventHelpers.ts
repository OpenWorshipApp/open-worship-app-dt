import AppDocument from '../app-document-list/AppDocument';
import { type VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import type Slide from '../app-document-list/Slide';
import KeyboardEventListener, {
    checkIsControlKeys,
    checkIsKeyboardEventMatch,
    PlatformEnum,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { readBibleItemFromClipboard } from './canvas/canvasBibleItemHelpers';
import Canvas from './canvas/Canvas';
import type CanvasController from './canvas/CanvasController';
import type CanvasItem from './canvas/CanvasItem';

/**
 * Cancels the key's default action NOW. A default can only be cancelled while
 * the event is still being dispatched -- before the handler's first `await` --
 * so the `preventDefault` at the end of these handlers came too late for any
 * branch that awaits: Ctrl+A in the slide list held every slide AND ran the
 * browser's select-all over the whole window.
 */
function consumeEvent(event: any) {
    event.preventDefault();
    event.stopPropagation();
}

/**
 * A context menu, a modal, a popup or an armed presenting tool holds the
 * keyboard, and the list or canvas that kept focus is behind it. Its keys were
 * still answered here AND stopped: Escape never reached the open menu (it
 * stayed up over a focused slide list), and Delete took the held slides or
 * boxes away behind it (2026-11-04). The keying areas are silent behind a
 * layer for the same reason (`keyingAreaHelpers`).
 */
function checkIsKeyboardHeldAbove() {
    return KeyboardEventListener.getLastLayer() !== 'root';
}

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
        appDocument.save();
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
        if (checkIsControlKeys(event) || checkIsKeyboardHeldAbove()) {
            return;
        }
        // A copy: `holdingSlides` is React's state array, and pushing the
        // slide being edited into it changed the held list behind React's
        // back on every key (2026-11-03).
        const allSelectedSlides = [...holdingSlides];
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
            consumeEvent(event);
            // The held slides and the one being edited, as copy and duplicate
            // take them -- what Delete took through that shared array.
            if (allSelectedSlides.length > 0) {
                await appDocument.deleteSlides(allSelectedSlides);
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
            consumeEvent(event);
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
                consumeEvent(event);
                if (await AppDocument.setCopiedSlides(allSelectedSlides)) {
                    showSimpleToast(tran('Copied'), tran('Slides are copied'));
                }
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
            consumeEvent(event);
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
        consumeEvent(event);
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
    if (
        event.type !== 'keydown' ||
        checkIsControlKeys(event) ||
        checkIsKeyboardHeldAbove()
    ) {
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
        consumeEvent(event);
        if (await Canvas.setCopiedItems(selectedCanvasItems)) {
            showSimpleToast(tran('Copied'), tran('Items are copied'));
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
        consumeEvent(event);
        const copiedItems = await Canvas.getCopiedCanvasItems();
        if (copiedItems.length > 0) {
            canvasController.duplicateItems(copiedItems);
        } else {
            const bibleItem = await readBibleItemFromClipboard();
            if (bibleItem !== null) {
                await canvasController.addNewBibleItem(bibleItem);
            }
        }
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
        consumeEvent(event);
    }
}
