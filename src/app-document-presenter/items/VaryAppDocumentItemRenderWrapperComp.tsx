import { MouseEvent } from 'react';

import SlideRenderComp from './SlideRenderComp';
import PdfSlideRenderComp from './PdfSlideRenderComp';
import { handleAppDocumentItemSelecting } from './varyAppDocumentHelpers';
import {
    useSelectedEditingSlideSetterContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import { showSimpleToast } from '../../toast/toastHelpers';
import Slide from '../../app-document-list/Slide';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import { AllControlType as KeyboardControlType } from '../../event/KeyboardEventListener';

export default function VaryAppDocumentItemRenderWrapperComp({
    thumbSize,
    varyAppDocumentItem,
    index,
}: Readonly<{
    thumbSize: number;
    varyAppDocumentItem: VaryAppDocumentItemType;
    index: number;
}>) {
    const selectedAppDocument = useVaryAppDocumentContext();
    const setSelectedAppDocumentItem = useSelectedEditingSlideSetterContext();
    const handleClicking = (event: MouseEvent) => {
        event.stopPropagation();
        setTimeout(() => {
            handleAppDocumentItemSelecting(
                event,
                index + 1,
                varyAppDocumentItem,
                (selectedVaryAppDocumentItem) => {
                    if (
                        selectedVaryAppDocumentItem instanceof Slide ===
                        false
                    ) {
                        return;
                    }
                    let controlType: KeyboardControlType | undefined =
                        undefined;
                    if (event.ctrlKey) {
                        controlType = 'Ctrl';
                    } else if (event.shiftKey) {
                        controlType = 'Shift';
                    }
                    setSelectedAppDocumentItem(
                        selectedVaryAppDocumentItem,
                        controlType,
                    );
                },
            );
        }, 0);
    };
    const handleContextMenuOpening = (
        event: MouseEvent,
        extraMenuItems: ContextMenuItemType[],
    ) => {
        if (event.ctrlKey) {
            // Ctrl + left click to open context should not open context menu
            // but trigger clicking (selecting) instead
            event.preventDefault();
            event.stopPropagation();
            handleClicking(event);
            return;
        }
        selectedAppDocument.showSlideContextMenu(
            event,
            varyAppDocumentItem as any,
            extraMenuItems,
        );
    };
    const handleCopying = async () => {
        const text = await varyAppDocumentItem.clipboardSerialize();
        if (text === null) {
            showSimpleToast(
                'Cannot copy this item.',
                'Unable to serialize this item for clipboard.',
            );
            return;
        }
        navigator.clipboard.writeText(text);
    };
    if (PdfSlide.checkIsThisType(varyAppDocumentItem)) {
        return (
            <PdfSlideRenderComp
                key={varyAppDocumentItem.id}
                onClick={handleClicking}
                slide={varyAppDocumentItem}
                width={thumbSize}
                index={index}
                onContextMenu={handleContextMenuOpening}
            />
        );
    }
    if (!selectedAppDocument.isEditable) {
        return (
            <SlideRenderComp
                index={index}
                slide={varyAppDocumentItem}
                width={thumbSize}
                onClick={handleClicking}
                onContextMenu={handleContextMenuOpening}
                onCopy={handleCopying}
            />
        );
    }
    return (
        <SlideRenderComp
            index={index}
            slide={varyAppDocumentItem}
            width={thumbSize}
            onClick={handleClicking}
            onContextMenu={handleContextMenuOpening}
            onCopy={handleCopying}
        />
    );
}
