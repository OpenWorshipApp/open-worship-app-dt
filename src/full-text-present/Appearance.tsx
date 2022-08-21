
import { useState } from 'react';
import { AppColorType } from '../others/ColorPicker';
import { usePFTMEvents } from '../_present/presentEventHelpers';
import PresentFTManager from '../_present/PresentFTManager';

export default function Appearance() {
    const textStyle = PresentFTManager.getTextStyle();
    const [color, setColor] = useState(
        PresentFTManager.getTextStyleTextColor(textStyle));
    const [fontSize, setFontSize] = useState(
        PresentFTManager.getTextStyleTextFontSize(textStyle));
    usePFTMEvents(['text-style'], undefined, () => {
        const newTextStyle = PresentFTManager.getTextStyle();
        setColor(PresentFTManager.getTextStyleTextColor(newTextStyle));
        setFontSize(PresentFTManager.getTextStyleTextFontSize(newTextStyle));
    });
    const setColorToStyle = (newColor: AppColorType) => {
        PresentFTManager.applyTextStyle({
            color: newColor,
        });
    };
    const setFontSizeToStyle = (newFontSize: number) => {
        PresentFTManager.applyTextStyle({
            fontSize: newFontSize,
        });
    };
    return (
        <div>
            <span className='p-'>
                Font Size
                <span className='badge bg-success'>({fontSize}px)</span>
            </span>-
            <div className='btn-group control'>
                <button className='btn btn-sm btn-info'
                    type='button'
                    onClick={() => {
                        setFontSizeToStyle(fontSize - 1);
                    }}>{'<'}</button>
                <button className='btn btn-sm btn-info'
                    type='button'
                    onClick={() => {
                        setFontSizeToStyle(fontSize + 1);
                    }}>{'>'}</button>
            </div>
            <input className='float-end' type='color'
                onChange={(event) => {
                    setColorToStyle(event.target.value as AppColorType);
                }}
                value={color} />
            <div>
                <input className='form-range'
                    type='range' min='1'
                    max={PresentFTManager.maxTextStyleTextFontSize}
                    value={fontSize} onChange={(event) => {
                        setFontSizeToStyle(+event.target.value);
                    }} />
            </div>
        </div>
    );
}
