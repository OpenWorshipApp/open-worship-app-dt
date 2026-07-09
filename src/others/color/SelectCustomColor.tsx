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
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
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
    const setLocalColor1Ref = useAppCurrentRef(setLocalColor1);
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setLocalColor1Ref.current(event.target.value as any);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const localColorRef = useAppCurrentRef(localColor);
    const applyColorRef = useAppCurrentRef(applyColor);
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                applyColorRef.current(localColorRef.current);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleBlur = useCallback(() => {
        applyColorRef.current(localColorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
