import { CSSProperties, createContext, use, useOptimistic } from 'react';

import { cloneJson } from '../../helper/helpers';
import { AppColorType } from '../../others/color/colorHelpers';
import {
    ToolingBoxType,
    tooling2BoxProps,
    canvasItemList,
    genTextDefaultBoxStyle,
    CanvasItemKindType,
    cleanupProps,
} from './canvasHelpers';
import EventHandler from '../../event/EventHandler';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { useProgressBarComp } from '../../progress-bar/ProgressBarComp';
import { ClipboardInf } from '../../server/appHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemPropsType = {
    id: number;
    top: number;
    left: number;
    rotate: number;
    width: number;
    height: number;
    backgroundColor: AppColorType;
    backdropFilter: number;
    roundSizePercentage: number;
    roundSizePixel: number;
    type: CanvasItemKindType;
};

export type CanvasItemEventType = 'edit';

export default abstract class CanvasItem<T extends CanvasItemPropsType>
    extends EventHandler<CanvasItemEventType>
    implements ClipboardInf
{
    props: T;
    constructor(props: T) {
        super();
        this.props = {
            ...props,
            top: props.top ?? 0,
            left: props.left ?? 0,
            rotate: props.rotate ?? 0,
            width: props.width ?? 0,
            height: props.height ?? 0,
            backgroundColor: props.backgroundColor ?? '#00000000',
            backdropFilter: props.backdropFilter ?? 0,
            roundSizePercentage: props.roundSizePercentage ?? 0,
            roundSizePixel: props.roundSizePixel ?? 0,
        };
        cleanupProps(this.props);
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

    static genShapeBoxStyle(props: CanvasItemPropsType): CSSProperties {
        let borderRadius: string | number | undefined = undefined;
        if (props.roundSizePixel) {
            borderRadius = props.roundSizePixel;
        } else if (props.roundSizePercentage) {
            borderRadius = `${props.roundSizePercentage / 2}%`;
        }
        const shapeStyle: CSSProperties = {
            width: `${props.width}px`,
            height: `${props.height}px`,
            backgroundColor: props.backgroundColor ?? 'transparent',
            backdropFilter: props.backdropFilter
                ? `blur(${props.backdropFilter}px)`
                : undefined,
            ...(borderRadius !== undefined
                ? { borderRadius: borderRadius, boxSizing: 'border-box' }
                : {}),
        };
        return shapeStyle;
    }

    static genBoxStyle(props: CanvasItemPropsType): CSSProperties {
        const style: CSSProperties = {
            display: 'flex',
            top: `${props.top}px`,
            left: `${props.left}px`,
            transform: `rotate(${props.rotate}deg)`,
            position: 'absolute',
            ...this.genShapeBoxStyle(props),
        };
        return style;
    }

    getBoxStyle(): CSSProperties {
        return CanvasItem.genBoxStyle(this.props);
    }

    static fromJson(_json: object): CanvasItem<any> {
        throw new Error('Method not implemented.');
    }

    applyBoxData(
        parentDim: {
            parentWidth: number;
            parentHeight: number;
        },
        boxData: ToolingBoxType,
    ) {
        const boxProps = tooling2BoxProps(
            { ...this.props, ...boxData },
            {
                width: this.props.width,
                height: this.props.height,
                parentWidth: parentDim.parentWidth,
                parentHeight: parentDim.parentHeight,
            },
        );
        const newProps = {
            ...boxData,
            ...boxProps,
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
        for (const [key, value] of Object.entries(props)) {
            propsAny[key] = value;
        }
        cleanupProps(props);
    }

    clone() {
        const newItem = (this.constructor as typeof CanvasItem<any>).fromJson(
            this.toJson(),
        );
        newItem.props.id = -1;
        return newItem;
    }

    toJson(): CanvasItemPropsType {
        return this.props;
    }

    static validate(json: AnyObjectType) {
        if (
            typeof json.id !== 'number' ||
            typeof json.top !== 'number' ||
            typeof json.left !== 'number' ||
            typeof json.rotate !== 'number' ||
            typeof json.width !== 'number' ||
            typeof json.height !== 'number' ||
            (json.backgroundColor !== null &&
                typeof json.backgroundColor !== 'string') ||
            !canvasItemList.includes(json.type)
        ) {
            throw new Error('Invalid canvas item data');
        }
    }

    fireEditEvent() {
        this.addPropEvent('edit');
    }

    clipboardSerialize() {
        return JSON.stringify(this.toJson());
    }

    checkIsSame(canvasItem: CanvasItem<any>) {
        return this.id === canvasItem.id;
    }
}

export class CanvasItemError extends CanvasItem<any> {
    jsonError: AnyObjectType | null = null;
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
        item.jsonError = json;
        return item;
    }
}

export const CanvasItemsContext = createContext<CanvasItem<any>[] | null>(null);
export function useCanvasItemsContext() {
    const context = use(CanvasItemsContext);
    if (context === null) {
        throw new Error('CanvasItemsContext not found');
    }
    return context;
}

export const SelectedCanvasItemsAndSetterContext = createContext<{
    canvasItems: CanvasItem<any>[];
    setCanvasItems: (canvasItems: CanvasItem<any>[]) => void;
} | null>(null);
export function useSelectedCanvasItemsAndSetterContext() {
    const context = use(SelectedCanvasItemsAndSetterContext);
    if (context === null) {
        throw new Error('SelectedCanvasItemsAndSetterContext not found');
    }
    return context;
}

export function checkCanvasItemsIncludes(
    canvasItems: CanvasItem<any>[],
    targetCanvasItem: CanvasItem<any>,
) {
    for (const item of canvasItems) {
        if (item.checkIsSame(targetCanvasItem)) {
            return true;
        }
    }
    return false;
}

export function useSetSelectedCanvasItems() {
    const { canvasItems, setCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    return (targetCanvasItem: CanvasItem<any>, isControlling = true) => {
        let newCanvasItems = [targetCanvasItem];
        if (
            !isControlling &&
            checkCanvasItemsIncludes(canvasItems, targetCanvasItem)
        ) {
            newCanvasItems = [];
        }
        setCanvasItems(newCanvasItems);
    };
}

export const EditingCanvasItemAndSetterContext = createContext<{
    canvasItem: CanvasItem<any> | null;
    setCanvasItem: (canvasItem: CanvasItem<any> | null) => void;
} | null>(null);
export function useEditingCanvasItemAndSetterContext() {
    const context = use(EditingCanvasItemAndSetterContext);
    if (context === null) {
        throw new Error('EditingCanvasItemAndSetterContext not found');
    }
    return context;
}

export function useSetEditingCanvasItem() {
    const { canvasItem, setCanvasItem } =
        useEditingCanvasItemAndSetterContext();
    return (targetCanvasItem: CanvasItem<any>, isEditing = true) => {
        let newCanvasItem: CanvasItem<any> | null = targetCanvasItem;
        if (!isEditing) {
            newCanvasItem = canvasItem !== targetCanvasItem ? canvasItem : null;
        }
        setCanvasItem(newCanvasItem);
    };
}

export const CanvasItemContext = createContext<CanvasItem<any> | null>(null);
export function useCanvasItemContext() {
    const context = use(CanvasItemContext);
    if (context === null) {
        throw new Error('CanvasItem not provided in context');
    }
    return context;
}

export function useCanvasItemEditEvent(
    canvasItem: CanvasItem<any>,
    callback: () => void,
) {
    useAppEffect(() => {
        const registeredEvent = canvasItem.registerEventListener(
            ['edit'],
            callback,
        );
        return () => {
            canvasItem.unregisterEventListener(registeredEvent);
        };
    }, [canvasItem]);
}

export function useCanvasItemPropsContext<T extends CanvasItemPropsType>() {
    const canvasItem = useCanvasItemContext();
    const [props, setProps] = useOptimistic(cloneJson(canvasItem.props));
    const { startTransaction } = useProgressBarComp();
    useCanvasItemEditEvent(canvasItem, () => {
        startTransaction(() => {
            setProps(cloneJson(canvasItem.props));
        });
    });
    return props as T;
}

export const CanvasItemPropsSetterContext = createContext<{
    props: CanvasItemPropsType;
    setProps: (anyProps: any) => void;
} | null>(null);
export function useCanvasItemPropsSetterContext<
    T extends CanvasItemPropsType,
>() {
    const context = use(CanvasItemPropsSetterContext);
    if (context === null) {
        throw new Error('CanvasItem not provided in context');
    }
    return [
        context.props as T,
        (props: AnyObjectType) => context.setProps(props),
    ] as const;
}

export function useIsCanvasItemSelected() {
    const canvasItem = useCanvasItemContext();
    const { canvasItems: selectedCasItems } =
        useSelectedCanvasItemsAndSetterContext();
    return checkCanvasItemsIncludes(selectedCasItems, canvasItem);
}

export function useStopAllModes() {
    const { setCanvasItem: setEditingCanvasItem } =
        useEditingCanvasItemAndSetterContext();
    const { setCanvasItems: setSelectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    return () => {
        setEditingCanvasItem(null);
        setSelectedCanvasItems([]);
    };
}
