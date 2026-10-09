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
import LangAppMenuComp from '../lang/LangAppMenuComp';
import { toWidgetLabel } from '../others/labelIconHelpers';
import DataArchiveAppMenuComp from '../setting/data-archive/DataArchiveAppMenuComp';
import { useAppEffect } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';

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
    // The screens that were up on a virtual display come back with the app.
    // The Mini Screen's module first: loading it registers the answer to
    // main's request for a screen's state (`initReceiveScreenMessage` at its
    // top), and a screen shown before that request can be answered waits ten
    // seconds and goes off again -- what a restore from here met at first,
    // its panel being a lazy chunk that loads after this.
    useAppEffect(() => {
        Promise.all([
            import('../_screen/preview/MiniScreenComp'),
            import('../_screen/managers/screenManagerHelpers'),
        ])
            .then(([, { restoreVirtualDisplayScreens }]) => {
                restoreVirtualDisplayScreens();
            })
            .catch(handleError);
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
            {/* File → Export/Import Data, shared with the Reader page. */}
            <DataArchiveAppMenuComp />
            <LangAppMenuComp />
        </BibleItemsViewControllerContext>
    );
}
