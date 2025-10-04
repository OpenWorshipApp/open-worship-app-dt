import OpenAI from 'openai';
import { showSimpleToast } from '../../toast/toastHelpers';

import { getAISetting, useAISetting } from './aiHelpers';

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
    if (!openAIAPIKey) {
        showSimpleToast(
            'Fail to get OpenAI instance',
            'Missing OpenAI API Key.',
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
    return setting.openAIAPIKey.trim().length > 0;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return checkIsAvailable(aiSetting);
}
