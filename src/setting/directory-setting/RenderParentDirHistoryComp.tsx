import { type ReactNode, useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import type DirSource from '../../helper/DirSource';
import { useAppCurrentRef, useAppStateAsync } from '../../helper/appHooks';
import {
    checkIsDesktopDataDir,
    findDataDirsOnVolumesSync,
    fsCheckDirExist,
    getDefaultDataDirPath,
    pathResolve,
    toPathCompareKey,
} from '../../server/fileHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { escapeHtmlText } from '../../helper/sanitizeHelpers';
import {
    getParentDirHistory,
    removeParentDirHistory,
} from './parentDirHistoryHelpers';

type RecentDirType = { dirPath: string; isExisting: boolean };

async function loadRecentDirs(currentDirPath: string) {
    const currentKey = currentDirPath
        ? toPathCompareKey(pathResolve(currentDirPath))
        : null;
    const dirPathList = getParentDirHistory().filter((dirPath) => {
        return toPathCompareKey(dirPath) !== currentKey;
    });
    return await Promise.all(
        dirPathList.map(async (dirPath): Promise<RecentDirType> => {
            return { dirPath, isExisting: await fsCheckDirExist(dirPath) };
        }),
    );
}

function toDirKey(dirPath: string) {
    return toPathCompareKey(pathResolve(dirPath));
}

/**
 * The data folders worth recommending that no other list here shows: one at
 * the top of any drive, a stick's included, and the default
 * `~/.owa/open-worship-data` while it is not the suggestion already. Never one
 * on the Desktop -- that is where the app asks a data folder to move AWAY from
 * (W-54), and offering it back undid the ask. Offered here only, never by a
 * start-up dialog. A scan of every drive's top folders, so it runs while Path
 * Settings is open and never on a start.
 */
function loadFoundDirs(
    shownDirPaths: string[],
    isDefaultSuggested: boolean,
): RecentDirType[] {
    const shownKeySet = new Set(shownDirPaths.map(toDirKey));
    const foundDirs: RecentDirType[] = [];
    for (const dirPath of findDataDirsOnVolumesSync(
        isDefaultSuggested ? [] : [getDefaultDataDirPath()],
    )) {
        const key = toDirKey(dirPath);
        if (!shownKeySet.has(key) && !checkIsDesktopDataDir(dirPath)) {
            shownKeySet.add(key);
            foundDirs.push({ dirPath, isExisting: true });
        }
    }
    return foundDirs;
}

function RenderRecentDirComp({
    dirSource,
    recentDir,
    onChanged,
    isFound = false,
}: Readonly<{
    dirSource: DirSource;
    recentDir: RecentDirType;
    onChanged: () => void;
    /** Found on a drive: stands out, and is on no list to be taken off. */
    isFound?: boolean;
}>) {
    const { dirPath, isExisting } = recentDir;
    const dirSourceRef = useAppCurrentRef(dirSource);
    const dirPathRef = useAppCurrentRef(dirPath);
    const onChangedRef = useAppCurrentRef(onChanged);
    const handleSwitching = useCallback(async () => {
        const targetDirPath = dirPathRef.current;
        // Asked again at the press: switching to a folder that is not there
        // blanks every child folder setting (`setParentDirPath`).
        if (!(await fsCheckDirExist(targetDirPath))) {
            showSimpleToast(
                tran('Recent Folders'),
                tran('This folder is not there any more.'),
            );
            onChangedRef.current();
            return;
        }
        // Every open window reloads on the new folder, a projector included,
        // so one stray press must not be enough.
        const isOk = await showAppConfirm(
            tran('Switch Data Folder'),
            `${tran('Switch to the data folder')} ` +
                `"${escapeHtmlText(targetDirPath)}"? ` +
                tran('Every open window reloads.'),
            { confirmButtonLabel: 'Switch' },
        );
        if (!isOk) {
            return;
        }
        dirSourceRef.current.dirPath = targetDirPath;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemoving = useCallback(() => {
        removeParentDirHistory(dirPathRef.current);
        onChangedRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex align-items-center mb-1">
            {/* Cut on the LEFT, so the folder's own name -- the part that
            tells two entries apart -- stays in view. The `bdi` keeps the path
            in its own order under that `direction: rtl` (`PathPreviewerComp`).
            */}
            <span
                className={
                    'flex-grow-1 app-ellipsis-left app-selectable-text' +
                    (isFound ? '' : ' text-body-secondary')
                }
                style={{
                    minWidth: 0,
                    fontSize: isFound ? '0.95rem' : '0.9rem',
                }}
                title={dirPath}
            >
                <bdi>{dirPath}</bdi>
            </span>
            {isExisting ? null : (
                <span className="badge rounded-pill text-bg-danger ms-1">
                    {tran('Missing')}
                </span>
            )}
            <button
                className={
                    `btn btn-sm ${isFound ? 'btn-info' : 'btn-outline-info'}` +
                    ' d-flex align-items-center ms-1'
                }
                type="button"
                disabled={!isExisting}
                title={tran('Switch to the data folder')}
                onClick={handleSwitching}
            >
                <i className="bi bi-arrow-left-right me-1" />
                {tran('Switch')}
            </button>
            {isFound ? null : (
                <button
                    className="btn btn-sm btn-outline-secondary ms-1"
                    type="button"
                    title={tran('Remove from Recent Folders')}
                    aria-label={tran('Remove from Recent Folders')}
                    onClick={handleRemoving}
                >
                    <i className="bi bi-x-lg" />
                </button>
            )}
        </div>
    );
}

// What can be CHOSEN -- a folder found on a drive, the default one -- stands
// out in a tinted box; the history beside them stays quiet.
const SECTION_TONE_CLASS_MAP = {
    muted: { box: 'mt-2', title: 'opacity-75' },
    info: {
        box: 'mt-2 p-2 rounded border border-info-subtle bg-info-subtle',
        title: 'text-info-emphasis fw-semibold',
    },
    success: {
        box: 'mt-2 p-2 rounded border border-success-subtle bg-success-subtle',
        title: 'text-success-emphasis fw-semibold',
    },
};

function RenderDirSectionComp({
    iconClassName,
    title,
    tone,
    children,
}: Readonly<{
    iconClassName: string;
    title: string;
    tone: keyof typeof SECTION_TONE_CLASS_MAP;
    children: ReactNode;
}>) {
    const toneClass = SECTION_TONE_CLASS_MAP[tone];
    return (
        <div className={toneClass.box}>
            <div
                className={`d-flex align-items-center mb-1 ${toneClass.title}`}
            >
                <i className={`bi ${iconClassName} me-2`} />
                {title}
            </div>
            {children}
        </div>
    );
}

/**
 * The default data folder, offered as a row like the others -- never chosen
 * until it is pressed, and made then if it is not there.
 */
function RenderSuggestedDirComp({
    dirPath,
    onUsing,
}: Readonly<{ dirPath: string; onUsing: () => void }>) {
    return (
        <div className="d-flex align-items-center mb-1">
            <span
                className="flex-grow-1 app-ellipsis-left app-selectable-text"
                style={{ minWidth: 0, fontSize: '0.95rem' }}
                title={dirPath}
            >
                <bdi>{dirPath}</bdi>
            </span>
            <button
                className="btn btn-sm btn-success d-flex align-items-center ms-1"
                type="button"
                title={tran('will create if not exist')}
                onClick={onUsing}
            >
                <i className="bi bi-folder-plus me-1" />
                {tran('Use This Folder')}
            </button>
        </div>
    );
}

/**
 * Where a data folder can be taken from without the folder picker: the ones
 * used before on this computer, the ones found on its drives, and -- while
 * none is chosen -- the default one as a suggestion. Read only while Path
 * Settings is open: one home-storage read, a stat per recent folder (at most
 * ten) and one scan of the drives' top folders.
 */
export default function RenderParentDirHistoryComp({
    dirSource,
    suggestedDirPath = null,
    onSuggestedUsing = () => {},
}: Readonly<{
    dirSource: DirSource;
    /**
     * The default data folder while none is chosen: the one recommended, made
     * when it is pressed if it is not there.
     */
    suggestedDirPath?: string | null;
    onSuggestedUsing?: () => void;
}>) {
    const [reloadCount, setReloadCount] = useState(0);
    const [dirLists] = useAppStateAsync(async () => {
        // Shown once, where it stands out: the suggestion is off the history.
        const suggestedKey = suggestedDirPath
            ? toDirKey(suggestedDirPath)
            : null;
        const recentDirs = (await loadRecentDirs(dirSource.dirPath)).filter(
            ({ dirPath }) => {
                return toDirKey(dirPath) !== suggestedKey;
            },
        );
        const foundDirs = loadFoundDirs(
            [
                dirSource.dirPath,
                ...(suggestedDirPath ? [suggestedDirPath] : []),
                ...recentDirs.map(({ dirPath }) => {
                    return dirPath;
                }),
            ].filter(Boolean),
            suggestedDirPath !== null,
        );
        return { recentDirs, foundDirs };
    }, [dirSource, suggestedDirPath, reloadCount]);
    const handleChanged = useCallback(() => {
        setReloadCount((count) => {
            return count + 1;
        });
    }, []);
    if (!dirLists) {
        return null;
    }
    const { recentDirs, foundDirs } = dirLists;
    return (
        <>
            {foundDirs.length === 0 ? null : (
                <RenderDirSectionComp
                    iconClassName="bi-search"
                    title={tran('Found Data Folders')}
                    tone="info"
                >
                    {foundDirs.map((foundDir) => {
                        return (
                            <RenderRecentDirComp
                                key={foundDir.dirPath}
                                dirSource={dirSource}
                                recentDir={foundDir}
                                onChanged={handleChanged}
                                isFound
                            />
                        );
                    })}
                </RenderDirSectionComp>
            )}
            {suggestedDirPath === null ? null : (
                <RenderDirSectionComp
                    iconClassName="bi-lightbulb"
                    title={tran('Suggested')}
                    tone="success"
                >
                    <RenderSuggestedDirComp
                        dirPath={suggestedDirPath}
                        onUsing={onSuggestedUsing}
                    />
                </RenderDirSectionComp>
            )}
            {recentDirs.length === 0 ? null : (
                <RenderDirSectionComp
                    iconClassName="bi-clock-history"
                    title={tran('Recent Folders')}
                    tone="muted"
                >
                    {recentDirs.map((recentDir) => {
                        return (
                            <RenderRecentDirComp
                                key={recentDir.dirPath}
                                dirSource={dirSource}
                                recentDir={recentDir}
                                onChanged={handleChanged}
                            />
                        );
                    })}
                </RenderDirSectionComp>
            )}
        </>
    );
}
