import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { clearWidgetSizeSetting } from '../resize-actor/flexSizeHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';
import { applyStore } from './SettingApplyComp';
import SettingCardHeaderComp from './SettingCardHeaderComp';

export default function SettingGeneralOtherOptionsComp() {
    const handleResetWidgetSize = useCallback(() => {
        clearWidgetSizeSetting();
        applyStore.pendingApply();
    }, []);
    const handleClearSettings = useCallback(async () => {
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
                    className="btn btn-warning d-flex align-items-center justify-content-center"
                    title={tran('Reset Widgets Size')}
                    onClick={handleResetWidgetSize}
                >
                    <i className="bi bi-arrows-angle-expand me-2" />
                    {tran('Reset Widgets Size')}
                </button>
                <hr className="my-1" />
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
