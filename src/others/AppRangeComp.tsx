import './AppRangeComp.scss';

import {
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useState,
} from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { pressElementLikeButton } from '../helper/helpers';
import { tran } from '../lang/langHelpers';

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
    const valueRef = useAppCurrentRef(value);
    const setValueRef = useAppCurrentRef(setValue);

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
    isCompact = false,
}: Readonly<{
    value: number;
    title: string;
    id?: string;
    setValue: (newValue: number) => void;
    defaultSize: AppRangeDefaultType;
    isShowValue?: boolean;
    /**
     * The control-strip shape: no zoom buttons, no pill around it, and the
     * value is a box you can TYPE in.
     *
     * The buttons are a whole step apart and the slider does the same job
     * under the thumb, so beside four sliders in one panel they were ~200px
     * spent on nothing -- and a value you can only reach by dragging is a
     * value you cannot set exactly. Ctrl+wheel still steps it either way.
     */
    isCompact?: boolean;
}>) {
    const fixedSize = (defaultSize.step.toString().split('.')[1] || '').length;
    const [localValue, setLocalValue] = useState(
        roundSize(value, defaultSize, fixedSize),
    );
    useAppEffect(() => {
        setLocalValue(roundSize(value, defaultSize, fixedSize));
    }, [value, defaultSize, fixedSize]);
    const defaultSizeRef = useAppCurrentRef(defaultSize);
    const fixedSizeRef = useAppCurrentRef(fixedSize);
    const setValueRef = useAppCurrentRef(setValue);
    const setLocalValue1 = useCallback(
        (newValue: number) => {
            newValue = roundSize(
                newValue,
                defaultSizeRef.current,
                fixedSizeRef.current,
            );
            setLocalValue(newValue);
            setValueRef.current(newValue);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    if (defaultSize.max <= defaultSize.min) {
        throw new Error(
            'max must be greater than min value, ' +
                JSON.stringify(defaultSize),
        );
    }
    const setLocalValue1Ref = useAppCurrentRef(setLocalValue1);
    const localValueRef = useAppCurrentRef(localValue);
    const handleZoomOut = useCallback(() => {
        setLocalValue1Ref.current(
            localValueRef.current - defaultSizeRef.current.step,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRangeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            // parseFLOAT: `Scale` steps by 0.1, and parsing as an int threw
            // away every fractional stop -- dragging it could only ever land
            // on 1, 2 or 3. `roundSize` still snaps to the step after this.
            setLocalValue1Ref.current(Number.parseFloat(event.target.value));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // What is being TYPED, kept as text until Enter or leaving the box. Every
    // keystroke used to be clamped and written back: typing `0.8` into Scale
    // (min 0.1) turned the `0` into `0.1` at once, and the next keys built on
    // that -- it stored 0.2. A draft that is a number in range still applies
    // as it is typed, so the screen follows, but the box keeps the keys.
    const [draftText, setDraftText] = useState<string | null>(null);
    const draftTextRef = useAppCurrentRef(draftText);
    const handleValueTyping = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setDraftText(text);
            const typed = Number.parseFloat(text);
            const { min, max } = defaultSizeRef.current;
            if (Number.isNaN(typed) || typed < min || typed > max) {
                return;
            }
            const newValue = roundSize(
                typed,
                defaultSizeRef.current,
                fixedSizeRef.current,
            );
            setLocalValue(newValue);
            setValueRef.current(newValue);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const commitDraft = useCallback(() => {
        const text = draftTextRef.current;
        if (text === null) {
            return;
        }
        setDraftText(null);
        const typed = Number.parseFloat(text);
        if (!Number.isNaN(typed)) {
            setLocalValue1Ref.current(typed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleValueKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                commitDraft();
            } else if (event.key === 'Escape') {
                setDraftText(null);
            }
        },
        [commitDraft],
    );
    const handleZoomIn = useCallback(() => {
        setLocalValue1Ref.current(
            localValueRef.current + defaultSizeRef.current.step,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'form form-inline d-flex app-range' +
                (isCompact ? ' app-range-compact' : '')
            }
            title={title}
            style={{ minWidth: isCompact ? '92px' : '100px' }}
        >
            {/* Buttons with names: bare clickable divs were out of the
                accessibility tree and out of reach of the keyboard. */}
            {isCompact ? null : (
                <div
                    className="pointer"
                    role="button"
                    tabIndex={0}
                    title={tran('Zoom Out')}
                    aria-label={tran('Zoom Out')}
                    onClick={handleZoomOut}
                    onKeyDown={pressElementLikeButton}
                >
                    <i className="bi bi-zoom-out" />
                </div>
            )}
            <input
                id={id}
                className="form-range px-1"
                aria-label={title}
                title={localValue.toString()}
                type="range"
                min={defaultSize.min}
                max={defaultSize.max}
                step={defaultSize.step}
                value={localValue}
                onChange={handleRangeChange}
            />
            {isCompact ? null : (
                <div
                    className="pointer"
                    role="button"
                    tabIndex={0}
                    title={tran('Zoom In')}
                    aria-label={tran('Zoom In')}
                    onClick={handleZoomIn}
                    onKeyDown={pressElementLikeButton}
                >
                    <i className="bi bi-zoom-in" />
                </div>
            )}
            {isShowValue && isCompact ? (
                <input
                    className="app-range-value"
                    type="number"
                    aria-label={title}
                    value={draftText ?? localValue}
                    min={defaultSize.min}
                    max={defaultSize.max}
                    step={defaultSize.step}
                    onChange={handleValueTyping}
                    onBlur={commitDraft}
                    onKeyDown={handleValueKeyDown}
                />
            ) : null}
            {isShowValue && !isCompact ? (
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
