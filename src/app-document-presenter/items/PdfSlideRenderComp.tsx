import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import ReactDOMServer from 'react-dom/server';
import { getHTMLChild } from '../../helper/helpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import SlideItemRenderComp, { useScale } from './SlideItemRenderComp';
import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';

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
    const htmlString = ReactDOMServer.renderToStaticMarkup(
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
    onContextMenu,
}: Readonly<{
    pdfSlide: PdfSlide;
    width: number;
    index: number;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
}>) {
    const { scale, parentWidth, setParentDiv } = useScale(pdfSlide, width);
    useScreenVaryAppDocumentManagerEvents(['update']);
    const pdfPreviewSrc = pdfSlide.pdfPreviewSrc;
    return (
        <SlideItemRenderComp
            slide={pdfSlide}
            width={width}
            index={index}
            onContextMenu={onContextMenu}
            onClick={onClick}
        >
            <div
                ref={setParentDiv}
                style={{
                    width: `${parentWidth}px`,
                    height: `${Math.round(pdfSlide.height * scale)}px`,
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
