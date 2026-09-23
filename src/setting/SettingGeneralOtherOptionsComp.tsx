import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';
import { applyStore } from './SettingApplyComp';
import SettingCardHeaderComp from './SettingCardHeaderComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import {
    getAreDailyTipsDisabled,
    setAreDailyTipsEnabled,
} from '../toast/dailyTipSettingHelpers';

// `Reset Widgets Size` used to live here. It moved to the native View menu,
// where it applies live instead of waiting for an Apply Settings reload:
// `resize-actor/widgetAppMenuHelpers`.
export default function SettingGeneralOtherOptionsComp() {
    const [areDailyTipsEnabled, setDailyTipsEnabledState] = useState(
        () => !getAreDailyTipsDisabled(),
    );
    const handleClearSettings = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Clear All Settings'),
            tran('Are you sure you want to clear all settings?'),
        );
        if (!isOk) {
            return;
        }
        await appLocalStorage.clear();
        applyStore.pendingApply();
    }, []);
    return (
        <div className="card m-1">
            <SettingCardHeaderComp
                iconClassName="bi-sliders"
                title="Other General Options"
            />
            <div className="card-body d-grid gap-2">
                <div className="form-check form-switch">
                    <input
                        id="setting-daily-tips-enabled"
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={areDailyTipsEnabled}
                        onChange={(event) => {
                            const isEnabled = event.currentTarget.checked;
                            setAreDailyTipsEnabled(isEnabled);
                            setDailyTipsEnabledState(isEnabled);
                        }}
                    />
                    <label
                        className="form-check-label"
                        htmlFor="setting-daily-tips-enabled"
                    >
                        {tran('Show Tips of the Day automatically')}
                    </label>
                    <div className="form-text">
                        {tran(
                            'Applies to the Presenter and Bible Reader on the next app launch.',
                        )}
                    </div>
                </div>
                <button
                    className="btn btn-outline-danger d-flex align-items-center justify-content-center"
                    title={tran('Clear All Settings')}
                    onClick={handleClearSettings}
                >
                    <i className="bi bi-trash3 me-2" />
                    {tran('Clear All Settings')}
                </button>
            </div>
        </div>
    );
}
