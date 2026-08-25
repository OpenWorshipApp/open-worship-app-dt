import { useState } from 'react';
import { useAppEffect } from '../appHooks';

import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import bibleCrossRefSchemaJson from './bibleCrossRefSchema.json';
export { bibleCrossRefSchemaJson };

export type RefreshingRefType = {
    refresh: () => void;
};

export type AISettingType = {
    openAIAPIKey: string;
    anthropicAPIKey: string;
    isAutoPlay: boolean;
};

// Non-secret half, readable plaintext on disk.
const AI_SETTING_NAME = 'ai-setting';
// The API keys, encrypted at rest by the OS. Never write them to the plaintext
// store, and never merge the two halves back into one storage key.
const AI_SECRET_SETTING_NAME = 'ai-setting-secret';

function getAISecret() {
    const settingStr = appSecureStorage.getItem(AI_SECRET_SETTING_NAME) || '{}';
    try {
        const data = JSON.parse(settingStr);
        return {
            openAIAPIKey:
                typeof data.openAIAPIKey === 'string'
                    ? data.openAIAPIKey.trim()
                    : '',
            anthropicAPIKey:
                typeof data.anthropicAPIKey === 'string'
                    ? data.anthropicAPIKey.trim()
                    : '',
        };
    } catch (_error) {
        return { openAIAPIKey: '', anthropicAPIKey: '' };
    }
}

/**
 * The non-secret half only. Bible audio checks this once per `<audio>` element
 * mount, and it has no business decrypting the API keys into that renderer just
 * to read a boolean.
 */
export function getAIIsAutoPlay(): boolean {
    const settingStr = appHomeStorage.getItem(AI_SETTING_NAME) || '{}';
    try {
        return JSON.parse(settingStr).isAutoPlay === true;
    } catch (_error) {
        return false;
    }
}

export function getAISetting(): AISettingType {
    const secret = getAISecret();
    return {
        ...secret,
        // Auto play needs the OpenAI key. `setAISetting` already keeps the
        // stored flag in step; this also covers a store edited behind the app.
        isAutoPlay: secret.openAIAPIKey.length > 0 && getAIIsAutoPlay(),
    };
}

const changingListener = new Set<() => void>();
export function setAISetting(value: AISettingType) {
    const openAIAPIKey = (value.openAIAPIKey ?? '').trim();
    const anthropicAPIKey = (value.anthropicAPIKey ?? '').trim();
    appHomeStorage.setItem(
        AI_SETTING_NAME,
        JSON.stringify({
            isAutoPlay: openAIAPIKey.length > 0 && value.isAutoPlay === true,
        }),
    );
    if (openAIAPIKey.length === 0 && anthropicAPIKey.length === 0) {
        // Nothing to protect, so leave no phantom blob behind.
        appSecureStorage.removeItem(AI_SECRET_SETTING_NAME);
    } else {
        appSecureStorage.setItem(
            AI_SECRET_SETTING_NAME,
            JSON.stringify({ openAIAPIKey, anthropicAPIKey }),
        );
    }
    for (const listener of changingListener) {
        listener();
    }
}
export function useAISetting() {
    const [setting, setSetting] = useState<AISettingType>(() => getAISetting());
    useAppEffect(() => {
        const listener = () => {
            setSetting(getAISetting());
        };
        changingListener.add(listener);
        return () => {
            changingListener.delete(listener);
        };
    }, []);
    return setting;
}
