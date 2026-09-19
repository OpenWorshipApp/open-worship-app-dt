import { memo } from 'react';

import { BoxEditorComp } from '../box/BoxEditorComp';
import type CanvasItem from '../CanvasItem';
import { CanvasItemContext } from '../CanvasItem';

// Kept as its own memoized component so marquee-drag state updates in
// `BodyRendererComp` don't re-render every box on the canvas.
export const CanvasItemsListComp = memo(function CanvasItemsListComp({
    canvasItems,
}: Readonly<{ canvasItems: CanvasItem<any>[] }>) {
    return canvasItems.map((canvasItem) => {
        return (
            <CanvasItemContext key={canvasItem.id} value={canvasItem}>
                <BoxEditorComp />
            </CanvasItemContext>
        );
    });
});
