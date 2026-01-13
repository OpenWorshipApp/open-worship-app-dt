import { CSSProperties, useMemo, useRef, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { ForegroundWebDataType } from '../_screen/screenTypeHelpers';
import { backgroundTypeMapper } from '../background/backgroundHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { useGenDirSource } from '../helper/dirSourceHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import FileSource from '../helper/FileSource';
import FileListHandlerComp from '../others/FileListHandlerComp';
import { getMimetypeExtensions } from '../server/fileHelpers';
import {
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
    getScreenForegroundManagerInstances,
} from './foregroundHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { genTimeoutAttempt } from '../helper/helpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from '../background/RenderBackgroundWebIframeComp';
import { dragStore } from '../helper/dragHelpers';
import {
    genBackgroundWebContextMenuItems,
    genBackgroundWebExtraItemContextMenuItems,
} from '../background/backgroundWebHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    genCommonMenu,
    genShowOnScreensContextMenu,
} from '../others/FileItemHandlerComp';

function getAllShowingScreenIdDataList() {
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        ({ webDataList }) => {
            return webDataList.length > 0;
        },
    ).reduce(
        (acc, [screenId, { webDataList }]) => {
            return acc.concat(
                webDataList.map((data) => {
                    return [screenId, data];
                }),
            );
        },
        [] as [number, ForegroundWebDataType][],
    );
    return showingScreenIdDataList;
}

function handleWebHiding(screenId: number, data: ForegroundWebDataType) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeWebData(data);
    });
}

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllWebs(
    showingScreenIdDataList: [number, ForegroundWebDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
        for (const [screenId, data] of showingScreenIdDataList) {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.removeWebData(data);
                    screenForegroundManager.addWebData({
                        ...data,
                        extraStyle,
                    });
                },
            );
        }
    });
}

function genDimScale(getWidthScale: () => number) {
    const widthScale = getWidthScale() / 100;
    const heightScale = (widthScale * 9) / 16;
    return {
        widthScale: widthScale,
        heightScale: heightScale,
    };
}

function RenderShownMiniComp() {
    useScreenForegroundManagerEvents(['update']);
    const allShowingScreenIdDataList = getAllShowingScreenIdDataList();
    return (
        <ScreensRendererComp
            showingScreenIdDataList={allShowingScreenIdDataList}
            buttonText={tran('Hide Web')}
            genTitle={(data) => {
                const fileSource = FileSource.getInstance(data.filePath);
                return `Web: ${fileSource.fullName}`;
            }}
            handleForegroundHiding={handleWebHiding}
            isMini
        />
    );
}

function RenderWebInfoComp({
    filePath,
    width,
    genStyle,
    getWidthScale,
}: Readonly<{
    filePath: string;
    width: number;
    genStyle: () => CSSProperties;
    getWidthScale: () => number;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    const height = useMemo(() => {
        return Math.round((width * 9) / 16);
    }, [width]);
    const fileSource = useMemo(() => {
        return FileSource.getInstance(filePath);
    }, [filePath]);
    const containerRef = useRef<HTMLDivElement>(null);
    const handleShowing = (event: any, isForceChoosing = false) => {
        const { widthScale, heightScale } = genDimScale(getWidthScale);
        ScreenForegroundManager.addWebData(
            event,
            {
                filePath,
                widthScale,
                heightScale,
                extraStyle: genStyle(),
            },
            isForceChoosing,
        );
    };
    const handleByDropped = (event: any) => {
        const screenForegroundManager =
            getScreenForegroundManagerByDropped(event);
        if (screenForegroundManager === null) {
            return;
        }
        const { widthScale, heightScale } = genDimScale(getWidthScale);
        screenForegroundManager.addWebData({
            filePath,
            widthScale,
            heightScale,
            extraStyle: genStyle(),
        });
    };
    return (
        <div className="card m-1" style={{ width: `${width}px` }}>
            <div
                className="card-header app-ellipsis"
                title={fileSource.filePath}
            >
                {fileSource.fullName}
            </div>
            <div
                className={
                    'card-body w-100 p-0 app-overflow-hidden' +
                    ' app-caught-hover-pointer'
                }
                style={{ height: `${height}px` }}
                onClick={handleShowing}
                onContextMenu={(event) => {
                    showAppContextMenu(event as any, [
                        ...genCommonMenu(filePath),
                        ...genShowOnScreensContextMenu((event) => {
                            handleShowing(event, true);
                        }),
                        ...genBackgroundWebExtraItemContextMenuItems(filePath),
                    ]);
                }}
                ref={containerRef}
                draggable
                onDragStart={() => {
                    dragStore.onDropped = handleByDropped;
                }}
                onMouseEnter={() => {
                    setIsPlaying(true);
                }}
                onMouseLeave={() => {
                    setIsPlaying(false);
                }}
            >
                {isPlaying ? (
                    <RenderBackgroundWebIframeComp
                        fileSource={fileSource}
                        width={width}
                        height={height}
                    />
                ) : (
                    <BackgroundWebPlaceHolderComp height={height} />
                )}
            </div>
        </div>
    );
}

function ForegroundWebItemComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getAllShowingScreenIdDataList().filter(
        ([, data]) => data.filePath === filePath,
    );
    const fileSource = FileSource.getInstance(filePath);
    const {
        genStyle,
        getWidthScale,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix: `web-${fileSource.fullName}`,
        onChange: (extraStyle) => {
            refreshAllWebs(showingScreenIdDataList, extraStyle);
        },
    });
    return (
        <div className="app-border-white-round p-1" style={{ margin: '2px' }}>
            {propsSetting}
            <hr />
            <div className="d-flex flex-wrap">
                <RenderWebInfoComp
                    filePath={filePath}
                    width={200}
                    getWidthScale={getWidthScale}
                    genStyle={genStyle}
                />
            </div>
            <hr />
            <ScreensRendererComp
                showingScreenIdDataList={showingScreenIdDataList}
                buttonText={tran('Hide Web')}
                genTitle={(data) => {
                    const fileSource = FileSource.getInstance(data.filePath);
                    return `Web: ${fileSource.fullName}`;
                }}
                handleForegroundHiding={handleWebHiding}
                isMini={false}
            />
        </div>
    );
}

function renderChildren(filePaths: string[]) {
    return (
        <div className="d-flex flex-wrap">
            {filePaths.map((filePath) => {
                return (
                    <ForegroundWebItemComp key={filePath} filePath={filePath} />
                );
            })}
        </div>
    );
}

export default function ForegroundWebComp() {
    const dirSource = useGenDirSource(dirSourceSettingNames.BACKGROUND_WEB);
    useScreenForegroundManagerEvents(['update']);
    if (dirSource === null) {
        return null;
    }
    const backgroundType = backgroundTypeMapper[DragTypeEnum.BACKGROUND_WEB];
    return (
        <ForegroundLayoutComp
            target="web"
            fullChildHeaders={<h4>{tran('Web Show')}</h4>}
            childHeadersOnHidden={<RenderShownMiniComp />}
            extraBodyStyle={{
                maxHeight: '500px',
            }}
        >
            <FileListHandlerComp
                className={`app-foreground-${backgroundType}`}
                mimetypeName={backgroundType}
                defaultFolderName={defaultDataDirNames.BACKGROUND_WEB}
                dirSource={dirSource}
                bodyHandler={renderChildren}
                genContextMenuItems={genBackgroundWebContextMenuItems}
                fileSelectionOption={
                    backgroundType === 'color'
                        ? undefined
                        : {
                              windowTitle: `Select ${backgroundType} files`,
                              dirPath: dirSource.dirPath,
                              extensions: getMimetypeExtensions(backgroundType),
                          }
                }
            />
        </ForegroundLayoutComp>
    );
}
