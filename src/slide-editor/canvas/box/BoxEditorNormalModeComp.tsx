import type { CSSProperties } from 'react';

import {
    useCanvasItemContext,
    useEditingCanvasItemAndSetterContext,
} from '../CanvasItem';
import BoxEditorNormalViewImageModeComp from './BoxEditorNormalViewImageModeComp';
import BoxEditorNormalTextEditModeComp from './BoxEditorNormalTextEditModeComp';
import BoxEditorNormalViewHtmlModeComp from './BoxEditorNormalViewHtmlModeComp';
import BoxEditorNormalViewTextModeComp from './BoxEditorNormalViewTextModeComp';
import BoxEditorNormalViewBibleModeComp from './BoxEditorNormalViewBibleModeComp';
import BoxEditorNormalViewErrorComp from './BoxEditorNormalViewErrorComp';
import BoxEditorNormalViewVideoModeComp from './BoxEditorNormalViewVideoModeComp';

export default function BoxEditorNormalModeComp() {
    const canvasItem = useCanvasItemContext();
    const { canvasItem: editingCanvasItem } =
        useEditingCanvasItemAndSetterContext();
    // Only the box style, matching what the screen output wraps a canvas item
    // in. The item's content style (font, alignment, padding) belongs to the
    // renderer inside, which applies it itself — spreading it here too padded
    // and flexed the content a second time, so a box shifted and re-wrapped
    // its text as soon as it was selected (controlling mode styles the box
    // alone).
    const style: CSSProperties = canvasItem.getBoxStyle();
    switch (canvasItem.type) {
        case 'image':
            return <BoxEditorNormalViewImageModeComp style={style} />;
        case 'video':
            return <BoxEditorNormalViewVideoModeComp style={style} />;
        case 'text':
            if (canvasItem === editingCanvasItem) {
                return <BoxEditorNormalTextEditModeComp style={style} />;
            }
            return <BoxEditorNormalViewTextModeComp style={style} />;
        case 'html':
            return <BoxEditorNormalViewHtmlModeComp style={style} />;
        case 'bible':
            return <BoxEditorNormalViewBibleModeComp style={style} />;
        default:
            return <BoxEditorNormalViewErrorComp />;
    }
}
