/**
 * **Open in Chatbot** beside every **Open** a Bible passage's menu offers
 * (2026-10-22, the user with the Bible list's, the lookup history's and a
 * cross reference's menus circled: _add `Open in Chatbot` everywhere have
 * option to open bible item_ -- _like open here_, the 🤖 at the end of a Bible
 * view's toolbar). It opens the passage the way that 🤖 does
 * (`bibleItemAskHelpers.ts`), and is offered only while AI is on, like it.
 *
 * A leaf on purpose: the asking itself, its dialogs and the window opener are
 * loaded at the press, never with a list of passages.
 */
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import type BibleItem from '../../bible-list/BibleItem';
import { tran } from '../../lang/langHelpers';
import { handleError } from '../errorHelpers';
import { getIsAIEnabled } from './aiHelpers';

export function openBibleItemInChatbot(bibleItem: BibleItem) {
    import('./bibleItemAskHelpers')
        .then(({ openChatbotWithBibleItem }) => {
            return openChatbotWithBibleItem(bibleItem);
        })
        .catch(handleError);
}

export function genOpenInChatbotContextMenu(
    bibleItem: BibleItem,
): ContextMenuItemType[] {
    if (!getIsAIEnabled()) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('robot'),
            menuElement: tran('Open in Chatbot'),
            onSelect: () => {
                openBibleItemInChatbot(bibleItem);
            },
        },
    ];
}
