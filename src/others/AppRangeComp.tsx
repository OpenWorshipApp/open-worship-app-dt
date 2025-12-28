import { useMemo, useState } from 'react';
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

export function handleCtrlWheel({
    event,
    value,
    setValue,
    defaultSize,
}: {
    event: any;
    value: number;
    setValue: (newValue: number) => void;
    defaultSize: AppRangeDefaultType;
}) {
    if (!event.ctrlKey) {
        return;
    }
    const newValue = wheelToRangeValue({
        defaultSize,
        isUp: event.deltaY > 0,
        currentScale: value,
    });
    setValue(newValue);
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
    const fixedSize = useMemo(() => {
        return (defaultSize.step.toString().split('.')[1] || '').length;
    }, [defaultSize]);
    const [localValue, setLocalValue] = useState(
        roundSize(value, defaultSize, fixedSize),
    );
    useAppEffect(() => {
        setLocalValue(roundSize(value, defaultSize, fixedSize));
    }, [value, defaultSize, fixedSize]);
    const setLocalValue1 = (newValue: number) => {
        newValue = roundSize(newValue, defaultSize, fixedSize);
        setLocalValue(newValue);
        setValue(newValue);
    };
    if (defaultSize.max <= defaultSize.min) {
        throw new Error(
            'max must be greater than min value, ' +
                JSON.stringify(defaultSize),
        );
    }
    return (
        <div
            className="form form-inline d-flex mx-2"
            title={title}
            style={{ minWidth: '100px' }}
        >
            <div
                className="pointer"
                onClick={() => {
                    setLocalValue1(localValue - defaultSize.step);
                }}
            >
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
                onChange={(event) => {
                    setLocalValue1(Number.parseInt(event.target.value));
                }}
            />
            <div
                className="pointer"
                onClick={() => {
                    setLocalValue1(localValue + defaultSize.step);
                }}
            >
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
