import { lazy } from 'react';

import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';

const LazyBibleFindPreviewerComp = lazy(() => {
    return import('./BibleFindPreviewerComp');
});
const LazyBibleCrossReferencePreviewerComp = lazy(() => {
    return import('./BibleCrossReferencePreviewerComp');
});

export const BIBLE_SEARCH_SETTING_NAME = 'bible-search-tab';
export function setBibleSearchingTabType(tabType: 's' | 'c') {
    setSetting(BIBLE_SEARCH_SETTING_NAME, tabType);
}

const tabTypeList = [
    ['s', 'Search', LazyBibleFindPreviewerComp],
    ['c', 'Cross Reference', LazyBibleCrossReferencePreviewerComp],
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
            <div
                className="card-header overflow-hidden p-0"
                style={{
                    height: '42px',
                }}
            >
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
            <div
                className="card-body px-1 app-inner-shadow"
                style={{
                    overflowY: 'auto',
                    height: 'calc(100% - 42px)',
                }}
            >
                {tabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
                <ScrollingHandlerComp />
            </div>
        </div>
    );
}
