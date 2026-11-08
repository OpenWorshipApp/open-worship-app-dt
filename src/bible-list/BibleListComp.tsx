import './cueList.scss';

import { type ReactNode, useCallback } from 'react';

import FileListHandlerComp from '../others/FileListHandlerComp';
import Bible from './Bible';
import BibleFileComp from './BibleFileComp';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import { getSettingPrefix } from '../helper/settingHelpers';
import { defaultDataDirNames } from '../helper/constants';
import appProvider from '../server/appProvider';
import type BibleItem from './BibleItem';
import { checkIsBibleItemOnScreen, sortBibleFilePaths } from './bibleHelpers';
import { toIconedLabel } from '../others/labelIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import { getFileFullName } from '../server/fileHelpers';
import { useFileListSessions } from '../media-sessions/useFileListSessions';
import {
    askAndImportBibleArchiveFromUrl,
    checkIsBibleArchiveFileFullName,
    importDroppedBibleArchive,
    selectAndImportBibleArchive,
} from './bibleArchiveHelpers';

async function checkIsOnScreen(filePaths: string[]) {
    const bibleItems: BibleItem[] = [];
    for (const filePath of filePaths) {
        const bible = await Bible.fromFilePath(filePath);
        if (bible !== null) {
            bibleItems.push(...bible.items);
        }
    }
    return await checkIsBibleItemOnScreen(bibleItems);
}

// Built per call rather than at module scope: `tran` reads the loaded language,
// which is not ready when this module is first imported.
function genContextMenuItems(): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('box-arrow-in-down'),
            menuElement: tran('Import'),
            onSelect: () => {
                selectAndImportBibleArchive();
            },
        },
        {
            childBefore: genContextMenuItemIcon('cloud-download'),
            menuElement: tran('Import From URL'),
            onSelect: () => {
                askAndImportBibleArchiveFromUrl();
            },
        },
    ];
}

/**
 * An exported bundle dropped onto the list is imported rather than dropped into
 * the bibles folder as-is: the archive itself is not a bible list the app can
 * open, so copying it there would only leave an unreadable file behind. Any
 * other file falls through to the default handling.
 */
function handleDroppedFileTaking(file: DroppedFileType) {
    const fileFullName = getFileFullName(file);
    if (
        fileFullName === undefined ||
        !checkIsBibleArchiveFileFullName(fileFullName)
    ) {
        return false;
    }
    importDroppedBibleArchive(file);
    return true;
}

/**
 * The Bibles list: the folder-session strip under its title, and the list of
 * the session in front, keyed by session so a switch drops the list it
 * leaves. The Presenter and the Reader keep separate sessions, as they keep
 * separate folders.
 */
export default function BibleListComp() {
    const session = useFileListSessions(Bible.getBaseDirSourceSettingName());
    return (
        <BibleListBodyComp
            key={session.activeId}
            dirSourceSettingName={session.dirSourceSettingName}
            sessionsElement={session.element}
            isDirSettingRouteHidden={!session.isDefaultSession}
        />
    );
}

function BibleListBodyComp({
    dirSourceSettingName,
    sessionsElement,
    isDirSettingRouteHidden,
}: Readonly<{
    dirSourceSettingName: string;
    sessionsElement: ReactNode;
    isDirSettingRouteHidden: boolean;
}>) {
    const dirSource = useGenDirSourceReload(dirSourceSettingName);
    const handleBodyRendering = useCallback((filePaths: string[]) => {
        return filePaths.map((filePath, i) => {
            return (
                <BibleFileComp key={filePath} index={i} filePath={filePath} />
            );
        });
    }, []);
    if (dirSource === null) {
        return null;
    }
    // Make sure the default bible file is created
    Bible.getDefault();
    const settingPrefix = getSettingPrefix();
    const defaultDataDirName = appProvider.isPageReader
        ? defaultDataDirNames.BIBLE_READ
        : defaultDataDirNames.BIBLE_PRESENT;
    return (
        <FileListHandlerComp
            className={`${settingPrefix}bible-list app-cue-list`}
            mimetypeName="bible"
            defaultFolderName={defaultDataDirName}
            dirSource={dirSource}
            onNewFile={async (dirPath: string, name: string) => {
                return !(await Bible.create(dirPath, name));
            }}
            header={<span>{toIconedLabel('Bibles')}</span>}
            sessionsElement={sessionsElement}
            isDirSettingRouteHidden={isDirSettingRouteHidden}
            bodyHandler={handleBodyRendering}
            userClassName="p-0"
            checkIsOnScreen={checkIsOnScreen}
            sortFilePaths={sortBibleFilePaths}
            genContextMenuItems={genContextMenuItems}
            takeDroppedFile={handleDroppedFileTaking}
        />
    );
}
