import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { toWidgetLabel } from '../others/labelIconHelpers';

const LazyPresenterComp = lazy(() => {
    return import('../app-document-presenter/PresenterComp');
});
const LazyBackgroundComp = lazy(() => {
    return import('../background/BackgroundComp');
});

export default function AppPresenterMiddleComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appPresenterMiddle}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['3'],
                v2: ['1'],
            }}
            dataInput={[
                {
                    children: LazyPresenterComp,
                    key: 'v1',
                    ...toWidgetLabel('Presenter'),
                    className: 'app-flex-item',
                },
                {
                    children: LazyBackgroundComp,
                    key: 'v2',
                    ...toWidgetLabel('Background'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
