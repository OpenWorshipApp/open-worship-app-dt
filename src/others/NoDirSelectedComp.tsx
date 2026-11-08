import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { selectDefaultDataDirName } from '../setting/directory-setting/directoryHelpers';
import { openPathSetting } from '../setting/settingHelpers';
import { selectDirs } from '../server/fileHelpers';

export function SelectDefaultDirButtonComp({
    dirSource,
    defaultFolderName,
}: Readonly<{
    dirSource: DirSource;
    defaultFolderName: string;
}>) {
    return (
        <button
            // Wraps: the app's `.btn` is `nowrap`, and in a ~230px sidebar the
            // label ran out of the card on both sides.
            className="btn btn-sm btn-info text-wrap text-break mw-100"
            onClick={() => {
                selectDefaultDataDirName(dirSource, defaultFolderName);
            }}
        >
            {tran('Select Default')} "{defaultFolderName}"
        </button>
    );
}

/**
 * Points the list at a folder of the person's own choosing, straight from the
 * empty state. Offered where **Go to Settings** is not an answer -- a folder
 * session's key is one the Path Settings page never lists -- so a new session
 * is one press from a folder rather than a hunt for the path row above.
 */
export function ChooseDirButtonComp({
    dirSource,
}: Readonly<{
    dirSource: DirSource;
}>) {
    return (
        <button
            className="btn btn-sm btn-outline-info text-wrap text-break mw-100"
            onClick={async () => {
                const dirs = await selectDirs();
                if (dirs.length === 0) {
                    return;
                }
                dirSource.dirPath = dirs[0];
            }}
        >
            <i className="bi bi-folder2-open me-1" />
            <span>{tran('Choose a folder')}</span>
        </button>
    );
}

export function GotoSettingDirectoryPathComp() {
    return (
        <div className="m-2">
            <button
                className="btn btn-sm btn-warning text-wrap text-break mw-100"
                onClick={() => {
                    openPathSetting();
                }}
            >
                <span>{tran('Go to Settings ')}</span>
                <i className="bi bi-gear-wide-connected" />
            </button>
        </div>
    );
}

export default function NoDirSelectedComp({
    dirSource,
    defaultFolderName,
    isDirSettingRouteHidden = false,
}: Readonly<{
    dirSource: DirSource;
    defaultFolderName: string;
    /**
     * Drop the **Go to Settings** route.
     *
     * It is only an answer where the folder is one the Path Settings page
     * actually lists. A folder SESSION -- a foreground widget's, a file
     * list's -- keeps its own folder under a key of its own, which that page
     * knows nothing about -- so the button
     * sent a volunteer out of the panel, into another window, to a list their
     * folder is not on. The folder picker beside this empty state is the way
     * in, and it is already here -- and so is a **Choose a folder** button in
     * the Settings route's place.
     */
    isDirSettingRouteHidden?: boolean;
}>) {
    // No data folder at all: a default folder inside it cannot be made, and
    // the only way on is the page where one is chosen.
    if (appLocalStorage.isOnOwnFolder) {
        return (
            <div className="card p-1 w-100 app-overflow-hidden">
                <div className="card-body w-100">
                    <div className="ms-2 text-warning-emphasis">
                        <i className="bi bi-info-circle me-1" />
                        <span>{tran('No Parent Directory Selected')}</span>
                    </div>
                    <div className="w-100 d-flex flex-column align-items-center justify-content-center">
                        <GotoSettingDirectoryPathComp />
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="card p-1 w-100 app-overflow-hidden">
            <div className="card-body w-100">
                {/* A theme colour: purple on the dark theme's card could
                    barely be read. */}
                <div className="ms-2 text-warning-emphasis">
                    <i className="bi bi-info-circle me-1" />
                    <span>{tran('No directory selected')}</span>
                </div>
                <div className="w-100 d-flex flex-column align-items-center justify-content-center">
                    <div className="m-1 mw-100">
                        <SelectDefaultDirButtonComp
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                    {isDirSettingRouteHidden ? (
                        <div className="m-2 mw-100">
                            <ChooseDirButtonComp dirSource={dirSource} />
                        </div>
                    ) : (
                        <div className="mw-100">
                            <GotoSettingDirectoryPathComp />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
