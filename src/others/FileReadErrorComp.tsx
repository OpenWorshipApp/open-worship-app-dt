import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import type FileSource from '../helper/FileSource';

export default function FileReadErrorComp({
    fileSource,
    onContextMenu,
    reload,
}: Readonly<{
    fileSource?: FileSource;
    onContextMenu?: (event: any) => void;
    reload?: () => void;
}>) {
    const handleReload = useCallback(() => {
        reload?.();
    }, [reload]);
    const handleTrash = useCallback(() => {
        if (fileSource) {
            fileSource.trash();
        }
    }, [fileSource]);
    return (
        <div
            className="card app-caught-hover-pointer"
            onContextMenu={onContextMenu}
        >
            <div
                className={
                    'card-body d-flex justify-content-center ' +
                    'flex-column align-items-center p-2'
                }
            >
                <div className="alert alert-warning p-2">
                    {tran('Fail to read file data')}
                    {fileSource ? `: ${fileSource.fullName}` : ''}
                </div>
                <div className="d-flex flex-wrap justify-content-center">
                    {reload === undefined ? null : (
                        <button
                            className="btn btn-sm btn-primary m-1"
                            onClick={handleReload}
                        >
                            {tran('Reload')}
                        </button>
                    )}
                    {fileSource === undefined ? null : (
                        <button
                            className="btn btn-sm btn-danger m-1"
                            onClick={handleTrash}
                        >
                            {tran('Move to Trash')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
