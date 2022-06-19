import './Presenting.scss';

import SlidePreviewer from './SlidePreviewer';
import FullTextPresentController from '../full-text-present/FullTextPresentController';
import { useFullTextOpening, useSlideSelecting } from '../event/PreviewingEventListener';
import { useSlideItemSelecting } from '../event/SlideListEventListener';
import { useStateSettingString } from '../helper/settingHelper';
import TabRender from '../others/TabRender';

// s: slides, f: full text
type TabType = 's' | 'f';
export default function Presenting() {
    const [tabType, setTabType] = useStateSettingString<TabType>('presenting-tab', 's');
    useFullTextOpening(() => {
        setTabType('f');
    });
    useSlideSelecting(() => setTabType('s'));
    useSlideItemSelecting(() => setTabType('s'));
    return (
        <div id="presenting" className="w-100 h-100">
            <TabRender<TabType> tabs={[
                ['s', 'Slide'],
                ['f', 'Full Text'],
            ]}
                activeTab={tabType}
                setActiveTab={setTabType}
                className='header' />
            <div className="body w-100 p-10">
                {tabType === 's' && <SlidePreviewer />}
                {tabType === 'f' && <FullTextPresentController />}
            </div>
        </div>
    );
}
