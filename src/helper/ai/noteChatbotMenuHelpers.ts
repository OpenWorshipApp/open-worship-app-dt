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

/** The help window, opened on this note with it attached. */
export async function openNoteInChatbot(filePath: string, noteId: number) {
    try {
        const { openChatbotWithFile } = await import('./chatbotHandoffHelpers');
        return await openChatbotWithFile(filePath, null, noteId);
    } catch (error) {
        handleError(error);
        return false;
    }
}

/** The menu item a note row carries, or none. */
export function genNoteOpenInChatbotContextMenu(
    filePath: string,
    noteId: number,
): ContextMenuItemType[] {
    if (!getIsAIEnabled()) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: () => {
                void openNoteInChatbot(filePath, noteId);
            },
        },
    ];
}
