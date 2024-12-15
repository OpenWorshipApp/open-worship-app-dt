import { useState } from 'react';

import SlideItemEditor from './SlideItemEditorTool';
import CanvasItemText from '../CanvasItemText';
import { useFontList } from '../../../server/fontHelpers';
import { FontListType } from '../../../server/appProvider';
import { useAppEffect } from '../../../helper/debuggerHelpers';
import { useCanvasControllerContext } from '../CanvasController';

export default function ToolsTextFontControl({ canvasItemText }: Readonly<{
    canvasItemText: CanvasItemText,
}>) {
    return (
        <SlideItemEditor title='Font Size'>
            <FontSize canvasItemText={canvasItemText} />
            <hr />
            <FontFamily canvasItemText={canvasItemText} />
        </SlideItemEditor>
    );
}
function FontSize({ canvasItemText }: Readonly<{
    canvasItemText: CanvasItemText,
}>) {
    const canvasController = useCanvasControllerContext();
    const [localFontSize, setLocalFontSize] = useState(
        canvasItemText.props.fontSize);
    useAppEffect(() => {
        setLocalFontSize(canvasItemText.props.fontSize);
    }, [canvasItemText]);
    const applyFontSize = (fontSize: number) => {
        setLocalFontSize(fontSize);
        canvasItemText.applyTextData({ fontSize });
        canvasController.fireUpdateEvent();
    };
    return (
        <div>
            <input className='form-control' type='number'
                style={{ maxWidth: '100px' }}
                value={localFontSize}
                onChange={(event) => {
                    applyFontSize(parseInt(event.target.value, 10));
                }} />
            <select className='form-select form-select-sm'
                value={localFontSize}
                onChange={(event) => {
                    applyFontSize(parseInt(event.target.value, 10));
                }} >
                <option>--</option>
                {Array.from({ length: 20 }, (_, i) => (i + 1) * 15)
                    .reverse().map((n) => {
                        return <option key={n}
                            value={n}>{n}px</option>;
                    })}
            </select>
        </div>
    );
}
function FontFamily({ canvasItemText }: Readonly<{
    canvasItemText: CanvasItemText,
}>) {
    const canvasController = useCanvasControllerContext();
    const fontList = useFontList();
    const [localFontFamily, setLocalFontFamily] = useState(
        canvasItemText.props.fontFamily ?? '');
    const applyFontFamily = (fontFamily: string) => {
        setLocalFontFamily(fontFamily);
        canvasItemText.applyTextData({
            fontFamily: fontFamily || null,
        });
        canvasController.fireUpdateEvent();
    };
    if (fontList === null) {
        return (
            <div>Loading Font ...</div>
        );
    }
    return (
        <div className='pb-2'>
            <div>
                <label htmlFor='text-font-family'>Font Family</label>
                <select id='text-font-family'
                    className='form-select form-select-sm'
                    value={localFontFamily}
                    onChange={(event) => {
                        if (event.target.value === '--') {
                            return;
                        }
                        applyFontFamily(event.target.value);
                    }} >
                    <option>--</option>
                    {Object.keys(fontList).map((ff) => {
                        return <option key={ff}
                            value={ff}>{ff}</option>;
                    })}
                </select>
            </div>
            {!!fontList[localFontFamily]?.length && <FontWeight
                fontWeight={''} fontFamily={localFontFamily}
                fontList={fontList}
                canvasItemText={canvasItemText} />}
        </div>
    );
}

function FontWeight({
    fontFamily, fontWeight, fontList, canvasItemText,
}: Readonly<{
    fontWeight: string,
    fontFamily: string,
    fontList: FontListType,
    canvasItemText: CanvasItemText,
}>) {
    const canvasController = useCanvasControllerContext();
    const [localFontWeight, setLocalFontWeight] = useState(fontWeight);
    useAppEffect(() => {
        setLocalFontWeight(fontWeight);
    }, [fontWeight]);
    const applyFontWeight = (newFontWeight: string) => {
        setLocalFontWeight(newFontWeight);
        canvasItemText.applyTextData({
            fontWeight: newFontWeight || null,
        });
        canvasController.fireUpdateEvent();
    };
    return (
        <div>
            <label htmlFor='text-font-style'>Font Style</label>
            <select id='text-font-style'
                className='form-select form-select-sm'
                value={localFontWeight}
                onChange={(event) => {
                    applyFontWeight(event.target.value);
                }} >
                <option>--</option>
                {fontList[fontFamily].map((fs) => {
                    return (
                        <option key={fs}
                            value={fs}>{fs}</option>
                    );
                })}
            </select>
        </div>
    );
}
