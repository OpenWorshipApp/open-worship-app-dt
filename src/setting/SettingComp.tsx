import './SettingComp.scss';

import { lazy } from 'react';

import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { SETTING_SETTING_NAME } from './settingHelpers';
import SettingApplyComp from './SettingApplyComp';
import { tran } from '../lang/langHelpers';

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
    return (
        <div
            id="app-setting"
            className={
                'card w-100 h-100 app-overflow-hidden app-zero-border-radius' +
                ' d-flex flex-row'
            }
        >
            <div className="app-setting-sidebar d-flex flex-column p-1">
                <TabRenderComp<TabKeyType>
                    className="app-setting-nav flex-column flex-grow-1"
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
                        };
                    })}
                    activeTabs={[tabKey]}
                    setActiveTab={(key) => setTabKey(key)}
                />
                <div className="app-setting-apply mt-1 pt-1">
                    <SettingApplyComp />
                </div>
            </div>
            <div
                className="card-body app-overflow-hidden flex-grow-1 p-0"
                style={{
                    height: '100%',
                }}
            >
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
            </div>
        </div>
    );
}
