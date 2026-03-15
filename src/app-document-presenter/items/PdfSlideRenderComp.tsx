import { useCallback, useMemo, type MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { getHTMLChild } from '../../helper/helpers';
import type PdfSlide from '../../app-document-list/PdfSlide';
import VaryAppDocumentItemRenderComp from './VaryAppDocumentItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { tran } from '../../lang/langHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';

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
    pdfSlide,
    width,
    index,
    onClick,
}: Readonly<{
    pdfSlide: PdfSlide;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}>) {
    const pdfAppDocument = useVaryAppDocumentContext() as PdfAppDocument;
    const pdfPreviewSrc = pdfSlide.pdfPreviewSrc;
    useScreenVaryAppDocumentManagerEvents(['update']);
    const handleContextMenuOpening = useCallback(
        (event: MouseEvent, extraMenuItems: ContextMenuItemType[]) => {
            pdfAppDocument.showSlideContextMenu(
                event,
                pdfSlide,
                extraMenuItems,
            );
        },
        [pdfAppDocument, pdfSlide],
    );
    return (
        <VaryAppDocumentItemRenderComp
            slide={pdfSlide}
            width={width}
            index={index}
            onContextMenu={handleContextMenuOpening}
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
