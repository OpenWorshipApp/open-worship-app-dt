import { handleError } from '../../helper/errorHelpers';
import { HEX_COLOR_WHITE } from '../../others/color/colorHelpers';
import appProvider from '../../server/appProvider';
import type { TextStylePropsType } from './canvasHelpers';
import {
    checkIsValidTextStyleProps,
    genTextDefaultBoxStyle,
    genTextStyle,
} from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import type { AnyObjectType } from '../../helper/typeHelpers';

export function genHtmlDefaultProps(): HtmlPropsType {
    return {
        html: appProvider.appInfo.titleFull,
        color: HEX_COLOR_WHITE,
        fontSize: 60,
        fontFamily: null,
        fontWeight: null,
        textHorizontalAlignment: 'center',
        textVerticalAlignment: 'center',
    };
}
export type HtmlPropsType = TextStylePropsType & {
    html: string;
};
export type CanvasItemHtmlPropsType = CanvasItemPropsType & HtmlPropsType;

// Markup rendered as-is; unlike a text item it is never edited in place.
class CanvasItemHtml extends CanvasItem<CanvasItemHtmlPropsType> {
    static genStyle(props: CanvasItemHtmlPropsType) {
        return genTextStyle(props);
    }
    getStyle() {
        return CanvasItemHtml.genStyle(this.props);
    }
    static genDefaultItem() {
        return CanvasItemHtml.fromJson({
            ...genHtmlDefaultProps(),
            ...genTextDefaultBoxStyle(),
            type: 'html',
        }) as CanvasItemHtml;
    }
    toJson(): CanvasItemHtmlPropsType {
        return this.props;
    }
    // Items saved before `html` existed carry the markup under `htmlText`.
    static migrateJson<T extends AnyObjectType>(json: T) {
        if (
            typeof json.html !== 'string' &&
            typeof json.htmlText === 'string'
        ) {
            return { ...json, html: json.htmlText };
        }
        return json;
    }
    static fromJson(json: CanvasItemHtmlPropsType) {
        try {
            const migratedJson = this.migrateJson(json);
            this.validate(migratedJson);
            return new CanvasItemHtml(migratedJson);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        if (
            typeof json.html !== 'string' ||
            !checkIsValidTextStyleProps(json)
        ) {
            throw new Error('Invalid canvas item html data');
        }
    }
}

export default CanvasItemHtml;
