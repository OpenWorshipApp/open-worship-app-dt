import { lazy, useMemo } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import BibleItemsViewController, {
    BibleItemsViewControllerContext,
} from '../bible-reader/BibleItemsViewController';
import BibleCustomStyleFloatingComp from '../screen-setting/BibleCustomStyleFloatingComp';
import BibleViewComp from '../bible-reader/BibleViewComp';
import type BibleItem from '../bible-list/BibleItem';
import { BibleViewTitleEditingComp } from '../bible-reader/view-extra/BibleViewTitleEditingComp';
import { BibleViewTitleMaterialContext } from '../bible-reader/view-extra/viewExtraHelpers';
import { useAppEffect } from '../helper/appHooks';
import {
    initLangAppMenu,
    registerLangAppMenuClicked,
} from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import {
    initDataArchiveAppMenu,
    registerDataArchiveAppMenuClicked,
} from '../setting/data-archive/dataArchiveMenuHelpers';

const LazyAppPresenterLeftComp = lazy(() => {
    return import('./AppPresenterLeftComp');
});
const LazyAppPresenterMiddleComp = lazy(() => {
    return import('./AppPresenterMiddleComp');
});
const LazyAppPresenterRightComp = lazy(() => {
    return import('./AppPresenterRightComp');
});

export default function AppPresenterComp() {
    useAppEffect(() => {
        const unregister = registerLangAppMenuClicked();
        initLangAppMenu();
        return unregister;
    }, []);
    // File → Export/Import Data. Registered from the presenter only: the
    // entries are keyed, so a second window would replace rather than duplicate
    // them, but its clicks would then be routed to that window instead.
    useAppEffect(() => {
        const unregister = registerDataArchiveAppMenuClicked();
        initDataArchiveAppMenu();
        return unregister;
    }, []);
    const viewController = useMemo(() => {
        const newViewController = new BibleItemsViewController('presenter');
        newViewController.finalRenderer = (bibleItem: BibleItem) => {
            return (
                <BibleViewTitleMaterialContext
                    value={{
                        titleElement: (
                            <BibleViewTitleEditingComp
                                bibleItem={bibleItem}
                                onTargetChange={(newBibleTarget) => {
                                    newViewController.applyTargetOrBibleKey(
                                        bibleItem,
                                        { target: newBibleTarget },
                                    );
                                }}
                            />
                        ),
                    }}
                >
                    <BibleViewComp bibleItem={bibleItem} />
                </BibleViewTitleMaterialContext>
            );
        };
        return newViewController;
    }, []);
    return (
        <BibleItemsViewControllerContext value={viewController}>
            <ResizeActorComp
                flexSizeName={resizeSettingNames.appPresenter}
                isHorizontal
                flexSizeDefault={{
                    h1: ['1'],
                    h2: ['3'],
                    h3: ['2'],
                }}
                dataInput={[
                    {
                        children: LazyAppPresenterLeftComp,
                        key: 'h1',
                        ...toWidgetLabel('App Presenter Left'),
                    },
                    {
                        children: LazyAppPresenterMiddleComp,
                        key: 'h2',
                        ...toWidgetLabel('App Presenter Middle'),
                    },
                    {
                        children: LazyAppPresenterRightComp,
                        key: 'h3',
                        ...toWidgetLabel('App Presenter Right'),
                    },
                ]}
            />
            <BibleCustomStyleFloatingComp />
        </BibleItemsViewControllerContext>
    );
}
