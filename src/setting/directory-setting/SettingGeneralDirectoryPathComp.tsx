import { useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import PathSelectorComp from '../../others/PathSelectorComp';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
    useAppCurrentRef,
} from '../../helper/appHooks';
import DirSource from '../../helper/DirSource';
import { selectableDataDirectories } from './dataDirectories';
import {
    checkIsUsedDataDir,
    getDefaultDataDir,
    removePathForChildDir,
    repairDataDirLinks,
    selectPathForChildDir,
    selectPathForChildDirIfNeeded,
} from './directoryHelpers';
import {
    checkIsNativeAbsolutePath,
    fsCheckDirExist,
    fsCreateDir,
    selectDirs,
} from '../../server/fileHelpers';
import { handleError } from '../../helper/errorHelpers';
import appProvider from '../../server/appProvider';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    showAppAlert,
    showAppConfirm,
} from '../../popup-widget/popupWidgetHelpers';
import { escapeHtmlText } from '../../helper/sanitizeHelpers';
import { forceReloadAppWindows } from '../settingHelpers';
import {
    appLocalStorage,
    SELECTED_PARENT_DIR_SETTING_NAME,
} from './appLocalStorage';
import { SelectDefaultDirButtonComp } from '../../others/NoDirSelectedComp';
import { useGenDirSourceReload } from '../../helper/dirSourceHelpers';
import { unwatchDataDir, watchDataDir } from '../../helper/dirWatchingHelpers';
import { type OptionalPromise } from '../../helper/typeHelpers';
import SettingCardHeaderComp from '../SettingCardHeaderComp';
import RenderParentDirHistoryComp from './RenderParentDirHistoryComp';

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
                        isFolderDroppable
                    />
                </div>
                {isValidDirPath ? null : (
                    <div className="m-1">
                        <SelectDefaultDirButtonComp
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * **Copy Data Folder**: a copy of the folder in use, wherever the person
 * points the folder picker -- a USB stick, another drive, any folder -- and
 * then the choice to use it. The move's own careful copy (`copyDataDirTo`);
 * the folder in use is not touched.
 */
function RenderCopyDataDirComp({
    dirSource,
}: Readonly<{ dirSource: DirSource }>) {
    const dirSourceRef = useAppCurrentRef(dirSource);
    const handleCopying = useCallback(async () => {
        const fromDirPath = dirSourceRef.current.dirPath;
        if (!fromDirPath) {
            return;
        }
        const [parentDirPath] = await selectDirs();
        if (!parentDirPath) {
            return;
        }
        const { copyDataDirTo } = await import('./dataDirMoveHelpers');
        const progressKey = 'copy-data-dir';
        showProgressBar(progressKey);
        const result = await copyDataDirTo(fromDirPath, parentDirPath, {
            update: () => {},
        }).finally(() => {
            hideProgressBar(progressKey);
        });
        if (!result.isCopied) {
            await showAppAlert(
                tran('Copy Data Folder'),
                `${tran('The data folder was not copied:')} ` +
                    escapeHtmlText(result.errorMessage ?? ''),
            );
            return;
        }
        const isSwitching = await showAppConfirm(
            tran('Copy Data Folder'),
            `${tran('The data folder was copied to')} ` +
                `"${escapeHtmlText(result.toDirPath)}". ` +
                tran('Switch to the copy now? Every open window reloads.'),
            { confirmButtonLabel: 'Switch', cancelButtonLabel: 'Not Now' },
        );
        if (isSwitching) {
            dirSourceRef.current.dirPath = result.toDirPath;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            // Its own width: stretched across the page it read as one more
            // bordered box round the folder.
            className={
                'btn btn-sm btn-outline-info d-flex align-items-center mt-2' +
                ' align-self-start'
            }
            type="button"
            title={tran('Copy this data folder to a drive or another folder')}
            onClick={handleCopying}
        >
            <i className="bi bi-copy me-1" />
            {tran('Copy Data Folder')}
        </button>
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
        // Choosing it asks about its standard folders (`setParentDirPath`).
        // Asked here as well, the two questions came up together.
        dirSourceRef.current.dirPath = defaultPathRef.current;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        // At the root of the page, with no box of its own (the user, twice:
        // "move it to root to save space", then "also remove the border" of
        // the highlight ring it kept).
        <div className="d-flex flex-column">
            <div className="app-setting-path-item-title d-flex align-items-center mb-1">
                <i className="bi bi-folder-symlink me-2" />
                {tran('Parent Directory:')}
            </div>
            <div>
                <PathSelectorComp
                    prefix="path-parent-dir"
                    dirSource={dirSource}
                    placeholder={defaultPath}
                    // No data folder: the app has nothing to show until one
                    // is chosen here, and every route to "choose one" lands
                    // on this page.
                    isAutoFocus={!dirSource.dirPath}
                    // Dragged in from the file manager (the user's picture: a
                    // folder held over this box showed "no entry").
                    isFolderDroppable
                    // The data folder is changed by choosing another, never
                    // unset: an emptied value is put back (see below).
                    isUnsettable={false}
                />
            </div>
            {dirSource.dirPath ? (
                <RenderCopyDataDirComp dirSource={dirSource} />
            ) : null}
            {/* A chosen folder that is not there is not warned about: it is
                on the list with "Missing", and the default folder is only a
                suggestion until it is pressed. */}
            <RenderParentDirHistoryComp
                dirSource={dirSource}
                suggestedDirPath={dirSource.dirPath ? null : defaultPath}
                onSuggestedUsing={handleSetDefault}
            />
        </div>
    );
}

function RenderChildDirectoriesComp({
    parentDirPath,
}: Readonly<{ parentDirPath: string }>) {
    const parentDirPathRef = useAppCurrentRef(parentDirPath);
    const handleResetChildDirs = useCallback(() => {
        selectPathForChildDir(parentDirPathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRepairLinks = useCallback(async () => {
        const progressKey = 'repair-data-dir-links';
        showProgressBar(progressKey);
        const result = await repairDataDirLinks().finally(() => {
            hideProgressBar(progressKey);
        });
        if (result === null) {
            return;
        }
        if (result.linkCount === 0) {
            showSimpleToast(
                tran('Repair Links'),
                tran(
                    'No links to an old location of this data folder were found.',
                ),
            );
            return;
        }
        await showAppAlert(
            tran('Repair Links'),
            `${tran('Links repaired:')} ${result.linkCount}. ` +
                `${tran('Files changed:')} ${result.fileCount}. ` +
                tran('The app reloads to show them.'),
        );
        // Every open window read these files before they were repaired.
        forceReloadAppWindows();
    }, []);
    return (
        <>
            <SettingCardHeaderComp
                iconClassName="bi-diagram-3"
                title="Child Directories"
            >
                <button
                    className="btn btn-sm btn-outline-info d-flex align-items-center me-1"
                    title={tran(
                        'Point links to pictures, videos and songs that still name an old location of this data folder at where it is now',
                    )}
                    onClick={handleRepairLinks}
                >
                    <i className="bi bi-link-45deg me-1" />
                    {tran('Repair Links')}
                </button>
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
                {selectableDataDirectories.map(
                    ({ title, settingName, defaultDirName, iconClassName }) => {
                        return (
                            <RenderPathElementComp
                                key={title}
                                title={tran(title)}
                                iconClassName={iconClassName}
                                settingName={settingName}
                                defaultFolderName={defaultDirName}
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
        if (dirSource.dirPath) {
            await selectPathForChildDirIfNeeded(dirSource.dirPath);
        }
    }, [dirSource]);
    return (
        <div className="d-flex flex-column w-100 h-100">
            {/* Outside the Path Settings card (the user's picture, the block
                circled: "move it outside the card"): the one choice the
                rest of the app waits on is the first thing on the page. */}
            <div className="p-1 mb-2">
                <RenderParentDirectoryComp dirSource={dirSource} />
            </div>
            {/* No card at all with no folder: everything in it belongs to a
                folder, and an empty one drew a bare box under the
                suggestions. */}
            {dirSource.dirPath ? (
                <div className="card flex-grow-1">
                    <SettingCardHeaderComp
                        iconClassName="bi-folder2-open"
                        title="Path Settings"
                    />
                    <div className="card-body w-100 p-2">
                        <div className="card app-border-white-round p-1">
                            <RenderChildDirectoriesComp
                                parentDirPath={dirSource.dirPath}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/**
 * Whether a path typed into the parent box names a folder that is there now
 * -- asked to be made when it is not. Every other way in (the picker, a drop,
 * Recent and Found Folders, Use This Folder) hands over a folder that exists;
 * only typing can name one that does not, and a slip (`Documnets`, a stick's
 * drive letter while it is out) silently made an empty data folder. A path
 * that is not a whole one (`C:`, `data`) resolves against wherever the app
 * happens to run from, so it is refused.
 */
async function checkIsTypedDataDirReady(dirPath: string) {
    if (!checkIsNativeAbsolutePath(dirPath)) {
        showSimpleToast(
            tran('Choose a folder'),
            `${tran('Type the full path of the folder, for example')} ` +
                getDefaultDataDir(),
        );
        return false;
    }
    if (await fsCheckDirExist(dirPath)) {
        return true;
    }
    const isCreating = await showAppConfirm(
        tran('Create Data Folder'),
        `${tran('There is no folder at')} "${escapeHtmlText(dirPath)}". ` +
            tran('Create it and use it as the data folder?'),
        { confirmButtonLabel: 'Create' },
    );
    if (!isCreating) {
        return false;
    }
    try {
        await fsCreateDir(dirPath);
    } catch (error) {
        handleError(error);
    }
    if (await fsCheckDirExist(dirPath)) {
        return true;
    }
    showSimpleToast(
        tran('Create Data Folder'),
        `${tran('Fail to create folder')} "${dirPath}"`,
    );
    return false;
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
        const takeParentDirPath = async (dirPath: string) => {
            // An emptied box, a path that is not a whole one, or a folder not
            // made: the box goes back to the folder in force. Taken as they
            // came, the first stopped using the data folder -- every window
            // showed "No Parent Directory Selected" after one Backspace and a
            // click away -- and a typing slip made an empty data folder.
            if (dirPath === '' || !(await checkIsTypedDataDirReady(dirPath))) {
                dirSource.setDirPath(dirSource.dirPath);
                return;
            }
            // The recursive watch is keyed to the directory it was started on,
            // so the OLD tree has to be released before the selection moves —
            // nothing else can name it afterwards, and an orphaned watch keeps
            // firing file events for a folder the app no longer uses.
            unwatchDataDir();
            // Asked BEFORE the choice is saved: from then on any setting read
            // creates `local-storage` in the new folder, and a brand-new one
            // would pass for a used one.
            const isUsedDataDir = await checkIsUsedDataDir(dirPath);
            await appLocalStorage.setSelectedParentDirectory(dirPath);
            if (!(await fsCheckDirExist(dirPath))) {
                // Gone in the moment since it was checked.
                await removePathForChildDir();
            } else if (isUsedDataDir) {
                // A data folder brought from another computer (a stick)
                // already says where its documents, videos and the rest are.
                // Asking to reset them was a question with a wrong answer:
                // "Yes" pointed every one of them at a default folder.
                appProvider.reload();
                return;
            } else {
                await selectPathForChildDir(dirPath);
            }
            await watchDataDir();
            const newDirSource = new ParentDirSource(dirPath);
            setDirSource(newDirSource);
        };
        // The folder being taken up right now. Enter commits the box, and the
        // question that follows takes the focus, so the box's blur committed
        // the same path again: every question came twice, one behind the
        // other.
        let takingDirPath: string | null = null;
        dirSource.setParentDirPath = async (dirPath: string) => {
            if (takingDirPath === dirPath) {
                return;
            }
            takingDirPath = dirPath;
            try {
                await takeParentDirPath(dirPath);
            } finally {
                takingDirPath = null;
            }
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
