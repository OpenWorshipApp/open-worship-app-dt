import { getVideoDim } from '../../helper/helpers';
import FileSource from '../../helper/FileSource';
import { getAppFilePathFromFile } from '../../helper/localFileHelpers';
import type { CanvasItemVideoMediaPropsType } from './canvasHelpers';
import { genMediaDefaultBoxStyle, validateMediaProps } from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemVideoPropsType = CanvasItemPropsType &
    CanvasItemVideoMediaPropsType;
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
        filePath: string,
        mediaWidth: number,
        mediaHeight: number,
        x: number,
        y: number,
    ) {
        const props: CanvasItemVideoPropsType = {
            filePath,
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
        return this.genCanvasItem(filePath, mediaWidth, mediaHeight, x, y);
    }
    static async genFromFile(x: number, y: number, file: File | Blob) {
        // Videos are referenced by their on-disk path rather than inlined, so
        // a blob without a resolvable file path (e.g. clipboard paste) cannot
        // become a video item.
        const filePath = getAppFilePathFromFile(file);
        if (filePath === null) {
            throw new Error(
                'Error occurred during resolving video file path from blob',
            );
        }
        return this.genFromInsertion(x, y, filePath);
    }
    toJson(): CanvasItemVideoPropsType {
        return {
            filePath: this.props.filePath,
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
        validateMediaProps(json, 'filePath');
    }
}

export default CanvasItemVideo;
