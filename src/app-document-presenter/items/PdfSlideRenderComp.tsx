import { useMemo, type MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { getHTMLChild } from '../../helper/helpers';
import type PdfSlide from '../../app-document-list/PdfSlide';
import VaryAppDocumentItemRenderComp from './VaryAppDocumentItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { tran } from '../../lang/langHelpers';

function PdfSlideRenderContentComp({
    pdfImageSrc,
    isFullWidth = false,
}: Readonly<{
    pdfImageSrc: string;
    isFullWidth?: boolean;
}>) {
    const actualStyle = useMemo(() => {
        if (isFullWidth) {
            return {
                width: '100%',
            };
        }
        return {
            width: '100%',
            height: '100%',
            objectFit: 'contain' as const,
        };
    }, [isFullWidth]);
    return <img alt="pdf-image" style={actualStyle} src={pdfImageSrc} />;
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
    const pdfPreviewSrc = slide.pdfPreviewSrc;
    useScreenVaryAppDocumentManagerEvents(['update']);
    return (
        <VaryAppDocumentItemRenderComp
            slide={slide}
            width={width}
            index={index}
            onContextMenu={onContextMenu}
            onClick={onClick}
        >
            {pdfPreviewSrc === null ? (
                <h3>{tran('Unable to preview right now')}</h3>
            ) : (
                <PdfSlideRenderContentComp pdfImageSrc={pdfPreviewSrc} />
            )}
        </VaryAppDocumentItemRenderComp>
    );
}
