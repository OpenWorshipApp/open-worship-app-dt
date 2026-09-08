import { useState } from 'react';
import { useAppEffect } from '../appHooks';

import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import appProvider from '../../server/appProvider';
import bibleCrossRefSchemaJson from './bibleCrossRefSchema.json';
export { bibleCrossRefSchemaJson };

export type RefreshingRefType = {
    refresh: () => void;
};

/**
 * The credential fields, named once. Every provider that can be switched on in
 * the chatbot names its field from this union, and so does the settings panel
 * that types the key in -- a provider given a switch but no field to fill it
 * from is then a build failure rather than a button that can only fail.
 *
 * NOT `keyof AISettingType`: that includes the booleans and the workspace id,
 * and these are the ones a key is read out of.
 */
export type AISecretKeyNameType =
    'openAIAPIKey' | 'anthropicAPIKey' | 'kimiAPIKey';

export type AISettingType = {
    openAIAPIKey: string;
    anthropicAPIKey: string;
    // Kimi (Moonshot) answers in the chatbot only -- Bible Cross Ref and Bible
    // Audio are bound to their own SDKs and have no reason to learn about it.
    kimiAPIKey: string;
    // Required by Anthropic when the key is identity-linked ("anthropic-
    // workspace-id is required ..." 400); ignored otherwise. Not a secret --
    // it is an id, not a credential -- so it lives in the plaintext half.
    anthropicWorkspaceId: string;
    isAutoPlay: boolean;
};

// Non-secret half, readable plaintext on disk.
const AI_SETTING_NAME = 'ai-setting';
/**
 * The master switch, read by the MAIN process before `ready`
 * (`checkIsAiEnabled` in `electron/aiHelpers.ts`) -- which is why it is its own
 * key in the same store rather than a field inside `ai-setting`, and why
 * turning it off only takes effect on the next launch: a running process
 * cannot un-import what it already loaded, and not loading it is the whole
 * point on a low-spec machine.
 */
const AI_ENABLED_SETTING_NAME = 'ai-enabled';
// The API keys, encrypted at rest by the OS. Never write them to the plaintext
// store, and never merge the two halves back into one storage key.
const AI_SECRET_SETTING_NAME = 'ai-setting-secret';

function toStoredKey(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function getAISecret(): Record<AISecretKeyNameType, string> {
    const settingStr = appSecureStorage.getItem(AI_SECRET_SETTING_NAME) || '{}';
    try {
        const data = JSON.parse(settingStr);
        return {
            openAIAPIKey: toStoredKey(data.openAIAPIKey),
            anthropicAPIKey: toStoredKey(data.anthropicAPIKey),
            kimiAPIKey: toStoredKey(data.kimiAPIKey),
        };
    } catch (_error) {
        // Every field, not just the ones that existed when this was written:
        // a blob that failed to parse must still answer the same shape, or a
        // provider added later reads `undefined` here and nowhere else.
        return { openAIAPIKey: '', anthropicAPIKey: '', kimiAPIKey: '' };
    }
}

/**
 * The non-secret half only. Bible audio checks this once per `<audio>` element
 * mount, and it has no business decrypting the API keys into that renderer just
 * to read a boolean.
 */
export function getAnthropicWorkspaceId(): string {
    const settingStr = appHomeStorage.getItem(AI_SETTING_NAME) || '{}';
    try {
        const value = JSON.parse(settingStr).anthropicWorkspaceId;
        return typeof value === 'string' ? value.trim() : '';
    } catch (_error) {
        return '';
    }
}

export function getAIIsAutoPlay(): boolean {
    if (!getIsAIEnabled()) {
        return false;
    }
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
        anthropicWorkspaceId: getAnthropicWorkspaceId(),
        // Auto play needs the OpenAI key. `setAISetting` already keeps the
        // stored flag in step; this also covers a store edited behind the app.
        isAutoPlay: secret.openAIAPIKey.length > 0 && getAIIsAutoPlay(),
    };
}

const changingListener = new Set<() => void>();

/**
 * MUST agree with `checkIsAiEnabled` in `electron/aiHelpers.ts`, which reads
 * the same key off disk before `ready`. The main process decides there whether
 * the CDP endpoint and the MCP host open at all; if this half disagreed, a
 * packaged install would show a ticked switch, a chatbot button and a provider
 * the window can hand out -- over a process that opened neither door.
 *
 * Off unless asked for, except in dev. See the note on the main-process twin
 * for why: those doors drive a renderer with node integration.
 */
export function getIsAIEnabled(): boolean {
    const value = appHomeStorage.getItem(AI_ENABLED_SETTING_NAME);
    if (value !== 'true' && value !== 'false') {
        return appProvider.systemUtils.isDev;
    }
    return value === 'true';
}

export function setIsAIEnabled(isEnabled: boolean) {
    appHomeStorage.setItem(
        AI_ENABLED_SETTING_NAME,
        isEnabled ? 'true' : 'false',
    );
    for (const listener of changingListener) {
        listener();
    }
}
export function setAISetting(value: AISettingType) {
    const openAIAPIKey = (value.openAIAPIKey ?? '').trim();
    appHomeStorage.setItem(
        AI_SETTING_NAME,
        JSON.stringify({
            isAutoPlay: openAIAPIKey.length > 0 && value.isAutoPlay === true,
            anthropicWorkspaceId: (value.anthropicWorkspaceId ?? '').trim(),
        }),
    );
    // Built as ONE object and then asked whether it holds anything, rather
    // than re-listing the fields in a condition and again in the write. Listed
    // twice, a key added later is dropped by whichever copy was not updated --
    // and the "nothing to protect" branch would then fire on the very save
    // that stores it, deleting the blob it was about to write. The user types
    // a good key, tabs out of the field, and nothing happens at all.
    const secret: Record<AISecretKeyNameType, string> = {
        openAIAPIKey,
        anthropicAPIKey: (value.anthropicAPIKey ?? '').trim(),
        kimiAPIKey: (value.kimiAPIKey ?? '').trim(),
    };
    const isAnyKeySet = Object.values(secret).some((one) => {
        return one.length > 0;
    });
    if (!isAnyKeySet) {
        // Nothing to protect, so leave no phantom blob behind.
        appSecureStorage.removeItem(AI_SECRET_SETTING_NAME);
    } else {
        appSecureStorage.setItem(
            AI_SECRET_SETTING_NAME,
            JSON.stringify(secret),
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
