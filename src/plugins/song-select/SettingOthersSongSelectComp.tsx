import { useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { handleError } from '../../helper/errorHelpers';
import type { SongSelectSettingType } from './songSelectSettingHelpers';
import {
    checkIsSongSelectConfigured,
    checkIsSongSelectSignedIn,
    clearSongSelectTokens,
    getSongSelectSetting,
    setSongSelectSetting,
    useSongSelectSetting,
} from './songSelectSettingHelpers';
import {
    disableSongSelectDevMock,
    enableSongSelectDevMock,
} from './songSelectDevMockHelpers';
import appProvider from '../../server/appProvider';
import { showSimpleToast } from '../../toast/toastHelpers';
import { applyStore } from '../../setting/SettingApplyComp';
import SettingOthersFieldComp from '../../setting/SettingOthersFieldComp';
import SettingOthersSecureStorageWarningComp from '../../setting/SettingOthersSecureStorageWarningComp';
import SettingOthersSectionComp from '../../setting/SettingOthersSectionComp';

type CredentialFieldNameType =
    'clientId' | 'clientSecret' | 'subscriptionKey' | 'redirectUri';

function RenderCredentialFieldComp({
    fieldName,
    label,
    hintKey,
    isSecret = false,
}: Readonly<{
    fieldName: CredentialFieldNameType;
    label: string;
    hintKey: string;
    isSecret?: boolean;
}>) {
    const setting = useSongSelectSetting();
    // Written on blur, not per keystroke: every save is a sync IPC round trip
    // to the home storage file.
    const handleSaving = useCallback(
        (value: string) => {
            const setting: SongSelectSettingType = getSongSelectSetting();
            if (setting[fieldName] === value) {
                return;
            }
            setSongSelectSetting({ ...setting, [fieldName]: value });
            // Other windows keep their own in-memory copy of the setting, so
            // they only pick the new value up after a reload.
            applyStore.pendingApply();
        },
        [fieldName],
    );
    return (
        <SettingOthersFieldComp
            label={label}
            hintKey={hintKey}
            value={setting[fieldName]}
            isSecret={isSecret}
            onSave={handleSaving}
        />
    );
}

// The control that changes the row's state sits next to the state itself, so
// the credentials below stay a plain form.
function RenderSignInActionsComp() {
    const setting = useSongSelectSetting();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const isConfigured = checkIsSongSelectConfigured(setting);
    const handleSigningIn = async () => {
        setIsSigningIn(true);
        try {
            const { signInSongSelect, checkIsSignInCanceledError } =
                await import('./songSelectAuthHelpers');
            try {
                await signInSongSelect();
                showSimpleToast(
                    tran('Sign In'),
                    tran('Signed in to SongSelect successfully'),
                );
            } catch (error) {
                handleError(error);
                showSimpleToast(
                    tran('Sign in failed'),
                    tran(
                        checkIsSignInCanceledError(error)
                            ? 'Sign in was canceled'
                            : 'SongSelect request failed',
                    ),
                );
            }
        } finally {
            setIsSigningIn(false);
        }
    };
    const handleSigningOut = () => {
        if (getSongSelectSetting().isDevMock) {
            // Leaving mock mode drops the fake credentials too, back to a
            // clean row.
            disableSongSelectDevMock();
        } else {
            clearSongSelectTokens();
        }
        showSimpleToast(tran('Sign Out'), tran('Signed out from SongSelect'));
    };
    if (checkIsSongSelectSignedIn(setting)) {
        return (
            <>
                {setting.isDevMock ? (
                    <span className="app-setting-others-note text-warning">
                        {tran('(mock)')}
                    </span>
                ) : null}
                <button
                    className="btn btn-sm btn-outline-warning"
                    onClick={handleSigningOut}
                >
                    {tran('Sign Out')}
                </button>
            </>
        );
    }
    return (
        <>
            <button
                className="btn btn-sm btn-primary"
                disabled={!isConfigured || isSigningIn}
                title={
                    isConfigured
                        ? undefined
                        : tran(
                              'Set Client ID, Subscription Key and' +
                                  ' Redirect URI first',
                          )
                }
                onClick={handleSigningIn}
            >
                {isSigningIn ? tran('Signing in...') : tran('Sign In')}
            </button>
            {appProvider.systemUtils.isDev ? (
                <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={isSigningIn}
                    onClick={enableSongSelectDevMock}
                >
                    {tran('(dev) Use Mock Data')}
                </button>
            ) : null}
        </>
    );
}

export default function SettingOthersSongSelectComp() {
    const setting = useSongSelectSetting();
    const isSignedIn = checkIsSongSelectSignedIn(setting);
    const handleOpeningWebsite = useCallback(() => {
        appProvider.browserUtils.openExternalURL('https://songselect.ccli.com');
    }, []);
    return (
        <SettingOthersSectionComp
            iconClassName="bi-music-note-list"
            title="SongSelect Integration"
            description="Import song lyrics from CCLI SongSelect"
            state={isSignedIn ? 'ready' : 'idle'}
            stateLabel={isSignedIn ? 'Signed in' : 'Not signed in'}
            headerActions={
                <>
                    <RenderSignInActionsComp />
                    <button
                        className="btn btn-sm btn-secondary text-nowrap"
                        title={tran('Open CCLI SongSelect website')}
                        onClick={handleOpeningWebsite}
                    >
                        SongSelect
                        <i className="bi bi-box-arrow-up-right ms-1" />
                    </button>
                </>
            }
        >
            <SettingOthersSecureStorageWarningComp />
            <div className="app-setting-others-fields">
                <RenderCredentialFieldComp
                    fieldName="clientId"
                    label="Client ID"
                    hintKey="The OAuth client ID of your CCLI API application"
                />
                <RenderCredentialFieldComp
                    fieldName="clientSecret"
                    label="Client Secret"
                    hintKey="Leave empty for a public client"
                    isSecret
                />
                <RenderCredentialFieldComp
                    fieldName="subscriptionKey"
                    label="Subscription Key"
                    hintKey="The subscription key from the CCLI developer portal"
                    isSecret
                />
                <RenderCredentialFieldComp
                    fieldName="redirectUri"
                    label="Redirect URI"
                    hintKey="Must exactly match the redirect URI registered with CCLI"
                />
            </div>
        </SettingOthersSectionComp>
    );
}
