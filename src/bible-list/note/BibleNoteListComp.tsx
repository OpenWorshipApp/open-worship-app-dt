import '../cueList.scss';

import { type ReactNode } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import { useGenDirSourceReload } from '../../helper/dirSourceHelpers';
import { useAppEffect } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';
import type { DroppedFileType } from '../../others/droppingFileHelpers';
import { toIconedLabel } from '../../others/labelIconHelpers';
import FileListHandlerComp, {
    type NewFileKindType,
} from '../../others/FileListHandlerComp';
import { createNewFileDetail, getFileFullName } from '../../server/fileHelpers';
import { useFileListSessions } from '../../media-sessions/useFileListSessions';
import { checkIsMarkdownPreviewFileName } from '../../markdown-preview/markdownPreviewParamHelpers';
import MarkdownNoteFileComp, {
    openMarkdownNoteFile,
} from './MarkdownNoteFileComp';
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

// 2026-11-11, the user: _make markdown be the part of bible-note area as
// well, so user can create either bible-note or markdown file_. The list
// shows both, and its menu makes either, as the Documents list's does
// slides and songs.
const NEW_FILE_KIND_MARKDOWN = 'markdown';
const newFileKinds: NewFileKindType[] = [
    { key: 'note', title: 'New Bible Note', iconName: 'journal-text' },
    {
        key: NEW_FILE_KIND_MARKDOWN,
        title: 'New Markdown File',
        iconName: 'markdown',
    },
];

// A new Markdown file starts with its name as its heading, and opens in
// its own window, whose editor is one press away.
async function newFileHandling(
    dirPath: string,
    name: string,
    kindKey: string | null,
) {
    if (kindKey !== NEW_FILE_KIND_MARKDOWN) {
        return !(await Note.create(dirPath, name));
    }
    const filePath = await createNewFileDetail(
        dirPath,
        name,
        `# ${name}\n`,
        'markdown',
    );
    if (filePath === null) {
        return true;
    }
    void openMarkdownNoteFile(filePath);
    return false;
}

// A Markdown file dropped onto the list is copied into it, as a note file is.
function checkIsDroppedMarkdownFile(fileFullName: string) {
    return checkIsMarkdownPreviewFileName(fileFullName);
}

function handleBodyRendering(filePaths: string[]) {
    return filePaths.map((filePath, i) => {
        if (checkIsMarkdownPreviewFileName(filePath)) {
            return (
                <MarkdownNoteFileComp
                    key={filePath}
                    index={i}
                    filePath={filePath}
                />
            );
        }
        return <NoteFileComp key={filePath} index={i} filePath={filePath} />;
    });
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
    // Make sure the default note file exists -- once per folder read, not on
    // every render: each ask lists the folder.
    useAppEffect(() => {
        if (dirSource !== null) {
            Note.getDefault();
        }
    }, [dirSource]);
    if (dirSource === null) {
        return null;
    }
    return (
        <FileListHandlerComp
            className="note-list app-cue-list"
            mimetypeName="note"
            extraMimetypeNames={['markdown']}
            defaultFolderName={defaultDataDirNames.BIBLE_NOTES}
            dirSource={dirSource}
            onNewFile={newFileHandling}
            newFileKinds={newFileKinds}
            checkExtraFile={checkIsDroppedMarkdownFile}
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
