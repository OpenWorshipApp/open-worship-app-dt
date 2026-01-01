import { ReactNode, MouseEvent } from 'react';

import FileListHandlerComp from '../others/FileListHandlerComp';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import FileSource from '../helper/FileSource';
import { DragTypeEnum } from '../helper/DragInf';
import { useGenDirSource } from '../helper/dirSourceHelpers';
import { getMimetypeExtensions } from '../server/fileHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { OptionalPromise } from '../helper/typeHelpers';
import DirSource from '../helper/DirSource';
import { useStateSettingNumber } from '../helper/settingHelpers';
import AppRangeComp, { handleCtrlWheel } from '../others/AppRangeComp';
import BackgroundMediaItemComp, {
    backgroundTypeMapper,
    RenderChildType,
} from './BackgroundMediaItemComp';

export const defaultRangeSize = {
    size: 100,
    min: 50,
    max: 500,
    step: 10,
};

export function useThumbnailWidthSetting() {
    const [thumbnailWidth, setThumbnailWidth] = useStateSettingNumber(
        'bg-thumbnail-width',
        100,
    );
    return [thumbnailWidth, setThumbnailWidth] as const;
}

type PropsType = {
    shouldHideFooter?: boolean;
    extraHeaderChild?: ReactNode;
    rendChild: RenderChildType;
    dragType: DragTypeEnum;
    onClick?: (event: any, fileSource: FileSource) => void;
    defaultFolderName?: string;
    dirSourceSettingName: string;
    noDraggable?: boolean;
    isNameOnTop?: boolean;
    contextMenuItems?: ContextMenuItemType[];
    genContextMenuItems?: (
        dirSource: DirSource,
        event: MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    sortFilePaths?: (filePaths: string[]) => string[];
    onItemsAdding?: (
        dirSource: DirSource,
        contextMenuItems: ContextMenuItemType[],
        event: any,
    ) => void;
    genExtraItemContextMenuItems?: (filePath: string) => ContextMenuItemType[];
};

const handleBodyRendering = (
    props: PropsType,
    thumbnailWidth: number,
    filePaths: string[],
) => {
    const {
        extraHeaderChild,
        rendChild,
        dragType,
        onClick,
        noDraggable = false,
        isNameOnTop = false,
        sortFilePaths = (filePaths) => {
            return filePaths.sort((a, b) => a.localeCompare(b));
        },
        genExtraItemContextMenuItems = (_filePath: string) => [],
    } = props;
    const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
    const newFilePaths = sortFilePaths(filePaths);
    return (
        <div>
            {extraHeaderChild ? <>{extraHeaderChild}</> : null}
            <div className="d-flex justify-content-start flex-wrap">
                {newFilePaths.map((filePath) => {
                    return (
                        <BackgroundMediaItemComp
                            key={filePath}
                            rendChild={rendChild}
                            genExtraItemContextMenuItems={
                                genExtraItemContextMenuItems
                            }
                            dragType={dragType}
                            onClick={onClick}
                            noDraggable={noDraggable}
                            isNameOnTop={isNameOnTop}
                            thumbnailWidth={thumbnailWidth}
                            thumbnailHeight={thumbnailHeight}
                            filePath={filePath}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default function BackgroundMediaComp(props: Readonly<PropsType>) {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const backgroundType = backgroundTypeMapper[props.dragType];
    const dirSource = useGenDirSource(props.dirSourceSettingName);

    useScreenBackgroundManagerEvents(['update']);
    if (dirSource === null) {
        return null;
    }
    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: thumbnailWidth,
                    setValue: setThumbnailWidth,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <div className="card-body">
                <FileListHandlerComp
                    className={`app-background-${backgroundType}`}
                    mimetypeName={backgroundType}
                    defaultFolderName={props.defaultFolderName}
                    dirSource={dirSource}
                    bodyHandler={handleBodyRendering.bind(
                        null,
                        props,
                        thumbnailWidth,
                    )}
                    contextMenuItems={props.contextMenuItems}
                    genContextMenuItems={props.genContextMenuItems}
                    fileSelectionOption={
                        backgroundType === 'color'
                            ? undefined
                            : {
                                  windowTitle: `Select ${backgroundType} files`,
                                  dirPath: dirSource.dirPath,
                                  extensions:
                                      getMimetypeExtensions(backgroundType),
                              }
                    }
                    onItemsAdding={
                        props.onItemsAdding
                            ? props.onItemsAdding.bind(null, dirSource)
                            : undefined
                    }
                />
            </div>
            {props.shouldHideFooter ? null : (
                <div className="card-footer d-flex p-0">
                    <div className="flex-fill" />
                    <div>
                        <AppRangeComp
                            value={thumbnailWidth}
                            title="Thumbnail Size"
                            setValue={setThumbnailWidth}
                            defaultSize={defaultRangeSize}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
