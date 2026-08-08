import { tran } from '../../../lang/langHelpers';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { CanvasItemCameraPropsType } from '../CanvasItemCamera';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { cameraObjectFitList } from '../canvasHelpers';
import { useCameraInfoList } from '../../../helper/cameraHelpers';

const MISSING_DEVICE_VALUE = '__missing__';

export default function SlideEditorToolsCameraComp() {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<CanvasItemCameraPropsType>();
    const cameraInfoList = useCameraInfoList();
    // The stored camera may not be on this machine right now (unplugged, or a
    // document authored elsewhere). Show WHAT is missing rather than a blank
    // select, and keep the stored device selected so merely opening the panel
    // does not silently rewrite the item to some other camera.
    const isDeviceMissing = !cameraInfoList.some((camera) => {
        return camera.deviceId === props.deviceId;
    });
    return (
        <div
            className="app-inner-shadow ps-1"
            style={{
                minWidth: '200px',
            }}
        >
            <SlideEditorToolTitleComp title={tran('Camera Device')} isInline>
                <select
                    className="form-select form-select-sm"
                    value={
                        isDeviceMissing ? MISSING_DEVICE_VALUE : props.deviceId
                    }
                    onChange={(event) => {
                        const newDeviceId = event.target.value;
                        const camera = cameraInfoList.find((cameraInfo) => {
                            return cameraInfo.deviceId === newDeviceId;
                        });
                        if (camera === undefined) {
                            return;
                        }
                        // Both halves move together: the label is the fallback
                        // matcher once Chromium rotates the id.
                        setProps({
                            deviceId: camera.deviceId,
                            label: camera.label,
                        });
                    }}
                >
                    {isDeviceMissing ? (
                        <option value={MISSING_DEVICE_VALUE} disabled>
                            {`${props.label || props.deviceId} (${tran(
                                'Camera not found',
                            )})`}
                        </option>
                    ) : null}
                    {cameraInfoList.map((camera, index) => {
                        return (
                            <option
                                key={camera.deviceId}
                                value={camera.deviceId}
                            >
                                {camera.label ||
                                    `${tran('Camera')} ${index + 1}`}
                            </option>
                        );
                    })}
                </select>
            </SlideEditorToolTitleComp>
            <SlideEditorToolTitleComp title={tran('Mirror')} isInline>
                <div className="form-check form-switch">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={props.isMirrored}
                        onChange={(event) => {
                            setProps({ isMirrored: event.target.checked });
                        }}
                    />
                </div>
            </SlideEditorToolTitleComp>
            <SlideEditorToolTitleComp title={tran('Object Fit')} isInline>
                <div className="btn-group">
                    {cameraObjectFitList.map((objectFit) => {
                        const isActive = props.objectFit === objectFit;
                        return (
                            <button
                                key={objectFit}
                                type="button"
                                className={
                                    'btn btn-sm ' +
                                    (isActive ? 'btn-info' : 'btn-outline-info')
                                }
                                onClick={() => {
                                    setProps({ objectFit });
                                }}
                            >
                                {tran(
                                    objectFit === 'cover'
                                        ? 'Cover'
                                        : objectFit === 'contain'
                                          ? 'Contain'
                                          : 'Fill',
                                )}
                            </button>
                        );
                    })}
                </div>
            </SlideEditorToolTitleComp>
        </div>
    );
}
