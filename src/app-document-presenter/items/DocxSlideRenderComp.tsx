import { type MouseEvent, useCallback } from 'react';

import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import type DocxSlide from '../../app-document-list/DocxSlide';
import VarySlideRenderComp from './VarySlideRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useVaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import type DocxAppDocument from '../../app-document-list/DocxAppDocument';
import { type VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import HtmlSlideRenderComp, {
    genHtmlSlideContent,
} from './HtmlSlideRenderComp';
import FileSource from '../../helper/FileSource';

function genDocxIframeElement(
    htmlFilePath: string,
    width: number,
    height: number,
    parentWidth?: number,
) {
    const iframe = document.createElement('iframe');
    const fileSource = FileSource.getInstance(htmlFilePath);
    iframe.title = 'docx-slide';
    iframe.src = fileSource.src;
    Object.assign(iframe.style, {
        colorScheme: 'normal',
        backgroundColor: 'transparent',
        border: 'none',
        overflow: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        width: `${width}px`,
        height: `${height}px`,
    });
    if (parentWidth === undefined) {
        return iframe;
    }
    const wrapper = document.createElement('div');
    const scale = parentWidth / width;
    Object.assign(wrapper.style, {
        position: 'relative',
        width: '100%',
        aspectRatio: `${width} / ${height}`,
    });
    Object.assign(iframe.style, {
        position: 'absolute',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        inset: '0',
    });
    wrapper.appendChild(iframe);
    return wrapper;
}

function DocxSlideIframeContentComp(
    props: Readonly<{
        htmlFilePath: string;
        width: number;
        height: number;
        parentWidth?: number;
    }>,
) {
    const { htmlFilePath, width, height, parentWidth } = props;
    if (parentWidth !== undefined) {
        const aspectRatio = parentWidth / width;
        return (
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                }}
            >
                <iframe
                    title="docx-slide"
                    style={{
                        colorScheme: 'normal',
                        backgroundColor: 'transparent',
                        border: 'none',
                        overflow: 'hidden',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        width,
                        height,
                        position: 'absolute',
                        transform: `scale(${aspectRatio})`,
                        transformOrigin: 'top left',
                        inset: 0,
                    }}
                    src={FileSource.getInstance(htmlFilePath).src}
                />
            </div>
        );
    }
    return (
        <iframe
            title="docx-slide"
            style={{
                colorScheme: 'normal',
                backgroundColor: 'transparent',
                border: 'none',
                overflow: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                width,
                height,
            }}
            src={FileSource.getInstance(htmlFilePath).src}
        />
    );
}

function DocxSlideRenderContentComp(
    props: Readonly<{
        html?: string;
        htmlFilePath: string;
        width: number;
        height: number;
        parentWidth?: number;
    }>,
) {
    const { html, htmlFilePath, width, height, parentWidth } = props;
    if (html === undefined) {
        return (
            <DocxSlideIframeContentComp
                htmlFilePath={htmlFilePath}
                width={width}
                height={height}
                parentWidth={parentWidth}
            />
        );
    }
    return (
        <HtmlSlideRenderComp
            html={html}
            htmlFilePath={htmlFilePath}
            width={width}
            height={height}
            parentWidth={parentWidth}
        />
    );
}

export function genDocxSlide(
    html: string | undefined,
    htmlFilePath: string,
    width: number,
    height: number,
    parentWidth: number,
    isFullWidth = false,
) {
    if (html === undefined) {
        const div = document.createElement('div');
        div.style.width = '100%';
        div.style.height = isFullWidth ? 'auto' : '100%';
        div.appendChild(
            genDocxIframeElement(
                htmlFilePath,
                width,
                height,
                isFullWidth ? parentWidth : undefined,
            ),
        );
        return div;
    }
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = isFullWidth ? 'auto' : '100%';
    div.appendChild(
        genHtmlSlideContent({
            html,
            htmlFilePath,
            width,
            height,
            parentWidth: isFullWidth ? parentWidth : undefined,
        }),
    );
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
                html={docxSlide.html}
                htmlFilePath={docxSlide.htmlFilePath}
                width={docxSlide.width}
                height={docxSlide.height}
            />
        </VarySlideRenderComp>
    );
}
