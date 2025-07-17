import { getVideoDim } from '../../helper/helpers';
import FileSource from '../../helper/FileSource';
import {
    CanvasItemMediaPropsType,
    genTextDefaultBoxStyle,
    validateMediaProps,
} from './canvasHelpers';
import CanvasItem, { CanvasItemError, CanvasItemPropsType } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemVideoPropsType = CanvasItemPropsType &
    CanvasItemMediaPropsType;
class CanvasItemVideo extends CanvasItem<CanvasItemVideoPropsType> {
    static gegStyle(_props: CanvasItemVideoPropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemVideo.gegStyle(this.props);
    }
    static async genFromInsertion(x: number, y: number, filePath: string) {
        const fileSource = FileSource.getInstance(filePath);
        const [mediaWidth, mediaHeight] = await getVideoDim(fileSource.src);
        const srcData = await fileSource.getSrcData();
        const props: CanvasItemVideoPropsType = {
            srcData,
            mediaWidth: mediaWidth,
            mediaHeight: mediaHeight,
            ...genTextDefaultBoxStyle(),
            left: x - mediaWidth / 2,
            top: y - mediaHeight / 2,
            width: mediaWidth,
            height: mediaHeight,
            type: 'video',
        };
        return this.fromJson(props);
    }
    toJson(): CanvasItemVideoPropsType {
        return {
            srcData: this.props.srcData,
            mediaWidth: this.props.mediaWidth,
            mediaHeight: this.props.mediaHeight,
            ...super.toJson(),
        };
    }
    static fromJson(json: CanvasItemVideoPropsType) {
        try {
            this.validate(json);
            return new CanvasItemVideo(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        validateMediaProps(json);
    }
}

export default CanvasItemVideo;
