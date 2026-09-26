import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useScreenMaskManagerEvents } from '../managers/screenEventHelpers';
import { MASK_INSET_MAX, MASK_INSET_MIN } from '../managers/ScreenMaskManager';
import type { MaskDataType } from '../screenTypeHelpers';

// Blanking controls. Four edges and a colour, and deliberately NOTHING else:
// no keyboard steps, no shortcut bindings, no arming. A mask is measured ONCE
// for the room the projector stands in and then left alone for months, so
// every key it claimed would be a key taken away from the things an operator
// really does drive mid-service.
const INSET_STEP = 1;

function MaskEdgeRangeComp({
    icon,
    label,
    value,
    setValue,
}: Readonly<{
    icon: string;
    label: string;
    value: number;
    setValue: (value: number) => void;
}>) {
    return (
        <label
            className="d-flex align-items-center gap-1 m-0"
            title={label}
            style={{ minWidth: '150px' }}
        >
            <i className={`bi ${icon}`} />
            <input
                type="range"
                className="form-range"
                style={{ width: '80px' }}
                aria-label={label}
                min={MASK_INSET_MIN}
                max={MASK_INSET_MAX}
                step={INSET_STEP}
                value={value}
                onChange={(event) => {
                    setValue(Number.parseInt(event.target.value, 10));
                }}
            />
            <small className="text-muted" style={{ minWidth: '32px' }}>
                {value}%
            </small>
        </label>
    );
}

export default function MiniScreenMaskHandlersComp() {
    const { screenMaskManager } = useScreenManagerContext();
    // Re-render when another window (or a sync-group member) changes the mask.
    useScreenMaskManagerEvents(['update']);
    const [maskData, setMaskData] = useState<MaskDataType>(
        screenMaskManager.maskData,
    );

    // Every control writes local state (so the slider tracks the thumb) and the
    // manager, which repaints, persists and broadcasts. The manager is the only
    // writer of what is on screen -- the same single-writer arrangement the
    // spotlight panel uses.
    const handleChange = (partial: Partial<MaskDataType>) => {
        const newMaskData = { ...maskData, ...partial };
        setMaskData(newMaskData);
        screenMaskManager.setMaskData(newMaskData);
    };
    const handleClearing = () => {
        screenMaskManager.clearMask();
        setMaskData(screenMaskManager.maskData);
    };

    const isMasking = screenMaskManager.isShowing;
    return (
        <div className="w-100">
            <hr className="w-100 my-1" />
            <div className="d-flex flex-wrap align-items-center gap-2 px-1 pb-1">
                <MaskEdgeRangeComp
                    icon="bi-align-top"
                    label={tran('Cover from the top')}
                    value={maskData.topPercentage}
                    setValue={(value) => {
                        handleChange({ topPercentage: value });
                    }}
                />
                <MaskEdgeRangeComp
                    icon="bi-align-bottom"
                    label={tran('Cover from the bottom')}
                    value={maskData.bottomPercentage}
                    setValue={(value) => {
                        handleChange({ bottomPercentage: value });
                    }}
                />
                <MaskEdgeRangeComp
                    icon="bi-align-start"
                    label={tran('Cover from the left')}
                    value={maskData.leftPercentage}
                    setValue={(value) => {
                        handleChange({ leftPercentage: value });
                    }}
                />
                <MaskEdgeRangeComp
                    icon="bi-align-end"
                    label={tran('Cover from the right')}
                    value={maskData.rightPercentage}
                    setValue={(value) => {
                        handleChange({ rightPercentage: value });
                    }}
                />
                <label
                    className="d-flex align-items-center gap-1 m-0"
                    title={tran('Mask color')}
                >
                    <i className="bi bi-palette" />
                    <input
                        type="color"
                        className="form-control form-control-color p-0"
                        style={{ width: '28px', height: '24px' }}
                        aria-label={tran('Mask color')}
                        value={maskData.color}
                        onChange={(event) => {
                            handleChange({ color: event.target.value });
                        }}
                    />
                </label>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleClearing}
                    disabled={!isMasking}
                    title={tran('Remove Mask')}
                    aria-label={tran('Remove Mask')}
                >
                    <i className="bi bi-arrow-repeat" />
                </button>
                <div className="ms-auto d-flex align-items-center gap-2">
                    <small className="text-muted">
                        {isMasking
                            ? tran('Clear All does not remove the mask')
                            : tran('Cover the edges the projector overshoots')}
                    </small>
                </div>
            </div>
        </div>
    );
}
