import { useCallback, type MouseEvent } from 'react';

import type DirSource from '../helper/DirSource';
import { PathPreviewerComp } from './PathPreviewerComp';
import { tran } from '../lang/langHelpers';

export default function RenderPathTitleComp({
    dirSource,
    addItems,
}: Readonly<{
    dirSource: DirSource;
    addItems?: (event: MouseEvent) => void;
}>) {
    const handleReload = useCallback(
        (event: MouseEvent) => {
            event.stopPropagation();
            dirSource.fireReloadEvent();
        },
        [dirSource],
    );
    const handleAddItems = useCallback(
        (event: MouseEvent) => {
            event.stopPropagation();
            addItems?.(event);
        },
        [addItems],
    );
    if (!dirSource.dirPath) {
        return null;
    }
    return (
        <>
            <PathPreviewerComp dirPath={dirSource.dirPath} />
            <div className="ps-2" title={tran('Reload')} onClick={handleReload}>
                <i className="bi bi-arrow-clockwise" />
            </div>
            {addItems === undefined ? null : (
                <div
                    className="app-add-items-button px-1"
                    title={tran('Add items')}
                    onClick={handleAddItems}
                >
                    <i className="bi bi-plus-lg" />
                </div>
            )}
        </>
    );
}
