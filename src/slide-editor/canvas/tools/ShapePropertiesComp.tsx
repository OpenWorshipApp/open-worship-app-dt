import AppRangeComp from '../../../others/AppRangeComp';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';

export default function ShapePropertiesComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const roundSizePixel = props.roundSizePixel ?? 0;
    const roundSizePercentage =
        roundSizePixel > 0 ? 0 : (props.roundSizePercentage ?? 0);
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
                    onChange={(e) => {
                        setProps({
                            backdropFilter: Number.parseInt(e.target.value, 10),
                        });
                    }}
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
                `Round Size %:
                <AppRangeComp
                    value={roundSizePercentage}
                    title={
                        roundSizePercentage > 0
                            ? 'Set round size pixel to 0 to use this'
                            : '`Round (%)'
                    }
                    setValue={(value) => {
                        setProps({ roundSizePercentage: value });
                    }}
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
                <div className="input-group-text">`Round Size Pixel:</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    value={roundSizePixel}
                    min={0}
                    onChange={(event) => {
                        const value =
                            Number.parseInt(event.target.value, 10) || 0;
                        setProps({
                            roundSizePixel: value,
                            roundSizePercentage: 0,
                        });
                    }}
                />
                <div className="input-group-text">px</div>
            </div>
        </div>
    );
}
