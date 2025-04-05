import { useRef, useState } from 'react';

import { createMouseEvent } from '../../context-menu/appContextMenuHelpers';
import { AppColorType } from './colorHelpers';

export default function SelectCustomColor({
    color,
    onColorSelected,
}: Readonly<{
    color: AppColorType | null;
    onColorSelected: (color: AppColorType, event: MouseEvent) => void;
}>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localColor, setLocalColor] = useState<AppColorType>(
        color || '#ffffff',
    );
    const applyColor = (newColor: AppColorType) => {
        setLocalColor(newColor);
        let e = createMouseEvent(0, 0);
        if (inputRef.current !== null) {
            e = createMouseEvent(
                inputRef.current.offsetLeft,
                inputRef.current.offsetLeft,
            );
        }
        onColorSelected(newColor, e);
    };
    return (
        <input
            ref={inputRef}
            title="Select custom color"
            className="pointer"
            type="color"
            value={localColor}
            onKeyUp={(event) => {
                if (event.key === 'Enter') {
                    applyColor(localColor);
                }
            }}
            onBlur={() => {
                applyColor(localColor);
            }}
            onChange={(event) => {
                setLocalColor(event.target.value as any);
            }}
        />
    );
}
