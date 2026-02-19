import './BackgroundWebComp.scss';

import type { ReactElement } from 'react';
import { useState } from 'react';

import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import type DirSource from '../helper/DirSource';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import FileSource from '../helper/FileSource';
import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from './RenderBackgroundWebIframeComp';
import {
    genBackgroundWebContextMenuItems,
    genBackgroundWebExtraItemContextMenuItems,
} from './backgroundWebHelpers';

function RenderChildComp({
    filePath,
    selectedBackgroundSrcList,
    width,
    height,
    extraChild,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    width: number;
    height: number;
    extraChild?: ReactElement;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    const fileSource = FileSource.getInstance(filePath);
    return (
        <div
            className="card-body app-blank-bg"
            title={fileSource.fullName}
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
            onMouseEnter={() => {
                setIsPlaying(true);
            }}
            onMouseLeave={() => {
                setIsPlaying(false);
            }}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            {isPlaying ? (
                <RenderBackgroundWebIframeComp
                    fileSource={fileSource}
                    width={width}
                    height={height}
                />
            ) : (
                <BackgroundWebPlaceHolderComp height={height} />
            )}
            {extraChild}
        </div>
    );
}

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    width: number,
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RenderChildComp
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            width={width}
            height={height}
            extraChild={extraChild}
        />
    );
}

export default function BackgroundWebComp() {
    const handleItemsAdding = async (
        _dirSource: DirSource,
        defaultContextMenuItems: ContextMenuItemType[],
        event: any,
    ) => {
        showAppContextMenu(event, [...defaultContextMenuItems]);
    };
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_WEB}
            dragType={DragTypeEnum.BACKGROUND_WEB}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_WEB}
            genContextMenuItems={genBackgroundWebContextMenuItems}
            onItemsAdding={handleItemsAdding}
            genExtraItemContextMenuItems={
                genBackgroundWebExtraItemContextMenuItems
            }
            itemFillingClassname="web-thumbnail"
        />
    );
}
