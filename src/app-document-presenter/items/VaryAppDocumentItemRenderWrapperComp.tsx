import { type MouseEvent, useCallback } from 'react';

import SlideRenderComp from './SlideRenderComp';
import PdfSlideRenderComp from './PdfSlideRenderComp';
import { handleAppDocumentItemSelecting } from './varyAppDocumentHelpers';
import { useSelectedEditingSlideSetterContext } from '../../app-document-list/appDocumentHelpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import Slide from '../../app-document-list/Slide';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import { type AllControlType as KeyboardControlType } from '../../event/KeyboardEventListener';

function selectVaryAppDocumentItem(
    {
        index,
        varyAppDocumentItem,
        setSelectedAppDocumentItem,
    }: {
        index: number;
        varyAppDocumentItem: VaryAppDocumentItemType;
        setSelectedAppDocumentItem: (
            newSlide: Slide | null,
            controlType?: KeyboardControlType,
        ) => void;
    },
    event: MouseEvent,
) {
    event.stopPropagation();
    setTimeout(() => {
        handleAppDocumentItemSelecting(
            event,
            index + 1,
            varyAppDocumentItem,
            (selectedVaryAppDocumentItem) => {
                if (selectedVaryAppDocumentItem instanceof Slide === false) {
                    return;
                }
                let controlType: KeyboardControlType | undefined = undefined;
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
}

export default function VaryAppDocumentItemRenderWrapperComp({
    thumbSize,
    varyAppDocumentItem,
    index,
}: Readonly<{
    thumbSize: number;
    varyAppDocumentItem: VaryAppDocumentItemType;
    index: number;
}>) {
    const setSelectedAppDocumentItem = useSelectedEditingSlideSetterContext();
    const handleClicking = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            selectVaryAppDocumentItem(
                {
                    index,
                    varyAppDocumentItem,
                    setSelectedAppDocumentItem,
                },
                event,
            );
        },
        [index, varyAppDocumentItem, setSelectedAppDocumentItem],
    );
    if (PdfSlide.checkIsThisType(varyAppDocumentItem)) {
        return (
            <PdfSlideRenderComp
                key={varyAppDocumentItem.id}
                onClick={handleClicking}
                pdfSlide={varyAppDocumentItem}
                width={thumbSize}
                index={index}
            />
        );
    }
    return (
        <SlideRenderComp
            index={index}
            slide={varyAppDocumentItem}
            width={thumbSize}
            onClick={handleClicking}
        />
    );
}
