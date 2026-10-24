import OpenAI from 'openai';

import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import { getAISetting, getIsAIEnabled } from './aiHelpers';

/**
 * Amazon Bedrock speaks OpenAI's protocol on its `bedrock-mantle` endpoint, so
 * it is the same SDK pointed somewhere else -- no AWS SDK, no request signing:
 * a Bedrock API key (`ABSK...`) is sent as a plain bearer token, exactly as an
 * OpenAI key is, and the chatbot's OpenAI-shaped tool loop answers for it.
 *
 * The PATH is the part that is easy to get wrong. Most models on that endpoint
 * answer under `/v1`; Gemma 4 answers only under `/openai/v1`, and a request to
 * `/v1/chat/completions` for it is refused with "model `google.gemma-4-31b`
 * isn't supported on this route" (AWS's model card, read 2026-10-09). The
 * chatbot offers Gemma 4, so the base URL is the one that route lives on.
 */
export function genBedrockBaseUrl(region: string) {
    return `https://bedrock-mantle.${region}.api.aws/openai/v1`;
}

// Its OWN client and its own memo, for the reason `kimiHelpers` gives: a client
// shared with another provider would hand the wrong host a key off a warm
// cache. Keyed on the region as well as the key, because the region is a
// separate setting and changing it must change where the next question goes.
let instance: OpenAI | null = null;
let instanceFor: string | null = null;
export function getBedrockInstance() {
    const { bedrockAPIKey, bedrockRegion } = getAISetting();
    // The master switch in Settings > Others turns every AI feature off,
    // stored keys or not -- and says so.
    if (!getIsAIEnabled()) {
        showSimpleToast(
            tran('Fail to get Amazon Bedrock instance'),
            tran('AI features are turned off in Settings.'),
        );
        return null;
    }
    if (!bedrockAPIKey) {
        showSimpleToast(
            tran('Fail to get Amazon Bedrock instance'),
            tran('Missing Amazon Bedrock API Key.'),
        );
        return null;
    }
    const memoKey = `${bedrockRegion}\n${bedrockAPIKey}`;
    if (instance !== null && instanceFor === memoKey) {
        return instance;
    }
    instanceFor = memoKey;
    instance = new OpenAI({
        apiKey: bedrockAPIKey,
        baseURL: genBedrockBaseUrl(bedrockRegion),
        dangerouslyAllowBrowser: true,
    });
    return instance;
}
