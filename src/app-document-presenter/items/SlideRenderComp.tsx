import type { MouseEvent } from 'react';
import { use, useCallback } from 'react';

import type Slide from '../../app-document-list/Slide';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import {
    SelectedEditingSlideContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import VarySlideRenderComp from './VarySlideRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import SlideRendererComp from './SlideRendererComp';
import type AppDocument from '../../app-document-list/AppDocument';
import { type VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

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
    onClick?: (
        event: MouseEvent<HTMLDivElement>,
        index: number,
        varSlide: VarySlideType,
    ) => void;
}>) {
    const appDocument = useVaryAppDocumentContext() as AppDocument;
    const { selectedEditingSlide, holdingEditingSlides } = useData();
    useScreenVaryAppDocumentManagerEvents(['update']);
    const indexRef = useAppCurrentRef(index);
    const holdingEditingSlidesRef = useAppCurrentRef(holdingEditingSlides);
    const slideRef = useAppCurrentRef(slide);
    const appDocumentRef = useAppCurrentRef(appDocument);
    const selectedEditingSlideRef = useAppCurrentRef(selectedEditingSlide);
    const onClickRef = useAppCurrentRef(onClick);
    const handleContextMenuOpening = useCallback(
        (event: any, extraMenuItems: ContextMenuItemType[]) => {
            if (event.ctrlKey) {
                // Ctrl + left click to open context should not open context menu
                // but trigger clicking (selecting) instead
                event.preventDefault();
                event.stopPropagation();
                onClickRef.current?.(event, indexRef.current, slideRef.current);
                return;
            }
            const isOnHoldingSlide = holdingEditingSlidesRef.current.some(
                (holdingSlide) => {
                    return holdingSlide.checkIsSame(slideRef.current);
                },
            );
            if (isOnHoldingSlide) {
                appDocumentRef.current.showHoldingSlidesContextMenu(
                    event,
                    holdingEditingSlidesRef.current,
                );
            } else {
                const isSelectedEditing =
                    !!selectedEditingSlideRef.current?.checkIsSame(
                        slideRef.current,
                    );
                appDocumentRef.current.showSlideContextMenu(
                    event,
                    slideRef.current,
                    extraMenuItems,
                    isSelectedEditing,
                );
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <VarySlideRenderComp
            varySlide={slide}
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
        </VarySlideRenderComp>
    );
}
