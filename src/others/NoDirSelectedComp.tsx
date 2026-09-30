import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import { selectDefaultDataDirName } from '../setting/directory-setting/directoryHelpers';
import { openGeneralSetting } from '../setting/settingHelpers';

export function SelectDefaultDirButton({
    dirSource,
    defaultFolderName,
}: Readonly<{
    dirSource: DirSource;
    defaultFolderName: string;
}>) {
    return (
        <button
            className="btn btn-sm btn-info"
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
                className="btn btn-sm btn-warning"
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
                <div
                    className="ms-2"
                    style={{
                        color: 'purple',
                    }}
                >
                    <i className="bi bi-info-circle me-1" />
                    <span>{tran('No directory selected')}</span>
                </div>
                <div className="w-100 d-flex flex-column align-items-center justify-content-center">
                    <div className="m-1">
                        <SelectDefaultDirButton
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                    {isDirSettingRouteHidden ? null : (
                        <div>
                            <GotoSettingDirectoryPathComp />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
