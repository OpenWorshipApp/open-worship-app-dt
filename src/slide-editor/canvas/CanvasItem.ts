import { CSSProperties, createContext, use, useOptimistic } from 'react';

import { cloneJson } from '../../helper/helpers';
import { AppColorType } from '../../others/color/colorHelpers';
import {
    ToolingBoxType,
    tooling2BoxProps,
    canvasItemList,
    genTextDefaultBoxStyle,
    CanvasItemKindType,
    hAlignmentList,
    HAlignmentType,
    vAlignmentList,
    VAlignmentType,
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
    horizontalAlignment: HAlignmentType;
    verticalAlignment: VAlignmentType;
    backgroundColor: AppColorType | null;
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
        this.props = cloneJson(props);
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
            backgroundColor: props.backgroundColor ?? 'transparent',
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
        const boxProps = tooling2BoxProps(boxData, {
            width: this.props.width,
            height: this.props.height,
            parentWidth: parentDim.parentWidth,
            parentHeight: parentDim.parentHeight,
        });
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
        Object.entries(props).forEach(([key, value]) => {
            propsAny[key] = value;
        });
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
            !hAlignmentList.includes(json.horizontalAlignment) ||
            !vAlignmentList.includes(json.verticalAlignment) ||
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
        throw new Error('CanvasItemContext not found');
    }
    return context;
}

export function useCanvasItemPropsContext<T extends CanvasItemPropsType>() {
    const canvasItem = useCanvasItemContext();
    const [props, setProps] = useOptimistic(cloneJson(canvasItem.props));
    const { startTransaction } = useProgressBarComp();
    useAppEffect(() => {
        canvasItem.registerEventListener(['edit'], () => {
            startTransaction(() => {
                setProps(cloneJson(canvasItem.props));
            });
        });
    }, [canvasItem]);
    return props as T;
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
