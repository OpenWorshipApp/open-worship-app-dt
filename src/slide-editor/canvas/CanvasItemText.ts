import { CSSProperties } from 'react';

import { handleError } from '../../helper/errorHelpers';
import { AppColorType } from '../../others/color/colorHelpers';
import appProvider from '../../server/appProvider';
import {
    genTextDefaultBoxStyle,
    hAlignmentList,
    HAlignmentType,
    vAlignmentList,
    VAlignmentType,
} from './canvasHelpers';
import CanvasItem, { CanvasItemError, CanvasItemPropsType } from './CanvasItem';
import { AnyObjectType } from '../../helper/typeHelpers';

export function genTextDefaultProps(): TextPropsType {
    return {
        text: appProvider.appInfo.name,
        color: '#ffffff',
        fontSize: 60,
        fontFamily: null,
        fontWeight: null,
        textHorizontalAlignment: 'center',
        textVerticalAlignment: 'center',
    };
}
export type TextPropsType = {
    text: string;
    color: AppColorType;
    fontSize: number;
    fontFamily: string | null;
    fontWeight: string | null;
    textHorizontalAlignment: HAlignmentType;
    textVerticalAlignment: VAlignmentType;
};
export type CanvasItemTextPropsType = CanvasItemPropsType & TextPropsType;
export type CanvasItemTextHtmlPropsType = CanvasItemTextPropsType & {
    htmlText: string;
};
export type ToolingTextType = {
    color?: AppColorType;
    fontSize?: number;
    fontFamily?: string | null;
    fontWeight?: string | null;
    textHorizontalAlignment?: HAlignmentType;
    textVerticalAlignment?: VAlignmentType;
};
class CanvasItemText extends CanvasItem<CanvasItemTextPropsType> {
    static genStyle(props: CanvasItemTextPropsType) {
        const style: CSSProperties = {
            display: 'flex',
            width: '100%',
            height: '100%',
            fontSize: `${props.fontSize}px`,
            fontFamily: props.fontFamily ?? '',
            fontWeight: props.fontWeight ?? '',
            color: props.color,
            alignItems: props.textVerticalAlignment,
            justifyContent: props.textHorizontalAlignment,
            padding: `${props.fontSize / 10}px`,
        };
        return style;
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
            typeof json.color !== 'string' ||
            typeof json.fontSize !== 'number' ||
            (json.fontFamily !== null && typeof json.fontFamily !== 'string') ||
            (json.fontWeight !== null && typeof json.fontWeight !== 'string')
        ) {
            throw new Error('Invalid canvas item text data');
        }
    }
}

export default CanvasItemText;
