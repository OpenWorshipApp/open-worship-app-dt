import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
import AppRangeComp from '../../../others/AppRangeComp';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function ShapePropertiesComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const roundSizePixel = props.roundSizePixel ?? 0;
    const roundSizePercentage =
        roundSizePixel > 0 ? 0 : (props.roundSizePercentage ?? 0);
    const setPropsRef = useAppCurrentRef(setProps);
    const handleBackdropFilterChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setPropsRef.current({
                backdropFilter: Number.parseInt(e.target.value, 10),
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleRoundPercentageChange = useCallback((value: number) => {
        setPropsRef.current({ roundSizePercentage: value });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRoundPixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const value = Number.parseInt(event.target.value, 10) || 0;
            setPropsRef.current({
                roundSizePixel: value,
                roundSizePercentage: 0,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="d-flex flex-column gap-2" style={{ maxWidth: '280px' }}>
            <div className="d-flex align-items-center">
                <span className="pe-2 flex-grow-1">{tran('Glass Effect')}</span>
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
                className="d-flex align-items-center gap-2 app-border-white-round px-2 py-1"
                style={
                    roundSizePixel > 0
                        ? { opacity: 0.5, pointerEvents: 'none' }
                        : {}
                }
            >
                <span className="text-nowrap">{tran('Round Size %:')}</span>
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
            <div className="d-flex input-group input-group-sm">
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
