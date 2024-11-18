import './Background.scss';

import { lazy } from 'react';

import {
    useStateSettingString,
} from '../helper/settingHelper';
import TabRender, {
    genTabBody,
} from '../others/TabRender';
import {
    usePBGMEvents,
} from '../_screen/screenEventHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import {
    BackgroundType, getBGSrcListOnScreenSetting,
} from '../_screen/screenHelpers';

const BackgroundColors = lazy(() => {
    return import('./BackgroundColors');
});
const BackgroundImages = lazy(() => {
    return import('./BackgroundImages');
});
const BackgroundVideos = lazy(() => {
    return import('./BackgroundVideos');
});


const tabTypeList = [
    ['color', 'Colors', BackgroundColors],
    ['image', 'Images', BackgroundImages],
    ['video', 'Videos', BackgroundVideos],
] as const;
type TabType = typeof tabTypeList[number][0];
export default function Background() {
    const [tabType, setTabType] = useStateSettingString<TabType>(
        'background-tab', 'image',
    );
    usePBGMEvents(['update']);
    const bgSrcList = getBGSrcListOnScreenSetting();
    const toHLS = (type: BackgroundType) => {
        const isSelected = Object.values(bgSrcList).some((src) => {
            return src.type === type;
        });
        return isSelected ? 'nav-highlight-selected' : undefined;
    };
    return (
        <div className='background w-100 d-flex flex-column'>
            <div className='background-header'>
                <TabRender<TabType>
                    tabs={tabTypeList.map(([type, name]) => {
                        return [type, name, toHLS(type)];
                    })}
                    activeTab={tabType}
                    setActiveTab={setTabType} />
            </div>
            <div className='background-body w-100 flex-fill'>
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabType>(tabType, [type, target]);
                })}
            </div>
        </div>
    );
}

export function RenderScreenIds({ screenIds }: Readonly<{
    screenIds: number[],
}>) {
    return (
        <div style={{
            position: 'absolute',
            textShadow: '1px 1px 5px #000',
        }}>
            {screenIds.map((screenId) => {
                return (
                    <ShowingScreenIcon
                        key={screenId}
                        screenId={screenId}
                    />
                );
            })}
        </div>
    );
}
