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
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    checkIsImagesInClipboard,
    readImagesFromClipboard,
} from '../server/appHelpers';
import DirSource from '../helper/DirSource';
import { showSimpleToast } from '../toast/toastHelpers';
import { getDotExtensionFromBase64Data } from '../server/fileHelpers';

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
    return contextMenuItems;
}

export default function BackgroundImagesComp() {
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_IMAGE}
            dragType={DragTypeEnum.BACKGROUND_IMAGE}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_IMAGE}
            genContextMenuItems={genContextMenuItems}
        />
    );
}
