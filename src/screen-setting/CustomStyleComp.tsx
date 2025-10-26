import { lazy } from 'react';

import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { bringDomToTopView } from '../helper/helpers';

const LazyAppearanceComp = lazy(() => {
    return import('./AppearanceComp');
});
const LazyTextShadowComp = lazy(() => {
    return import('../_screen/preview/TextShadow');
});

const tabTypeList = [
    ['a', 'Appearance', LazyAppearanceComp],
    ['s', 'Shadow', LazyTextShadowComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function CustomStyleComp({
    onClose,
}: Readonly<{
    onClose: () => void;
}>) {
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        'tull-text-screen-custom-style-tab',
        'a',
    );
    return (
        <div
            className="custom-style card app-border-white-round mt-1"
            ref={(element) => {
                if (element) {
                    setTimeout(() => {
                        bringDomToTopView(element);
                    }, 500);
                }
            }}
        >
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
                    className="app-caught-hover-pointer m-1"
                    style={{ position: 'absolute', top: '0', right: '0' }}
                    onClick={onClose}
                >
                    <i className="bi bi-x-lg" style={{ color: 'red' }} />
                </div>
            </div>
            <div className="card-body">
                <div className="custom-style-body p-2">
                    {tabTypeList.map(([type, _, target]) => {
                        return genTabBody<TabKeyType>(tabKey, [type, target]);
                    })}
                </div>
            </div>
        </div>
    );
}
