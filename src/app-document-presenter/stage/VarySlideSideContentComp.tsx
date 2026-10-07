import { useMemo } from 'react';

import SlideRendererComp from '../items/SlideRendererComp';
import { PdfSlideRenderContentComp } from '../items/PdfSlideRenderComp';
import { PptxSlideRenderContentComp } from '../items/PptxSlideRenderComp';
import { DocxSlideRenderContentComp } from '../items/DocxSlideRenderComp';
import { SlideThumbnailContext } from '../../slide-editor/canvas/box/slideThumbnailContext';
import PdfSlide from '../../app-document-list/PdfSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import DocxSlide from '../../app-document-list/DocxSlide';
import type Slide from '../../app-document-list/Slide';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { filterSideCanvasItems } from './documentStageHelpers';

function SlideSideContentComp({ slide }: Readonly<{ slide: Slide }>) {
    const canvasItemsJson = useMemo(() => {
        return filterSideCanvasItems(slide.canvasItemsJson);
    }, [slide.canvasItemsJson]);
    return (
        <SlideThumbnailContext value={true}>
            <SlideRendererComp
                canvasItemsJson={canvasItemsJson}
                width={`${slide.width}px`}
                height={`${slide.height}px`}
            />
        </SlideThumbnailContext>
    );
}

/**
 * A slide drawn small beside the one on a stage, at its own size: the same
 * content its own card draws, minus anything that plays
 * (`filterSideCanvasItems`).
 */
export default function VarySlideSideContentComp({
    varySlide,
}: Readonly<{ varySlide: VarySlideType }>) {
    if (PdfSlide.checkIsThisType(varySlide)) {
        const pdfImageSrc = varySlide.pdfPreviewSrc;
        return pdfImageSrc === null ? null : (
            <PdfSlideRenderContentComp pdfImageSrc={pdfImageSrc} />
        );
    }
    if (PptxSlide.checkIsThisType(varySlide)) {
        return (
            <PptxSlideRenderContentComp
                html={varySlide.html}
                htmlFilePath={varySlide.htmlFilePath}
                width={varySlide.width}
                height={varySlide.height}
            />
        );
    }
    if (DocxSlide.checkIsThisType(varySlide)) {
        return (
            <div style={{ width: varySlide.width, height: varySlide.height }}>
                <DocxSlideRenderContentComp
                    html={varySlide.html}
                    htmlFilePath={varySlide.htmlFilePath}
                    width={varySlide.width}
                    height={varySlide.height}
                />
            </div>
        );
    }
    return <SlideSideContentComp slide={varySlide as Slide} />;
}
