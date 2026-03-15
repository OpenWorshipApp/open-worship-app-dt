import {
    type ChangeEvent,
    useCallback,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';

import { tran } from '../../lang/langHelpers';
import { createMouseEvent } from '../../context-menu/appContextMenuHelpers';
import { HEX_COLOR_WHITE, type AppColorType } from './colorHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { removeOpacityFromHexColor } from '../../server/appHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';

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
        removeOpacityFromHexColor(color || HEX_COLOR_WHITE) as AppColorType,
    );
    const applyColor = useCallback(
        (newColor: AppColorType) => {
            setLocalColor(newColor);
            let fakeEvent = createMouseEvent(0, 0);
            if (inputRef.current !== null) {
                fakeEvent = createMouseEvent(
                    inputRef.current.offsetLeft,
                    inputRef.current.offsetLeft,
                );
            }
            onColorSelected(newColor, fakeEvent);
        },
        [onColorSelected],
    );
    const setLocalColor1 = useCallback(
        (newColor: string) => {
            if (isNoImmediate) {
                setLocalColor(newColor as AppColorType);
                return;
            }
            attemptTimeout(() => {
                applyColor(newColor as AppColorType);
            });
        },
        [isNoImmediate, attemptTimeout, applyColor],
    );
    useAppEffect(() => {
        if (color) {
            setLocalColor(removeOpacityFromHexColor(color) as AppColorType);
        } else {
            setLocalColor(HEX_COLOR_WHITE as AppColorType);
        }
    }, [color]);
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setLocalColor1(event.target.value as any);
        },
        [setLocalColor1],
    );
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                applyColor(localColor);
            }
        },
        [localColor, applyColor],
    );
    const handleBlur = useCallback(() => {
        applyColor(localColor);
    }, [localColor, applyColor]);
    return (
        <>
            <span>{tran('Mix Color: ')}</span>
            <input
                ref={inputRef}
                title="Select custom color"
                className="pointer"
                type="color"
                value={localColor}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
            />
        </>
    );
}
