import type { MouseEvent } from 'react';
import { use } from 'react';

import type Slide from '../../app-document-list/Slide';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import {
    SelectedEditingSlideContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import VaryAppDocumentItemRenderComp from './VaryAppDocumentItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import SlideRendererComp from './SlideRendererComp';
import AppDocument from '../../app-document-list/AppDocument';

function useData() {
    const selectedSlideContext = use(SelectedEditingSlideContext);
    const selectedSlide = selectedSlideContext?.selectedSlide ?? null;
    const holdingSlides = selectedSlideContext?.holdingSlides ?? [];
    return {
        selectedSlide,
        holdingSlides,
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
    const { selectedSlide, holdingSlides } = useData();
    useScreenVaryAppDocumentManagerEvents(['update']);
    const handleContextMenuOpening = (
        event: any,
        extraMenuItems: ContextMenuItemType[],
    ) => {
        if (event.ctrlKey) {
            // Ctrl + left click to open context should not open context menu
            // but trigger clicking (selecting) instead
            event.preventDefault();
            event.stopPropagation();
            onClick?.(event);
            return;
        }
        const isOnHoldingSlide = holdingSlides.some((holdingSlide) => {
            return holdingSlide.checkIsSame(slide);
        });
        if (isOnHoldingSlide) {
            appDocument.showHoldingSlidesContextMenu(event, holdingSlides);
        } else {
            appDocument.showSlideContextMenu(event, slide, extraMenuItems);
        }
    };
    return (
        <VaryAppDocumentItemRenderComp
            slide={slide}
            selectedItem={selectedSlide}
            holdingItems={holdingSlides}
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
