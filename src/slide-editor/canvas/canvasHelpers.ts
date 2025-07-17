import { SrcData } from '../../helper/FileSource';
import { AppColorType } from '../../others/color/colorHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasControllerEventType = 'update' | 'scale';

export type CanvasItemMediaPropsType = {
    srcData: SrcData;
    mediaWidth: number;
    mediaHeight: number;
};

export function validateMediaProps(props: AnyObjectType) {
    if (
        typeof props.srcData !== 'string' ||
        typeof props.mediaWidth !== 'number' ||
        typeof props.mediaHeight !== 'number'
    ) {
        throw new Error('Invalid canvas item media data');
    }
}

export const hAlignmentList = ['left', 'center', 'right'] as const;
export type HAlignmentType = (typeof hAlignmentList)[number];
export const vAlignmentList = ['start', 'center', 'end'] as const;
export type VAlignmentType = (typeof vAlignmentList)[number];

export function tooling2BoxProps(
    boxData: ToolingBoxType,
    state: {
        parentWidth: number;
        parentHeight: number;
        width: number;
        height: number;
    },
) {
    const boxProps: { top?: number; left?: number } = {};
    if (boxData) {
        if (boxData.verticalAlignment === 'start') {
            boxProps.top = 0;
        } else if (boxData.verticalAlignment === 'center') {
            boxProps.top = (state.parentHeight - state.height) / 2;
        } else if (boxData.verticalAlignment === 'end') {
            boxProps.top = state.parentHeight - state.height;
        }
        if (boxData.horizontalAlignment === 'left') {
            boxProps.left = 0;
        } else if (boxData.horizontalAlignment === 'center') {
            boxProps.left = (state.parentWidth - state.width) / 2;
        } else if (boxData.horizontalAlignment === 'right') {
            boxProps.left = state.parentWidth - state.width;
        }
    }
    return boxProps;
}

export type ToolingBoxType = {
    backgroundColor?: AppColorType | null;
    rotate?: number;
    horizontalAlignment?: HAlignmentType;
    verticalAlignment?: VAlignmentType;
};
export const canvasItemList = [
    'text',
    'html',
    'image',
    'video',
    'bible',
    'error',
] as const;
export type CanvasItemKindType = (typeof canvasItemList)[number];

export function genTextDefaultBoxStyle(
    width: number = 700,
    height: number = 400,
) {
    return {
        id: -1,
        top: 279,
        left: 356,
        backgroundColor: '#ff00ff8b' as AppColorType,
        width,
        height,
        rotate: 0,
        horizontalAlignment: 'center' as HAlignmentType,
        verticalAlignment: 'center' as VAlignmentType,
    };
}
