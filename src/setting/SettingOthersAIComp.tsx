import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import type {
    AISecretKeyNameType,
    AISettingType,
} from '../helper/ai/aiHelpers';
import {
    getAISetting,
    getIsAIEnabled,
    setAISetting,
    setIsAIEnabled,
    useAISetting,
} from '../helper/ai/aiHelpers';
import appProvider from '../server/appProvider';
import { FREE_SERVICE_MAP } from '../helper/ai/freeHelpers';
// The provider console pages, declared once (the help window opens the same
// ones under a "could not answer" note) so the two cannot drift apart.
import { PAID_PROVIDER_PAGE_MAP } from '../chatbot/providerIssueHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { applyStore } from './SettingApplyComp';
import { relaunchApp } from './settingHelpers';
import SettingOthersFieldComp from './SettingOthersFieldComp';
import SettingOthersSecureStorageWarningComp from './SettingOthersSecureStorageWarningComp';
import SettingOthersSectionComp from './SettingOthersSectionComp';

/**
 * What a key actually buys, named where the operator is typing it in. It used
 * to live only in the hover on the little "i", and both hovers were WRONG --
 * they named Bible Cross Ref and Bible Audio and omitted the chatbot, which
 * both keys had been driving for a while. With a third key that answers in the
 * chatbot and nowhere else, "which of these does what" stopped being a detail.
 */
const USE_CHATBOT = 'Chatbot';
const USE_CROSS_REF = 'Bible Cross Reference';
const USE_AUDIO = 'Bible Audio';

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
    usedForList,
    children,
}: Readonly<{
    title: string;
    usedForList: string[];
    children: ReactNode;
}>) {
    return (
        <div className="app-setting-others-group">
            <span className="app-setting-others-group-title">{title}</span>
            <div
                className="app-setting-others-group-uses"
                // One label for the row, so a screen reader does not read
                // three loose words after the provider's name.
                aria-label={`${title}: ${tran('Used by')}`}
            >
                <span className="app-setting-others-group-uses-label">
                    {tran('Used by')}
                </span>
                {usedForList.map((usedFor) => {
                    return (
                        <span
                            key={usedFor}
                            className="app-setting-others-group-use"
                        >
                            {tran(usedFor)}
                        </span>
                    );
                })}
            </div>
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
    keyName: AISecretKeyNameType;
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
                url={PAID_PROVIDER_PAGE_MAP.anthropic.workspaces ?? ''}
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
    // Asked first, because this closes every window in the app: whatever is
    // half-typed in the slide editor or on a screen goes with it.
    const handleRestarting = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Restart the app to apply'),
            tran('The app will close and open again. Save your work first.'),
            {
                cancelButtonLabel: 'No',
                confirmButtonLabel: 'Yes',
            },
        );
        if (isOk) {
            relaunchApp();
        }
    }, []);
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
            {/* Said whether or not the switch has just been touched. This one
                setting is read before the app opens a window, so an operator
                who ticks it and then goes looking for the assistant is looking
                for something this process was never started with -- and the
                Apply Settings button, which reloads the renderers, cannot get
                it either. The button beside it is the only way to apply it. */}
            <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                <span
                    className={
                        'app-data' + (isRestartNeeded ? ' text-warning' : '')
                    }
                >
                    {tran('Restart the app to apply')}
                </span>
                <button
                    className={
                        'btn btn-sm ' +
                        (isRestartNeeded
                            ? 'btn-warning'
                            : 'btn-outline-secondary')
                    }
                    type="button"
                    title={tran('Restart the app to apply')}
                    onClick={handleRestarting}
                >
                    <i className="bi bi-arrow-clockwise me-1" />
                    {tran('Restart Now')}
                </button>
            </div>
        </div>
    );
}

/**
 * One free service, as a link to its own site.
 *
 * Deliberately NOT `RenderOpenPageButtonComp`, which puts its label and title
 * through `tran()`: a company name and a URL are not translatable strings, and
 * `tran()` THROWS on a missing key in dev, so reusing that component here would
 * blank the whole Settings page the moment the app was run in Khmer. Nothing
 * inside this button is translated, because nothing inside it is language.
 */
function RenderServiceLinkComp({
    label,
    url,
}: Readonly<{ label: string; url: string }>) {
    const handleOpeningPage = useCallback(() => {
        appProvider.browserUtils.openExternalURL(url);
    }, [url]);
    return (
        <button
            className="btn btn-sm btn-outline-secondary text-nowrap"
            type="button"
            title={url}
            onClick={handleOpeningPage}
        >
            {label}
            <i className="bi bi-box-arrow-up-right ms-1" />
        </button>
    );
}

/**
 * What happens when none of the rows above is filled in.
 *
 * Shown ONLY in that state, and only while AI is switched on -- it describes a
 * fallback that is running right now, not a feature to go and find. With a key
 * set it would be describing something that no longer applies, and a settings
 * panel that explains inapplicable things is how a panel stops being read.
 *
 * The chatbot window says the same thing above every keyless conversation. It
 * is repeated here because this is the panel a user reaches when they decide to
 * do something about it, and arriving to no mention of the thing they came to
 * change reads as having come to the wrong place.
 */
function RenderFreeFallbackComp() {
    return (
        <div className="app-setting-others-fields">
            <div className="alert alert-warning py-2 px-3 mb-0">
                <div className="fw-semibold">
                    <i className="bi bi-exclamation-triangle me-2" />
                    {tran('Free assistant (no key needed)')}
                </div>
                <div className="app-data small mt-1">
                    {tran(
                        'With no key of your own, the chatbot answers through' +
                            ' free public AI services. They are shared,' +
                            ' slower, and can be busy, and your questions' +
                            ' leave this computer. Add a key above for better' +
                            ' and more private answers.',
                    )}
                </div>
                {/* WHICH services, with a way to go and read their terms. The
                    rows above all send the user off to make an account and
                    can name the site they are going to; this one does not,
                    which makes it the row where an unnamed third party would
                    otherwise be the thing being agreed to. Taken from the same
                    map the chatbot asks, so the two disclosures cannot come to
                    name different companies. */}
                <div className="d-flex flex-wrap gap-2 mt-2">
                    {Object.values(FREE_SERVICE_MAP).map((service) => {
                        return (
                            <RenderServiceLinkComp
                                key={service.homeUrl}
                                label={service.label}
                                url={service.homeUrl}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function SettingOthersAIComp() {
    const aiSetting = useAISetting();
    const isEnabled = getIsAIEnabled();
    // Either provider on its own is enough to make the features work, so one
    // key is a working row.
    const isAnyKeySet =
        !!aiSetting.openAIAPIKey ||
        !!aiSetting.anthropicAPIKey ||
        !!aiSetting.kimiAPIKey;
    return (
        <SettingOthersSectionComp
            iconClassName="bi-robot"
            title="AI Providers"
            description={
                'Add a key from any one of these. Each row says what its' +
                ' key is used for.'
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
                <RenderProviderGroupComp
                    title="OpenAI"
                    usedForList={[USE_CHATBOT, USE_CROSS_REF, USE_AUDIO]}
                >
                    <RenderAPIKeyComp
                        keyName="openAIAPIKey"
                        label="OpenAI API Key"
                        hintKey="Answers in the chatbot, and powers custom Bible Cross Reference and Bible Audio"
                        createKeyTitleKey="Create OpenAI api key"
                        createKeyURL={PAID_PROVIDER_PAGE_MAP.openai.keys}
                    />
                </RenderProviderGroupComp>
                <RenderProviderGroupComp
                    title="Anthropic"
                    usedForList={[USE_CHATBOT, USE_CROSS_REF]}
                >
                    <RenderAPIKeyComp
                        keyName="anthropicAPIKey"
                        label="Anthropic API Key"
                        hintKey="Answers in the chatbot, and powers custom Bible Cross Reference"
                        createKeyTitleKey="Create Anthropic api key"
                        createKeyURL={PAID_PROVIDER_PAGE_MAP.anthropic.keys}
                    />
                    <RenderWorkspaceIdComp />
                </RenderProviderGroupComp>
                <RenderProviderGroupComp
                    title="Kimi"
                    usedForList={[USE_CHATBOT]}
                >
                    <RenderAPIKeyComp
                        keyName="kimiAPIKey"
                        label="Kimi API Key"
                        hintKey="Answers in the chatbot only"
                        createKeyTitleKey="Create Kimi api key"
                        createKeyURL={PAID_PROVIDER_PAGE_MAP.kimi.keys}
                    />
                </RenderProviderGroupComp>
            </div>
            {isEnabled && !isAnyKeySet ? <RenderFreeFallbackComp /> : null}
        </SettingOthersSectionComp>
    );
}
