import { CSSProperties, createContext } from 'react';

import {
    AnyObjectType, cloneJson,
} from '../../helper/helpers';
import { AppColorType } from '../../others/color/colorHelpers';
import {
    ToolingBoxType, tooling2BoxProps, canvasItemList, genTextDefaultBoxStyle,
    CanvasItemKindType, hAlignmentList, HAlignmentType, vAlignmentList,
    VAlignmentType,
} from './canvasHelpers';
import { log } from '../../helper/loggerHelpers';

export type CanvasItemPropsType = {
    id: number,
    top: number,
    left: number,
    rotate: number,
    width: number,
    height: number,
    horizontalAlignment: HAlignmentType,
    verticalAlignment: VAlignmentType,
    backgroundColor: AppColorType | null,
    type: CanvasItemKindType,
};


export default abstract class CanvasItem<T extends CanvasItemPropsType> {
    static _objectId = 0;
    props: T;
    isSelected: boolean;
    isControlling: boolean;
    isEditing: boolean;
    constructor(props: T) {
        this.props = cloneJson(props);
        this.isSelected = false;
        this.isControlling = false;
        this.isEditing = false;
    }
    get id() {
        return this.props.id;
    }
    get type(): CanvasItemKindType {
        return this.props.type;
    }
    static genStyle(_props: CanvasItemPropsType) {
        throw new Error('Method not implemented.');
    }
    abstract getStyle(): CSSProperties;
    static genBoxStyle(props: CanvasItemPropsType): CSSProperties {
        const style: CSSProperties = {
            display: 'flex',
            top: `${props.top}px`,
            left: `${props.left}px`,
            transform: `rotate(${props.rotate}deg)`,
            width: `${props.width}px`,
            height: `${props.height}px`,
            position: 'absolute',
            backgroundColor: props.backgroundColor || 'transparent',
        };
        return style;
    }
    getBoxStyle(): CSSProperties {
        return CanvasItem.genBoxStyle(this.props);
    }
    static fromJson(_json: object): CanvasItem<any> {
        throw new Error('Method not implemented.');
    }
    applyBoxData(parentDim: {
        parentWidth: number,
        parentHeight: number,
    }, boxData: ToolingBoxType) {
        const boxProps = tooling2BoxProps(boxData, {
            width: this.props.width,
            height: this.props.height,
            parentWidth: parentDim.parentWidth,
            parentHeight: parentDim.parentHeight,
        });
        const newProps = {
            ...boxData, ...boxProps,
        };
        if (boxData?.rotate) {
            newProps.rotate = boxData.rotate;
        }
        if (boxData?.backgroundColor) {
            newProps.backgroundColor = boxData.backgroundColor;
        }
        this.applyProps(newProps);
    }
    applyProps(props: AnyObjectType) {
        const propsAny = this.props as any;
        Object.entries(props).forEach(([key, value]) => {
            propsAny[key] = value;
        });
    }
    clone() {
        const newItem = (this.constructor as typeof CanvasItem<any>)
            .fromJson(this.toJson());
        newItem.props.id = -1;
        return newItem;
    }
    toJson(): CanvasItemPropsType {
        return this.props;
    }
    static validate(json: AnyObjectType) {
        if (typeof json.id !== 'number' ||
            typeof json.top !== 'number' ||
            typeof json.left !== 'number' ||
            typeof json.rotate !== 'number' ||
            typeof json.width !== 'number' ||
            typeof json.height !== 'number' ||
            !hAlignmentList.includes(json.horizontalAlignment) ||
            !vAlignmentList.includes(json.verticalAlignment) ||
            (json.backgroundColor !== null
                && typeof json.backgroundColor !== 'string') ||
            !canvasItemList.includes(json.type)
        ) {
            log(json);
            throw new Error('Invalid canvas item data');
        }
    }
}

export class CanvasItemError extends CanvasItem<any> {
    _jsonError: AnyObjectType | null = null;
    get type(): CanvasItemKindType {
        return 'error';
    }
    getStyle(): CSSProperties {
        return {
            color: 'red',
            fontSize: '4.5em',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: 'auto',
        };
    }
    static fromJsonError(json: AnyObjectType) {
        const props = genTextDefaultBoxStyle() as any;
        props.type = 'error';
        const item = new CanvasItemError(props);
        item._jsonError = json;
        return item;
    }
    toJson() {
        return this._jsonError as any;
    }
}

export const CanvasItemContext = createContext<CanvasItem<any> | null>(null);
