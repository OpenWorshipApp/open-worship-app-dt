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
import {
    requestChatbotAsk,
    requestChatbotReport,
} from './chatbotHandoffStoreHelpers';

async function askToOpenChatbot() {
    if (!getIsAIEnabled()) {
        void askToEnableAI();
        return false;
    }
    return await askAiCaution('assistant');
}

export async function openChatbotAsking(text: string) {
    if (!(await askToOpenChatbot())) {
        return false;
    }
    requestChatbotAsk(text);
    openChatbotPage();
    return true;
}

/**
 * Opens the assistant to REPORT A PROBLEM: from the Help button's third
 * row (`problem` empty -- the person is asked what happened) and from the
 * dialog an error raises (`problem` is the error). The same two questions
 * first; the assistant then offers, and only a press there looks into
 * anything, and only a second one sends.
 */
export async function openChatbotReporting(problem = '') {
    if (!(await askToOpenChatbot())) {
        return false;
    }
    requestChatbotReport(problem);
    openChatbotPage();
    return true;
}
