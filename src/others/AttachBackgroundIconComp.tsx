import { useCallback } from 'react';
import type { CSSProperties, MouseEvent } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAttachedBackgroundData } from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { getMenuTitleRevealFile } from '../helper/helpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import type FileSource from '../helper/FileSource';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

function showMediaContextMenu(event: any, filePath: string) {
    event.stopPropagation();
    event.preventDefault();
    showAppContextMenu(event, [
        {
            childBefore: genContextMenuItemIcon('folder2-open'),
            menuElement: getMenuTitleRevealFile(),
            onSelect: () => {
                showFileOrDirExplorer(filePath);
            },
        },
    ]);
}

function RendItemComp({
    title,
    label,
    iStyle,
    iType,
    onContextMenu,
}: Readonly<{
    title: string;
    /**
     * What a screen reader says. Separate from `title` because the tooltip is
     * allowed to be the whole `file://` path -- useful when two slides carry
     * backgrounds of the same name -- while the accessible name must not be:
     * read aloud it is a minute of punctuation, and it carries the operator's
     * account name into anything that repeats it.
     */
    label?: string;
    iStyle?: CSSProperties;
    iType: string;
    onContextMenu?: (event: any) => void;
}>) {
    const onContextMenuRef = useAppCurrentRef(onContextMenu);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        if (onContextMenuRef.current) {
            onContextMenuRef.current(event);
        } else {
            event.stopPropagation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-secondary btn-sm p-0 mx-1"
            title={title}
            aria-label={label ?? title}
            // A plain click opens the same menu the right-click does. This
            // button has never done anything else, and a right-click is not
            // something a touch screen — or a browser that keeps its own menu on
            // that button — can offer at all.
            onClick={handleContextMenu}
            onContextMenu={handleContextMenu}
        >
            <i className={`bi bi-${iType}`} style={iStyle} />
        </button>
    );
}

export default function AttachBackgroundIconComp({
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
                title={`${tran('Color')}: ${item}`}
                iType="filter-circle-fill"
                iStyle={{ color: item }}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_CAMERA) {
        return (
            <RendItemComp
                title={`${tran('Camera')}: ${item.src}`}
                iType="camera-video-fill"
                iStyle={{}}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_WEB) {
        const fileSource = item as FileSource;
        return (
            <RendItemComp
                title={fileSource.src}
                label={`${tran('Web')}: ${fileSource.fullName}`}
                iType="globe"
                onContextMenu={(event) => {
                    showMediaContextMenu(event, fileSource.filePath);
                }}
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_IMAGE) {
        const fileSource = item as FileSource;
        return (
            <RendItemComp
                title={fileSource.src}
                label={`${tran('Image')}: ${fileSource.fullName}`}
                iType="image"
                onContextMenu={(event) =>
                    showMediaContextMenu(event, fileSource.filePath)
                }
            />
        );
    }
    if (backgroundType === DragTypeEnum.BACKGROUND_VIDEO) {
        const fileSource = item as FileSource;
        return (
            <RendItemComp
                title={fileSource.src}
                label={`${tran('Video')}: ${fileSource.fullName}`}
                iType="file-earmark-play-fill"
                onContextMenu={(event) =>
                    showMediaContextMenu(event, fileSource.filePath)
                }
            />
        );
    }
    // TODO: show bg on button click
    return null;
}
