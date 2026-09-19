import OpenAI from 'openai';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';

import { getAISetting, getIsAIEnabled } from './aiHelpers';

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

// Re-exported so existing callers keep one import site. Import them from
// `openAIAvailabilityHelpers` DIRECTLY in anything that merely draws a control:
// reaching them through this module pulls the `openai` SDK into that chunk.
export {
    checkIsAvailable,
    DATA_DIR_NAME,
    useAvailable,
} from './openAIAvailabilityHelpers';
