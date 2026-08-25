import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import type { AISettingType } from '../helper/ai/aiHelpers';
import {
    getAISetting,
    setAISetting,
    useAISetting,
} from '../helper/ai/aiHelpers';
import appProvider from '../server/appProvider';
import { applyStore } from './SettingApplyComp';
import SettingOthersFieldComp from './SettingOthersFieldComp';
import SettingOthersSecureStorageWarningComp from './SettingOthersSecureStorageWarningComp';
import SettingOthersSectionComp from './SettingOthersSectionComp';

type APIKeyNameType = 'openAIAPIKey' | 'anthropicAPIKey';

function RenderAPIKeyComp({
    keyName,
    label,
    hintKey,
    createKeyTitleKey,
    createKeyURL,
}: Readonly<{
    keyName: APIKeyNameType;
    label: string;
    hintKey: string;
    createKeyTitleKey: string;
    createKeyURL: string;
}>) {
    const aiSetting = useAISetting();
    // Written on blur, not per keystroke: every save is a sync IPC round trip
    // to the home storage file.
    const handleSaving = useCallback(
        (value: string) => {
            const setting: AISettingType = getAISetting();
            if (setting[keyName] === value) {
                return;
            }
            setAISetting({ ...setting, [keyName]: value });
            // Other windows keep their own in-memory copy of the AI setting,
            // so they only pick the new key up after a reload.
            applyStore.pendingApply();
        },
        [keyName],
    );
    const handleOpeningAPIKeyPage = useCallback(() => {
        appProvider.browserUtils.openExternalURL(createKeyURL);
    }, [createKeyURL]);
    return (
        <SettingOthersFieldComp
            label={label}
            hintKey={hintKey}
            value={aiSetting[keyName]}
            isSecret
            onSave={handleSaving}
        >
            <button
                className="btn btn-sm btn-secondary text-nowrap"
                type="button"
                title={tran(createKeyTitleKey)}
                onClick={handleOpeningAPIKeyPage}
            >
                {tran('Get key')}
                <i className="bi bi-box-arrow-up-right ms-1" />
            </button>
        </SettingOthersFieldComp>
    );
}

export default function SettingOthersAIComp() {
    const aiSetting = useAISetting();
    // Either provider on its own is enough to make the features work, so one
    // key is a working row.
    const isAnyKeySet = !!aiSetting.openAIAPIKey || !!aiSetting.anthropicAPIKey;
    return (
        <SettingOthersSectionComp
            iconClassName="bi-robot"
            title="AI Providers"
            description={
                'Add a key from either provider to use custom Bible Cross Ref' +
                ' and Bible Audio.'
            }
            state={isAnyKeySet ? 'ready' : 'idle'}
            stateLabel={isAnyKeySet ? 'Key set' : 'No key set'}
        >
            <SettingOthersSecureStorageWarningComp />
            <div className="app-setting-others-fields">
                <RenderAPIKeyComp
                    keyName="openAIAPIKey"
                    label="OpenAI API Key"
                    hintKey="This key will be used in custom Bible Cross Ref and Bible Audio"
                    createKeyTitleKey="Create OpenAI api key"
                    createKeyURL="https://platform.openai.com/api-keys"
                />
                <RenderAPIKeyComp
                    keyName="anthropicAPIKey"
                    label="Anthropic API Key"
                    hintKey="This key will be used in custom Bible Cross Ref"
                    createKeyTitleKey="Create Anthropic api key"
                    createKeyURL="https://console.anthropic.com/settings/keys"
                />
            </div>
        </SettingOthersSectionComp>
    );
}
