import type { MouseEvent } from 'react';
import { use } from 'react';

import type Slide from '../../app-document-list/Slide';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { SelectedEditingSlideContext } from '../../app-document-list/appDocumentHelpers';
import VaryAppDocumentItemRenderComp from './VaryAppDocumentItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import SlideRendererComp from './SlideRendererComp';

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
    onContextMenu,
}: Readonly<{
    slide: Slide;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
}>) {
    const { selectedSlide, holdingSlides } = useData();
    useScreenVaryAppDocumentManagerEvents(['update']);
    return (
        <VaryAppDocumentItemRenderComp
            slide={slide}
            selectedItem={selectedSlide}
            holdingItems={holdingSlides}
            width={width}
            index={index}
            onContextMenu={onContextMenu}
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
