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
export type CanvasItemTextPropsType = CanvasItemPropsType & TextPropsType;
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
