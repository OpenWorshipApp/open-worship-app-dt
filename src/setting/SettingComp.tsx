import './SettingComp.scss';

import { lazy } from 'react';

import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { SETTING_SETTING_NAME } from './settingHelpers';
import SettingApplyComp from './SettingApplyComp';
import { tran } from '../lang/langHelpers';
import { warnIfAnyBibleEditorDirty } from './bible-setting/bibleEditorDirtyHelpers';

const LazySettingGeneralComp = lazy(() => {
    return import('./SettingGeneralComp');
});
const LazySettingBibleComp = lazy(() => {
    return import('./bible-setting/SettingBibleComp');
});

const tabTypeList = [
    ['g', tran('General'), LazySettingGeneralComp],
    ['b', tran('Bible'), LazySettingBibleComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function SettingComp() {
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        SETTING_SETTING_NAME,
        'g',
    );
    const handleSettingTab = (key: TabKeyType) => {
        // Leaving the Bible tab unmounts its editors, which would silently
        // discard any unsaved changes.
        if (
            warnIfAnyBibleEditorDirty(
                'Save or discard unsaved Bible changes before switching tabs.',
            )
        ) {
            return;
        }
        setTabKey(key);
    };
    return (
        <div
            id="app-setting"
            className="card flex-row w-100 h-100 app-overflow-hidden app-zero-border-radius"
        >
            <div className="app-setting-sidebar d-flex flex-column p-1">
                <TabRenderComp<TabKeyType>
                    isVertical
                    className="app-setting-nav flex-grow-1"
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
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
