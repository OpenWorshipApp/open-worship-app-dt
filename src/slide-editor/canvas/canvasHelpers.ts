import type { CSSProperties } from 'react';

import type { SrcData } from '../../helper/FileSource';
import type { AppColorType } from '../../others/color/colorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { isSupportedMimetype } from '../../server/fileHelpers';

export type CanvasControllerEventType = 'update' | 'scale' | 'reload';

export type CanvasItemMediaDimPropsType = {
    mediaWidth: number;
    mediaHeight: number;
};

// Images embed their data inline (`srcData`). Videos would balloon the slide
// document if inlined, so they reference their source file by path instead.
export type CanvasItemMediaPropsType = CanvasItemMediaDimPropsType & {
    srcData: SrcData;
};

export type CanvasItemVideoMediaPropsType = CanvasItemMediaDimPropsType & {
    filePath: string;
};

export function validateMediaProps(
    props: AnyObjectType,
    srcKey: 'srcData' | 'filePath' = 'srcData',
) {
    if (
        typeof props[srcKey] !== 'string' ||
        typeof props.mediaWidth !== 'number' ||
        typeof props.mediaHeight !== 'number'
    ) {
        throw new TypeError('Invalid canvas item media data');
    }
}

export const hAlignmentList = ['left', 'center', 'right'] as const;
export type HAlignmentType = (typeof hAlignmentList)[number];
export const vAlignmentList = ['start', 'center', 'end'] as const;
export type VAlignmentType = (typeof vAlignmentList)[number];

export function cleanupProps(props: AnyObjectType) {
    delete props.horizontalAlignment;
    delete props.verticalAlignment;
}

export function tooling2BoxProps(
    boxData: ToolingBoxType,
    state: {
        parentWidth: number;
        parentHeight: number;
        width: number;
        height: number;
    },
) {
    const boxProps = {
        top: boxData.top ?? 0,
        left: boxData.left ?? 0,
    };
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
    return boxProps;
}

export type ToolingBoxType = {
    backgroundColor?: AppColorType | null;
    rotate?: number;
    horizontalAlignment?: HAlignmentType;
    verticalAlignment?: VAlignmentType;
    top?: number;
    left?: number;
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

export function checkIsMediaCanvasItemType(type: string) {
    return type === 'image' || type === 'video';
}

export function genTextDefaultBoxStyle(
    width: number = 700,
    height: number = 400,
) {
    return {
        id: -1,
        top: 279,
        left: 356,
        width,
        height,
        rotate: 0,
        backgroundColor: '#0000008b' as AppColorType,
        backdropFilter: 0,
        roundSizePercentage: 0,
        roundSizePixel: 0,
        horizontalAlignment: 'center' as HAlignmentType,
        verticalAlignment: 'center' as VAlignmentType,
    };
}

export function genMediaDefaultBoxStyle(width?: number, height?: number) {
    return {
        ...genTextDefaultBoxStyle(width, height),
        // Media fills its box, so a visible background color would never
        // actually be seen — default to transparent black.
        backgroundColor: '#00000000' as AppColorType,
    };
}

export const SCRIPT_SAFE_LINE_HEIGHT = 1.35;

// Shared by every canvas item that lays out rich text: text, html and bible.
export type TextStylePropsType = {
    color: AppColorType;
    fontSize: number;
    fontFamily: string | null;
    fontWeight: string | null;
    textHorizontalAlignment: HAlignmentType;
    textVerticalAlignment: VAlignmentType;
};

export function genTextStyle(props: TextStylePropsType): CSSProperties {
    return {
        display: 'flex',
        width: '100%',
        height: '100%',
        fontSize: `${props.fontSize}px`,
        // Keep ascenders/combining marks visible for complex scripts (Khmer, etc.).
        lineHeight: SCRIPT_SAFE_LINE_HEIGHT,
        fontFamily: props.fontFamily ?? '',
        fontWeight: props.fontWeight ?? '',
        color: props.color,
        alignItems: props.textVerticalAlignment,
        justifyContent: props.textHorizontalAlignment,
        textAlign: props.textHorizontalAlignment,
        padding: `${props.fontSize / 10}px`,
    };
}

export function checkIsValidTextStyleProps(json: AnyObjectType) {
    return (
        typeof json.color === 'string' &&
        typeof json.fontSize === 'number' &&
        (json.fontFamily === null || typeof json.fontFamily === 'string') &&
        (json.fontWeight === null || typeof json.fontWeight === 'string')
    );
}

export function checkIsSupportMediaType(fileType: string) {
    return (
        isSupportedMimetype(fileType, 'image') ||
        isSupportedMimetype(fileType, 'video')
    );
}
