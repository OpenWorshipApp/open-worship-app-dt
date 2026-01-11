import './BackgroundWebComp.scss';

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
import DirSource from '../helper/DirSource';
import { ReactElement, useState } from 'react';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { fsWriteFile } from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import appProvider from '../server/appProvider';
import { openPopupEditorWindow } from '../helper/domHelpers';
import RenderBackgroundWebIframeComp from './RenderBackgroundWebIframeComp';

function openPopupWebEditorWindow(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    const fileFullName = fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const pathName = `${appProvider.webEditorHomePage}?file=${fileFullNameEncoded}`;
    return openPopupEditorWindow(pathName);
}

function genExtraItemContextMenuItems(filePath: string) {
    return [
        {
            menuElement: '`Edit',
            title: '`Edit this web file',
            onSelect: () => {
                openPopupWebEditorWindow(filePath);
            },
        },
    ];
}

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
            title={filePath}
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
                <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                    <i
                        className="bi bi-filetype-html"
                        style={{
                            fontSize: `${Math.floor(height / 2)}px`,
                        }}
                    />
                </div>
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

export function genNewFileNameInput(
    fieName: string,
    onChange: (newFileName: string) => void,
) {
    return (
        <input
            type="text"
            autoFocus
            className="form-control"
            defaultValue={fieName}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
    );
}

function genDefaultHtml(fileFullName: string) {
    // https://codepen.io/P1N2O/pen/pyBNzX
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileFullName}</title>
    <style>
    body {
        background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
        background-size: 400% 400%;
        animation: gradient 15s ease infinite;
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    @keyframes gradient {
        0% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }
    </style>
</head>
<body></body>
</html>`;
}

function genContextMenuItems(dirSource: DirSource): ContextMenuItemType[] {
    return [
        {
            menuElement: '`New File',
            onSelect: async () => {
                let fileName = '';
                const isConfirmInput = await showAppInput(
                    '`New File Name',
                    genNewFileNameInput(fileName, (newFileName) => {
                        fileName = newFileName;
                    }),
                    {
                        escToCancel: false,
                        enterToOk: false,
                    },
                );
                if (isConfirmInput && fileName.trim().length > 0) {
                    const fileFullName = `${fileName}.html`;
                    const existFileFullNames =
                        await dirSource.getAllFileFullNames();
                    if (existFileFullNames.includes(fileFullName)) {
                        showSimpleToast(
                            'Create New Web File',
                            'File already exists',
                        );
                        return;
                    }
                    const fileSource =
                        dirSource.getFileSourceInstance(fileFullName);
                    fsWriteFile(
                        fileSource.filePath,
                        genDefaultHtml(fileFullName),
                    );
                }
            },
        },
    ];
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
            genContextMenuItems={genContextMenuItems}
            onItemsAdding={handleItemsAdding}
            genExtraItemContextMenuItems={genExtraItemContextMenuItems}
        />
    );
}
