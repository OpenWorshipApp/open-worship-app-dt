import { getImageDim } from '../../helper/helpers';
import FileSource, { SrcData } from '../../helper/FileSource';
import {
    CanvasItemMediaPropsType,
    genTextDefaultBoxStyle,
    validateMediaProps,
} from './canvasHelpers';
import CanvasItem, { CanvasItemError, CanvasItemPropsType } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';

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
    static async genFromBlob(x: number, y: number, blob: Blob) {
        const srcData = await new Promise<SrcData>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as SrcData);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
