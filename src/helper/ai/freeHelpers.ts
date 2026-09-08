import OpenAI from 'openai';

import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import { getIsAIEnabled } from './aiHelpers';

/**
 * The assistant a volunteer gets when NOBODY has typed an API key.
 *
 * Every other provider in this folder is somebody's paid account. That is the
 * right answer for a church that has one, and it is no answer at all for the
 * far larger number who install the app the week before Easter and never find
 * Settings. For them the help window used to say "no AI key" and hand them the
 * offline manual search -- which cannot converse, cannot look at the app, and
 * cannot walk anyone through anything.
 *
 * These two services answer with no key and no signup at all, over the same
 * OpenAI protocol the ChatGPT and Kimi loops already speak, so nothing new is
 * needed to drive them. They are PUBLIC and SHARED, which is the whole reason
 * they are free, and that is a trade the user has to be told about rather than
 * one made quietly on their behalf -- see the warning the chatbot window puts
 * above the first free answer.
 *
 * Measured against the live app before either was offered here (2026-09-01):
 * both call tools correctly through the app's own MCP host, which is the one
 * capability this bot cannot work without.
 */
export type FreeServiceType = 'llm7' | 'kilo';

export type FreeServiceInfoType = {
    /** What the warning calls it. The user may want to go and read its terms. */
    label: string;
    baseUrl: string;
    /** Where its terms live, for the warning's own link. */
    homeUrl: string;
};

/**
 * Declared once, and ORDERED: LLM7 first because it is the one that answered a
 * real volunteer question fastest and in the fewest rounds. Kilo carries the
 * bigger models and the only free ones that can look at a picture, and its free
 * pool is routed to whoever has capacity -- which is why its own documentation
 * warns that upstream providers may log prompts and outputs.
 */
export const FREE_SERVICE_MAP: Record<FreeServiceType, FreeServiceInfoType> = {
    llm7: {
        label: 'LLM7',
        baseUrl: 'https://api.llm7.io/v1',
        homeUrl: 'https://llm7.io',
    },
    kilo: {
        label: 'Kilo Code',
        baseUrl: 'https://api.kilo.ai/api/gateway',
        homeUrl: 'https://kilo.ai',
    },
};

/**
 * Both services answer an anonymous request, and both also accept an
 * `Authorization` header they do not recognise -- checked against each of them
 * before this was written. The SDK insists on a key, so it gets a word instead
 * of one. It is never read as a credential by anybody, and it must never be
 * mistaken for a place to put a real one.
 */
const NO_KEY_PLACEHOLDER = 'anonymous';

// One client per SERVICE, memoised the way the keyed providers memoise on the
// key itself. Not one shared client with the `baseURL` swapped per call: that
// is the bug `kimiHelpers` calls out, one layer along -- a warm client points
// at whichever service asked last, so a Kilo model would be asked of LLM7.
const instanceMap = new Map<FreeServiceType, OpenAI>();

export function getFreeInstance(service: FreeServiceType) {
    // The master switch in Settings > Others turns every AI feature off. It
    // has to hold here too: "free" is about money, not about permission, and a
    // user who switched AI off did not switch it off for paying customers only.
    if (!getIsAIEnabled()) {
        showSimpleToast(
            tran('Fail to get free assistant'),
            tran('AI features are turned off in Settings.'),
        );
        return null;
    }
    const existing = instanceMap.get(service);
    if (existing !== undefined) {
        return existing;
    }
    const info = FREE_SERVICE_MAP[service];
    const instance = new OpenAI({
        apiKey: NO_KEY_PLACEHOLDER,
        baseURL: info.baseUrl,
        dangerouslyAllowBrowser: true,
    });
    instanceMap.set(service, instance);
    return instance;
}
