import { useMemo, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { pathBasename } from '../server/fileHelpers';
import { listResourcesDataDirFolders } from './resourcesCopyHelpers';
import { filterUnlistedResourcesFolders } from './resourcesFolderHelpers';
import { MAX_SCAN_DEPTH } from './resourcesScanHelpers';

/**
 * The folders sitting in `<data dir>/resources` that are not on the list yet,
 * one press each to add.
 *
 * That folder belongs to Resources -- every **Copy to Data Directory** lands in
 * it, and **Import Data** restores it -- yet a folder put there by hand, or one
 * taken off the list, was invisible here until it was found again through the
 * folder picker. Nothing is drawn when there is nothing to offer, so a shelf
 * that already lists everything carries no extra line.
 */
export default function ResourcesDataDirFoldersComp({
    dirPathList,
    reloadCount,
    onAddFolder,
}: Readonly<{
    dirPathList: string[];
    /** Bumped by the panel's Reload, which re-reads the folder too. */
    reloadCount: number;
    onAddFolder: (dirPath: string) => void;
}>) {
    const [dataDirFolderList, setDataDirFolderList] = useState<string[]>([]);
    // A string, not the array: a primitive dependency re-runs the read only
    // when the list really changed, never on a re-render that rebuilt it.
    const dirPathListKey = dirPathList.join('\n');
    useAppEffect(() => {
        // Re-read whenever the list changes as well as on Reload: a folder
        // copied in and later removed must come back here, and the list only
        // changes on a press, so this is one `readdir` per user action.
        let isCancelled = false;
        listResourcesDataDirFolders().then((dirPaths) => {
            if (!isCancelled) {
                setDataDirFolderList(dirPaths);
            }
        });
        return () => {
            isCancelled = true;
        };
    }, [dirPathListKey, reloadCount]);
    // Filtered here rather than in the read, so a pressed folder leaves this
    // list in the same render it joins the shelf -- not one `readdir` later.
    const unlistedDirPathList = useMemo(() => {
        return filterUnlistedResourcesFolders(
            dataDirFolderList,
            dirPathList,
            MAX_SCAN_DEPTH,
        );
    }, [dataDirFolderList, dirPathList]);
    if (unlistedDirPathList.length === 0) {
        return null;
    }
    return (
        <div className="app-resources-suggestions">
            <div className="app-resources-suggestions-label app-ellipsis">
                <i className="bi bi-archive pe-1" />
                {tran('In the data directory')}
            </div>
            {unlistedDirPathList.map((dirPath) => {
                const title = `${tran('Add Folder')}: ${dirPath}`;
                return (
                    <button
                        key={dirPath}
                        className="app-resources-suggestion"
                        type="button"
                        title={title}
                        aria-label={title}
                        onClick={() => {
                            onAddFolder(dirPath);
                        }}
                    >
                        <i className="app-resources-suggestion-icon bi bi-folder-plus" />
                        <span className="app-ellipsis">
                            {pathBasename(dirPath)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
