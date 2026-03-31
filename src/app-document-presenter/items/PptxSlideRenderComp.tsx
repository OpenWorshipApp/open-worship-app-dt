import { type MouseEvent, useCallback } from 'react';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import type PptxSlide from '../../app-document-list/PptxSlide';
import VarySlideRenderComp from './VarySlideRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import type PptxAppDocument from '../../app-document-list/PptxAppDocument';
import FileSource from '../../helper/FileSource';
import { renderToStaticMarkup } from 'react-dom/server';
import appProvider from '../../server/appProvider';
import { type VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';

function PptxSlideRenderContentComp({
    htmlFilePath,
    width,
    height,
}: Readonly<{
    htmlFilePath: string;
    width: number;
    height: number;
}>) {
    const fileSource = FileSource.getInstance(htmlFilePath);
    return (
        <iframe
            title="pptx-slide"
            style={{
                colorScheme: 'normal',
                pointerEvents: appProvider.isPageScreen ? 'all' : 'none',
                backgroundColor: 'transparent',
                width,
                height,
                border: 'none',
                overflow: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
            }}
            src={fileSource.src}
        />
    );
}

export function genPptxSlide(
    htmlFilePath: string,
    width: number,
    height: number,
) {
    const htmlString = renderToStaticMarkup(
        <PptxSlideRenderContentComp
            htmlFilePath={htmlFilePath}
            width={width}
            height={height}
        />,
    );
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.innerHTML = htmlString;
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
                    htmlFilePath={pptxSlide.htmlFilePath}
                    width={pptxSlide.width}
                    height={pptxSlide.height}
                />
            </VarySlideRenderComp>
            {pptxSlide.subSlides.map((subSlide, i) => {
                const subIndex = index + (i + 1) * 0.01;
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
