import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import type { AISettingType } from '../helper/ai/aiHelpers';
import {
    getAISetting,
    getIsAIEnabled,
    setAISetting,
    setIsAIEnabled,
    useAISetting,
} from '../helper/ai/aiHelpers';
import appProvider from '../server/appProvider';
import { applyStore } from './SettingApplyComp';
import SettingOthersFieldComp from './SettingOthersFieldComp';
import SettingOthersSecureStorageWarningComp from './SettingOthersSecureStorageWarningComp';
import SettingOthersSectionComp from './SettingOthersSectionComp';

type APIKeyNameType = 'openAIAPIKey' | 'anthropicAPIKey';

/**
 * Every value on this row is something the operator has to go and FETCH from a
 * provider's console, so the button that takes them there is the same shape
 * wherever it appears and lives once.
 */
function RenderOpenPageButtonComp({
    labelKey,
    titleKey,
    url,
}: Readonly<{
    labelKey: string;
    titleKey: string;
    url: string;
}>) {
    const handleOpeningPage = useCallback(() => {
        appProvider.browserUtils.openExternalURL(url);
    }, [url]);
    return (
        <button
            className="btn btn-sm btn-secondary text-nowrap"
            type="button"
            title={tran(titleKey)}
            onClick={handleOpeningPage}
        >
            {tran(labelKey)}
            <i className="bi bi-box-arrow-up-right ms-1" />
        </button>
    );
}

/**
 * One provider's fields fenced off as a unit. The Anthropic key and the
 * workspace it acts in are a PAIR; laid out as loose siblings of OpenAI's key
 * they wrapped onto the next row, so the workspace id read as if it belonged
 * to whichever field happened to sit above it.
 */
function RenderProviderGroupComp({
    title,
    children,
}: Readonly<{
    title: string;
    children: ReactNode;
}>) {
    return (
        <div className="app-setting-others-group">
            <span className="app-setting-others-group-title">{title}</span>
            <div className="app-setting-others-group-fields">{children}</div>
        </div>
    );
}

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
    return (
        <SettingOthersFieldComp
            label={label}
            hintKey={hintKey}
            value={aiSetting[keyName]}
            isSecret
            onSave={handleSaving}
        >
            <RenderOpenPageButtonComp
                labelKey="Get key"
                titleKey={createKeyTitleKey}
                url={createKeyURL}
            />
        </SettingOthersFieldComp>
    );
}

/**
 * Only needed for an identity-linked Anthropic key, which the API rejects
 * without the workspace it acts in. An id, not a credential, so it is a plain
 * field in the plaintext half of the setting.
 */
function RenderWorkspaceIdComp() {
    const aiSetting = useAISetting();
    const handleSaving = useCallback((value: string) => {
        const setting: AISettingType = getAISetting();
        if (setting.anthropicWorkspaceId === value) {
            return;
        }
        setAISetting({ ...setting, anthropicWorkspaceId: value });
        applyStore.pendingApply();
    }, []);
    return (
        <SettingOthersFieldComp
            label="Anthropic Workspace ID"
            hintKey="Only needed if your Anthropic key is identity-linked"
            value={aiSetting.anthropicWorkspaceId}
            onSave={handleSaving}
        >
            <RenderOpenPageButtonComp
                labelKey="Get ID"
                titleKey="Find Anthropic workspace id"
                url="https://console.anthropic.com/settings/workspaces"
            />
        </SettingOthersFieldComp>
    );
}

/**
 * The master switch. Everything AI-shaped is decided at LAUNCH -- the main
 * process reads this before `ready` to know whether to open the debugging
 * endpoint and serve `owa-devtools-mcp` at all -- so turning it off can only
 * take effect on the next start. That is the point of it: an operator on a
 * low-spec machine gets a process with none of it loaded.
 */
function RenderAIEnabledComp() {
    const [isEnabled, setIsEnabled] = useState(() => {
        return getIsAIEnabled();
    });
    const [isRestartNeeded, setIsRestartNeeded] = useState(false);
    const handleToggling = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const isChecked = event.target.checked;
            setIsAIEnabled(isChecked);
            setIsEnabled(isChecked);
            setIsRestartNeeded(true);
        },
        [],
    );
    return (
        <div className="app-setting-others-field">
            <div className="form-check form-switch m-0">
                <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="app-ai-enabled"
                    checked={isEnabled}
                    onChange={handleToggling}
                />
                <label className="form-check-label" htmlFor="app-ai-enabled">
                    {tran('Enable AI features')}
                    <i
                        className="bi bi-info-circle app-setting-others-hint"
                        title={tran(
                            'Turns off the chatbot, the assistant tools and ' +
                                'the debugging endpoint they use.',
                        )}
                    />
                </label>
            </div>
            {isRestartNeeded ? (
                <span className="app-data">
                    {tran('Restart the app to apply')}
                </span>
            ) : null}
        </div>
    );
}

export default function SettingOthersAIComp() {
    const aiSetting = useAISetting();
    const isEnabled = getIsAIEnabled();
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
            state={!isEnabled ? 'idle' : isAnyKeySet ? 'ready' : 'idle'}
            stateLabel={
                !isEnabled
                    ? 'Turned off'
                    : isAnyKeySet
                      ? 'Key set'
                      : 'No key set'
            }
        >
            <SettingOthersSecureStorageWarningComp />
            <div className="app-setting-others-fields">
                <RenderAIEnabledComp />
            </div>
            <div className="app-setting-others-groups">
                <RenderProviderGroupComp title="OpenAI">
                    <RenderAPIKeyComp
                        keyName="openAIAPIKey"
                        label="OpenAI API Key"
                        hintKey="This key will be used in custom Bible Cross Ref and Bible Audio"
                        createKeyTitleKey="Create OpenAI api key"
                        createKeyURL="https://platform.openai.com/api-keys"
                    />
                </RenderProviderGroupComp>
                <RenderProviderGroupComp title="Anthropic">
                    <RenderAPIKeyComp
                        keyName="anthropicAPIKey"
                        label="Anthropic API Key"
                        hintKey="This key will be used in custom Bible Cross Ref"
                        createKeyTitleKey="Create Anthropic api key"
                        createKeyURL="https://console.anthropic.com/settings/keys"
                    />
                    <RenderWorkspaceIdComp />
                </RenderProviderGroupComp>
            </div>
        </SettingOthersSectionComp>
    );
}
