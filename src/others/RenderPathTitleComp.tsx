import { useCallback, type MouseEvent } from 'react';

import type DirSource from '../helper/DirSource';
import { PathPreviewerComp } from './PathPreviewerComp';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderPathTitleComp({
    dirSource,
    addItems,
}: Readonly<{
    dirSource: DirSource;
    addItems?: (event: MouseEvent) => void;
}>) {
    const dirSourceRef = useAppCurrentRef(dirSource);
    const handleReload = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        dirSourceRef.current.fireReloadEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const addItemsRef = useAppCurrentRef(addItems);
    const handleAddItems = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        addItemsRef.current?.(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
