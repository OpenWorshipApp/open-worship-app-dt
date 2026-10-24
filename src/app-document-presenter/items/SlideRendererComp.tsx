import { renderToStaticMarkup } from 'react-dom/server';

import CanvasItemRendererComp from '../../slide-editor/CanvasItemRendererComp';
import type { CanvasItemPropsType } from '../../slide-editor/canvas/CanvasItem';
import CanvasItem, {
    CanvasItemContext,
} from '../../slide-editor/canvas/CanvasItem';
import { getHTMLChild } from '../../helper/helpers';
import Canvas from '../../slide-editor/canvas/Canvas';
import { sanitizeSlideHtml } from '../../helper/sanitizeHelpers';
import { ensureCanvasItemUuids } from '../../slide-editor/canvas/canvasItemIdentityHelpers';
import {
    CanvasItemSafeHtmlContext,
    genCanvasItemSafeHtml,
} from '../../slide-editor/canvas/canvasItemSafeHtmlHelpers';

type SlideItemType = {
    canvasItemJson: any;
    canvasItem: CanvasItem<any>;
    safeHtml: string | null;
};

function genSlideItems(
    canvasItemsJson: CanvasItemPropsType[],
    isSanitizing: boolean,
): SlideItemType[] {
    return ensureCanvasItemUuids(canvasItemsJson).map((canvasItemJson: any) => {
        const canvasItem = Canvas.canvasItemFromJson(canvasItemJson);
        const html = canvasItem.props.html;
        return {
            canvasItemJson,
            canvasItem,
            safeHtml:
                isSanitizing && typeof html === 'string'
                    ? genCanvasItemSafeHtml(html)
                    : null,
        };
    });
}

export function genSlideHtml(canvasItemsJson: CanvasItemPropsType[]) {
    // The raw policy runs BEFORE the static render, never inside it: see
    // `CanvasItemSafeHtmlContext`.
    const slideItems = genSlideItems(canvasItemsJson, true);
    const htmlString = renderToStaticMarkup(
        <SlideRendererComp
            width={'100%'}
            height={'100%'}
            canvasItemsJson={canvasItemsJson}
            slideItems={slideItems}
        />,
    );
    const div = document.createElement('div');
    div.innerHTML = sanitizeSlideHtml(htmlString);
    return getHTMLChild<HTMLDivElement>(div, 'div');
}

export default function SlideRendererComp({
    width,
    height,
    canvasItemsJson,
    slideItems,
}: Readonly<{
    width: string;
    height: string;
    canvasItemsJson: CanvasItemPropsType[];
    // `genSlideHtml` builds these ahead, their markup already sanitized.
    slideItems?: SlideItemType[];
}>) {
    const items = slideItems ?? genSlideItems(canvasItemsJson, false);
    return (
        <div
            style={{
                width,
                height,
            }}
        >
            {items.map(({ canvasItemJson, canvasItem, safeHtml }) => {
                return (
                    <div
                        key={canvasItemJson.id}
                        data-canvas-item-uuid={
                            canvasItemJson.uuid ?? canvasItem.uuid
                        }
                        data-canvas-item-transition={
                            canvasItem.props.transitionEffect
                        }
                        style={CanvasItem.genBoxStyle(canvasItemJson)}
                    >
                        <CanvasItemContext value={canvasItem}>
                            <CanvasItemSafeHtmlContext value={safeHtml}>
                                <CanvasItemRendererComp />
                            </CanvasItemSafeHtmlContext>
                        </CanvasItemContext>
                    </div>
                );
            })}
        </div>
    );
}
