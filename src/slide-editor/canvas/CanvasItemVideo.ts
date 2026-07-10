import { getVideoDim } from '../../helper/helpers';
import type { SrcData } from '../../helper/FileSource';
import FileSource from '../../helper/FileSource';
import type { CanvasItemMediaPropsType } from './canvasHelpers';
import { genMediaDefaultBoxStyle, validateMediaProps } from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemVideoPropsType = CanvasItemPropsType &
    CanvasItemMediaPropsType;
class CanvasItemVideo extends CanvasItem<CanvasItemVideoPropsType> {
    static gegStyle(_props: CanvasItemVideoPropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemVideo.gegStyle(this.props);
    }
    get shouldLockAspectRatio() {
        return true;
    }
    static async genCanvasItem(
        srcData: SrcData,
        mediaWidth: number,
        mediaHeight: number,
        x: number,
        y: number,
    ) {
        const props: CanvasItemVideoPropsType = {
            srcData,
            mediaWidth,
            mediaHeight,
            ...genMediaDefaultBoxStyle(),
            left: x - mediaWidth / 2,
            top: y - mediaHeight / 2,
            width: mediaWidth,
            height: mediaHeight,
            type: 'video',
        };
        return this.fromJson(props);
    }
    static async genFromInsertion(x: number, y: number, filePath: string) {
        const fileSource = FileSource.getInstance(filePath);
        const [mediaWidth, mediaHeight] = await getVideoDim(fileSource.src);
        const srcData = await fileSource.getSrcData();
        return this.genCanvasItem(srcData, mediaWidth, mediaHeight, x, y);
    }
    static async genFromFile(x: number, y: number, file: File | Blob) {
        const srcData = await FileSource.getSrcDataFromFrom(file);
        if (srcData === null) {
            throw new Error(
                'Error occurred during reading video data from blob',
            );
        }
        const [mediaWidth, mediaHeight] = await getVideoDim(srcData);
        return this.genCanvasItem(srcData, mediaWidth, mediaHeight, x, y);
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
