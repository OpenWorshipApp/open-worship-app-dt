import { presentEventListener } from '../event/PresentEventListener';
import { useState } from 'react';
import ColorPicker from '../others/ColorPicker';
import { renderBGColor } from '../slide-presenting/slidePresentHelpers';


export default function Colors() {
    const [color, setColor] = useState('#55efc4');
    const onColorChange = (color: string) => {
        renderBGColor(color);
        setColor(color);
        presentEventListener.renderBG();
    };
    return (
        <ColorPicker color={color} onColorChange={onColorChange} />
    );
}
