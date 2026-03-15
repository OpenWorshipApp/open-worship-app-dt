import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';

export default function FileReadErrorComp({
    onContextMenu,
    reload,
}: Readonly<{
    onContextMenu?: (event: any) => void;
    reload?: () => void;
}>) {
    const handleReload = useCallback(() => {
        reload?.();
    }, [reload]);
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
                <div className="alert alert-danger p-2">
                    {tran('Fail to read file data')}
                </div>
                {reload === undefined ? null : (
                    <div>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={handleReload}
                        >
                            {tran('Reload')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
