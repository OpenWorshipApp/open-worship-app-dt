import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';

export default function ItemReadErrorComp({
    onContextMenu,
}: Readonly<{
    onContextMenu?: (event: any) => void;
}>) {
    return (
        <div
            className="card app-caught-hover-pointer"
            onContextMenu={onContextMenu}
        >
            {onContextMenu === undefined ? null : (
                <ContextMenuDotsButtonComp isCorner onOpening={onContextMenu} />
            )}
            <div className="card-header">Item data error</div>
        </div>
    );
}
