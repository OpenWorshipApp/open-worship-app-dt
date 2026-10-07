/**
 * Opening the assistant ALREADY asked: another window starts a job in the
 * chat for the person, instead of telling them what to type there.
 *
 * Asked for for Settings → Bible, where importing a Bible means four fields
 * an elderly volunteer has never heard of: one button opens the assistant,
 * and it is already asking which language (or downloading the link that
 * was typed). The 🤖's own two questions come first, exactly as for the 🤖:
 * whether AI is turned on at all, then the caution.
 *
 * The request crosses windows the way the Settings link prefill does
 * (`bibleImportRequestHelpers.ts`): one setting, taken ONCE by the chat
 * window when it opens or comes to the front, and only within half a
 * minute -- a request left by a window that then failed to open must not
 * start an import the next time somebody opens the assistant for something
 * else. The chat window reads it through `chatbotHandoffStoreHelpers.ts`,
 * a leaf, and never imports this module's dialogs.
 */
import { askAiCaution } from './aiCautionHelpers';
import { askToEnableAI } from './aiEnableHelpers';
import { getIsAIEnabled } from './aiHelpers';
import { openChatbotPage } from '../domHelpers';
import { requestChatbotAsk } from './chatbotHandoffStoreHelpers';

export async function openChatbotAsking(text: string) {
    if (!getIsAIEnabled()) {
        void askToEnableAI();
        return false;
    }
    if (!(await askAiCaution('assistant'))) {
        return false;
    }
    requestChatbotAsk(text);
    openChatbotPage();
    return true;
}
