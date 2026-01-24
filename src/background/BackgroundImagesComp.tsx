import './BackgroundImagesComp.scss';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    checkIsImagesInClipboard,
    downloadImage,
    readImagesFromClipboard,
} from '../server/appHelpers';
import type DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsMove,
    getDotExtensionFromBase64Data,
} from '../server/fileHelpers';
import { askForURL, getOpenSharedLinkMenuItem } from './downloadHelper';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { handleError } from '../helper/errorHelpers';
import type { ReactElement } from 'react';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    _width: number,
    height: number,
    extraChild?: ReactElement,
) {
    const fileSource = FileSource.getInstance(filePath);
    return (
        <div
            className="card-body app-blank-bg"
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <img
                loading="lazy"
                src={fileSource.src}
                className="w-100 h-100 card-img-top"
                alt={fileSource.name}
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center center',
                    pointerEvents: 'none',
                }}
            />
            {extraChild}
        </div>
    );
}

async function genContextMenuItems(dirSource: DirSource) {
    if (dirSource.dirPath === '') {
        return [];
    }
    const isClipboardHasImage = await checkIsImagesInClipboard();
    const contextMenuItems: ContextMenuItemType[] = [];
    if (isClipboardHasImage) {
        const pastImageTitle = tran('Paste Image');
        contextMenuItems.push({
            menuElement: pastImageTitle,
            onSelect: async () => {
                for await (const blob of readImagesFromClipboard()) {
                    const srcData = await FileSource.getSrcDataFromFrom(blob);
                    if (srcData === null) {
                        showSimpleToast(
                            pastImageTitle,
                            'Error occurred during reading image data from clipboard',
                        );
                        continue;
                    }
                    const dotExt = getDotExtensionFromBase64Data(srcData);
                    if (dotExt === null) {
                        showSimpleToast(
                            pastImageTitle,
                            'Error occurred during getting image file extension',
                        );
                        continue;
                    }
                    const filePath = await dirSource.genRandomFilePath(dotExt);
                    if (filePath === null) {
                        showSimpleToast(
                            pastImageTitle,
                            'Error occurred during generating file name',
                        );
                        continue;
                    }
                    const isSuccess = await FileSource.writeFileBase64Data(
                        filePath,
                        srcData,
                    );
                    if (!isSuccess) {
                        showSimpleToast(
                            pastImageTitle,
                            'Error occurred during pasting image',
                        );
                    }
                }
            },
        });
    }
    const title = tran('Download From URL');
    contextMenuItems.push(
        {
            menuElement: title,
            onSelect: async () => {
                const imageUrl = await askForURL(title, 'Image URL:');
                if (imageUrl === null) {
                    return;
                }
                try {
                    showSimpleToast(
                        title,
                        `Downloading image from "${imageUrl}", please wait...`,
                    );
                    showProgressBar(imageUrl);
                    const defaultPath = getDefaultDataDir();
                    const { filePath, fileFullName } = await downloadImage(
                        imageUrl,
                        defaultPath,
                    );
                    const destFileSource = FileSource.getInstance(
                        dirSource.dirPath,
                        fileFullName,
                    );
                    if (await fsCheckFileExist(destFileSource.filePath)) {
                        await fsDeleteFile(destFileSource.filePath);
                    }
                    await fsMove(filePath, destFileSource.filePath);
                    showSimpleToast(
                        title,
                        `Image downloaded successfully, file path: "${destFileSource.filePath}"`,
                    );
                } catch (error) {
                    handleError(error);
                    showSimpleToast(
                        title,
                        'Error occurred during downloading image',
                    );
                } finally {
                    hideProgressBar(imageUrl);
                }
            },
        },
        getOpenSharedLinkMenuItem('images'),
    );
    return contextMenuItems;
}

export default function BackgroundImagesComp() {
    const handleItemsAdding = async (
        dirSource: DirSource,
        defaultContextMenuItems: ContextMenuItemType[],
        event: any,
    ) => {
        const contextMenuItems = await genContextMenuItems(dirSource);
        showAppContextMenu(event, [
            ...defaultContextMenuItems,
            ...contextMenuItems,
        ]);
    };
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_IMAGE}
            dragType={DragTypeEnum.BACKGROUND_IMAGE}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_IMAGE}
            genContextMenuItems={genContextMenuItems}
            onItemsAdding={handleItemsAdding}
        />
    );
}
