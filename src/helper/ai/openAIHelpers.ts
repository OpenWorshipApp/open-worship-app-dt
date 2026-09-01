import OpenAI from 'openai';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';

import { getAISetting, getIsAIEnabled, useAISetting } from './aiHelpers';

export type AISettingType = {
    openAIAPIKey: string;
    anthropicAPIKey: string;
    isAutoPlay: boolean;
};

export const DATA_DIR_NAME = 'ai-openai-data';

let instance: OpenAI | null = null;
let key: string | null = null;
export function getOpenAIInstance() {
    const { openAIAPIKey } = getAISetting();
    // The master switch in Settings > Others turns every AI feature off,
    // stored keys or not -- and says so. Blaming a missing key sends the user
    // to re-enter one that is already there.
    if (!getIsAIEnabled()) {
        showSimpleToast(
            tran('Fail to get OpenAI instance'),
            tran('AI features are turned off in Settings.'),
        );
        return null;
    }
    if (!openAIAPIKey) {
        showSimpleToast(
            tran('Fail to get OpenAI instance'),
            tran('Missing OpenAI API Key.'),
        );
        return null;
    }
    if (instance !== null && key === openAIAPIKey) {
        return instance;
    }
    key = openAIAPIKey;
    instance = new OpenAI({
        apiKey: openAIAPIKey,
        dangerouslyAllowBrowser: true,
    });
    return instance;
}

export function checkIsAvailable(aiSetting?: AISettingType) {
    const setting = aiSetting ?? getAISetting();
    return getIsAIEnabled() && setting.openAIAPIKey.trim().length > 0;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return checkIsAvailable(aiSetting);
}
