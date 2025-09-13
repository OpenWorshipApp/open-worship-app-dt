import './SettingComp.scss';

import { lazy } from 'react';

import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { QuitCurrentPageComp } from '../others/commonButtons';
import { SETTING_SETTING_NAME } from './settingHelpers';

const LazySettingGeneralComp = lazy(() => {
    return import('./SettingGeneralComp');
});
const LazySettingBibleComp = lazy(() => {
    return import('./bible-setting/SettingBibleComp');
});

const tabTypeList = [
    ['g', 'General', LazySettingGeneralComp],
    ['b', 'Bible', LazySettingBibleComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function SettingComp() {
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        SETTING_SETTING_NAME,
        'g',
    );
    return (
        <div id="app-setting" className="card w-100 h-100 app-overflow-hidden">
            <div className="card-header">
                <TabRenderComp<TabKeyType>
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
                        };
                    })}
                    activeTab={tabKey}
                    setActiveTab={setTabKey}
                />
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        right: 0,
                    }}
                >
                    <QuitCurrentPageComp title="Quit Setting" />
                </div>
            </div>
            <div className="card-body app-overflow-hidden">
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
            </div>
        </div>
    );
}
