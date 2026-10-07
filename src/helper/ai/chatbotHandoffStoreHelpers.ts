/**
 * The request a window leaves for the assistant, and the assistant takes
 * (see `chatbotHandoffHelpers.ts`). A leaf of its own -- settings only --
 * so the chat window reads it without pulling in the dialogs and window
 * openers the button that LEAVES it needs.
 */
import { getSettingForce, removeSetting, setSetting } from '../settingHelpers';

const HANDOFF_KEY = 'chatbot-handoff-ask';
const HANDOFF_MAX_AGE_MS = 30 * 1000;
const HANDOFF_MAX_CHARS = 600;

export function requestChatbotAsk(text: string) {
    setSetting(
        HANDOFF_KEY,
        JSON.stringify({
            text: text.slice(0, HANDOFF_MAX_CHARS),
            at: Date.now(),
        }),
    );
}

/** The waiting request, once; null when there is none or it is stale. */
export function takeChatbotAsk(): string | null {
    const raw = getSettingForce(HANDOFF_KEY);
    if (!raw) {
        return null;
    }
    removeSetting(HANDOFF_KEY);
    try {
        const data = JSON.parse(raw);
        if (
            typeof data?.text !== 'string' ||
            typeof data?.at !== 'number' ||
            Math.abs(Date.now() - data.at) > HANDOFF_MAX_AGE_MS
        ) {
            return null;
        }
        return data.text.trim().slice(0, HANDOFF_MAX_CHARS) || null;
    } catch (_error) {
        return null;
    }
}
