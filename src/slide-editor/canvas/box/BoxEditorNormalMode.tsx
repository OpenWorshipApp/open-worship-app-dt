import { CSSProperties } from 'react';
import CanvasItem from '../CanvasItem';
import CanvasItemImage from '../CanvasItemImage';
import CanvasItemText from '../CanvasItemText';
import BENViewImageMode from './BENViewImageMode';
import BENTextEditMode from './BENTextEditMode';
import BENViewTextMode from './BENViewTextMode';
import BENViewBibleMode from './BENViewBibleMode';
import CanvasItemBible from '../CanvasItemBible';
import { useCCEvents } from '../canvasHelpers';
import BENViewError from './BENViewError';

export default function BoxEditorNormalMode({ canvasItem }: {
    canvasItem: CanvasItem<any>,
}) {
    const style: CSSProperties = {
        ...canvasItem.getStyle(),
        ...canvasItem.getBoxStyle(),
    };
    useCCEvents(['text-edit', 'update']);
    if (canvasItem.isTypeImage) {
        return (
            <BENViewImageMode
                canvasItemImage={canvasItem as CanvasItemImage}
                style={style} />
        );
    }
    if (canvasItem.isTypeText) {
        const canvasItemText = canvasItem as CanvasItemText;
        if (canvasItem.isEditing) {
            return (
                <BENTextEditMode canvasItemText={canvasItemText}
                    style={style} />
            );
        }
        return (
            <BENViewTextMode canvasItemText={canvasItemText}
                style={style} />
        );
    }
    if (canvasItem.isTypeBible) {
        return (
            <BENViewBibleMode
                canvasItemBible={canvasItem as CanvasItemBible}
                style={style} />
        );
    }
    return <BENViewError canvasItem={canvasItem}/>;
}
