/**
 * **Open in Chatbot** on a Bible note (2026-11-07, the user, with a note
 * row's menu open on Open / Edit Title / Export / Duplicate / Move To: _add
 * `Open in Chatbot` for bible-note, to do what `Open in Chatbot` of
 * appdocument … goal: chatbot can help modify and answer everything on
 * bible-note_). It opens the help window with that ONE note attached -- a
 * `.own` file holds many, so the note's id rides with the path -- under a card
 * that says what can be done to it (`src/chatbot/noteChatHelpers.ts`); the
 * assistant then changes it through `owa_note_edit`. Offered only while AI is
 * on, like every other way into the assistant: on a note row's menu, right
 * after **Open**, and as the 🤖 in the note window's footer.
 *
 * A leaf on purpose: the asking itself, its dialogs and the window opener are
 * loaded at the press, never with a list of notes.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';
import type { SelectionMentionType } from './chatbotHandoffStoreHelpers';
import { findNoteWindow, toNoteWindowTarget } from './noteWindowMatchHelpers';

/**
 * Whether the note's own window is open, asked of main the way the help
 * window's picker asks (`main:app:list-app-windows`). `null` when that
 * cannot be told: no window is opened on a guess, since a second editor on
 * the same note writes its stale copy back over the first's.
 */
async function checkIsNoteWindowOpen(filePath: string, noteId: number) {
    const target = toNoteWindowTarget(filePath, noteId);
    if (target === null) {
        return null;
    }
    try {
        const { electronSendAsync } =
            await import('../../server/electronSendHelpers');
        const windowList = await electronSendAsync<{ url: string }[]>(
            'main:app:list-app-windows',
        );
        if (!Array.isArray(windowList) || windowList.length === 0) {
            // Not even the window asking: the list could not be read.
            return null;
        }
        return findNoteWindow(windowList, target) !== null;
    } catch (_error) {
        return null;
    }
}

/**
 * The help window, opened on this note with it attached. From a note row,
 * `openNoteWindow` opens the note's own window first when it is not open
 * (2026-11-08, the user: _chatbot should demand select a bible-note window
 * (open one if not opened)_): the conversation works IN that window -- its
 * head reads Bible Note, a walkthrough rings the note editor's controls, and
 * the changes show there as they are made. Asked only once the person said
 * yes to the assistant, never before its caution. From the note window's
 * selection toolbar, the words selected ride with it (`mention`) and are
 * quoted in the box: in the tab already on this note when there is one,
 * else in a new tab with the note attached.
 */
export async function openNoteInChatbot(
    filePath: string,
    noteId: number,
    openNoteWindow: (() => unknown) | null = null,
    mention: SelectionMentionType | string | null = null,
) {
    try {
        const { openChatbotWithFile } = await import('./chatbotHandoffHelpers');
        const beforeOpening =
            openNoteWindow === null
                ? null
                : async () => {
                      if (
                          (await checkIsNoteWindowOpen(filePath, noteId)) ===
                          false
                      ) {
                          openNoteWindow();
                      }
                  };
        return await openChatbotWithFile(
            filePath,
            null,
            noteId,
            beforeOpening,
            mention,
        );
    } catch (error) {
        handleError(error);
        return false;
    }
}

/** The menu item a note row carries, or none. */
export function genNoteOpenInChatbotContextMenu(
    filePath: string,
    noteId: number,
    openNoteWindow: (() => unknown) | null = null,
): ContextMenuItemType[] {
    if (!getIsAIEnabled()) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: () => {
                void openNoteInChatbot(filePath, noteId, openNoteWindow);
            },
        },
    ];
}
