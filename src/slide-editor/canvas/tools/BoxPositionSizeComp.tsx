import { tran } from '../../../lang/langHelpers';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { normalizeDegrees } from '../box/boxEditorHelpers';
import BoxNumberFieldComp from './BoxNumberFieldComp';

export default function BoxPositionSizeComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    return (
        <div className="d-flex flex-column gap-1" style={{ maxWidth: '280px' }}>
            <div className="d-flex gap-1">
                <BoxNumberFieldComp
                    name="X:"
                    title={tran('Left')}
                    value={props.left}
                    onChange={(value) => {
                        setProps({ left: value });
                    }}
                />
                <BoxNumberFieldComp
                    name="Y:"
                    title={tran('Top')}
                    value={props.top}
                    onChange={(value) => {
                        setProps({ top: value });
                    }}
                />
            </div>
            <div className="d-flex gap-1">
                <BoxNumberFieldComp
                    name="W:"
                    title={tran('Width')}
                    value={props.width}
                    onChange={(value) => {
                        setProps({ width: Math.max(1, value) });
                    }}
                />
                <BoxNumberFieldComp
                    name="H:"
                    title={tran('Height')}
                    value={props.height}
                    onChange={(value) => {
                        setProps({ height: Math.max(1, value) });
                    }}
                />
            </div>
            <div className="d-flex gap-1">
                <BoxNumberFieldComp
                    name={tran('Rotate:')}
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
