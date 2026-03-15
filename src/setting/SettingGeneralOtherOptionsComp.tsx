import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { clearWidgetSizeSetting } from '../resize-actor/flexSizeHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';
import { applyStore } from './SettingApplyComp';

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
            <div className="card-header">{tran('Other General Options')}</div>
            <div className="card-body">
                <div className="m-2">
                    <button
                        className="btn btn-warning"
                        onClick={handleResetWidgetSize}
                    >
                        {tran('Reset Widgets Size')}
                    </button>
                </div>
                <div className="m-2 p-2">
                    <button
                        className="btn btn-danger"
                        onClick={handleClearSettings}
                    >
                        {tran('Clear All Settings')}
                    </button>
                </div>
            </div>
        </div>
    );
}
