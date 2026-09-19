import {
    type ChangeEvent,
    type FocusEvent,
    type KeyboardEvent,
    useCallback,
    useState,
} from 'react';

import type DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
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
    // Typing must NOT commit. The setter persists the value AND fires a reload,
    // so committing per keystroke made the app adopt every prefix of what was
    // being typed: an absolute path went through `C`, `C:`, `C:\` -- and `C:\`
    // exists, so the drive ROOT became the data dir and the app created
    // `bibles-data/` and `local-storage/` in it before the confirm that asks
    // about child directories had even been answered (observed 2026-09-11).
    // The keystrokes move local state only; Enter, blur and the folder picker
    // are the commits.
    const handleDirPathChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setDirPath(event.target.value);
        },
        [],
    );
    const commitDirPath = useCallback((newDirPath: string) => {
        if (newDirPath === dirSourceRef.current.dirPath) {
            return;
        }
        dirSourceRef.current.dirPath = newDirPath;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCommitting = useCallback(
        (event: FocusEvent<HTMLInputElement>) => {
            commitDirPath(event.currentTarget.value);
        },
        [commitDirPath],
    );
    const handleKeyingUp = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                commitDirPath(event.currentTarget.value);
            } else if (event.key === 'Escape') {
                // Put back what is actually in force, so a half-typed path can
                // be abandoned without guessing what it was.
                setDirPath(dirSourceRef.current.dirPath);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [commitDirPath],
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
                onBlur={handleCommitting}
                onKeyUp={handleKeyingUp}
                title={tran('Press Enter to apply this folder')}
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
