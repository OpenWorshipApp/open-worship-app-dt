import type { ReactElement, ReactNode } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type { CameraInfoType } from '../helper/cameraHelpers';

export type RenderChildType = (
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    width: number,
    height: number,
    extraChild?: ReactElement,
) => ReactNode;

export const backgroundTypeMapper: any = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_CAMERA]: 'camera',
    [DragTypeEnum.BACKGROUND_WEB]: 'web',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'audio',
};

export function genBackgroundMediaItemData(
    titlePrefix: string,
    src: string,
    dragType: DragTypeEnum,
) {
    const backgroundType = backgroundTypeMapper[dragType];
    const selectedBackgroundSrcList =
        ScreenBackgroundManager.getSelectBackgroundSrcList(src, backgroundType);
    const isInScreen = selectedBackgroundSrcList.length > 0;
    const selectedCN = isInScreen
        ? `${HIGHLIGHT_SELECTED_CLASSNAME} animation`
        : '';
    const screenKeys = selectedBackgroundSrcList.map(([key]) => key);
    const title =
        `${titlePrefix}` +
        (isInScreen ? ` \nShow in presents:${screenKeys.join(',')}` : '');
    const handleSelecting = (event: any, isForceChoosing = false) => {
        ScreenBackgroundManager.handleBackgroundSelecting(
            event,
            backgroundType,
            { src },
            isForceChoosing,
        );
    };
    return {
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    };
}

export function cameraDragSerialize(cameraInfo: CameraInfoType) {
    return {
        type: DragTypeEnum.BACKGROUND_CAMERA,
        data: cameraInfo.deviceId,
    };
}
export function cameraDragDeserialize(data: string) {
    return {
        src: data,
    };
}
