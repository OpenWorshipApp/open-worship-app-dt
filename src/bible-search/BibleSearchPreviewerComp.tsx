import { lazy } from 'react';

import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';

const LazyBibleFindPreviewerComp = lazy(() => {
    return import('./BibleFindPreviewerComp');
});
const LazyBibleCrossReferentPreviewerComp = lazy(() => {
    return import('./BibleCrossReferentPreviewerComp');
});

export const BIBLE_SEARCH_SETTING_NAME = 'bible-search-tab';
export function setBibleSearchingTabType(tabType: 's' | 'c') {
    setSetting(BIBLE_SEARCH_SETTING_NAME, tabType);
}

const tabTypeList = [
    ['s', 'Search', LazyBibleFindPreviewerComp],
    ['c', 'Cross Referent', LazyBibleCrossReferentPreviewerComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function BibleSearchPreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        BIBLE_SEARCH_SETTING_NAME,
        's',
    );
    useAppEffect(() => {
        viewController.openBibleSearch = (tabType: 's' | 'c') => {
            setTabKey(tabType);
        };
        return () => {
            viewController.openBibleSearch = setBibleSearchingTabType;
        };
    }, []);
    return (
        <div className="card w-100 h-100 app-overflow-hidden d-flex flex-column">
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
                    className="card-header"
                />
            </div>
            <div className="card-body">
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
            </div>
        </div>
    );
}
