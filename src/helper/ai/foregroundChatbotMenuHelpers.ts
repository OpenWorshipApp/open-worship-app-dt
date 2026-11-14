/**
 * **Open in Chatbot** on a foreground session (2026-11-09, the user, with a
 * panel's sessions strip circled: _sessions of opening foreground component
 * should be able to attached to the chatbot for the chat context_): on every
 * session chip's menu, and as the robot in every foreground panel's title
 * bar (its current session). It opens the help window with the session
 * ATTACHED, under a card that says what can be done to it
 * (`src/chatbot/foregroundChatHelpers.ts`); the assistant then changes it
 * through `owa_foreground_edit`. Offered only while AI is on, like every
 * other way into the assistant.
 *
 * A leaf on purpose: the asking itself, its dialogs and the window opener are
 * loaded at the press, never with a panel.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';
import type { ForegroundAskType } from './foregroundAskHelpers';

/** The help window, opened on this session with it attached. */
export async function openForegroundInChatbot(ask: ForegroundAskType) {
    try {
        const { openChatbotWithForeground } =
            await import('./chatbotHandoffHelpers');
        return await openChatbotWithForeground(ask);
    } catch (error) {
        handleError(error);
        return false;
    }
}

/** The menu item a session chip carries, or none while AI is off. */
export function genForegroundOpenInChatbotContextMenu(
    ask: ForegroundAskType,
): ContextMenuItemType[] {
    if (!getIsAIEnabled()) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: () => {
                void openForegroundInChatbot(ask);
            },
        },
    ];
}
