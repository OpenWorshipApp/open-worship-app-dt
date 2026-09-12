import type { AISettingType } from './aiHelpers';
import { getAISetting, getIsAIEnabled, useAISetting } from './aiHelpers';

// The Anthropic twin of `openAIAvailabilityHelpers`, and for the same reason:
// `anthropicHelpers` imports `@anthropic-ai/sdk` at module scope, so a component
// that only asks whether to DRAW an AI control used to pull that SDK into its
// chunk. Anything that actually calls Anthropic still imports `anthropicHelpers`
// and pays for the SDK there, which is when it is needed.
export const DATA_DIR_NAME = 'ai-anthropic-data';

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
