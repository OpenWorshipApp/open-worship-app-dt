import Anthropic from '@anthropic-ai/sdk';
import { getAISetting, getIsAIEnabled } from './aiHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';

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

// Re-exported so existing callers keep one import site. Import them from
// `anthropicAvailabilityHelpers` DIRECTLY in anything that merely draws a
// control: reaching them through this module pulls the SDK into that chunk.
export {
    checkIsAvailable,
    DATA_DIR_NAME,
    useAvailable,
} from './anthropicAvailabilityHelpers';
