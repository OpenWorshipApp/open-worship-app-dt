import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { useAppCurrentRef, useAppStateAsync } from '../helper/appHooks';
import {
    checkIsExtraBinInstalled,
    getExtraBinDirPath,
    getInstalledExtraBinVersion,
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
import SettingCardHeaderComp from './SettingCardHeaderComp';

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

function RenderRowComp({
    label,
    children,
}: Readonly<{ label: string; children: ReactNode }>) {
    return (
        <div className="d-flex align-items-center gap-2">
            <span className="text-nowrap text-body-secondary">
                {tran(label)}:
            </span>
            <span className="app-ellipsis flex-fill app-data">{children}</span>
        </div>
    );
}

export default function SettingOthersExtraBinComp() {
    // Bumped by every action so both reads re-run. There is no polling and no
    // interval: this panel only looks when something actually happened.
    const [refreshCount, setRefreshCount] = useState(0);
    const [isBusy, setIsBusy] = useState(false);
    const [localState] = useAppStateAsync<LocalStateType>(
        readExtraBinLocalState,
        [refreshCount],
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
    return (
        <div className="card m-1">
            <SettingCardHeaderComp
                iconClassName="bi-hdd-stack"
                title="Extra Binaries"
            />
            <div className="card-body">
                <div
                    className="text-body-secondary mb-2"
                    style={{ fontSize: 'var(--app-text-sm)' }}
                >
                    {tran(
                        'The media tools used to download background video ' +
                            'and audio. They are downloaded separately to ' +
                            'keep the app small.',
                    )}
                </div>
                <RenderRowComp label="Location">
                    {/* A button, not a styled span: the path is the primary
                        way to get at the folder, so it has to be reachable by
                        keyboard too. */}
                    <button
                        className="btn btn-link p-0 border-0 align-baseline"
                        title={`${dirPath}\n${tran('Reveal Folder')}`}
                        onClick={handleRevealing}
                    >
                        <code>{dirPath}</code>
                        <i className="bi bi-folder2-open ms-1" />
                    </button>
                </RenderRowComp>
                <RenderRowComp label="Installed version">
                    {isInstalled ? (
                        <>
                            <i className="bi bi-check-circle-fill text-success me-1" />
                            {installedVersion ?? '?'}
                        </>
                    ) : (
                        <span className="text-warning">
                            {tran('Not installed')}
                            {missingNames.length > 0
                                ? ` (${missingNames.join(', ')})`
                                : ''}
                        </span>
                    )}
                </RenderRowComp>
                <RenderRowComp label="Latest version">
                    {onlineEntry === undefined ? (
                        <span className="text-body-secondary">
                            {tran('Checking...')}
                        </span>
                    ) : onlineEntry === null ? (
                        <span className="text-body-secondary">
                            {tran('Could not check for updates')}
                        </span>
                    ) : (
                        <>
                            {onlineEntry.version}
                            {isOutdated ? (
                                <i className="bi bi-arrow-up-circle-fill text-warning ms-1" />
                            ) : null}
                        </>
                    )}
                </RenderRowComp>
                {archiveFileFullName !== null ? (
                    <RenderRowComp label="Archive">
                        <span
                            title={tran(
                                'Kept on purpose, so the binaries can be ' +
                                    'extracted again without downloading.',
                            )}
                        >
                            {archiveFileFullName}
                            <i className="bi bi-info-circle ms-1" />
                        </span>
                    </RenderRowComp>
                ) : null}
                <div className="d-grid gap-2 mt-2">
                    {isOutdated ? (
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
                    ) : null}
                    {/* The three maintenance actions share one row — they are
                        secondary to whichever primary button is above them.
                        No "Reveal Folder" among them: the Location path above
                        IS that affordance, and two of them is clutter. */}
                    <div className="d-flex gap-2">
                        {archiveFileFullName !== null ? (
                            <button
                                className="btn btn-sm btn-secondary flex-fill"
                                disabled={isBusy}
                                onClick={handleReextracting}
                            >
                                {tran('Re-extract')}
                            </button>
                        ) : null}
                        <button
                            className="btn btn-sm btn-secondary flex-fill"
                            disabled={isBusy}
                            onClick={handleReinstalling}
                        >
                            {tran('Reinstall')}
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary flex-fill"
                            disabled={isBusy}
                            onClick={handleRefreshing}
                        >
                            <i className="bi bi-arrow-clockwise me-1" />
                            {tran('Refresh')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
