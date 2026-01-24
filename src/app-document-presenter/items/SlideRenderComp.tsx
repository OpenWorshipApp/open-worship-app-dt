import type { MouseEvent } from 'react';
import { use } from 'react';

import type Slide from '../../app-document-list/Slide';
import SlideRendererHtmlComp from './SlideRendererHtmlComp';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import { SelectedEditingSlideContext } from '../../app-document-list/appDocumentHelpers';
import SlideItemRenderComp from './SlideItemRenderComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';

export default function SlideRenderComp({
    slide,
    width,
    index,
    onClick,
    onContextMenu,
    onCopy,
}: Readonly<{
    slide: Slide;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy: () => void;
}>) {
    const selectedSlide =
        use(SelectedEditingSlideContext)?.selectedSlide ?? null;
    useScreenVaryAppDocumentManagerEvents(['update']);
    return (
        <SlideItemRenderComp
            slide={slide}
            selectedItem={selectedSlide}
            width={width}
            index={index}
            onContextMenu={onContextMenu}
            onClick={onClick}
            onCopy={onCopy}
        >
            <SlideRendererHtmlComp slide={slide} width={width} />
        </SlideItemRenderComp>
    );
}
