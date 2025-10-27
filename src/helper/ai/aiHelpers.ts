import { useState } from 'react';
import { useAppEffect } from '../debuggerHelpers';

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

const AI_SETTING_NAME = 'ai-setting';

export function getAISetting(): AISettingType {
    const settingStr = localStorage.getItem(AI_SETTING_NAME) || '{}';
    try {
        const data = JSON.parse(settingStr);
        data.openAIAPIKey = (data.openAIAPIKey ?? '').trim();
        data.anthropicAPIKey = (data.anthropicAPIKey ?? '').trim();
        if (data.openAIAPIKey.trim().length === 0) {
            data.isAutoPlay = false;
        }
        return data;
    } catch (_error) {
        return {
            openAIAPIKey: '',
            anthropicAPIKey: '',
            isAutoPlay: false,
        };
    }
}
const changingListener = new Set<() => void>();
export function setAISetting(value: AISettingType) {
    localStorage.setItem(AI_SETTING_NAME, JSON.stringify(value));
    for (const listener of changingListener) {
        listener();
    }
}
export function useAISetting() {
    const [setting, setSetting] = useState<AISettingType>(getAISetting());
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
