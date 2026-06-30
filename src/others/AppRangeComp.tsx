import {
    type ChangeEvent,
    type RefObject,
    useCallback,
    useRef,
    useState,
} from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';

export type AppRangeDefaultType = {
    size: number;
    min: number;
    max: number;
    step: number;
};

export function wheelToRangeValue({
    defaultSize,
    isUp,
    currentScale,
}: {
    defaultSize: AppRangeDefaultType;
    isUp: boolean;
    currentScale: number;
}) {
    let newScale = currentScale + (isUp ? 1 : -1) * defaultSize.step;
    if (newScale < defaultSize.min) {
        newScale = defaultSize.min;
    }
    if (newScale > defaultSize.max) {
        newScale = defaultSize.max;
    }
    return newScale;
}

export function pinchToRangeValue({
    defaultSize,
    startValue,
    startDistance,
    currentDistance,
}: {
    defaultSize: AppRangeDefaultType;
    startValue: number;
    startDistance: number;
    currentDistance: number;
}) {
    if (startDistance <= 0) {
        return startValue;
    }
    let newScale = (startValue * currentDistance) / startDistance;
    if (newScale < defaultSize.min) {
        newScale = defaultSize.min;
    }
    if (newScale > defaultSize.max) {
        newScale = defaultSize.max;
    }
    return newScale;
}

type HandleCtrlWheelOptions = {
    value: number;
    setValue: (newValue: number) => void;
    defaultSize: AppRangeDefaultType;
};

export function handleCtrlWheel({
    event,
    value,
    setValue,
    defaultSize,
}: HandleCtrlWheelOptions & {
    event: any;
}) {
    if (!event.ctrlKey) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const newValue = wheelToRangeValue({
        defaultSize,
        isUp: event.deltaY > 0,
        currentScale: value,
    });
    setValue(newValue);
}

export function useZoomingRegistering<T extends HTMLElement>(
    containerRef: RefObject<T | null>,
    { value, setValue, defaultSize }: HandleCtrlWheelOptions,
) {
    const valueRef = useRef(value);
    valueRef.current = value;
    const setValueRef = useRef(setValue);
    setValueRef.current = setValue;

    useAppEffect(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }

        const handleWheel = (event: WheelEvent) => {
            handleCtrlWheel({
                event,
                value: valueRef.current,
                setValue: setValueRef.current,
                defaultSize,
            });
        };
        container.addEventListener('wheel', handleWheel, {
            passive: false,
        });

        const getTouchesDistance = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        };
        let pinchStartDistance: number | null = null;
        let pinchStartFontSize = valueRef.current;
        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length === 2) {
                pinchStartDistance = getTouchesDistance(event.touches);
                pinchStartFontSize = valueRef.current;
            }
        };
        const handleTouchMove = (event: TouchEvent) => {
            if (event.touches.length !== 2 || pinchStartDistance === null) {
                return;
            }
            event.preventDefault();
            const newFontSize = pinchToRangeValue({
                currentDistance: getTouchesDistance(event.touches),
                startValue: pinchStartFontSize,
                defaultSize,
                startDistance: pinchStartDistance,
            });
            setValueRef.current(Math.round(newFontSize));
        };
        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) {
                pinchStartDistance = null;
            }
        };
        container.addEventListener('touchstart', handleTouchStart, {
            passive: false,
        });
        container.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);

            container.removeEventListener('wheel', handleWheel);
        };
    }, [containerRef.current]);
}

function roundSize(
    value: number,
    defaultSize: AppRangeDefaultType,
    fixedSize: number,
): number {
    value = Math.min(defaultSize.max, Math.max(defaultSize.min, value));
    return Number.parseFloat(value.toFixed(fixedSize));
}

export default function AppRangeComp({
    value,
    title,
    id,
    setValue,
    defaultSize,
    isShowValue,
}: Readonly<{
    value: number;
    title: string;
    id?: string;
    setValue: (newValue: number) => void;
    defaultSize: AppRangeDefaultType;
    isShowValue?: boolean;
}>) {
    const fixedSize = (defaultSize.step.toString().split('.')[1] || '').length;
    const [localValue, setLocalValue] = useState(
        roundSize(value, defaultSize, fixedSize),
    );
    useAppEffect(() => {
        setLocalValue(roundSize(value, defaultSize, fixedSize));
    }, [value, defaultSize, fixedSize]);
    const setLocalValue1 = useCallback(
        (newValue: number) => {
            newValue = roundSize(newValue, defaultSize, fixedSize);
            setLocalValue(newValue);
            setValue(newValue);
        },
        [defaultSize, fixedSize, setValue],
    );
    if (defaultSize.max <= defaultSize.min) {
        throw new Error(
            'max must be greater than min value, ' +
                JSON.stringify(defaultSize),
        );
    }
    const handleZoomOut = useCallback(() => {
        setLocalValue1(localValue - defaultSize.step);
    }, [setLocalValue1, localValue, defaultSize.step]);
    const handleRangeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setLocalValue1(Number.parseInt(event.target.value));
        },
        [setLocalValue1],
    );
    const handleZoomIn = useCallback(() => {
        setLocalValue1(localValue + defaultSize.step);
    }, [setLocalValue1, localValue, defaultSize.step]);
    return (
        <div
            className="form form-inline d-flex mx-2 px-1 py-0"
            title={title}
            style={{ minWidth: '100px' }}
        >
            <div className="pointer" onClick={handleZoomOut}>
                <i className="bi bi-zoom-out" />
            </div>
            <input
                id={id}
                className="form-range px-1"
                title={localValue.toString()}
                type="range"
                min={defaultSize.min}
                max={defaultSize.max}
                step={defaultSize.step}
                value={localValue}
                onChange={handleRangeChange}
            />
            <div className="pointer" onClick={handleZoomIn}>
                <i className="bi bi-zoom-in" />
            </div>
            {isShowValue ? (
                <label
                    className="form-label"
                    style={{
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    :{localValue}
                </label>
            ) : null}
        </div>
    );
}
