import { useState, type ReactElement, type ReactNode } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type { CameraInfoType } from '../helper/cameraHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { useVaryAppDocumentDirSource } from '../app-document-list/appDocumentHelpers';
import PptxAppDocument from '../app-document-list/PptxAppDocument';

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

export type VaryAppDocumentAudioDataType = {
    [key: string]: string[];
};
export function useAppDocumentAudioData() {
    const [audioData, setAudioData] =
        useState<VaryAppDocumentAudioDataType | null>(null);
    const dirSource = useVaryAppDocumentDirSource();
    useAppEffectAsync(
        async (contextMethods) => {
            if (dirSource === null) {
                return;
            }
            const filePaths = await dirSource.getFilePaths('pptx');
            const audioDataList = await Promise.all(
                filePaths.map(async (filePath) => {
                    const pptxAppDocument =
                        PptxAppDocument.getInstance(filePath);
                    const audioData = await pptxAppDocument.getAudioFilePaths();
                    const fileName = pptxAppDocument.fileSource.name;
                    return [fileName, audioData];
                }),
            );
            contextMethods.setAudioData(Object.fromEntries(audioDataList));
        },
        [dirSource],
        { setAudioData },
    );
    return audioData;
}
