import PathSelectorComp from '../../others/PathSelectorComp';
import {
    useAppEffectAsync,
    useAppStateAsync,
} from '../../helper/debuggerHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import {
    checkShouldSelectChildDir,
    getDefaultDataDir,
    selectPathForChildDir,
} from './directoryHelpers';
import { fsCheckDirExist, fsCreateDir } from '../../server/fileHelpers';
import {
    appLocalStorage,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './appLocalStorage';
import { SelectDefaultDirButton } from '../../others/NoDirSelectedComp';
import { useGenDirSource } from '../../helper/dirSourceHelpers';
import { OptionalPromise } from '../../helper/typeHelpers';

class ParentDirSource extends DirSource {
    _dirPath: string;
    setDirPath: (dirPath: string) => OptionalPromise<void> = (
        _dirPath: string,
    ) => {};
    constructor(dirPath: string) {
        super(SELECTED_PARENT_DIR_SETTING_NAME);
        this._dirPath = dirPath;
    }

    get dirPath() {
        return this._dirPath;
    }

    set dirPath(dirPath: string) {
        this.setDirPath(dirPath);
    }
}

function RenderPathElementComp({
    title,
    settingName,
    defaultFolderName,
}: Readonly<{
    title: string;
    settingName: string;
    defaultFolderName: string;
}>) {
    const dirSource = useGenDirSource(settingName);
    const [isValidDirPath] = useAppStateAsync(() => {
        return fsCheckDirExist(dirSource?.dirPath ?? '');
    }, [dirSource]);
    if (!dirSource) {
        return null;
    }
    return (
        <div className="d-flex w-100 flex-column">
            <div>{title}:</div>
            <div className="d-flex flex-column">
                <div className="flex-grow-1">
                    <PathSelectorComp
                        prefix={`path-${settingName}`}
                        dirSource={dirSource}
                        isForceShowEditor={!isValidDirPath}
                    />
                </div>
                {!isValidDirPath ? (
                    <div className="m-1">
                        <SelectDefaultDirButton
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                ) : null}
            </div>
            <hr />
        </div>
    );
}

function RenderParentDirectoryComp({
    dirSource,
}: Readonly<{ dirSource: DirSource }>) {
    const defaultPath = getDefaultDataDir();
    return (
        <div className="d-flex flex-column">
            <div className="app-highlight-selected p-2">
                <div>`Parent Directory:</div>
                <div>
                    <PathSelectorComp
                        prefix="path-parent-dir"
                        dirSource={dirSource}
                    />
                </div>
            </div>
            {!dirSource.dirPath ? (
                <div>
                    <hr />
                    <button
                        className="btn btn-sm btn-info ms-2"
                        onClick={async () => {
                            await fsCreateDir(defaultPath);
                            dirSource.dirPath = defaultPath;
                            await selectPathForChildDir(defaultPath);
                        }}
                    >
                        Set Default Data ({defaultPath})
                    </button>
                </div>
            ) : null}
        </div>
    );
}

const titleSettingNames = {
    Documents: [
        dirSourceSettingNames.APP_DOCUMENT,
        defaultDataDirNames.APP_DOCUMENT,
    ],
    Lyrics: [dirSourceSettingNames.LYRIC, defaultDataDirNames.LYRIC],
    Playlists: [dirSourceSettingNames.PLAYLIST, defaultDataDirNames.PLAYLIST],
    'Background Images': [
        dirSourceSettingNames.BACKGROUND_IMAGE,
        defaultDataDirNames.BACKGROUND_IMAGE,
    ],
    'Background Videos': [
        dirSourceSettingNames.BACKGROUND_VIDEO,
        defaultDataDirNames.BACKGROUND_VIDEO,
    ],
    'Background Audios': [
        dirSourceSettingNames.BACKGROUND_AUDIO,
        defaultDataDirNames.BACKGROUND_AUDIO,
    ],
    'Bible Present': [
        dirSourceSettingNames.BIBLE_PRESENT,
        defaultDataDirNames.BIBLE_PRESENT,
    ],
    'Bible Reader': [
        dirSourceSettingNames.BIBLE_READ,
        defaultDataDirNames.BIBLE_READ,
    ],
};

function RenderChildDirectoriesComp({
    parentDirPath,
}: Readonly<{ parentDirPath: string }>) {
    return (
        <>
            <div className="card-header">
                <button
                    className="btn btn-sm btn-warning"
                    onClick={() => {
                        selectPathForChildDir(parentDirPath);
                    }}
                >
                    `Reset All Child Directories
                </button>
            </div>
            <div className="card-body">
                {Object.entries(titleSettingNames).map(
                    ([title, [settingName, defaultFolderName]]) => {
                        return (
                            <RenderPathElementComp
                                key={title}
                                title={title}
                                settingName={settingName}
                                defaultFolderName={defaultFolderName}
                            />
                        );
                    },
                )}
            </div>
        </>
    );
}

function RenderBodyComp({ dirSource }: Readonly<{ dirSource: DirSource }>) {
    useAppEffectAsync(async () => {
        if (dirSource.dirPath && (await checkShouldSelectChildDir())) {
            selectPathForChildDir(dirSource.dirPath);
        }
    }, [dirSource]);
    return (
        <div className="card">
            <div className="card-header">`Path Settings</div>
            <div className="card-body w-100 p-2">
                <RenderParentDirectoryComp dirSource={dirSource} />
                <div className="card app-border-white-round p-1">
                    {dirSource.dirPath ? (
                        <RenderChildDirectoriesComp
                            parentDirPath={dirSource.dirPath}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function SettingGeneralDirectoryPathComp() {
    const [dirSource, setDirSource] = useAppStateAsync(async () => {
        const selectedParentDir =
            await appLocalStorage.getSelectedParentDirectory();
        const dirSource = new ParentDirSource(selectedParentDir ?? '');
        return dirSource;
    });
    if (!dirSource) {
        return null;
    }
    dirSource.setDirPath = async (dirPath: string) => {
        await appLocalStorage.setSelectedParentDirectory(dirPath);
        await selectPathForChildDir(dirPath);
        const newDirSource = new ParentDirSource(dirPath);
        setDirSource(newDirSource);
    };
    return <RenderBodyComp dirSource={dirSource} />;
}
