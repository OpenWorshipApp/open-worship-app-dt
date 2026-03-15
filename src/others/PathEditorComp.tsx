import { ChangeEvent, useCallback, useMemo, useState } from 'react';

import type DirSource from '../helper/DirSource';
import { selectDirs } from '../server/fileHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';

export default function PathEditorComp({
    dirSource,
}: Readonly<{
    dirSource: DirSource;
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

    const dirValidClassname = useMemo(() => {
        let dirValidClassname = 'is-valid';
        if (dirSource.isDirPathValid === null) {
            dirValidClassname = '';
        } else if (!dirSource.isDirPathValid) {
            dirValidClassname = 'is-invalid';
        }
        return dirValidClassname;
    }, [dirSource.isDirPathValid]);

    const handleDirSelecting = useCallback(async () => {
        const dirs = await selectDirs();
        if (dirs.length === 0) {
            return;
        }
        dirSource.dirPath = dirs[0];
    }, [dirSource]);
    const handleReload = useCallback(() => {
        return dirSource.fireReloadEvent();
    }, [dirSource]);
    const handleDirPathChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            dirSource.dirPath = event.target.value;
        },
        [dirSource],
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
