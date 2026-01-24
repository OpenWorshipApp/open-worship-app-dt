import { getImageDim } from '../../helper/helpers';
import type { SrcData } from '../../helper/FileSource';
import FileSource from '../../helper/FileSource';
import type { CanvasItemMediaPropsType } from './canvasHelpers';
import { genTextDefaultBoxStyle, validateMediaProps } from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemImagePropsType = CanvasItemPropsType &
    CanvasItemMediaPropsType;
class CanvasItemImage extends CanvasItem<CanvasItemImagePropsType> {
    static gegStyle(_props: CanvasItemImagePropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemImage.gegStyle(this.props);
    }
    static async genCanvasItem(
        srcData: SrcData,
        mediaWidth: number,
        mediaHeight: number,
        x: number,
        y: number,
    ) {
        const props: CanvasItemImagePropsType = {
            srcData,
            mediaWidth,
            mediaHeight,
            ...genTextDefaultBoxStyle(),
            left: x - mediaWidth / 2,
            top: y - mediaHeight / 2,
            width: mediaWidth,
            height: mediaHeight,
            type: 'image',
        };
        return this.fromJson(props);
    }
    static async genFromInsertion(x: number, y: number, filePath: string) {
        const fileSource = FileSource.getInstance(filePath);
        const [mediaWidth, mediaHeight] = await getImageDim(fileSource.src);
        const srcData = await fileSource.getSrcData();
        return this.genCanvasItem(srcData, mediaWidth, mediaHeight, x, y);
    }
    static async genFromFile(x: number, y: number, file: File | Blob) {
        const srcData = await FileSource.getSrcDataFromFrom(file);
        if (srcData === null) {
            throw new Error(
                'Error occurred during reading image data from blob',
            );
        }
        const [mediaWidth, mediaHeight] = await getImageDim(srcData);
        return this.genCanvasItem(srcData, mediaWidth, mediaHeight, x, y);
    }
    toJson(): CanvasItemImagePropsType {
        return {
            srcData: this.props.srcData,
            mediaWidth: this.props.mediaWidth,
            mediaHeight: this.props.mediaHeight,
            ...super.toJson(),
        };
    }
    static fromJson(json: CanvasItemImagePropsType) {
        try {
            this.validate(json);
            return new CanvasItemImage(json);
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

export default CanvasItemImage;
