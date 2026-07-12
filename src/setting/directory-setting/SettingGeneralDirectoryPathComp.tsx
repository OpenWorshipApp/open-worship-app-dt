import { useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import PathSelectorComp from '../../others/PathSelectorComp';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
    useAppCurrentRef,
} from '../../helper/appHooks';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import {
    checkShouldSelectChildDir,
    getDefaultDataDir,
    removePathForChildDir,
    selectPathForChildDir,
} from './directoryHelpers';
import { fsCheckDirExist, fsCreateDir } from '../../server/fileHelpers';
import {
    appLocalStorage,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './appLocalStorage';
import { SelectDefaultDirButton } from '../../others/NoDirSelectedComp';
import { useGenDirSourceReload } from '../../helper/dirSourceHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';
import { type OptionalPromise } from '../../helper/typeHelpers';
import SettingCardHeaderComp from '../SettingCardHeaderComp';

class ParentDirSource extends DirSource {
    _dirPath: string;
    setParentDirPath: (newFilePath: string) => OptionalPromise<void> = () => {};
    constructor(dirPath: string) {
        super(SELECTED_PARENT_DIR_SETTING_NAME);
        this._dirPath = dirPath;
    }

    get dirPath() {
        return this._dirPath;
    }

    set dirPath(dirPath: string) {
        this.setDirPath(dirPath);
        this.setParentDirPath(dirPath);
    }
}

function RenderPathElementComp({
    title,
    iconClassName,
    settingName,
    defaultFolderName,
}: Readonly<{
    title: string;
    iconClassName: string;
    settingName: string;
    defaultFolderName: string;
}>) {
    const dirSource = useGenDirSourceReload(settingName);
    const [isValidDirPath] = useAppStateAsync(() => {
        return fsCheckDirExist(dirSource?.dirPath ?? '');
    }, [dirSource]);
    if (!dirSource) {
        return null;
    }
    return (
        <div
            className={
                'app-setting-path-item app-border-white-round d-flex w-100' +
                ' flex-column p-2 mb-2'
            }
        >
            <div className="d-flex align-items-center mb-1">
                <i
                    className={`bi ${iconClassName} app-setting-path-item-icon me-2`}
                />
                <span className="app-setting-path-item-title flex-grow-1">
                    {title}
                </span>
                {isValidDirPath ? null : (
                    <span className="badge rounded-pill text-bg-danger">
                        {tran('Missing')}
                    </span>
                )}
            </div>
            <div className="d-flex flex-column">
                <div className="flex-grow-1">
                    <PathSelectorComp
                        prefix={`path-${settingName}`}
                        dirSource={dirSource}
                        isForceShowEditor={!isValidDirPath}
                    />
                </div>
                {isValidDirPath ? null : (
                    <div className="m-1">
                        <SelectDefaultDirButton
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function RenderParentDirectoryComp({
    dirSource,
}: Readonly<{ dirSource: DirSource }>) {
    const defaultPath = getDefaultDataDir();
    const defaultPathRef = useAppCurrentRef(defaultPath);
    const dirSourceRef = useAppCurrentRef(dirSource);
    const handleSetDefault = useCallback(async () => {
        await fsCreateDir(defaultPathRef.current);
        dirSourceRef.current.dirPath = defaultPathRef.current;
        await selectPathForChildDir(defaultPathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex flex-column">
            <div
                className={`${HIGHLIGHT_SELECTED_CLASSNAME} app-border-white-round p-2`}
            >
                <div className="app-setting-path-item-title d-flex align-items-center mb-1">
                    <i className="bi bi-folder-symlink me-2" />
                    {tran('Parent Directory:')}
                </div>
                <div>
                    <PathSelectorComp
                        prefix="path-parent-dir"
                        dirSource={dirSource}
                        placeholder={defaultPath}
                    />
                </div>
            </div>
            {dirSource.dirPath ? null : (
                <div>
                    <hr />
                    <div className="d-flex align-items-center">
                        <div className="hand-pointing-right">👉</div>
                        <button
                            className="btn btn-sm btn-success ms-2 d-flex align-items-center"
                            onClick={handleSetDefault}
                        >
                            <div className="d-flex align-items-center me-2">
                                <strong
                                    style={{
                                        textShadow: '0 0 2px var(--bs-danger)',
                                    }}
                                >
                                    {tran(
                                        'Click here to set default data on "Desktop"',
                                    )}{' '}
                                </strong>
                            </div>
                        </button>
                    </div>
                    <strong
                        className="app-selectable-text"
                        style={{
                            marginLeft: '30px',
                        }}
                    >
                        "{defaultPath}"
                    </strong>
                </div>
            )}
        </div>
    );
}

const titleSettingNames = {
    Documents: [
        dirSourceSettingNames.APP_DOCUMENT,
        defaultDataDirNames.APP_DOCUMENT,
        'bi-file-earmark-text',
    ],
    Lyrics: [
        dirSourceSettingNames.LYRIC,
        defaultDataDirNames.LYRIC,
        'bi-music-note-list',
    ],
    Playlists: [
        dirSourceSettingNames.PLAYLIST,
        defaultDataDirNames.PLAYLIST,
        'bi-collection-play',
    ],
    'Background Images': [
        dirSourceSettingNames.BACKGROUND_IMAGE,
        defaultDataDirNames.BACKGROUND_IMAGE,
        'bi-image',
    ],
    'Background Videos': [
        dirSourceSettingNames.BACKGROUND_VIDEO,
        defaultDataDirNames.BACKGROUND_VIDEO,
        'bi-film',
    ],
    'Background Audios': [
        dirSourceSettingNames.BACKGROUND_AUDIO,
        defaultDataDirNames.BACKGROUND_AUDIO,
        'bi-volume-up',
    ],
    'Bible Present': [
        dirSourceSettingNames.BIBLE_PRESENT,
        defaultDataDirNames.BIBLE_PRESENT,
        'bi-book',
    ],
    'Bible Reader': [
        dirSourceSettingNames.BIBLE_READ,
        defaultDataDirNames.BIBLE_READ,
        'bi-book-half',
    ],
    Notes: [
        dirSourceSettingNames.BIBLE_NOTES,
        defaultDataDirNames.BIBLE_NOTES,
        'bi-journal-text',
    ],
};

function RenderChildDirectoriesComp({
    parentDirPath,
}: Readonly<{ parentDirPath: string }>) {
    const parentDirPathRef = useAppCurrentRef(parentDirPath);
    const handleResetChildDirs = useCallback(() => {
        selectPathForChildDir(parentDirPathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <>
            <SettingCardHeaderComp
                iconClassName="bi-diagram-3"
                title="Child Directories"
            >
                <button
                    className="btn btn-sm btn-warning d-flex align-items-center"
                    title={tran('Reset All Child Directories')}
                    onClick={handleResetChildDirs}
                >
                    <i className="bi bi-arrow-counterclockwise me-1" />
                    {tran('Reset All Child Directories')}
                </button>
            </SettingCardHeaderComp>
            <div className="card-body">
                {Object.entries(titleSettingNames).map(
                    ([
                        title,
                        [settingName, defaultFolderName, iconClassName],
                    ]) => {
                        return (
                            <RenderPathElementComp
                                key={title}
                                title={tran(title)}
                                iconClassName={iconClassName}
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
        <div className="card h-100">
            <SettingCardHeaderComp
                iconClassName="bi-folder2-open"
                title="Path Settings"
            />
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
    useAppEffect(() => {
        if (!dirSource) {
            return;
        }
        dirSource.setParentDirPath = async (dirPath: string) => {
            await appLocalStorage.setSelectedParentDirectory(dirPath);
            if (dirPath === '' || !(await fsCheckDirExist(dirPath))) {
                await removePathForChildDir();
            } else {
                await selectPathForChildDir(dirPath);
            }
            const newDirSource = new ParentDirSource(dirPath);
            setDirSource(newDirSource);
        };
        return () => {
            dirSource.setParentDirPath = () => {};
        };
    }, [dirSource]);
    if (!dirSource) {
        return null;
    }
    return <RenderBodyComp dirSource={dirSource} />;
}
