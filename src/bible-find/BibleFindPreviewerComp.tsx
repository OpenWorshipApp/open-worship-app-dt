import type { ChangeEvent } from 'react';
import { lazy, useCallback } from 'react';

import { genTabBody } from '../others/TabRenderComp';
import { useStateSettingString } from '../helper/settingHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import { genLabelIcon } from '../others/labelIconHelpers';
import { tran } from '../lang/langHelpers';
import type { BibleSearchTabType } from './bibleFindHelpers';
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
const LazyBibleLocationNamePreviewerComp = lazy(() => {
    return import('./BibleLocationNamePreviewerComp');
});

// The label KEY, not a rendered label: an `option` can only carry text, so the
// icon is rendered beside the `select`, for the active tab only.
const tabTypeList = [
    ['s', 'Find', LazyBibleFindPreviewerComp],
    ['c', 'Cross Reference', LazyBibleCrossReferencePreviewerComp],
    ['l', 'Location-Name (KJV)', LazyBibleLocationNamePreviewerComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function BibleFindPreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        BIBLE_SEARCH_SETTING_NAME,
        's',
    );
    useAppEffect(() => {
        viewController.openBibleSearch = (tabType: BibleSearchTabType) => {
            setTabKey(tabType);
        };
        return () => {
            viewController.openBibleSearch = setBibleSearchingTabType;
        };
    }, [viewController]);
    const setTabKeyRef = useAppCurrentRef(setTabKey);
    const handleTabChanging = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setTabKeyRef.current(event.target.value as TabKeyType);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const activeLabelKey =
        tabTypeList.find(([key]) => {
            return key === tabKey;
        })?.[1] ?? tabTypeList[0][1];
    return (
        <div
            className={
                'card w-100 h-100 app-overflow-hidden d-flex flex-column ' +
                'card app-zero-border-radius'
            }
        >
            <div
                className={
                    'card-header overflow-hidden py-0 px-1' +
                    ' d-flex align-items-center'
                }
                style={{
                    height: '35px',
                }}
            >
                {genLabelIcon(activeLabelKey, 'pe-1')}
                <select
                    className="form-select form-select-sm"
                    value={tabKey}
                    title={tran(activeLabelKey)}
                    aria-label={tran(activeLabelKey)}
                    onChange={handleTabChanging}
                >
                    {tabTypeList.map(([key, labelKey]) => {
                        return (
                            <option key={key} value={key}>
                                {tran(labelKey)}
                            </option>
                        );
                    })}
                </select>
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
