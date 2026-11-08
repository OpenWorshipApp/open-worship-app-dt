/**
 * **Open in Chatbot** on a song (2026-11-06, the user, with a Documents row's
 * menu: _add lyric context menu `Open In Chatbot`_, then the Lyric Editor's
 * top bar: _add robot icon to click for `Open In Chatbot`_) and on a slide
 * document (2026-11-07, the same menu on a slide document's row: _like
 * lyric, add `Open in Chatbot` for AppDocument to let chatbot help modify
 * slides_) and on a presenting flow (2026-11-07, its row in the Presenting
 * Flows list: _goal: chatbot can help the presenting flow modification_).
 * It opens the help window with the document ATTACHED, under a card that
 * says what can be done to it (`src/chatbot/lyricChatHelpers.ts`,
 * `slideChatHelpers.ts`, `flowChatHelpers.ts`); the assistant then changes
 * it through `owa_lyric_edit` / `owa_slide_edit` /
 * `owa_presenting_flow_edit`. Offered only while AI is on, like every other
 * way into the assistant.
 *
 * A leaf on purpose: the asking itself, its dialogs and the window opener are
 * loaded at the press, never with a list of documents.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';

/** The help window, opened on this document with it attached. */
export async function openDocumentInChatbot(filePath: string) {
    try {
        const { openChatbotWithFile } = await import('./chatbotHandoffHelpers');
        return await openChatbotWithFile(filePath);
    } catch (error) {
        handleError(error);
        return false;
    }
}

/** The menu item a song's or slide document's row carries, or none. */
export function genDocumentOpenInChatbotContextMenu(
    filePath: string,
): ContextMenuItemType[] {
    if (!getIsAIEnabled()) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: () => {
                void openDocumentInChatbot(filePath);
            },
        },
    ];
}

/** The song's names for the same two, kept for the song's own callers. */
export const openLyricInChatbot = openDocumentInChatbot;
export const genLyricOpenInChatbotContextMenu =
    genDocumentOpenInChatbotContextMenu;
