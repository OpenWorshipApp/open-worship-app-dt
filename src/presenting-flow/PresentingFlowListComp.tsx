import './PresentingFlowListComp.scss';

import { useCallback } from 'react';

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
import { removePresentingFlowSettings } from './presentingFlowHelpers';
import { checkIsAnyPresentingFlowOnScreen } from './presentingFlowOnScreenHelpers';
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

export default function PresentingFlowListComp() {
    const dirSource = useGenDirSourceReload(
        dirSourceSettingNames.PRESENTING_FLOW,
    );
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
        <>
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
                bodyHandler={handleBodyRendering}
                genContextMenuItems={genContextMenuItems}
                checkIsOnScreen={checkIsAnyPresentingFlowOnScreen}
            />
            <PresentingFlowPreviewFloatingComp />
        </>
    );
}
