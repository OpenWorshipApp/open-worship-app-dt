import { showAppContextMenu } from '../../../context-menu/appContextMenuHelpers';
import appProvider from '../../../server/appProvider';
import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasItemContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

export default function BoxEditorNormalViewErrorComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    return (
        <BoxEditorNormalWrapperComp
            style={canvasItem.getBoxStyle()}
            onContextMenu={async (event) => {
                event.stopPropagation();
                showAppContextMenu(event, [
                    {
                        menuElement: 'Delete',
                        onSelect: () => {
                            canvasController.deleteItems([canvasItem]);
                        },
                    },
                    {
                        menuElement: 'Copy Error Json',
                        onSelect: () => {
                            appProvider.systemUtils.copyToClipboard(
                                JSON.stringify(canvasItem.props),
                            );
                        },
                    },
                ]);
            }}
        >
            Error
        </BoxEditorNormalWrapperComp>
    );
}

export function BENViewErrorRender() {
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
            Error
        </div>
    );
}
