import './SlideItemRender.scss';

import SlideItem from '../../slide-list/SlideItem';
import { usePSlideMEvents } from '../../_screen/screenEventHelpers';
import {
    RendInfo, toCNHighlight,
} from './SlideItemRender';
import ReactDOMServer from 'react-dom/server';

export function SlideItemPdfRenderContent({
    pdfImageSrc, isFullWidth = false,
}: Readonly<{
    pdfImageSrc: string,
    isFullWidth?: boolean,
}>) {
    return (
        <img alt='pdf-image' style={isFullWidth ? {
            width: '100%',
        } : {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
        }}
            src={pdfImageSrc}
        />
    );
}

export function genPdfSlideItem(pdfImageSrc: string, isFullWidth = false) {
    const str = ReactDOMServer.renderToStaticMarkup(
        <SlideItemPdfRenderContent pdfImageSrc={pdfImageSrc}
            isFullWidth={isFullWidth}
        />,
    );
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.firstChild as HTMLDivElement;
}

export default function SlideItemPdfRender({
    slideItem, width, index, onClick,
}: Readonly<{
    slideItem: SlideItem;
    width: number,
    index: number;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}>) {
    usePSlideMEvents(['update']);
    const {
        activeCN, presenterCN,
    } = toCNHighlight(slideItem);
    return (
        <div className={`slide-item card pointer ${activeCN} ${presenterCN}`}
            style={{
                width: `${width}px`,
            }}
            onClick={onClick}>
            <div className='card-header d-flex'>
                <i className='bi bi-filetype-pdf' />
                <RendInfo index={index}
                    slideItem={slideItem}
                />
            </div>
            <div className='card-body overflow-hidden'
                style={{ padding: '0px' }} >
                <SlideItemPdfRenderContent
                    pdfImageSrc={slideItem.pdfImageSrc}
                />
            </div>
        </div>
    );
}
