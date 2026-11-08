import './PresentingFlowListComp.scss';

import { type ReactNode, useCallback } from 'react';

import PresentingFlowFileComp from './PresentingFlowFileComp';
import FileListHandlerComp from '../others/FileListHandlerComp';
import PresentingFlow from './PresentingFlow';
import {
    useFileSourceEvents,
    useGenDirSourceReload,
} from '../helper/dirSourceHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { toIconedLabel } from '../others/labelIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import { getFileFullName } from '../server/fileHelpers';
import {
    askAndImportPresentingFlowArchiveFromUrl,
    checkIsPresentingFlowArchiveFileFullName,
    importDroppedPresentingFlowArchive,
    selectAndImportPresentingFlowArchive,
} from './presentingFlowArchiveHelpers';
import { getOpenSharedLinkMenuItem } from '../background/downloadHelper';
import { removePresentingFlowSettings } from './presentingFlowHelpers';
import { checkIsAnyPresentingFlowOnScreen } from './presentingFlowOnScreenHelpers';
import { useFileListSessions } from '../media-sessions/useFileListSessions';
import PresentingFlowPreviewFloatingComp from './PresentingFlowPreviewFloatingComp';

// Built per call rather than at module scope: `tran` reads the loaded language,
// which is not ready when this module is first imported.
function genContextMenuItems(): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('box-arrow-in-down'),
            menuElement: tran('Import'),
            onSelect: () => {
                selectAndImportPresentingFlowArchive();
            },
        },
        {
            childBefore: genContextMenuItemIcon('cloud-download'),
            menuElement: tran('Import From URL'),
            onSelect: () => {
                askAndImportPresentingFlowArchiveFromUrl();
            },
        },
        getOpenSharedLinkMenuItem('presenting-flows'),
    ];
}

/**
 * An exported bundle dropped onto the list is imported rather than dropped into
 * the presenting flows folder as-is: the archive itself is not a presenting flow the app can
 * open, so copying it there would only leave an unreadable file behind. Any
 * other file falls through to the default handling.
 */
function handleDroppedFileTaking(file: DroppedFileType) {
    const fileFullName = getFileFullName(file);
    if (
        fileFullName === undefined ||
        !checkIsPresentingFlowArchiveFileFullName(fileFullName)
    ) {
        return false;
    }
    importDroppedPresentingFlowArchive(file);
    return true;
}

/**
 * The Presenting Flows list: the folder-session strip under its title, and
 * the list of the session in front, keyed by session so a switch drops the
 * list it leaves.
 */
export default function PresentingFlowListComp() {
    const session = useFileListSessions(dirSourceSettingNames.PRESENTING_FLOW);
    return (
        <>
            <PresentingFlowListBodyComp
                key={session.activeId}
                dirSourceSettingName={session.dirSourceSettingName}
                sessionsElement={session.element}
                isDirSettingRouteHidden={!session.isDefaultSession}
            />
            {/* Outside the keyed body: a flow's preview being played must
                not stop because the operator looked at another session. */}
            <PresentingFlowPreviewFloatingComp />
        </>
    );
}

function PresentingFlowListBodyComp({
    dirSourceSettingName,
    sessionsElement,
    isDirSettingRouteHidden,
}: Readonly<{
    dirSourceSettingName: string;
    sessionsElement: ReactNode;
    isDirSettingRouteHidden: boolean;
}>) {
    const dirSource = useGenDirSourceReload(dirSourceSettingName);
    // Subscribed once for the whole panel rather than per row: the row that owns
    // the deleted file is unmounting at exactly the moment the event fires, so a
    // per-row listener is the one listener that cannot be relied on to run.
    const handleFileDeleting = useCallback((filePath: string) => {
        if (typeof filePath !== 'string' || !filePath.endsWith('.owpf')) {
            return;
        }
        removePresentingFlowSettings(filePath);
    }, []);
    useFileSourceEvents(['delete'], handleFileDeleting, [handleFileDeleting]);
    const handleBodyRendering = useCallback((filePaths: string[]) => {
        return (
            <>
                {filePaths.map((filePath, i) => {
                    return (
                        <PresentingFlowFileComp
                            key={filePath}
                            index={i}
                            filePath={filePath}
                        />
                    );
                })}
            </>
        );
    }, []);
    if (dirSource === null) {
        return null;
    }
    return (
        <FileListHandlerComp
            className="presenting-flow-list"
            mimetypeName="presentingFlow"
            defaultFolderName={defaultDataDirNames.PRESENTING_FLOW}
            dirSource={dirSource}
            takeDroppedFile={handleDroppedFileTaking}
            onNewFile={async (dirPath: string, name: string) => {
                return !(await PresentingFlow.create(dirPath, name));
            }}
            header={<span>{toIconedLabel('Presenting Flows')}</span>}
            sessionsElement={sessionsElement}
            isDirSettingRouteHidden={isDirSettingRouteHidden}
            bodyHandler={handleBodyRendering}
            genContextMenuItems={genContextMenuItems}
            checkIsOnScreen={checkIsAnyPresentingFlowOnScreen}
        />
    );
}
