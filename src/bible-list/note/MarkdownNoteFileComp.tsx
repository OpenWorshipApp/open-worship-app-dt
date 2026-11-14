import { useCallback, useMemo } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { AppDocumentSourceAbs } from '../../helper/AppEditableDocumentSourceAbs';
import { genDocumentOpenInChatbotContextMenu } from '../../helper/ai/lyricChatbotMenuHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import FileSource from '../../helper/FileSource';
import { tran } from '../../lang/langHelpers';
import FileItemHandlerComp from '../../others/FileItemHandlerComp';
import appProvider from '../../server/appProvider';

/**
 * A Markdown file in the Bible Notes list: nothing the list reads or edits
 * itself, only what the row's menu and its trash need. Made per row and never
 * cached -- `AppDocumentSourceAbs._getInstance` keeps every instance for the
 * life of the window, and a row holds nothing worth keeping.
 */
class MarkdownNoteDocument extends AppDocumentSourceAbs {}

// The row's own press, and Preview on its menu: one more window on the file
// every time, as a Resources row's press and a Bible note's Open do, so two
// parts of it can be read side by side. Open in Chatbot passes `isAnother`
// false: the window already open on the file is brought forward and none is
// added, as the Resources 🤖 does, since the chat works in it. Loaded at the
// press: a list of rows carries no window helpers for a file nobody opens.
export async function openMarkdownNoteFile(filePath: string, isAnother = true) {
    const { openMarkdownPreview } =
        await import('../../resources/resourcePreviewOpenHelpers');
    openMarkdownPreview(filePath, { isAnother });
}

function genContextMenu(filePath: string): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('eye'),
            menuElement: tran('Preview'),
            onSelect: () => {
                void openMarkdownNoteFile(filePath);
            },
        },
        // Right after Preview, while AI is on (2026-11-13, the user, with
        // this menu open: _markdown file in bible-note should have open in
        // chatbot context menu as well_): what the Resources row's 🤖 does
        // for a Markdown file. Once the assistant's two questions are
        // answered its preview window opens, then a tab of its own with the
        // file attached, where the chat reads, changes and translates it as
        // `Bible Notes/<name>.md`.
        ...genDocumentOpenInChatbotContextMenu(filePath, () => {
            return openMarkdownNoteFile(filePath, false);
        }),
        {
            // The file is plain text the person may well want to write in
            // another editor; the preview's own editor is one press away too.
            childBefore: genContextMenuItemIcon('box-arrow-up-right'),
            menuElement: tran('Open in Default App'),
            onSelect: () => {
                appProvider.systemUtils.openFile(filePath);
            },
        },
    ];
}

function MarkdownNotePreviewComp({ filePath }: Readonly<{ filePath: string }>) {
    const fileSource = FileSource.getInstance(filePath);
    const filePathRef = useAppCurrentRef(filePath);
    const handleOpening = useCallback(() => {
        void openMarkdownNoteFile(filePathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="w-100 d-flex app-caught-hover-pointer app-cue-group"
            role="button"
            tabIndex={0}
            // Named and pressable as a note file's header is: a bare div
            // could not be reached by a keyboard, read by a screen reader or
            // aimed at by `owa_click`.
            aria-label={fileSource.name}
            onClick={handleOpening}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                // Otherwise Space scrolls the panel out from under it.
                event.preventDefault();
                handleOpening();
            }}
        >
            <div className="flex-fill app-overflow-hidden">
                {/* Where a note file's chevron is, so the two kinds' icons
                    and names line up down the list. */}
                <i className="bi bi-chevron-right invisible" />
                <i className="bi bi-markdown px-1" />
                <span className="app-ellipsis">{fileSource.name}</span>
            </div>
        </div>
    );
}

export default function MarkdownNoteFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const markdownDocument = useMemo(() => {
        return new MarkdownNoteDocument(filePath);
    }, [filePath]);
    const handleChildRendering = useCallback(
        (markdownDocument: AppDocumentSourceAbs) => {
            return (
                <MarkdownNotePreviewComp filePath={markdownDocument.filePath} />
            );
        },
        [],
    );
    // Nothing is read off the disk to draw the row, so nothing is read again.
    const handleReloading = useCallback(() => {}, []);
    return (
        <FileItemHandlerComp
            index={index}
            fileData={markdownDocument}
            reload={handleReloading}
            filePath={filePath}
            className="note-file markdown-note-file"
            renderChild={handleChildRendering}
            isDisabledColorNote
            userClassName="p-0"
            contextMenuItems={genContextMenu(filePath)}
            isSelected={false}
        />
    );
}
