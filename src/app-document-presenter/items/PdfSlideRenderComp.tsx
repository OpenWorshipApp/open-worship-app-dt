import { MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { getHTMLChild } from '../../helper/helpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import SlideItemRenderComp from './SlideItemRenderComp';
import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import SlideScaleContainerComp from './SlideScaleContainerComp';
import { useScale } from './slideItemRenderHelpers';

function PdfSlideRenderContentComp({
    pdfImageSrc,
    isFullWidth = false,
}: Readonly<{
    pdfImageSrc: string;
    isFullWidth?: boolean;
}>) {
    return (
        <img
            alt="pdf-image"
            style={
                isFullWidth
                    ? {
                          width: '100%',
                      }
                    : {
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                      }
            }
            src={pdfImageSrc}
        />
    );
}

export function genPdfSlide(pdfImageSrc: string, isFullWidth = false) {
    const htmlString = renderToStaticMarkup(
        <PdfSlideRenderContentComp
            pdfImageSrc={pdfImageSrc}
            isFullWidth={isFullWidth}
        />,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    return getHTMLChild<HTMLDivElement>(div, 'img');
}

export default function PdfSlideRenderComp({
    slide,
    width,
    index,
    onClick,
    onContextMenu,
}: Readonly<{
    slide: PdfSlide;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
}>) {
    const { scale, parentWidth, setParentDiv } = useScale(slide, width);
    useScreenVaryAppDocumentManagerEvents(['update']);
    const pdfPreviewSrc = slide.pdfPreviewSrc;
    return (
        <SlideItemRenderComp
            slide={slide}
            width={width}
            index={index}
            onContextMenu={onContextMenu}
            onClick={onClick}
        >
            <SlideScaleContainerComp
                slide={slide}
                width={width}
                extraStyle={{
                    position: 'absolute',
                }}
            />
            <div
                className="overflow-hidden"
                ref={setParentDiv}
                style={{
                    position: 'absolute',
                    width: `${parentWidth}px`,
                    height: `${Math.round(slide.height * scale)}px`,
                }}
            >
                {pdfPreviewSrc === null ? (
                    <div className="alert alert-danger">
                        Unable to preview right now
                    </div>
                ) : (
                    <PdfSlideRenderContentComp pdfImageSrc={pdfPreviewSrc} />
                )}
            </div>
        </SlideItemRenderComp>
    );
}
