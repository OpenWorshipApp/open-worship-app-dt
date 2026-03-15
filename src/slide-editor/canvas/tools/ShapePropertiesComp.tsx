import { ChangeEvent, useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
import AppRangeComp from '../../../others/AppRangeComp';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';

export default function ShapePropertiesComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const roundSizePixel = props.roundSizePixel ?? 0;
    const roundSizePercentage =
        roundSizePixel > 0 ? 0 : (props.roundSizePercentage ?? 0);
    const handleBackdropFilterChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setProps({
                backdropFilter: Number.parseInt(e.target.value, 10),
            });
        },
        [setProps],
    );
    const handleRoundPercentageChange = useCallback(
        (value: number) => {
            setProps({ roundSizePercentage: value });
        },
        [setProps],
    );
    const handleRoundPixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const value = Number.parseInt(event.target.value, 10) || 0;
            setProps({
                roundSizePixel: value,
                roundSizePercentage: 0,
            });
        },
        [setProps],
    );
    return (
        <div>
            <div className="d-flex">
                <span className="pe-2">Glass Effect:</span>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    min={0}
                    style={{
                        width: '80px',
                    }}
                    value={props.backdropFilter}
                    onChange={handleBackdropFilterChange}
                />
                <span className="ps-1">px</span>
            </div>
            <div
                className="d-flex app-border-white-round m-1"
                style={
                    roundSizePixel > 0
                        ? { opacity: 0.5, pointerEvents: 'none' }
                        : {}
                }
            >
                {tran('Round Size %:')}
                <AppRangeComp
                    value={roundSizePercentage}
                    title={
                        roundSizePercentage > 0
                            ? 'Set round size pixel to 0 to use this'
                            : tran('Round (%)')
                    }
                    setValue={handleRoundPercentageChange}
                    defaultSize={{
                        size: roundSizePercentage,
                        min: 0,
                        max: 100,
                        step: 1,
                    }}
                    isShowValue
                />
            </div>
            <div
                className="d-flex input-group m-1"
                style={{ width: '260px', height: '35px' }}
            >
                <div className="input-group-text">
                    {tran('Round Size Pixel:')}
                </div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    value={roundSizePixel}
                    min={0}
                    onChange={handleRoundPixelChange}
                />
                <div className="input-group-text">px</div>
            </div>
        </div>
    );
}
