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
 * This service answers with no key and no signup at all, over the same OpenAI
 * protocol the ChatGPT and Kimi loops already speak, so nothing new is needed
 * to drive it. It is PUBLIC and SHARED, which is the whole reason it is free,
 * and that is a trade the user has to be told about rather than one made
 * quietly on their behalf -- see the warning the chatbot window puts above the
 * first free answer.
 *
 * There used to be two. LLM7 (`api.llm7.io`) was the default until 2026-09-12,
 * when every keyless question in the window came back "Free could not answer":
 * its catalogue had turned into a priced one, `gpt-oss` answered
 * `model_unavailable`, `minimax-m2.7` answered once and then 429 on every call
 * after it, and the rest wanted a key or refused tools. Kilo Code's free models
 * were driven through the real tool loop the same afternoon and answered. A
 * second service is one row in the map below -- but only once it has been
 * driven through that loop too: a free host that accepts a request is not the
 * same thing as one whose models can call a tool.
 */
export type FreeServiceInfoType = {
    /** What the warning calls it. The user may want to go and read its terms. */
    label: string;
    baseUrl: string;
    /** Where its terms live, for the warning's own link. */
    homeUrl: string;
};

/**
 * Who answers, as the warning and Settings both name it -- they list this map
 * rather than a name written out twice, so the two disclosures cannot drift
 * apart. Kilo's free pool is routed to whoever has spare capacity, which is why
 * its own documentation warns that upstream providers may log prompts and
 * outputs.
 */
export const FREE_SERVICE_MAP: { kilo: FreeServiceInfoType } = {
    kilo: {
        label: 'Kilo Code',
        baseUrl: 'https://api.kilo.ai/api/gateway',
        homeUrl: 'https://kilo.ai',
    },
};

/**
 * The service answers an anonymous request, and also accepts an
 * `Authorization` header it does not recognise -- checked before this was
 * written. The SDK insists on a key, so it gets a word instead of one. It is
 * never read as a credential by anybody, and it must never be mistaken for a
 * place to put a real one.
 */
const NO_KEY_PLACEHOLDER = 'anonymous';

// Memoised the way the keyed providers memoise on the key itself.
let instance: OpenAI | null = null;

export function getFreeInstance() {
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
    instance ??= new OpenAI({
        apiKey: NO_KEY_PLACEHOLDER,
        baseURL: FREE_SERVICE_MAP.kilo.baseUrl,
        dangerouslyAllowBrowser: true,
    });
    return instance;
}
