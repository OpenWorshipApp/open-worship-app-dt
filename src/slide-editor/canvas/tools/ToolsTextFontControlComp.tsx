import { useState } from 'react';

import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import CanvasItemText from '../CanvasItemText';
import { useAppEffect } from '../../../helper/debuggerHelpers';
import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasItemContext } from '../CanvasItem';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import FontSizeControlComp from '../../../others/FontSizeControlComp';

export default function ToolsTextFontControlComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext() as CanvasItemText;

    const [localFontFamily, setLocalFontFamily] = useState(
        canvasItem.props.fontFamily ?? '',
    );
    const applyFontFamily = (fontFamily: string) => {
        setLocalFontFamily(fontFamily);
        canvasItem.applyTextData({
            fontFamily: fontFamily || null,
        });
        canvasController.applyEditItem(canvasItem);
    };

    const [localFontWeight, setLocalFontWeight] = useState(
        canvasItem.props.fontWeight ?? '',
    );
    const applyFontWeight = (newFontWeight: string) => {
        setLocalFontWeight(newFontWeight);
        canvasItem.applyTextData({
            fontWeight: newFontWeight || null,
        });
        canvasController.applyEditItem(canvasItem);
    };

    const [localFontSize, setLocalFontSize] = useState(
        canvasItem.props.fontSize,
    );
    const applyFontSize = (fontSize: number) => {
        setLocalFontSize(fontSize);
        canvasItem.applyTextData({ fontSize });
        canvasController.applyEditItem(canvasItem);
    };

    useAppEffect(() => {
        setLocalFontFamily(canvasItem.props.fontFamily ?? '');
        setLocalFontWeight(canvasItem.props.fontWeight ?? '');
        setLocalFontSize(canvasItem.props.fontSize);
    }, [canvasItem]);

    return (
        <SlideEditorToolTitleComp title="Font Size">
            <div className="d-flex">
                <FontSizeControlComp
                    fontSize={localFontSize}
                    setFontSize={applyFontSize}
                />
            </div>
            <hr />
            <div className="d-flex">
                <FontFamilyControlComp
                    fontFamily={localFontFamily}
                    setFontFamily={applyFontFamily}
                    fontWeight={localFontWeight}
                    setFontWeight={applyFontWeight}
                />
            </div>
        </SlideEditorToolTitleComp>
    );
}
