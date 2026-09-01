import Anthropic from '@anthropic-ai/sdk';
import type { AISettingType } from './aiHelpers';
import { getAISetting, getIsAIEnabled, useAISetting } from './aiHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';

export const DATA_DIR_NAME = 'ai-anthropic-data';

let instance: Anthropic | null = null;
// The cache key is the credential AND the workspace it acts in: changing only
// the workspace id in settings must not keep handing back the old client.
let key: string | null = null;
export function getAnthropicInstance() {
    const { anthropicAPIKey, anthropicWorkspaceId } = getAISetting();
    // The master switch in Settings > Others turns every AI feature off,
    // stored keys or not -- and says so. Blaming a missing key sends the user
    // to re-enter one that is already there.
    if (!getIsAIEnabled()) {
        showSimpleToast(
            tran('Fail to get Anthropic instance'),
            tran('AI features are turned off in Settings.'),
        );
        return null;
    }
    if (!anthropicAPIKey) {
        showSimpleToast(
            tran('Fail to get Anthropic instance'),
            tran('Missing Anthropic API Key.'),
        );
        return null;
    }
    const cacheKey = `${anthropicAPIKey}@${anthropicWorkspaceId}`;
    if (instance !== null && key === cacheKey) {
        return instance;
    }
    key = cacheKey;
    instance = new Anthropic({
        apiKey: anthropicAPIKey,
        dangerouslyAllowBrowser: true,
        // An identity-linked key is rejected without it: "anthropic-workspace-id
        // is required when authenticating with an identity-linked API key".
        // Left off entirely when unset, which is what an ordinary key wants.
        ...(anthropicWorkspaceId
            ? {
                  defaultHeaders: {
                      'anthropic-workspace-id': anthropicWorkspaceId,
                  },
              }
            : {}),
    });
    return instance;
}

export function checkIsAvailable(aiSetting?: AISettingType) {
    const setting = aiSetting ?? getAISetting();
    // The master switch too, exactly as the OpenAI twin does: a button left on
    // screen by a feature that is switched off can only apologise when pressed.
    return getIsAIEnabled() && setting.anthropicAPIKey.trim().length > 0;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return checkIsAvailable(aiSetting);
}
