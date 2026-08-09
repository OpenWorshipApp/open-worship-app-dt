import { tran } from '../../../lang/langHelpers';
import { showAppContextMenu } from '../../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../../context-menu/contextMenuIconHelpers';
import appProvider from '../../../server/appProvider';
import type CanvasController from '../CanvasController';
import type CanvasItem from '../CanvasItem';

export function genErrorContextMenuHandler(
    canvasController: CanvasController,
    canvasItem: CanvasItem<any>,
) {
    return (event: any) => {
        event.stopPropagation();
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('trash3', {
                    color: 'var(--bs-danger)',
                }),
                menuElement: tran('Delete'),
                onSelect: () => {
                    canvasController.deleteItems([canvasItem]);
                },
            },
            {
                childBefore: genContextMenuItemIcon('braces'),
                menuElement: tran('Copy Error Json'),
                onSelect: () => {
                    appProvider.systemUtils.copyToClipboard(
                        JSON.stringify(canvasItem.props),
                    );
                },
            },
        ]);
    };
}

export function BoxEditorNormalViewErrorRenderComp() {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '5.5rem',
                color: 'red',
            }}
        >
            {tran('Error')}
        </div>
    );
}
