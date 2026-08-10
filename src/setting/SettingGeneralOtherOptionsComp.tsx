import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';
import { applyStore } from './SettingApplyComp';
import SettingCardHeaderComp from './SettingCardHeaderComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

// `Reset Widgets Size` used to live here. It moved to the native View menu,
// where it applies live instead of waiting for an Apply Settings reload:
// `resize-actor/widgetAppMenuHelpers`.
export default function SettingGeneralOtherOptionsComp() {
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
