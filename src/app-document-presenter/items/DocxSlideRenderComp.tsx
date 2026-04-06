import { type MouseEvent, useCallback } from 'react';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import type DocxSlide from '../../app-document-list/DocxSlide';
import VarySlideRenderComp from './VarySlideRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import type DocxAppDocument from '../../app-document-list/DocxAppDocument';
import FileSource from '../../helper/FileSource';
import { renderToStaticMarkup } from 'react-dom/server';
import appProvider from '../../server/appProvider';
import { type VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';

function DocxSlideRenderContentComp({
    htmlFilePath,
    width,
    height,
    isFullWidth = false,
}: Readonly<{
    htmlFilePath: string;
    width: number;
    height: number;
    isFullWidth?: boolean;
}>) {
    const fileSource = FileSource.getInstance(htmlFilePath);
    const iframe = (
        <iframe
            title="docx-slide"
            style={{
                colorScheme: 'normal',
                pointerEvents: appProvider.isPageScreen ? 'all' : 'none',
                backgroundColor: 'transparent',
                border: 'none',
                overflow: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                width: isFullWidth ? '100%' : width,
                height: isFullWidth ? '100%' : height,
                position: isFullWidth ? 'absolute' : undefined,
                inset: isFullWidth ? 0 : undefined,
            }}
            src={fileSource.src}
        />
    );
    if (isFullWidth) {
        return (
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                }}
            >
                {iframe}
            </div>
        );
    }
    return (
        iframe
    );
}

export function genDocxSlide(
    htmlFilePath: string,
    width: number,
    height: number,
    isFullWidth = false,
) {
    const htmlString = renderToStaticMarkup(
        <DocxSlideRenderContentComp
            htmlFilePath={htmlFilePath}
            width={width}
            height={height}
            isFullWidth={isFullWidth}
        />,
    );
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = isFullWidth ? 'auto' : '100%';
    div.innerHTML = htmlString;
    return div;
}

export default function DocxSlideRenderComp({
    docxSlide,
    width,
    index,
    onClick,
}: Readonly<{
    docxSlide: DocxSlide;
    width: number;
    index: number;
    onClick?: (
        event: MouseEvent<HTMLDivElement>,
        index: number,
        varySlide: VarySlideType,
    ) => void;
}>) {
    const docxAppDocument = useVaryAppDocumentContext() as DocxAppDocument;
    useScreenVaryAppDocumentManagerEvents(['update']);
    const handleContextMenuOpening = useCallback(
        (event: MouseEvent, extraMenuItems: ContextMenuItemType[]) => {
            docxAppDocument.showSlideContextMenu(
                event,
                docxSlide,
                extraMenuItems,
            );
        },
        [docxAppDocument, docxSlide],
    );
    return (
        <VarySlideRenderComp
            varySlide={docxSlide}
            width={width}
            index={index}
            onContextMenu={handleContextMenuOpening}
            onClick={(event) => {
                onClick?.(event, index, docxSlide);
            }}
        >
            <DocxSlideRenderContentComp
                htmlFilePath={docxSlide.htmlFilePath}
                width={docxSlide.width}
                height={docxSlide.height}
            />
        </VarySlideRenderComp>
    );
}
