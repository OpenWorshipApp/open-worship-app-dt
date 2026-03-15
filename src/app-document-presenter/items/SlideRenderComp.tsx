import type { MouseEvent } from 'react';
import { use, useCallback } from 'react';

import type Slide from '../../app-document-list/Slide';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import {
    SelectedEditingSlideContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import VaryAppDocumentItemRenderComp from './VaryAppDocumentItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import SlideRendererComp from './SlideRendererComp';
import type AppDocument from '../../app-document-list/AppDocument';

function useData() {
    const selectedEditingSlideContext = use(SelectedEditingSlideContext);
    const selectedEditingSlide =
        selectedEditingSlideContext?.selectedSlideEditing ?? null;
    const holdingEditingSlides =
        selectedEditingSlideContext?.holdingSlides ?? [];
    return {
        selectedEditingSlide,
        holdingEditingSlides,
    };
}

export default function SlideRenderComp({
    slide,
    width,
    index,
    onClick,
}: Readonly<{
    slide: Slide;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}>) {
    const appDocument = useVaryAppDocumentContext() as AppDocument;
    const { selectedEditingSlide, holdingEditingSlides } = useData();
    useScreenVaryAppDocumentManagerEvents(['update']);
    const handleContextMenuOpening = useCallback(
        (event: any, extraMenuItems: ContextMenuItemType[]) => {
            if (event.ctrlKey) {
                // Ctrl + left click to open context should not open context menu
                // but trigger clicking (selecting) instead
                event.preventDefault();
                event.stopPropagation();
                onClick?.(event);
                return;
            }
            const isOnHoldingSlide = holdingEditingSlides.some(
                (holdingSlide) => {
                    return holdingSlide.checkIsSame(slide);
                },
            );
            if (isOnHoldingSlide) {
                appDocument.showHoldingSlidesContextMenu(
                    event,
                    holdingEditingSlides,
                );
            } else {
                const isSelectedEditing =
                    !!selectedEditingSlide?.checkIsSame(slide);
                appDocument.showSlideContextMenu(
                    event,
                    slide,
                    extraMenuItems,
                    isSelectedEditing,
                );
            }
        },
        [
            holdingEditingSlides,
            slide,
            appDocument,
            selectedEditingSlide,
            onClick,
        ],
    );
    return (
        <VaryAppDocumentItemRenderComp
            slide={slide}
            selectedItemEditing={selectedEditingSlide}
            holdingItems={holdingEditingSlides}
            width={width}
            index={index}
            onContextMenu={handleContextMenuOpening}
            onClick={onClick}
        >
            <SlideRendererComp
                canvasItemsJson={slide.canvasItemsJson}
                width={`${slide.width}px`}
                height={`${slide.height}px`}
            />
        </VaryAppDocumentItemRenderComp>
    );
}
