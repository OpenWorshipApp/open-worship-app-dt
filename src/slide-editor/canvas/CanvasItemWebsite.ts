import type { CanvasItemUrlPropsType } from './canvasHelpers';
import {
    genMediaDefaultBoxStyle,
    validateUrlProps,
    WEBSITE_EMBED_HEIGHT,
    WEBSITE_EMBED_WIDTH,
} from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemWebsitePropsType = CanvasItemPropsType &
    CanvasItemUrlPropsType;

class CanvasItemWebsite extends CanvasItem<CanvasItemWebsitePropsType> {
    static gegStyle(_props: CanvasItemWebsitePropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemWebsite.gegStyle(this.props);
    }
    // Match the video item's controls, which keep the box's aspect ratio while
    // resizing.
    get shouldLockAspectRatio() {
        return true;
    }
    static genCanvasItem(url: string, x: number, y: number) {
        const props: CanvasItemWebsitePropsType = {
            url,
            ...genMediaDefaultBoxStyle(
                WEBSITE_EMBED_WIDTH,
                WEBSITE_EMBED_HEIGHT,
            ),
            left: x - WEBSITE_EMBED_WIDTH / 2,
            top: y - WEBSITE_EMBED_HEIGHT / 2,
            width: WEBSITE_EMBED_WIDTH,
            height: WEBSITE_EMBED_HEIGHT,
            type: 'website',
        };
        return this.fromJson(props);
    }
    static genFromUrl(x: number, y: number, url: string) {
        return this.genCanvasItem(url, x, y);
    }
    toJson(): CanvasItemWebsitePropsType {
        return {
            url: this.props.url,
            ...super.toJson(),
        };
    }
    static fromJson(json: CanvasItemWebsitePropsType) {
        try {
            this.validate(json);
            return new CanvasItemWebsite(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        validateUrlProps(json);
    }
}

export default CanvasItemWebsite;
