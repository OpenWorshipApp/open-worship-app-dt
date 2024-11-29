import { useCallback } from 'react';

import { showAppContextMenu } from '../others/AppContextMenu';
import FileListHandler from '../others/FileListHandler';
import { genCommonMenu } from '../others/FileItemHandler';
import ScreenBGManager from '../_screen/ScreenBGManager';
import { usePBGMEvents } from '../_screen/screenEventHelpers';
import FileSource from '../helper/FileSource';
import { DragTypeEnum } from '../helper/DragInf';
import ItemColorNote from '../others/ItemColorNote';
import { handleDragStart } from '../bible-list/dragHelpers';
import { useGenDS } from '../helper/dirSourceHelpers';
import { BackgroundSrcType } from '../_screen/screenHelpers';

export type RenderChildType = (
    filePath: string,
    selectedBGSrcList: [string, BackgroundSrcType][],
) => React.JSX.Element;

const bgTypeMapper: any = {
    [DragTypeEnum.BG_IMAGE]: 'image',
    [DragTypeEnum.BG_VIDEO]: 'video',
};

export default function BackgroundMedia({
    rendChild, dragType, defaultFolderName, dirSourceSettingName,
}: Readonly<{
    rendChild: RenderChildType,
    dragType: DragTypeEnum,
    defaultFolderName: string,
    dirSourceSettingName: string,
}>) {
    const bgType = bgTypeMapper[dragType];
    const dirSource = useGenDS(dirSourceSettingName);
    const renderCallback = useCallback((filePaths: string[]) => {
        const genBodyWithChild = genBody.bind(null, rendChild, dragType);
        return (
            <div className='d-flex justify-content-start flex-wrap'>
                {filePaths.map(genBodyWithChild)}
            </div>
        );
    }, []);
    usePBGMEvents(['update']);
    if (dirSource === null) {
        return null;
    }
    return (
        <FileListHandler id={`background-${bgType}`}
            mimetype={bgType}
            defaultFolderName={defaultFolderName}
            dirSource={dirSource}
            bodyHandler={renderCallback}
        />
    );
}

function genBody(
    rendChild: RenderChildType, dragType: DragTypeEnum, filePath: string,
) {
    const fileSource = FileSource.getInstance(filePath);
    const bgType = bgTypeMapper[dragType];
    const selectedBGSrcList = ScreenBGManager.getSelectBGSrcList(
        fileSource.src, bgType,
    );
    const selectedCN = selectedBGSrcList.length ? 'highlight-selected' : '';
    const screenKeys = selectedBGSrcList.map(([key]) => key);
    const title = (
        `${filePath}` + (selectedBGSrcList.length ?
            ` \nShow in presents:${screenKeys.join(',')}` : ''
        )
    );

    return (
        <div key={fileSource.name}
            className={`${bgType}-thumbnail card ${selectedCN}`}
            title={title}
            draggable
            onDragStart={(event) => {
                handleDragStart(event, fileSource, dragType);
            }}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, genCommonMenu(filePath));
            }}
            onClick={(event) => {
                ScreenBGManager.bgSrcSelect(fileSource.src, event, bgType);
            }}>
            {rendChild(filePath, selectedBGSrcList)}
            <div style={{
                position: 'absolute',
                right: 0,
            }}>
                <ItemColorNote item={fileSource} />
            </div>
            <div className='card-footer'>
                <p className='ellipsis-left card-text'>
                    {fileSource.fileName}
                </p>
            </div>
        </div>
    );
}
