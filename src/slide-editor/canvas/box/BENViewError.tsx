import { showAppContextMenu } from '../../../others/AppContextMenu';
import appProvider from '../../../server/appProvider';
import CanvasController from '../CanvasController';
import CanvasItem from '../CanvasItem';

export default function BENViewError({ canvasItem }: Readonly<{
    canvasItem: CanvasItem<any>,
}>) {
    return (
        <div className='box-editor pointer'
            style={canvasItem.getBoxStyle()}
            onContextMenu={async (event) => {
                event.stopPropagation();
                showAppContextMenu(event as any, [{
                    menuTitle: 'Delete',
                    onClick: () => {
                        const canvasController = CanvasController.getInstance();
                        canvasController.deleteItem(canvasItem);
                    },
                }, {
                    menuTitle: 'Copy Error Json',
                    onClick: () => {
                        appProvider.browserUtils.copyToClipboard(
                            JSON.stringify(canvasItem.props));
                    },
                }]);
            }}
            onClick={async (event) => {
                event.stopPropagation();
                const canvasController = CanvasController.getInstance();
                canvasController.stopAllMods();
                canvasController.setItemIsSelecting(canvasItem, true);
            }}>
            <div style={{
                ...canvasItem.getStyle(),
            }}>
                Error
            </div>
        </div>
    );
}

export function BENViewErrorRender() {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '5.5rem',
            color: 'red',
        }}>
            Error
        </div>
    );
}
