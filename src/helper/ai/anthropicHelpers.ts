import Anthropic from '@anthropic-ai/sdk';
import { getAISetting, useAISetting } from './aiHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

export const DATA_DIR_NAME = 'ai-anthropic-data';

let instance: Anthropic | null = null;
let key: string | null = null;
export function getAnthropicInstance() {
    const { anthropicAPIKey } = getAISetting();
    if (!anthropicAPIKey) {
        showSimpleToast(
            'Fail to get Anthropic instance',
            'Missing Anthropic API Key.',
        );
        return null;
    }
    if (instance !== null && key === anthropicAPIKey) {
        return instance;
    }
    key = anthropicAPIKey;
    instance = new Anthropic({
        apiKey: anthropicAPIKey,
        dangerouslyAllowBrowser: true,
    });
    return instance;
}

export function useAvailable() {
    const aiSetting = useAISetting();
    return aiSetting.anthropicAPIKey.trim().length > 0;
}
