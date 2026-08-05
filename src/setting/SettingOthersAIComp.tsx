import type { FocusEvent } from 'react';
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
import SettingCardHeaderComp from './SettingCardHeaderComp';

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
        (event: FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
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
        <div className="d-flex flex-column w-100">
            <div>
                {label}{' '}
                <i
                    className="bi bi-lightbulb"
                    title={tran(hintKey)}
                    style={{
                        color: 'var(--bs-info-text-emphasis)',
                    }}
                />
                {aiSetting[keyName] ? (
                    <i className="bi bi-check-circle-fill ms-1 text-success" />
                ) : null}
                :
            </div>
            <div className="d-flex align-items-center">
                <input
                    className="form-control form-control-sm flex-fill me-2"
                    type="text"
                    defaultValue={aiSetting[keyName]}
                    onBlur={handleSaving}
                />
                <button
                    className="btn btn-sm btn-secondary text-nowrap"
                    title={tran(createKeyTitleKey)}
                    onClick={handleOpeningAPIKeyPage}
                >
                    API Key <i className="bi bi-box-arrow-up-right ms-1" />
                </button>
            </div>
        </div>
    );
}

export default function SettingOthersAIComp() {
    return (
        <div className="card m-1">
            <SettingCardHeaderComp
                iconClassName="bi-robot"
                title="Set AI API Key"
            />
            <div className="card-body">
                <RenderAPIKeyComp
                    keyName="openAIAPIKey"
                    label="OpenAI API Key"
                    hintKey="This key will be used in custom Bible Cross Ref and Bible Audio"
                    createKeyTitleKey="Create OpenAI api key"
                    createKeyURL="https://platform.openai.com/api-keys"
                />
                <hr />
                <RenderAPIKeyComp
                    keyName="anthropicAPIKey"
                    label="Anthropic API Key"
                    hintKey="This key will be used in custom Bible Cross Ref"
                    createKeyTitleKey="Create Anthropic api key"
                    createKeyURL="https://console.anthropic.com/settings/keys"
                />
            </div>
        </div>
    );
}
