import Anthropic from '@anthropic-ai/sdk';
import { getAISetting } from './aiHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

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
