/**
 * **Add Bible Item** asks HOW (2026-11-14, EC-760; the user with the
 * Bibles panel's button circled: _when click `Add Bible Item` should open a
 * context menu for `Bible Lookup` and `Open in Chatbot`, `Open in Chatbot`
 * should open the chatbot and put pretext prompt to let user continue
 * editing by pasting more bible paragraph_, the story _as a user I want to
 * open chatbot with pre-existing prompt for letting assistant help extract
 * bible items for me_). The chatbot row is offered only while AI is on,
 * like every **Open in Chatbot**; with it off the button opens the lookup
 * as it always did, a menu of one being a press for nothing.
 *
 * A leaf on purpose: the asking, its dialogs and the window opener are
 * loaded at the press, never with the Bibles list.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';

export function openBibleListPasteInChatbot() {
    import('./chatbotHandoffHelpers')
        .then(({ openChatbotForBibleListPaste }) => {
            return openChatbotForBibleListPaste();
        })
        .catch(handleError);
}

/**
 * The button's menu: the lookup, then the chatbot -- or null when AI is
 * off and the lookup is the one way, opened at the press.
 */
export function genAddBibleItemContextMenu(
    openBibleLookup: () => void,
): ContextMenuItemType[] | null {
    if (!getIsAIEnabled()) {
        return null;
    }
    return [
        {
            childBefore: genContextMenuItemIcon('book'),
            menuElement: tran('Bible Lookup'),
            onSelect: openBibleLookup,
        },
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: openBibleListPasteInChatbot,
        },
    ];
}
