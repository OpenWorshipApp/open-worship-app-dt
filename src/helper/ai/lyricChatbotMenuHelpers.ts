/**
 * **Open in Chatbot** on a song (2026-11-06, the user, with a Documents row's
 * menu: _add lyric context menu `Open In Chatbot`_, then the Lyric Editor's
 * top bar: _add robot icon to click for `Open In Chatbot`_). It opens the
 * help window with the song ATTACHED, under a card that says what can be
 * done to it (`src/chatbot/lyricChatHelpers.ts`); the assistant then changes
 * it part by part through `owa_lyric_edit`. Offered only while AI is on, like
 * every other way into the assistant.
 *
 * A leaf on purpose: the asking itself, its dialogs and the window opener are
 * loaded at the press, never with a list of songs.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';

/** The help window, opened on this song with it attached. */
export async function openLyricInChatbot(filePath: string) {
    try {
        const { openChatbotWithFile } = await import('./chatbotHandoffHelpers');
        return await openChatbotWithFile(filePath);
    } catch (error) {
        handleError(error);
        return false;
    }
}

/** The menu item a song's row carries, or none while AI is off. */
export function genLyricOpenInChatbotContextMenu(
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
                void openLyricInChatbot(filePath);
            },
        },
    ];
}
