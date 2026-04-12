import { type MouseEvent, useCallback } from 'react';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import PptxSlide from '../../app-document-list/PptxSlide';
import VarySlideRenderComp from './VarySlideRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import type PptxAppDocument from '../../app-document-list/PptxAppDocument';
import FileSource from '../../helper/FileSource';
import { type VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import HtmlSlideRenderComp, {
    genHtmlSlideContent,
} from './HtmlSlideRenderComp';

function genPptxIframeElement(
    htmlFilePath: string,
    width: number,
    height: number,
) {
    const iframe = document.createElement('iframe');
    const fileSource = FileSource.getInstance(htmlFilePath);
    iframe.title = 'pptx-slide';
    iframe.src = fileSource.src;
    Object.assign(iframe.style, {
        colorScheme: 'normal',
        backgroundColor: 'transparent',
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        overflow: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
    });
    return iframe;
}

function PptxSlideIframeContentComp({
    htmlFilePath,
    width,
    height,
}: Readonly<{
    htmlFilePath: string;
    width: number;
    height: number;
}>) {
    return (
        <iframe
            title="pptx-slide"
            style={{
                colorScheme: 'normal',
                backgroundColor: 'transparent',
                width,
                height,
                border: 'none',
                overflow: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
            }}
            src={FileSource.getInstance(htmlFilePath).src}
        />
    );
}

function PptxSlideRenderContentComp({
    html,
    htmlFilePath,
    width,
    height,
}: Readonly<{
    html?: string;
    htmlFilePath: string;
    width: number;
    height: number;
}>) {
    if (html === undefined) {
        return (
            <PptxSlideIframeContentComp
                htmlFilePath={htmlFilePath}
                width={width}
                height={height}
            />
        );
    }
    return (
        <HtmlSlideRenderComp
            html={html}
            htmlFilePath={htmlFilePath}
            width={width}
            height={height}
        />
    );
}

export function genPptxSlide(
    html: string | undefined,
    htmlFilePath: string,
    width: number,
    height: number,
) {
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    if (html === undefined) {
        div.appendChild(genPptxIframeElement(htmlFilePath, width, height));
        return div;
    }
    div.appendChild(
        genHtmlSlideContent({
            html,
            htmlFilePath,
            width,
            height,
        }),
    );
    return div;
}

export default function PptxSlideRenderComp({
    pptxSlide,
    width,
    index,
    onClick,
}: Readonly<{
    pptxSlide: PptxSlide;
    width: number;
    index: number;
    onClick?: (
        event: MouseEvent<HTMLDivElement>,
        index: number,
        varySlide: VarySlideType,
    ) => void;
}>) {
    const pptxAppDocument = useVaryAppDocumentContext() as PptxAppDocument;
    useScreenVaryAppDocumentManagerEvents(['update']);
    const handleContextMenuOpening = useCallback(
        (event: MouseEvent, extraMenuItems: ContextMenuItemType[]) => {
            pptxAppDocument.showSlideContextMenu(
                event,
                pptxSlide,
                extraMenuItems,
            );
        },
        [pptxAppDocument, pptxSlide],
    );
    return (
        <>
            <VarySlideRenderComp
                varySlide={pptxSlide}
                width={width}
                index={index}
                onContextMenu={handleContextMenuOpening}
                onClick={(event) => {
                    onClick?.(event, index, pptxSlide);
                }}
            >
                <PptxSlideRenderContentComp
                    html={pptxSlide.html}
                    htmlFilePath={pptxSlide.htmlFilePath}
                    width={pptxSlide.width}
                    height={pptxSlide.height}
                />
            </VarySlideRenderComp>
            {pptxSlide.subSlides.map((subSlide, i) => {
                const subIndex = PptxSlide.calcIndex(index, i);
                return (
                    <VarySlideRenderComp
                        key={subSlide.id}
                        varySlide={subSlide}
                        width={width}
                        index={subIndex}
                        onContextMenu={handleContextMenuOpening}
                        onClick={(event) => {
                            onClick?.(event, subIndex, subSlide);
                        }}
                    >
                        <PptxSlideRenderContentComp
                            html={subSlide.html}
                            htmlFilePath={subSlide.htmlFilePath}
                            width={subSlide.width}
                            height={subSlide.height}
                        />
                    </VarySlideRenderComp>
                );
            })}
        </>
    );
}
