import PathSelectorComp from '../../others/PathSelectorComp';
import { useAppEffect, useAppStateAsync } from '../../helper/debuggerHelpers';
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
import { fsCreateDir } from '../../server/fileHelpers';
import { OptionalPromise } from '../../others/otherHelpers';
import {
    appLocalStorage,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './appLocalStorage';
import { SelectDefaultDirButton } from '../../others/NoDirSelectedComp';
import { useGenDirSource } from '../../helper/dirSourceHelpers';

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
    if (!dirSource) {
        return null;
    }
    return (
        <div className="d-flex w-100 flex-column">
            <div>{title}:</div>
            <div className="d-flex">
                <div className="flex-grow-1">
                    <PathSelectorComp
                        prefix={`path-${settingName}`}
                        dirSource={dirSource}
                    />
                </div>
                {!dirSource.dirPath ? (
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
                            selectPathForChildDir(defaultPath);
                            dirSource.dirPath = defaultPath;
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
    Documents: [dirSourceSettingNames.DOCUMENT, defaultDataDirNames.DOCUMENT],
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
    'Background Sounds': [
        dirSourceSettingNames.BACKGROUND_SOUND,
        defaultDataDirNames.BACKGROUND_SOUND,
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
function RenderBodyComp({ dirSource }: Readonly<{ dirSource: DirSource }>) {
    useAppEffect(() => {
        if (dirSource.dirPath && checkShouldSelectChildDir()) {
            selectPathForChildDir(dirSource.dirPath);
        }
    }, [dirSource]);
    return (
        <div className="card">
            <div className="card-header">`Path Settings</div>
            <div className="card-body w-100 p-2">
                <RenderParentDirectoryComp dirSource={dirSource} />
                <div className="app-border-white-round p-1">
                    {dirSource.dirPath
                        ? Object.entries(titleSettingNames).map(
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
                          )
                        : null}
                </div>
            </div>
        </div>
    );
}

export default function SettingGeneralPathComp() {
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
