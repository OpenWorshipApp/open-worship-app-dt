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
    requestChatbotFile,
    requestChatbotForeground,
    requestChatbotLookup,
    requestChatbotReport,
    type SelectionMentionType,
} from './chatbotHandoffStoreHelpers';
import type { ForegroundAskType } from './foregroundAskHelpers';
import type { LookupAskType } from './lookupAskHelpers';
import type { ResourceReadingType } from './resourceReadingAskHelpers';

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

/**
 * Opens the assistant on a FILE -- the 🤖 on a row of the Resources panel:
 * a tab of its own with the file attached and ready to be asked about, and
 * the passage the Reader is on for that file, when it is on one
 * (`resourceReadingAskHelpers.ts`). A Bible notes file names the ONE note
 * the conversation is about (`noteId`). The same two questions first, and
 * only once they are answered `beforeOpening` -- a Bible note's row opens
 * the note's own window there, for the conversation to work in. Words
 * selected in that note (`mention`) are quoted in the box, ready for the
 * question about them.
 */
export async function openChatbotWithFile(
    filePath: string,
    reading: ResourceReadingType | null = null,
    noteId: number | null = null,
    beforeOpening: (() => Promise<void>) | null = null,
    mention: SelectionMentionType | string | null = null,
) {
    if (!(await askToOpenChatbot())) {
        return false;
    }
    await beforeOpening?.();
    requestChatbotFile(filePath, reading, noteId, mention);
    openChatbotPage();
    return true;
}

/**
 * Opens the assistant on what a Lookup Detail panel shows -- a person, a
 * place or a passage: a tab of its own that reads the record and is ready
 * to be asked about it. The same two questions first. Words selected in a
 * passage (`mention`) are quoted in the box, ready for the question about
 * them.
 */
export async function openChatbotWithLookup(
    ask: LookupAskType,
    mention: SelectionMentionType | string | null = null,
) {
    if (!(await askToOpenChatbot())) {
        return false;
    }
    requestChatbotLookup(ask, mention);
    openChatbotPage();
    return true;
}

/**
 * Opens the assistant on ONE session of a foreground component -- a chip's
 * **Open in Chatbot** or a panel header's 🤖: a tab of its own with the
 * session attached as its context, ready to be asked to change it. The same
 * two questions first.
 */
export async function openChatbotWithForeground(ask: ForegroundAskType) {
    if (!(await askToOpenChatbot())) {
        return false;
    }
    requestChatbotForeground(ask);
    openChatbotPage();
    return true;
}
