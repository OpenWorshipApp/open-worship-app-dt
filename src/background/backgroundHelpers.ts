import { useState, type ReactElement, type ReactNode } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type {
    BackgroundSrcType,
    BackgroundType,
} from '../_screen/screenTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type { CameraInfoType } from '../helper/cameraHelpers';
import { useAppEffect } from '../helper/appHooks';
import PptxAppDocument from '../app-document-list/PptxAppDocument';
import { dirSourceSettingNames } from '../helper/constants';
import type DirSource from '../helper/DirSource';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import FileSource from '../helper/FileSource';
import { handleDragStart } from '../helper/dragHelpers';

export type RenderChildType = (
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    width: number,
    height: number,
    extraChild?: ReactElement,
) => ReactNode;

/**
 * Everything a media tile needs to know about the LAYER it belongs to: whether
 * it is up, how to put it up, and how to drag it onto a screen.
 *
 * The Background tabs answer this from `ScreenBackgroundManager`; the
 * Foreground panel's Video / Image / Web widgets answer it from
 * `ScreenForegroundManager` instead. Both then reuse the same windowed grid,
 * which is what keeps a folder of a thousand files costing a screenful.
 */
export type MediaItemDataType = {
    selectedCN: string;
    title: string;
    handleSelecting: (event: any, isForceChoosing?: boolean) => void;
    handleDragStart: (event: any) => void;
    backgroundType: string;
    isInScreen: boolean;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
};

export type GenMediaItemDataType = (
    filePath: string,
    dragType: DragTypeEnum,
) => MediaItemDataType;

export const backgroundTypeMapper: any = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_CAMERA]: 'camera',
    [DragTypeEnum.BACKGROUND_WEB]: 'web',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'audio',
};

/**
 * What this layer is SHOWING, as one short string.
 *
 * A tile is memoised on its props, and "am I on a screen?" is NOT one of them
 * -- the tile reads that from the screen managers inside its own body. So when
 * a background went up React had no reason to redraw the grid, and the item
 * now showing stayed unmarked while the one before it kept its highlight,
 * until something else remounted the list. This gives `memo` the one fact it
 * was missing, without giving up the windowed grid it was put there to make
 * cheap: one small string per grid render, compared per mounted tile, instead
 * of re-rendering every tile on every scroll row.
 */
export function genBackgroundLayerMarker(backgroundType: BackgroundType) {
    return ScreenBackgroundManager.getBackgroundSrcListByType(backgroundType)
        .map(([screenKey, backgroundSrc]) => {
            return `${screenKey}:${backgroundSrc.src}`;
        })
        .join('|');
}

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

/**
 * The default for the windowed grid: a tile that belongs to the BACKGROUND
 * layer. Keyed by file path rather than by `src` so a caller that has to reach
 * the file itself -- the foreground widgets store a path, not a URL -- can
 * share the same seam.
 */
export function genBackgroundMediaItemDataByFilePath(
    filePath: string,
    dragType: DragTypeEnum,
): MediaItemDataType {
    const fileSource = FileSource.getInstance(filePath);
    const data = genBackgroundMediaItemData(
        fileSource.fullName,
        fileSource.src,
        dragType,
    );
    return {
        ...data,
        handleDragStart: (event: any) => {
            handleDragStart(event, fileSource, dragType);
        },
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
