import { handleError } from '../../helper/errorHelpers';
import type { AppColorType } from '../../others/color/colorHelpers';
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

export function genTextDefaultProps(): TextPropsType {
    return {
        text: appProvider.appInfo.titleFull,
        color: HEX_COLOR_WHITE,
        fontSize: 60,
        fontFamily: null,
        fontWeight: null,
        textHorizontalAlignment: 'center',
        textVerticalAlignment: 'center',
    };
}
export type TextPropsType = TextStylePropsType & {
    text: string;
};
export type CanvasItemTextPropsType = { type: 'text' } & CanvasItemPropsType &
    TextPropsType;
export type ToolingTextType = Partial<TextStylePropsType>;

class CanvasItemText extends CanvasItem<CanvasItemTextPropsType> {
    static genStyle(props: CanvasItemTextPropsType) {
        return genTextStyle(props);
    }
    getStyle() {
        return CanvasItemText.genStyle(this.props);
    }
    static genDefaultItem() {
        return CanvasItemText.fromJson({
            ...genTextDefaultProps(),
            ...genTextDefaultBoxStyle(),
            type: 'text',
        }) as CanvasItemText;
    }
    // A plain colored rectangle — what dropping a color from the Background
    // panel onto empty canvas produces. There is no "color" item kind, and
    // there does not need to be: an empty text box already paints its
    // `backgroundColor`, keeps the shape/rounding tooling, and stays editable
    // by double-click if the operator then wants words in it.
    static genColorBoxItem(x: number, y: number, color: AppColorType) {
        const boxStyle = genTextDefaultBoxStyle();
        return CanvasItemText.fromJson({
            ...genTextDefaultProps(),
            text: '',
            ...boxStyle,
            backgroundColor: color,
            left: x - boxStyle.width / 2,
            top: y - boxStyle.height / 2,
            type: 'text',
        }) as CanvasItemText;
    }
    applyTextData(textData: ToolingTextType) {
        this.applyProps(textData);
    }
    toJson(): CanvasItemTextPropsType {
        return this.props;
    }
    static fromJson(json: CanvasItemTextPropsType) {
        try {
            this.validate(json);
            return new CanvasItemText(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        if (
            typeof json.text !== 'string' ||
            !checkIsValidTextStyleProps(json)
        ) {
            throw new Error('Invalid canvas item text data');
        }
    }
}

export default CanvasItemText;
