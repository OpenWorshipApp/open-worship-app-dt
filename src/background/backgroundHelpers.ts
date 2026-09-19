import { useState, type ReactElement, type ReactNode } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type { CameraInfoType } from '../helper/cameraHelpers';
import { useAppEffect } from '../helper/appHooks';
import PptxAppDocument from '../app-document-list/PptxAppDocument';
import { dirSourceSettingNames } from '../helper/constants';
import type DirSource from '../helper/DirSource';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';

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

export type VarySlideAudioDataType = {
    slideIndex: number;
    slideId: number;
    filePaths: string[];
    slideFilePath: string;
};
export type VaryAppDocumentAudioDataType = {
    [key: string]: VarySlideAudioDataType[];
};
async function getAudioDataList(dirSource: DirSource) {
    if (!dirSource.dirPath) {
        return null;
    }
    const filePaths = await dirSource.getFilePathsQuick('pptx', true);
    const audioDataList = await Promise.all(
        filePaths.map(async (filePath) => {
            const pptxAppDocument = PptxAppDocument.getInstance(filePath);
            const audioSlideDataList =
                await pptxAppDocument.getAudioFilePaths();
            if (audioSlideDataList.length === 0) {
                return null;
            }
            const fileName = pptxAppDocument.fileSource.name;
            return [fileName, audioSlideDataList] as [
                string,
                VarySlideAudioDataType[],
            ];
        }),
    );
    const audioDataObject = Object.fromEntries(
        audioDataList.filter((item) => {
            return item !== null;
        }),
    );
    const dataEntries = Object.entries(audioDataObject);
    if (
        dataEntries.every(
            ([, audioSlideDataList]) => audioSlideDataList.length === 0,
        )
    ) {
        return null;
    }
    return audioDataObject;
}
export function useAppDocumentAudioData() {
    const [audioData, setAudioData] =
        useState<VaryAppDocumentAudioDataType | null>(null);
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.APP_DOCUMENT);

    useAppEffect(() => {
        if (dirSource === null) {
            return;
        }
        getAudioDataList(dirSource).then((audioDataObject) => {
            setAudioData(audioDataObject);
        });
        const registeredEvent = dirSource.registerEventListener(
            ['refresh', 'reload'],
            async () => {
                const audioDataObject = await getAudioDataList(dirSource);
                setAudioData(audioDataObject);
            },
        );
        return () => {
            dirSource.unregisterEventListener(registeredEvent);
        };
    }, [dirSource]);

    return audioData;
}
