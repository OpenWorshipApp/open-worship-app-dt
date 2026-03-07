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
}: Readonly<{
    dirSource: DirSource;
    defaultFolderName: string;
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
                    <i className="bi bi-info-circle" />
                    <span>{tran('No directory selected')}</span>
                </div>
                <div className="w-100 d-flex flex-column align-items-center justify-content-center">
                    <div className="m-1">
                        <SelectDefaultDirButton
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                    <div>
                        <GotoSettingDirectoryPathComp />
                    </div>
                </div>
            </div>
        </div>
    );
}
