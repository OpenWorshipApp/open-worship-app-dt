import { useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { forceReloadAppWindows } from './settingHelpers';

export const applyStore = {
    pendingApply: () => {},
};

export default function SettingApplyComp() {
    const [isApplied, setIsApplied] = useState(true);
    useAppEffect(() => {
        applyStore.pendingApply = () => {
            setIsApplied(false);
        };
        return () => {
            applyStore.pendingApply = () => {};
        };
    }, []);
    return (
        <button
            className={`btn btn-sm btn-outline-${isApplied ? 'success' : 'warning'} mx-2`}
            title={tran('Will reload the app to apply settings')}
            onClick={() => {
                forceReloadAppWindows();
            }}
        >
            {tran('Apply Settings') + ' '}
            <i className={`bi bi-${isApplied ? 'check' : 'asterisk'}`} />
        </button>
    );
}
