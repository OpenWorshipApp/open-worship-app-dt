import { lazy } from 'react';

import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { useStateSettingString } from '../helper/settingHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import { tran } from '../lang/langHelpers';
import {
    BIBLE_SEARCH_SETTING_NAME,
    setBibleSearchingTabType,
} from './bibleFindHelpers';

const LazyBibleFindPreviewerComp = lazy(() => {
    return import('./BibleFindBodyPreviewerComp');
});
const LazyBibleCrossReferencePreviewerComp = lazy(() => {
    return import('./BibleCrossReferencePreviewerComp');
});

const tabTypeList = [
    ['s', tran('Find'), LazyBibleFindPreviewerComp],
    ['c', tran('Cross Reference'), LazyBibleCrossReferencePreviewerComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function BibleFindPreviewerComp() {
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
        <div
            className={
                'card w-100 h-100 app-overflow-hidden d-flex flex-column ' +
                'card app-zero-border-radius'
            }
        >
            <div
                className="card-header overflow-hidden p-0"
                style={{
                    height: '35px',
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
                />
            </div>
            <div
                className="card-body p-0 app-inner-shadow"
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
