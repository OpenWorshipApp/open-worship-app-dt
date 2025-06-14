import './SettingComp.scss';

import { lazy } from 'react';

import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { QuickOrBackButtonComp } from '../others/commonButtons';

const LazySettingGeneralComp = lazy(() => {
    return import('./SettingGeneralComp');
});
const LazySettingBibleComp = lazy(() => {
    return import('./bible-setting/SettingBibleComp');
});
const LazySettingAboutComp = lazy(() => {
    return import('./SettingAboutComp');
});

const tabTypeList = [
    ['g', 'General', LazySettingGeneralComp],
    ['b', 'Bible', LazySettingBibleComp],
    ['a', 'About', LazySettingAboutComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function SettingComp() {
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        'popup-setting-tab',
        'b',
    );
    return (
        <div
            id="app-setting"
            className="shadow card w-100 h-100 overflow-hidden"
        >
            <div className="card-body d-flex flex-column">
                <div className="setting-header d-flex">
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
                </div>
                <div className="setting-body flex-fill">
                    <div
                        style={{
                            margin: 'auto',
                            maxWidth: '600px',
                        }}
                    >
                        {tabTypeList.map(([type, _, target]) => {
                            return genTabBody<TabKeyType>(tabKey, [
                                type,
                                target,
                            ]);
                        })}
                    </div>
                </div>
            </div>
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                }}
            >
                <QuickOrBackButtonComp title="Quit Setting" />
            </div>
        </div>
    );
}
