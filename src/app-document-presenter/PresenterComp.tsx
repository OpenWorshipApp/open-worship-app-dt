import './PresenterComp.scss';

import { lazy } from 'react';

import {
    useBibleItemShowing,
    useLyricSelecting,
    useVaryAppDocumentSelecting,
} from '../event/PreviewingEventListener';
import { useAppDocumentItemSelecting } from '../event/VaryAppDocumentEventListener';
import { getSetting, useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';

const LazyAppDocumentPreviewerComp = lazy(() => {
    return import('./items/AppDocumentPreviewerComp');
});
const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});
const LazyLyricPreviewerComp = lazy(() => {
    return import('../advance-presenter/LyricPreviewerComp');
});
const LazyPresenterOthersControllerComp = lazy(() => {
    return import('../presenter-others/PresenterOthersControllerComp');
});

const PRESENT_TAB_SETTING_NAME = 'presenter-tab';

export function getIsShowingVaryAppDocumentPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'd';
}

export function getIsShowingLyricPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'l';
}

export function getIsShowingBiblePreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'f';
}

const tabTypeList = [
    ['d', 'Documents', LazyAppDocumentPreviewerComp],
    ['l', 'Lyrics', LazyLyricPreviewerComp],
    ['b', 'Bibles', LazyBiblePreviewerRenderComp],
    ['a', 'Others', LazyPresenterOthersControllerComp],
] as const;
type TabType = (typeof tabTypeList)[number][0];
export default function PresenterComp() {
    const [tabType, setTabType] = useStateSettingString<TabType>(
        PRESENT_TAB_SETTING_NAME,
        'd',
    );
    useLyricSelecting(() => setTabType('l'), []);
    useBibleItemShowing(() => setTabType('b'), []);
    useVaryAppDocumentSelecting(() => setTabType('d'));
    useAppDocumentItemSelecting(() => setTabType('d'));
    return (
        <div id="presenter-manager" className="w-100 h-100">
            <TabRenderComp<TabType>
                tabs={tabTypeList.map(([type, name]) => {
                    return [type, name];
                })}
                activeTab={tabType}
                setActiveTab={setTabType}
                className="header"
            />
            <div className="body w-100 overflow-hidden">
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabType>(tabType, [type, target]);
                })}
            </div>
        </div>
    );
}
