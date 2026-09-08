import OpenAI from 'openai';

import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import type { AISettingType } from './aiHelpers';
import { getAISetting, getIsAIEnabled, useAISetting } from './aiHelpers';

/**
 * Kimi speaks OpenAI's protocol, so it is the same SDK pointed somewhere else
 * -- no second package, and the chatbot's OpenAI-shaped tool loop answers for
 * both. The company is Moonshot and the endpoint says so; everything the user
 * reads says Kimi, which is what the models are called.
 */
const KIMI_BASE_URL = 'https://api.moonshot.ai/v1';

// Its OWN client and its own memo, never a `baseURL` argument bolted onto
// `getOpenAIInstance`: that one is keyed on the API key alone, so a shared
// factory would hand a Kimi-pointed client to the OpenAI path (or the reverse)
// off a warm cache the moment both keys were set.
let instance: OpenAI | null = null;
let key: string | null = null;
export function getKimiInstance() {
    const { kimiAPIKey } = getAISetting();
    // The master switch in Settings > Others turns every AI feature off,
    // stored keys or not -- and says so. Blaming a missing key sends the user
    // to re-enter one that is already there.
    if (!getIsAIEnabled()) {
        showSimpleToast(
            tran('Fail to get Kimi instance'),
            tran('AI features are turned off in Settings.'),
        );
        return null;
    }
    if (!kimiAPIKey) {
        showSimpleToast(
            tran('Fail to get Kimi instance'),
            tran('Missing Kimi API Key.'),
        );
        return null;
    }
    if (instance !== null && key === kimiAPIKey) {
        return instance;
    }
    key = kimiAPIKey;
    instance = new OpenAI({
        apiKey: kimiAPIKey,
        baseURL: KIMI_BASE_URL,
        dangerouslyAllowBrowser: true,
    });
    return instance;
}

export function checkIsAvailable(aiSetting?: AISettingType) {
    const setting = aiSetting ?? getAISetting();
    return getIsAIEnabled() && setting.kimiAPIKey.trim().length > 0;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return checkIsAvailable(aiSetting);
}
