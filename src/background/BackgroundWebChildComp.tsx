import { Fragment, useCallback, useRef, type ReactElement } from 'react';
import { useState } from 'react';

import { DragTypeEnum } from '../helper/DragInf';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import BackgroundMediaItemComp from './BackgroundMediaItemComp';
import FileSource from '../helper/FileSource';
import FillingFlexCenterComp from '../others/FillingFlexCenterComp';
import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from './RenderBackgroundWebIframeComp';
import { type BackgroundWebUrlSource } from './backgroundWebUrlHelpers';
import { genBackgroundWebExtraItemContextMenuItems } from './backgroundWebHelpers';
import { useWebCapturing } from '../helper/capturingHelpers';
import BackgroundWebUrlItemComp from './BackgroundWebUrlItemComp';
import { genColorBar } from '../helper/colorNoteHelpers';
import { genBackgroundWebColorSections } from './backgroundWebCompHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

export function RenderWebChildComp({
    fileOrUrlSource,
    selectedBackgroundSrcList,
    width,
    height,
    extraChild,
    isUrl = false,
}: Readonly<{
    fileOrUrlSource: FileSource | BackgroundWebUrlSource;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    width: number;
    height: number;
    extraChild?: ReactElement;
    isUrl?: boolean;
}>) {
    const attemptTimeOutRef = useRef(genTimeoutAttempt(1e3));
    const [isPlaying, setIsPlaying] = useState(false);
    const imageData = useWebCapturing(fileOrUrlSource.src);
    const handleMouseOver = useCallback(() => {
        setIsPlaying(true);
        attemptTimeOutRef.current?.(() => {
            setIsPlaying(true);
        });
    }, []);
    const handleMouseOut = useCallback(() => {
        setIsPlaying(false);
        attemptTimeOutRef.current?.(() => {
            setIsPlaying(false);
        });
    }, []);

    return (
        <div
            className="card-body app-blank-bg"
            title={fileOrUrlSource.fullName}
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
                position: 'relative',
            }}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <BackgroundWebPlaceHolderComp
                height={height}
                imageData={imageData}
                isUrl={isUrl}
                isPlaying={isPlaying}
            />
            {isPlaying ? (
                <RenderBackgroundWebIframeComp
                    iframeSource={fileOrUrlSource}
                    width={width}
                    height={height}
                />
            ) : null}
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
    const fileSource = FileSource.getInstance(filePath);
    return (
        <RenderWebChildComp
            fileOrUrlSource={fileSource}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            width={width}
            height={height}
            extraChild={extraChild}
        />
    );
}

export function basicRenderBody(
    urlSources: BackgroundWebUrlSource[],
    thumbnailWidth: number,
    handleUrlRemoving: (urlSource: BackgroundWebUrlSource) => Promise<void>,
    onColorNoteChange: () => void,
    filePaths: string[],
) {
    const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
    const sections = genBackgroundWebColorSections(filePaths, urlSources);

    return (
        <div className="w-100">
            {sections.map((section) => {
                return (
                    <Fragment key={section.colorNote ?? 'default'}>
                        {section.colorNote === undefined
                            ? null
                            : genColorBar(section.colorNote)}
                        <div className="d-flex justify-content-center flex-wrap">
                            {section.filePaths.map((filePath) => {
                                return (
                                    <BackgroundMediaItemComp
                                        key={filePath}
                                        rendChild={rendChild}
                                        genExtraItemContextMenuItems={
                                            genBackgroundWebExtraItemContextMenuItems
                                        }
                                        dragType={DragTypeEnum.BACKGROUND_WEB}
                                        onClick={undefined}
                                        noDraggable={false}
                                        isNameOnTop={false}
                                        thumbnailWidth={thumbnailWidth}
                                        thumbnailHeight={thumbnailHeight}
                                        filePath={filePath}
                                    />
                                );
                            })}
                            {section.urlSources.map((urlSource) => {
                                return (
                                    <BackgroundWebUrlItemComp
                                        key={urlSource.id}
                                        urlSource={urlSource}
                                        thumbnailWidth={thumbnailWidth}
                                        thumbnailHeight={thumbnailHeight}
                                        onRemove={handleUrlRemoving}
                                        onColorNoteChange={onColorNoteChange}
                                    />
                                );
                            })}
                            <FillingFlexCenterComp
                                width={thumbnailWidth}
                                className="web-thumbnail"
                            />
                        </div>
                    </Fragment>
                );
            })}
        </div>
    );
}
