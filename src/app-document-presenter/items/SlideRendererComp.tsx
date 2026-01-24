import { renderToStaticMarkup } from 'react-dom/server';

import CanvasItemRendererComp from '../../slide-editor/CanvasItemRendererComp';
import type { CanvasItemPropsType } from '../../slide-editor/canvas/CanvasItem';
import CanvasItem, {
    CanvasItemContext,
} from '../../slide-editor/canvas/CanvasItem';
import { getHTMLChild } from '../../helper/helpers';
import Canvas from '../../slide-editor/canvas/Canvas';

export function genSlideHtml(canvasItemsJson: CanvasItemPropsType[]) {
    const htmlString = renderToStaticMarkup(
        <SlideRendererComp
            width={'100%'}
            height={'100%'}
            canvasItemsJson={canvasItemsJson}
        />,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    return getHTMLChild<HTMLDivElement>(div, 'div');
}

export default function SlideRendererComp({
    width,
    height,
    canvasItemsJson,
}: Readonly<{
    width: string;
    height: string;
    canvasItemsJson: CanvasItemPropsType[];
}>) {
    return (
        <div
            style={{
                width: `${width}px`,
                height: `${height}px`,
            }}
        >
            {canvasItemsJson.map((canvasItemJson: any) => {
                const canvasItem = Canvas.canvasItemFromJson(canvasItemJson);
                return (
                    <div
                        key={canvasItemJson.id}
                        style={CanvasItem.genBoxStyle(canvasItemJson)}
                    >
                        <CanvasItemContext value={canvasItem}>
                            <CanvasItemRendererComp />
                        </CanvasItemContext>
                    </div>
                );
            })}
        </div>
    );
}
