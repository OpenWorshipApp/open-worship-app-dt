import './SettingComp.scss';

import { lazy } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    getAIKeyFocusRequest,
    takeAIKeyFocusRequest,
} from '../helper/ai/aiKeyFocusHelpers';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { SETTING_SETTING_NAME, takeSettingTabRequest } from './settingHelpers';
import SettingApplyComp from './SettingApplyComp';
import { toIconedLabel } from '../others/labelIconHelpers';
import { warnIfAnyBibleEditorDirty } from './bible-setting/bibleEditorDirtyHelpers';

const LazySettingGeneralComp = lazy(() => {
    return import('./SettingGeneralComp');
});
const LazySettingBibleComp = lazy(() => {
    return import('./bible-setting/SettingBibleComp');
});
const LazySettingOthersComp = lazy(() => {
    return import('./SettingOthersComp');
});

// Label KEYS, translated in render: `toIconedLabel` calls `tran()`, and
// called here at import it froze the tabs in whatever language was in force
// when this module first loaded (and throws in dev before language data is in).
const tabTypeList = [
    ['g', 'General', LazySettingGeneralComp],
    ['b', 'Bible', LazySettingBibleComp],
    ['o', 'Others', LazySettingOthersComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
// The tab holding the AI keys.
const OTHERS_TAB_KEY: TabKeyType = 'o';

export default function SettingComp() {
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        SETTING_SETTING_NAME,
        'g',
    );
    // Says whether the tab changed, for the focus handler below.
    const handleSettingTab = (key: TabKeyType) => {
        // Leaving the Bible tab unmounts its editors, which would silently
        // discard any unsaved changes.
        if (
            warnIfAnyBibleEditorDirty(
                'Save or discard unsaved Bible changes before switching tabs.',
            )
        ) {
            return false;
        }
        setTabKey(key);
        return true;
    };
    const handleSettingTabRef = useAppCurrentRef(handleSettingTab);
    const tabKeyRef = useAppCurrentRef(tabKey);
    // Another window can ask this one to show a particular tab. A newly opened
    // Settings window reads `setting-tabs` while mounting; one that was open
    // all along is only RAISED, and the raise is the focus this listens for.
    // AI-key requests use the same focus event, then remain stored for the AI
    // panel itself to take once Others is showing.
    useAppEffect(() => {
        const handleFocusing = () => {
            let currentTab = tabKeyRef.current;
            const requestedTab = takeSettingTabRequest();
            if (requestedTab !== null && requestedTab !== currentTab) {
                if (!handleSettingTabRef.current(requestedTab)) {
                    // The request was written before this already-open window
                    // could apply its dirty-editor guard. Keep the persisted
                    // tab aligned with the tab that safely remained visible.
                    setSetting(SETTING_SETTING_NAME, currentTab);
                    if (getAIKeyFocusRequest() !== null) {
                        takeAIKeyFocusRequest();
                    }
                    return;
                }
                currentTab = requestedTab;
            }
            if (
                currentTab === OTHERS_TAB_KEY ||
                getAIKeyFocusRequest() === null
            ) {
                return;
            }
            if (!handleSettingTabRef.current(OTHERS_TAB_KEY)) {
                // Refused over unsaved Bible changes, and the warning says so.
                // Dropped, or every click back into this window would ask
                // again for the next half minute.
                takeAIKeyFocusRequest();
            }
        };
        window.addEventListener('focus', handleFocusing);
        return () => {
            window.removeEventListener('focus', handleFocusing);
        };
    }, []);
    return (
        <div
            id="app-setting"
            className="card flex-row w-100 h-100 app-overflow-hidden app-zero-border-radius"
        >
            <div className="app-setting-sidebar d-flex flex-column p-1">
                <TabRenderComp<TabKeyType>
                    isVertical
                    className="app-setting-nav flex-grow-1"
                    tabs={tabTypeList.map(([key, labelKey]) => {
                        return {
                            key,
                            title: toIconedLabel(labelKey),
                        };
                    })}
                    activeTabs={[tabKey]}
                    setActiveTab={handleSettingTab}
                />
                <div className="app-setting-apply mt-1 pt-1">
                    <SettingApplyComp />
                </div>
            </div>
            <div className="card-body app-overflow-hidden p-0">
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
            </div>
        </div>
    );
}
