import Anthropic from '@anthropic-ai/sdk';

import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import { getAISetting, getIsAIEnabled } from './aiHelpers';

/**
 * Claude on Amazon Bedrock. AWS serves every Claude model on the Anthropic
 * Messages API -- never on the OpenAI-shaped route the rest of the Bedrock
 * list rides (`bedrockHelpers`) -- and outside GovCloud serves the current
 * ones (Haiku 5.5, Sonnet 5.5, Fable 5.1) on the `bedrock-runtime` host only,
 * as cross-region ids (`global.anthropic.claude-haiku-5-5`). So this is the
 * Anthropic SDK pointed at that host's `/anthropic` route, sending the same
 * Bedrock API key the OpenAI-shaped client sends: AWS's own sample hands the
 * key to the SDK as its `api_key` (the `x-api-key` header), and the SDK adds
 * the `anthropic-version` header itself. Read off AWS's Haiku 5.5 card and
 * its "Inference using Anthropic Messages API" page, 2026-10-11.
 *
 * A module of its own rather than a corner of `bedrockHelpers`, for the
 * reason `anthropicHelpers` gives: importing this pulls the Anthropic SDK
 * into the chunk, and nothing that merely draws a control should pay that.
 */
export function genBedrockClaudeBaseUrl(region: string) {
    return `https://bedrock-runtime.${region}.amazonaws.com/anthropic`;
}

// Its own client and its own memo, keyed on the region as well as the key,
// for the reasons `bedrockHelpers` gives.
let instance: Anthropic | null = null;
let instanceFor: string | null = null;
export function getBedrockClaudeInstance() {
    const { bedrockAPIKey, bedrockRegion } = getAISetting();
    // The same two refusals as the OpenAI-shaped client, in the same words:
    // it is the same key and the same switch.
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
    instance = new Anthropic({
        apiKey: bedrockAPIKey,
        baseURL: genBedrockClaudeBaseUrl(bedrockRegion),
        dangerouslyAllowBrowser: true,
    });
    return instance;
}
