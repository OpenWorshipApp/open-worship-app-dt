import type { ChangeEvent } from 'react';

import { tran } from '../../../lang/langHelpers';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { normalizeDegrees } from '../box/boxEditorHelpers';

function PositionSizeFieldComp({
    name,
    title,
    value,
    unit = 'px',
    onChange,
}: Readonly<{
    name: string;
    title?: string;
    value: number;
    unit?: string;
    onChange: (value: number) => void;
}>) {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const newValue = Number.parseFloat(event.target.value);
        if (!Number.isNaN(newValue)) {
            onChange(newValue);
        }
    };
    return (
        <div className="d-flex input-group input-group-sm" title={title}>
            <div className="input-group-text">{tran(name)}</div>
            <input
                className="form-control form-control-sm"
                type="number"
                value={Math.round(value)}
                onChange={handleChange}
            />
            <div className="input-group-text">{unit}</div>
        </div>
    );
}

export default function BoxPositionSizeComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    return (
        <div className="d-flex flex-column gap-1" style={{ maxWidth: '280px' }}>
            <div className="d-flex gap-1">
                <PositionSizeFieldComp
                    name="X:"
                    title={tran('Left')}
                    value={props.left}
                    onChange={(value) => {
                        setProps({ left: value });
                    }}
                />
                <PositionSizeFieldComp
                    name="Y:"
                    title={tran('Top')}
                    value={props.top}
                    onChange={(value) => {
                        setProps({ top: value });
                    }}
                />
            </div>
            <div className="d-flex gap-1">
                <PositionSizeFieldComp
                    name="W:"
                    title={tran('Width')}
                    value={props.width}
                    onChange={(value) => {
                        setProps({ width: Math.max(1, value) });
                    }}
                />
                <PositionSizeFieldComp
                    name="H:"
                    title={tran('Height')}
                    value={props.height}
                    onChange={(value) => {
                        setProps({ height: Math.max(1, value) });
                    }}
                />
            </div>
            <div className="d-flex gap-1">
                <PositionSizeFieldComp
                    name="Rotate:"
                    value={props.rotate}
                    unit="deg"
                    onChange={(value) => {
                        // Normalize to [0, 360) the same way dragging the
                        // rotate handle does, so typed values behave
                        // consistently with dragged ones.
                        setProps({ rotate: normalizeDegrees(value) });
                    }}
                />
                <button
                    className="btn btn-sm btn-outline-info"
                    title={tran('Reset Rotate')}
                    aria-label={tran('Reset Rotate')}
                    onClick={() => {
                        setProps({ rotate: 0 });
                    }}
                >
                    <i className="bi bi-arrow-counterclockwise" />
                </button>
            </div>
        </div>
    );
}
