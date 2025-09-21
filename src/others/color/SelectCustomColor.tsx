import { useMemo, useRef, useState } from 'react';

import { createMouseEvent } from '../../context-menu/appContextMenuHelpers';
import { AppColorType } from './colorHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { genTimeoutAttempt } from '../../helper/helpers';
import { removeOpacityFromHexColor } from '../../server/appHelpers';

export default function SelectCustomColor({
    color,
    onColorSelected,
    isNoImmediate = false,
}: Readonly<{
    color: AppColorType | null | undefined;
    onColorSelected: (color: AppColorType, event: MouseEvent) => void;
    isNoImmediate?: boolean;
}>) {
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const inputRef = useRef<HTMLInputElement>(null);
    const [localColor, setLocalColor] = useState(
        removeOpacityFromHexColor(color || '#ffffff') as AppColorType,
    );
    const applyColor = (newColor: AppColorType) => {
        setLocalColor(newColor);
        let fakeEvent = createMouseEvent(0, 0);
        if (inputRef.current !== null) {
            fakeEvent = createMouseEvent(
                inputRef.current.offsetLeft,
                inputRef.current.offsetLeft,
            );
        }
        onColorSelected(newColor, fakeEvent);
    };
    const setLocalColor1 = (newColor: string) => {
        if (isNoImmediate) {
            setLocalColor(newColor as AppColorType);
            return;
        }
        attemptTimeout(() => {
            applyColor(newColor as AppColorType);
        });
    };
    useAppEffect(() => {
        if (color) {
            setLocalColor(removeOpacityFromHexColor(color) as AppColorType);
        } else {
            setLocalColor('#ffffff' as AppColorType);
        }
    }, [color]);
    return (
        <>
            <span>`Mix Color: </span>
            <input
                ref={inputRef}
                title="Select custom color"
                className="pointer"
                type="color"
                value={localColor}
                onChange={(event) => {
                    setLocalColor1(event.target.value as any);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        applyColor(localColor);
                    }
                }}
                onBlur={() => {
                    applyColor(localColor);
                }}
            />
        </>
    );
}
