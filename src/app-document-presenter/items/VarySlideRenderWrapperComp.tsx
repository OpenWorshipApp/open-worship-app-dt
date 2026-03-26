import { type MouseEvent, useCallback } from 'react';

import SlideRenderComp from './SlideRenderComp';
import PdfSlideRenderComp from './PdfSlideRenderComp';
import PptxSlideRenderComp from './PptxSlideRenderComp';
import { handleVarySlideSelecting } from './varyAppDocumentHelpers';
import { useSelectedEditingSlideSetterContext } from '../../app-document-list/appDocumentHelpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import Slide from '../../app-document-list/Slide';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { type AllControlType as KeyboardControlType } from '../../event/KeyboardEventListener';
import type { OptionalPromise } from '../../helper/typeHelpers';

function selectVarySlide(
    {
        index,
        varySlide,
        setVarySlides,
    }: {
        index: number;
        varySlide: VarySlideType;
        setVarySlides: (
            newSlide: Slide | null,
            controlType?: KeyboardControlType,
        ) => OptionalPromise<void>;
    },
    event: MouseEvent,
) {
    event.stopPropagation();
    setTimeout(() => {
        handleVarySlideSelecting(
            event,
            index + 1,
            varySlide,
            (selectedVarySlide) => {
                if (selectedVarySlide instanceof Slide === false) {
                    return;
                }
                let controlType: KeyboardControlType | undefined = undefined;
                if (event.ctrlKey) {
                    controlType = 'Ctrl';
                } else if (event.shiftKey) {
                    controlType = 'Shift';
                }
                setVarySlides(selectedVarySlide, controlType);
            },
        );
    }, 0);
}

export default function VarySlideRenderWrapperComp({
    thumbSize,
    varySlide,
    index,
}: Readonly<{
    thumbSize: number;
    varySlide: VarySlideType;
    index: number;
}>) {
    const setSelectedVarySlide = useSelectedEditingSlideSetterContext();
    const handleClicking = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            selectVarySlide(
                {
                    index,
                    varySlide,
                    setVarySlides: setSelectedVarySlide,
                },
                event,
            );
        },
        [index, varySlide, setSelectedVarySlide],
    );
    if (PdfSlide.checkIsThisType(varySlide)) {
        return (
            <PdfSlideRenderComp
                key={varySlide.id}
                onClick={handleClicking}
                pdfSlide={varySlide}
                width={thumbSize}
                index={index}
            />
        );
    }
    if (PptxSlide.checkIsThisType(varySlide)) {
        return (
            <PptxSlideRenderComp
                key={varySlide.id}
                onClick={handleClicking}
                pptxSlide={varySlide}
                width={thumbSize}
                index={index}
            />
        );
    }
    return (
        <SlideRenderComp
            index={index}
            slide={varySlide}
            width={thumbSize}
            onClick={handleClicking}
        />
    );
}
