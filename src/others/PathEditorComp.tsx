import { useState } from 'react';

import DirSource from '../helper/DirSource';
import { selectDirs } from '../server/fileHelpers';

export default function PathEditorComp({
    dirSource,
}: Readonly<{
    dirSource: DirSource;
}>) {
    const [path, setPath] = useState(dirSource.dirPath);
    const setPath1 = (newPath: string) => {
        setPath(newPath);
        dirSource.dirPath = newPath;
    };
    let dirValidClassname = 'is-valid';
    if (dirSource.isDirPathValid === null) {
        dirValidClassname = '';
    } else if (!dirSource.isDirPathValid) {
        dirValidClassname = 'is-invalid';
    }
    return (
        <div className="input-group mb-3">
            {dirSource.dirPath ? (
                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                        return dirSource.fireReloadEvent();
                    }}
                >
                    <i className="bi bi-arrow-clockwise" />
                </button>
            ) : null}
            <input
                className={`form-control form-control-sm ${dirValidClassname}`}
                type="text"
                value={path}
                onChange={(event) => {
                    setPath1(event.target.value);
                }}
            />
            <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                    const dirs = selectDirs();
                    if (dirs.length) {
                        setPath1(dirs[0]);
                    }
                }}
            >
                <i className="bi bi-folder2-open" />
            </button>
        </div>
    );
}
