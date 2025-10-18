import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAttachedBackgroundData } from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { menuTitleRevealFile } from '../helper/helpers';
import { showExplorer } from '../server/appHelpers';

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
    if (attachedBackgroundData.type === DragTypeEnum.BACKGROUND_COLOR) {
        return (
            <button
                className="btn btn-secondary btn-sm"
                title={attachedBackgroundData.item}
            >
                <i
                    className="bi bi-filter-circle-fill"
                    style={{
                        color: attachedBackgroundData.item,
                    }}
                />
            </button>
        );
    } else if (attachedBackgroundData.type === DragTypeEnum.BACKGROUND_IMAGE) {
        return (
            <button
                className="btn btn-secondary btn-sm"
                title={attachedBackgroundData.item.src}
                onContextMenu={(event) =>
                    showMediaContextMenu(event, attachedBackgroundData.item.src)
                }
            >
                <i className="bi bi-image" />
            </button>
        );
    } else if (attachedBackgroundData.type === DragTypeEnum.BACKGROUND_VIDEO) {
        return (
            <button
                className="btn btn-secondary btn-sm"
                title={attachedBackgroundData.item.src}
                onContextMenu={(event) =>
                    showMediaContextMenu(event, attachedBackgroundData.item.src)
                }
            >
                <i className="bi bi-file-earmark-play-fill" />
            </button>
        );
    }
    // TODO: show bg on button click
    return null;
}
