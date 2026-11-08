import '../cueList.scss';

import { type ReactNode, useCallback } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import { useGenDirSourceReload } from '../../helper/dirSourceHelpers';
import { tran } from '../../lang/langHelpers';
import type { DroppedFileType } from '../../others/droppingFileHelpers';
import { toIconedLabel } from '../../others/labelIconHelpers';
import FileListHandlerComp from '../../others/FileListHandlerComp';
import { getFileFullName } from '../../server/fileHelpers';
import { useFileListSessions } from '../../media-sessions/useFileListSessions';
import Note from './Note';
import NoteFileComp from './NoteFileComp';
import {
    askAndImportBibleNoteArchiveFromUrl,
    checkIsBibleNoteArchiveFileFullName,
    importDroppedBibleNoteArchive,
    selectAndImportBibleNoteArchive,
} from './bibleNoteArchiveHelpers';
import { sortNoteFilePaths } from './noteHelpers';

// The WHOLE-FILE bundle. Importing a single note ITEM is on a note file's own
// menu instead, because that one needs a file to be appended into.
function genContextMenuItems(): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('box-arrow-in-down'),
            menuElement: tran('Import'),
            onSelect: () => {
                selectAndImportBibleNoteArchive();
            },
        },
        {
            childBefore: genContextMenuItemIcon('cloud-download'),
            menuElement: tran('Import From URL'),
            onSelect: () => {
                askAndImportBibleNoteArchiveFromUrl();
            },
        },
    ];
}

/**
 * An exported bundle dropped onto the list is imported rather than dropped into
 * the notes folder as-is: the archive itself is not a note file the app can
 * open, so copying it there would only leave an unreadable file behind. Any
 * other file falls through to the default handling.
 */
function handleDroppedFileTaking(file: DroppedFileType) {
    const fileFullName = getFileFullName(file);
    if (
        fileFullName === undefined ||
        !checkIsBibleNoteArchiveFileFullName(fileFullName)
    ) {
        return false;
    }
    importDroppedBibleNoteArchive(file);
    return true;
}

/**
 * The Bible Notes list: the folder-session strip under its title, and the
 * list of the session in front, keyed by session so a switch drops the list
 * it leaves. Verse marks stay in the Default session's notes whichever is in
 * front (`Note.getDefault`).
 */
export default function BibleNoteListComp() {
    const session = useFileListSessions(dirSourceSettingNames.BIBLE_NOTES);
    return (
        <BibleNoteListBodyComp
            key={session.activeId}
            dirSourceSettingName={session.dirSourceSettingName}
            sessionsElement={session.element}
            isDirSettingRouteHidden={!session.isDefaultSession}
        />
    );
}

function BibleNoteListBodyComp({
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
                <NoteFileComp key={filePath} index={i} filePath={filePath} />
            );
        });
    }, []);
    if (dirSource === null) {
        return null;
    }
    // Make sure the default note file is created
    Note.getDefault();
    return (
        <FileListHandlerComp
            className="note-list app-cue-list"
            mimetypeName="note"
            defaultFolderName={defaultDataDirNames.BIBLE_NOTES}
            dirSource={dirSource}
            onNewFile={async (dirPath: string, name: string) => {
                return !(await Note.create(dirPath, name));
            }}
            header={<span>{toIconedLabel('Bible Notes')}</span>}
            sessionsElement={sessionsElement}
            isDirSettingRouteHidden={isDirSettingRouteHidden}
            bodyHandler={handleBodyRendering}
            userClassName="p-0"
            sortFilePaths={sortNoteFilePaths}
            genContextMenuItems={genContextMenuItems}
            takeDroppedFile={handleDroppedFileTaking}
        />
    );
}
