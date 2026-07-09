import { type ChangeEvent, useCallback, useState } from 'react';

import type DirSource from '../helper/DirSource';
import { selectDirs } from '../server/fileHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';

export default function PathEditorComp({
    dirSource,
    placeholder = '',
}: Readonly<{
    dirSource: DirSource;
    placeholder?: string;
}>) {
    const [dirPath, setDirPath] = useState(dirSource.dirPath);

    useAppEffect(() => {
        dirSource.setDirPath = (newDirPath: string) => {
            setDirPath(newDirPath);
        };
        return () => {
            dirSource.setDirPath = () => {};
        };
    }, [dirSource]);

    let dirValidClassname = 'is-valid';
    if (dirSource.isDirPathValid === null) {
        dirValidClassname = '';
    } else if (!dirSource.isDirPathValid) {
        dirValidClassname = 'is-invalid';
    }

    const dirSourceRef = useAppCurrentRef(dirSource);
    const handleDirSelecting = useCallback(async () => {
        const dirs = await selectDirs();
        if (dirs.length === 0) {
            return;
        }
        dirSourceRef.current.dirPath = dirs[0];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleReload = useCallback(() => {
        return dirSourceRef.current.fireReloadEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDirPathChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            dirSourceRef.current.dirPath = event.target.value;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="input-group mb-3">
            {dirSource.dirPath ? (
                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={handleReload}
                >
                    <i className="bi bi-arrow-clockwise" />
                </button>
            ) : null}
            <input
                className={`form-control form-control-sm ${dirValidClassname}`}
                type="text"
                value={dirPath}
                onChange={handleDirPathChange}
                placeholder={placeholder ? `e.g. ${placeholder}` : ''}
            />
            <button
                className="btn btn-secondary"
                type="button"
                onClick={handleDirSelecting}
            >
                <i className="bi bi-folder2-open" />
            </button>
        </div>
    );
}
