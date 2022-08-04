
import { useState } from 'react';
import fullTextPresentHelper from './fullTextPresentHelper';
import { usePresentCtrlScrolling } from '../event/PresentEventListener';
import { AppColorType } from '../others/ColorPicker';

export default function Appearance() {
    const [color, setColor] = useState(fullTextPresentHelper.textColor);
    const [fontSize, setFontSize] = useState(fullTextPresentHelper.textFontSize);
    const setColorToStyle = (newColor: AppColorType) => {
        setColor(newColor);
        fullTextPresentHelper.setStyle({ color: newColor });
    };
    const setFontSizeToStyle = (newFontSize: number) => {
        setFontSize(newFontSize);
        fullTextPresentHelper.setStyle({ fontSize: newFontSize });
    };
    usePresentCtrlScrolling(() => {
        setFontSize(fullTextPresentHelper.textFontSize);
    });
    return (
        <div>
            <span className='p-'>Font Size <span className='badge bg-success'>({fontSize}px)</span></span>-
            <div className='btn-group control'>
                <button type='button' className='btn btn-sm btn-info'
                    onClick={() => {
                        setFontSizeToStyle(fontSize - 1);
                    }}>{'<'}</button>
                <button type='button' className='btn btn-sm btn-info'
                    onClick={() => {
                        setFontSizeToStyle(fontSize + 1);
                    }}>{'>'}</button>
            </div>
            <input className='float-end' type='color' onChange={(e) => {
                setColorToStyle(e.target.value as AppColorType);
            }} value={color} />
            <div>
                <input type='range' className='form-range' min='1' max='200'
                    value={fontSize} onChange={(e) => {
                        setFontSizeToStyle(+e.target.value);
                    }} />
            </div>
        </div>
    );
}
