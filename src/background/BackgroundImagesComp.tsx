import './BackgroundImagesComp.scss';

import { RenderScreenIds } from './BackgroundComp';
import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import {
    checkIsImagesInClipboard,
    downloadImage,
    readImagesFromClipboard,
} from '../server/appHelpers';
import DirSource from '../helper/DirSource';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsMove,
    getDotExtensionFromBase64Data,
} from '../server/fileHelpers';
import { askForURL } from './downloadHelper';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { handleError } from '../helper/errorHelpers';

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
) {
    const fileSource = FileSource.getInstance(filePath);
    return (
        <div className="card-body overflow-hidden">
            <RenderScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return parseInt(key);
                })}
            />
            <img
                loading="lazy"
                src={fileSource.src}
                className="card-img-top"
                alt={fileSource.name}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center center',
                    pointerEvents: 'none',
                }}
            />
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
        contextMenuItems.push({
            menuElement: '`Paste Image',
            onSelect: async () => {
                for await (const blob of readImagesFromClipboard()) {
                    const srcData = await FileSource.getSrcDataFromBlob(blob);
                    if (srcData === null) {
                        showSimpleToast(
                            '`Paste Image',
                            'Error occurred during reading image data from clipboard',
                        );
                        continue;
                    }
                    const dotExt = getDotExtensionFromBase64Data(srcData);
                    if (dotExt === null) {
                        showSimpleToast(
                            '`Paste Image',
                            'Error occurred during getting image file extension',
                        );
                        continue;
                    }
                    const filePath = await dirSource.genRandomFilePath(dotExt);
                    if (filePath === null) {
                        showSimpleToast(
                            '`Paste Image',
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
                            '`Paste Image',
                            'Error occurred during pasting image',
                        );
                    }
                }
            },
        });
    }
    contextMenuItems.push({
        menuElement: '`Download from URL',
        onSelect: async () => {
            const imageUrl = await askForURL(
                '`Download From URL',
                'Image URL:',
            );
            if (imageUrl === null) {
                return;
            }
            try {
                showSimpleToast(
                    '`Download From URL',
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
                    '`Download From URL',
                    `Image downloaded successfully, file path: "${destFileSource.filePath}"`,
                );
            } catch (error) {
                handleError(error);
                showSimpleToast(
                    '`Download From URL',
                    'Error occurred during downloading image',
                );
            } finally {
                hideProgressBar(imageUrl);
            }
        },
    });
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
