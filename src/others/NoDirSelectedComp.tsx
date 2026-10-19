import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import { selectDefaultDataDirName } from '../setting/directory-setting/directoryHelpers';
import { openGeneralSetting } from '../setting/settingHelpers';

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

export function GotoSettingDirectoryPathComp() {
    return (
        <div className="m-2">
            <button
                className="btn btn-sm btn-warning text-wrap text-break mw-100"
                onClick={() => {
                    openGeneralSetting();
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
     * actually lists. A foreground media SESSION keeps its own folder under a
     * key of its own, which that page knows nothing about -- so the button
     * sent a volunteer out of the panel, into another window, to a list their
     * folder is not on. The folder picker beside this empty state is the way
     * in, and it is already here.
     */
    isDirSettingRouteHidden?: boolean;
}>) {
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
                    {isDirSettingRouteHidden ? null : (
                        <div className="mw-100">
                            <GotoSettingDirectoryPathComp />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
