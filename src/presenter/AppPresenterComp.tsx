import { lazy, useMemo } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import BibleItemsViewController, {
    BibleItemsViewControllerContext,
} from '../bible-reader/BibleItemsViewController';
import SlideEditHandlerComp from '../app-document-presenter/SlideEditHandlerComp';
import BibleViewComp from '../bible-reader/BibleViewComp';
import type BibleItem from '../bible-list/BibleItem';
import { BibleViewTitleEditingComp } from '../bible-reader/view-extra/BibleViewTitleEditingComp';
import { BibleViewTitleMaterialContext } from '../bible-reader/view-extra/viewExtraHelpers';

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
                        widgetName: 'App Presenter Left',
                    },
                    {
                        children: LazyAppPresenterMiddleComp,
                        key: 'h2',
                        widgetName: 'App Presenter Middle',
                    },
                    {
                        children: LazyAppPresenterRightComp,
                        key: 'h3',
                        widgetName: 'App Presenter Right',
                    },
                ]}
            />
            <SlideEditHandlerComp />
        </BibleItemsViewControllerContext>
    );
}
