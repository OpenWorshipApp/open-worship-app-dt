import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import {
    checkIsExtraBinInstalled,
    getExtraBinDirPath,
    getInstalledExtraBinVersion,
    registerExtraBinChangedListener,
} from '../helper/extra-bin/extraBinHelpers';
import type { ExtraBinEntryType } from '../helper/extra-bin/extraBinInstallHelpers';
import {
    findLocalExtraBinArchive,
    getExtraBinEntry,
    installExtraBin,
} from '../helper/extra-bin/extraBinInstallHelpers';
import { tran } from '../lang/langHelpers';
import { showFileOrDirExplorer } from '../server/appHelpers';
import { checkIsVersionOutdated } from '../server/updatingAppHelpers';
import SettingOthersSectionComp from './SettingOthersSectionComp';

type LocalStateType = {
    dirPath: string;
    isInstalled: boolean;
    missingNames: string[];
    installedVersion: string | null;
    archiveFileFullName: string | null;
};

/**
 * Everything the panel can answer WITHOUT a network call: three file stats, one
 * tiny json read and one directory listing. Cheap enough to re-run after every
 * action, which is why the panel needs no polling.
 */
async function readExtraBinLocalState(): Promise<LocalStateType> {
    const dirPath = getExtraBinDirPath();
    const [{ isInstalled, missingNames }, installedVersion, archive] =
        await Promise.all([
            checkIsExtraBinInstalled(),
            getInstalledExtraBinVersion(),
            findLocalExtraBinArchive(dirPath),
        ]);
    return {
        dirPath,
        isInstalled,
        missingNames,
        installedVersion,
        archiveFileFullName: archive,
    };
}

function RenderDetailComp({
    label,
    isWide = false,
    children,
}: Readonly<{ label: string; isWide?: boolean; children: ReactNode }>) {
    return (
        <div
            className={
                'app-setting-others-detail' +
                (isWide ? ' app-setting-others-detail-wide' : '')
            }
        >
            <span className="app-setting-others-label">{tran(label)}</span>
            <span className="app-ellipsis app-data">{children}</span>
        </div>
    );
}

export default function SettingOthersExtraBinComp() {
    // Bumped by every action so both reads re-run. There is no polling and no
    // interval: this panel only looks when something actually happened.
    const [refreshCount, setRefreshCount] = useState(0);
    // Bumped by the media download's own "not installed" prompt, which happens
    // in ANOTHER renderer. Settings is its own window, so it can already be
    // sitting on this tab showing the pre-existing "installed" answer when that
    // prompt sends the user here -- which contradicts the prompt AND hides the
    // `Download and Install` button that resolves it. Deliberately NOT wired to
    // `refreshCount`: that one also re-runs the online lookup, and this needs
    // only the three local file stats.
    const [localRefreshCount, setLocalRefreshCount] = useState(0);
    const [isBusy, setIsBusy] = useState(false);
    const [localState] = useAppStateAsync<LocalStateType>(
        readExtraBinLocalState,
        [refreshCount, localRefreshCount],
    );
    // `undefined` while the two small info.json reads are in flight, `null` when
    // they failed or this platform publishes no pack. Being offline is not an
    // error state here — the local half above is still the useful answer.
    const [onlineEntry] = useAppStateAsync<ExtraBinEntryType | null>(
        getExtraBinEntry,
        [refreshCount],
    );
    const localStateRef = useAppCurrentRef(localState);
    const onlineEntryRef = useAppCurrentRef(onlineEntry);
    useAppEffect(() => {
        return registerExtraBinChangedListener(() => {
            setLocalRefreshCount((oldCount) => {
                return oldCount + 1;
            });
        });
    }, []);

    type InstallArgsType = [
        isForceDownload: boolean,
        supersededArchiveFileFullName?: string | null,
    ];
    const handleInstalling = useCallback(async (...args: InstallArgsType) => {
        const [isForceDownload, supersededArchiveFileFullName = null] = args;
        setIsBusy(true);
        try {
            await installExtraBin({
                entry: onlineEntryRef.current ?? null,
                isForceDownload,
                supersededArchiveFileFullName,
            });
        } finally {
            setIsBusy(false);
            setRefreshCount((oldCount) => {
                return oldCount + 1;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleInstallingRef = useAppCurrentRef(handleInstalling);
    const handleFreshInstalling = useCallback(() => {
        handleInstallingRef.current(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleReinstalling = useCallback(() => {
        // Force a fresh download even when an archive is on disk: the repair
        // path for an archive that is itself corrupt.
        handleInstallingRef.current(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleUpdating = useCallback(() => {
        // Hand over the archive being replaced, or the folder would keep one
        // pack per release forever.
        handleInstallingRef.current(
            true,
            localStateRef.current?.archiveFileFullName ?? null,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleReextracting = useCallback(() => {
        // No network at all: the archive is kept on disk exactly so corrupted
        // binaries can be repaired without one.
        handleInstallingRef.current(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRefreshing = useCallback(() => {
        setRefreshCount((oldCount) => {
            return oldCount + 1;
        });
    }, []);
    const handleRevealing = useCallback(() => {
        const dirPath = localStateRef.current?.dirPath;
        if (dirPath) {
            showFileOrDirExplorer(dirPath);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!localState) {
        return null;
    }
    const {
        dirPath,
        isInstalled,
        missingNames,
        installedVersion,
        archiveFileFullName,
    } = localState;
    const isOutdated =
        installedVersion !== null &&
        !!onlineEntry &&
        checkIsVersionOutdated(installedVersion, onlineEntry.version);
    const primaryAction = isOutdated ? (
        <button
            className="btn btn-sm btn-warning"
            disabled={isBusy}
            onClick={handleUpdating}
        >
            {`${tran('Update to')} ${onlineEntry.version}`}
        </button>
    ) : !isInstalled ? (
        <button
            className="btn btn-sm btn-primary"
            disabled={isBusy}
            onClick={handleFreshInstalling}
        >
            {tran('Download and Install')}
        </button>
    ) : null;
    return (
        <SettingOthersSectionComp
            iconClassName="bi-hdd-stack"
            title="Extra Binaries"
            description={
                'The media tools used to download background video and ' +
                'audio. They are downloaded separately to keep the app small.'
            }
            state={isInstalled && !isOutdated ? 'ready' : 'attention'}
            stateLabel={
                !isInstalled
                    ? 'Not installed'
                    : isOutdated
                      ? 'Update Available'
                      : 'Installed'
            }
            headerActions={
                <>
                    {primaryAction}
                    {/* Re-reading state belongs with the state readout, not
                        among the repair actions below. */}
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={isBusy}
                        title={tran('Refresh')}
                        onClick={handleRefreshing}
                    >
                        <i className="bi bi-arrow-clockwise" />
                    </button>
                </>
            }
        >
            <div className="app-setting-others-details">
                <RenderDetailComp label="Location" isWide>
                    {/* A button, not a styled span: the path is the primary
                        way to get at the folder, so it has to be reachable by
                        keyboard too. */}
                    <button
                        className="btn btn-link p-0 border-0 align-baseline"
                        title={`${dirPath}
${tran('Reveal Folder')}`}
                        onClick={handleRevealing}
                    >
                        <code>{dirPath}</code>
                        <i className="bi bi-folder2-open ms-1" />
                    </button>
                </RenderDetailComp>
                {isInstalled ? (
                    <RenderDetailComp label="Installed version">
                        {installedVersion ?? '?'}
                    </RenderDetailComp>
                ) : (
                    /* A missing pack has no version to report; what the
                       operator needs is which tools are gone. */
                    <RenderDetailComp label="Missing">
                        <span className="text-warning">
                            {missingNames.length > 0
                                ? missingNames.join(', ')
                                : tran('Not installed')}
                        </span>
                    </RenderDetailComp>
                )}
                <RenderDetailComp label="Latest version">
                    {onlineEntry === undefined ? (
                        <span className="text-body-secondary">
                            {tran('Checking...')}
                        </span>
                    ) : onlineEntry === null ? (
                        <span className="text-body-secondary">
                            {tran('Could not check for updates')}
                        </span>
                    ) : (
                        onlineEntry.version
                    )}
                </RenderDetailComp>
                {archiveFileFullName !== null ? (
                    <RenderDetailComp label="Archive">
                        <span
                            title={tran(
                                'Kept on purpose, so the binaries can be ' +
                                    'extracted again without downloading.',
                            )}
                        >
                            {archiveFileFullName}
                            <i className="bi bi-info-circle ms-1" />
                        </span>
                    </RenderDetailComp>
                ) : null}
            </div>
            {/* The repair actions, secondary to whichever primary button sits
                up in the header. No "Reveal Folder" among them: the Location
                path above IS that affordance, and two of them is clutter. */}
            <div className="app-setting-others-repair">
                {archiveFileFullName !== null ? (
                    <button
                        className="btn btn-sm btn-secondary"
                        disabled={isBusy}
                        onClick={handleReextracting}
                    >
                        {tran('Re-extract')}
                    </button>
                ) : null}
                <button
                    className="btn btn-sm btn-secondary"
                    disabled={isBusy}
                    onClick={handleReinstalling}
                >
                    {tran('Reinstall')}
                </button>
            </div>
        </SettingOthersSectionComp>
    );
}
