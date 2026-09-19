import { getImageDim } from '../../helper/helpers';
import FileSource from '../../helper/FileSource';
import type { CanvasItemMediaPropsType } from './canvasHelpers';
import { genMediaDefaultBoxStyle, validateMediaProps } from './canvasHelpers';
import type { UrlMediaSourceType } from '../../helper/mediaSourceHelpers';
import { checkIsRemoteMediaSource } from '../../helper/mediaSourceHelpers';
import type { CanvasItemBoxPropsType, CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemImagePropsType = { type: 'image' } & CanvasItemPropsType &
    CanvasItemMediaPropsType;
class CanvasItemImage extends CanvasItem<CanvasItemImagePropsType> {
    static gegStyle(_props: CanvasItemImagePropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemImage.gegStyle(this.props);
    }
    get shouldLockAspectRatio() {
        return true;
    }
    static async genCanvasItem(
        srcData: CanvasItemImagePropsType['srcData'],
        mediaWidth: number,
        mediaHeight: number,
        x: number,
        y: number,
    ) {
        const props: CanvasItemImagePropsType = {
            srcData,
            mediaWidth,
            mediaHeight,
            ...genMediaDefaultBoxStyle(),
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
    // A remote link is kept as the source verbatim: the image is never
    // downloaded into the document (inlining a linked file would bloat every
    // slide it appears on), only measured so the box gets the right ratio.
    static async genCanvasItemFromLink(x: number, y: number, url: string) {
        if (!checkIsRemoteMediaSource(url)) {
            throw new Error(`Invalid image link: ${url}`);
        }
        const [mediaWidth, mediaHeight] = await getImageDim(url);
        return this.genCanvasItem(url, mediaWidth, mediaHeight, x, y);
    }
    // The props for an image item that fills a box chosen by the caller. Unlike
    // `genCanvasItemFromLink` the image is NOT loaded to be measured: the box is
    // already decided, so the ratio would be measured only to be thrown away —
    // `mediaWidth`/`mediaHeight` therefore describe the box itself.
    static genCanvasItemPropsFromLink(
        url: UrlMediaSourceType,
        boxProps: CanvasItemBoxPropsType,
    ): CanvasItemImagePropsType {
        return {
            ...boxProps,
            type: 'image',
            srcData: url,
            mediaWidth: boxProps.width,
            mediaHeight: boxProps.height,
        };
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
            type: 'image',
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
