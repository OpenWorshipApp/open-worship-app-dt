import type {
    CameraObjectFitType,
    CanvasItemCameraDevicePropsType,
} from './canvasHelpers';
import {
    CAMERA_DEFAULT_BACKGROUND_COLOR,
    CAMERA_EMBED_HEIGHT,
    CAMERA_EMBED_WIDTH,
    cameraObjectFitList,
    genMediaDefaultBoxStyle,
    validateCameraProps,
} from './canvasHelpers';
import type { AppColorType } from '../../others/color/colorHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemCameraPropsType = {
    type: 'camera';
} & CanvasItemPropsType &
    CanvasItemCameraDevicePropsType;

// A live camera feed placed as a box on a slide. Unlike every other media item
// this one holds NO source data at all — just which device to open — and it is
// drawn as a static placeholder everywhere except a screen, where
// `ScreenVaryAppDocumentManager` hydrates it. See `CAMERA_ITEM_ATTR`.
//
// Deliberately imports nothing from `cameraHelpers`: that module destructures
// `navigator.mediaDevices` at load, and the canvas model tests run in the node
// environment.
class CanvasItemCamera extends CanvasItem<CanvasItemCameraPropsType> {
    constructor(props: CanvasItemCameraPropsType) {
        super(props);
        // Defaulted here rather than in `validate` so an item saved by a build
        // that predates these props still renders.
        this.props.isMirrored = props.isMirrored ?? false;
        this.props.objectFit = cameraObjectFitList.includes(props.objectFit)
            ? props.objectFit
            : 'cover';
    }
    static gegStyle(_props: CanvasItemCameraPropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemCamera.gegStyle(this.props);
    }
    // NOT ratio-locked, unlike the youtube/website embeds: a webcam's own ratio
    // is unknown until its stream opens, and `objectFit` is what decides how the
    // feed fills whatever box the operator draws.
    get shouldLockAspectRatio() {
        return false;
    }
    static genCanvasItem(
        deviceId: string,
        label: string,
        x: number,
        y: number,
    ) {
        const props: CanvasItemCameraPropsType = {
            deviceId,
            label,
            isMirrored: false,
            objectFit: 'cover' as CameraObjectFitType,
            ...genMediaDefaultBoxStyle(CAMERA_EMBED_WIDTH, CAMERA_EMBED_HEIGHT),
            // Overrides the fully-transparent media default on purpose — see
            // `CAMERA_DEFAULT_BACKGROUND_COLOR`.
            backgroundColor: CAMERA_DEFAULT_BACKGROUND_COLOR as AppColorType,
            left: x - CAMERA_EMBED_WIDTH / 2,
            top: y - CAMERA_EMBED_HEIGHT / 2,
            width: CAMERA_EMBED_WIDTH,
            height: CAMERA_EMBED_HEIGHT,
            type: 'camera',
        };
        return this.fromJson(props);
    }
    static genFromDevice(
        x: number,
        y: number,
        deviceId: string,
        label: string,
    ) {
        return this.genCanvasItem(deviceId, label, x, y);
    }
    toJson(): CanvasItemCameraPropsType {
        return {
            deviceId: this.props.deviceId,
            label: this.props.label,
            isMirrored: this.props.isMirrored,
            objectFit: this.props.objectFit,
            ...super.toJson(),
            type: 'camera',
        };
    }
    static fromJson(json: CanvasItemCameraPropsType) {
        try {
            this.validate(json);
            return new CanvasItemCamera(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        validateCameraProps(json);
    }
}

export default CanvasItemCamera;
