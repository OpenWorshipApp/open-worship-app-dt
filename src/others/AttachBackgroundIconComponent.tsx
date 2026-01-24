import type { CSSProperties } from 'react';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAttachedBackgroundData } from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { menuTitleRevealFile } from '../helper/helpers';
import { showExplorer } from '../server/appHelpers';
import type FileSource from '../helper/FileSource';

function showMediaContextMenu(event: any, filePath: string) {
    event.stopPropagation();
    event.preventDefault();
    showAppContextMenu(event, [
        {
            menuElement: menuTitleRevealFile,
            onSelect: () => {
                showExplorer(filePath);
            },
        },
    ]);
}

function RendItemComp({
    title,
    iStyle,
    iType,
    onContextMenu,
}: Readonly<{
    title: string;
    iStyle?: CSSProperties;
    iType: string;
    onContextMenu?: (event: any) => void;
}>) {
    return (
        <button
            className="btn btn-secondary btn-sm p-0 mx-1"
            title={title}
            onContextMenu={
                onContextMenu ??
                ((event) => {
                    event.stopPropagation();
                })
            }
        >
            <i className={`bi bi-${iType}`} style={iStyle} />
        </button>
    );
}

export default function AttachBackgroundIconComponent({
    filePath,
    id,
}: Readonly<{
    filePath: string;
    id?: string | number;
}>) {
    const attachedBackgroundData = useAttachedBackgroundData(filePath, id);
    if (
        attachedBackgroundData === null ||
        attachedBackgroundData === undefined
    ) {
        return null;
    }
    const { type: backgroundType, item } = attachedBackgroundData;
    if (backgroundType === DragTypeEnum.BACKGROUND_COLOR) {
        return (
            <RendItemComp
                title={`Color: ${item}`}
                iType="filter-circle-fill"
                iStyle={{ color: item }}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_CAMERA) {
        return (
            <RendItemComp
                title={`Camera: ${item.src}`}
                iType="camera-video-fill"
                iStyle={{}}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_WEB) {
        return (
            <RendItemComp
                title={(item as FileSource).src}
                iType="globe"
                onContextMenu={(event) => {
                    showMediaContextMenu(event, (item as FileSource).filePath);
                }}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_IMAGE) {
        return (
            <RendItemComp
                title={(item as FileSource).src}
                iType="image"
                onContextMenu={(event) =>
                    showMediaContextMenu(event, (item as FileSource).filePath)
                }
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_VIDEO) {
        return (
            <RendItemComp
                title={(item as FileSource).src}
                iType="file-earmark-play-fill"
                onContextMenu={(event) =>
                    showMediaContextMenu(event, (item as FileSource).filePath)
                }
            />
        );
    }
    // TODO: show bg on button click
    return null;
}
