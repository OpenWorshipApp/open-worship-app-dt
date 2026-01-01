import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

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
                    widgetName: 'Presenter',
                    className: 'flex-item',
                },
                {
                    children: LazyBackgroundComp,
                    key: 'v2',
                    widgetName: 'Background',
                    className: 'flex-item',
                },
            ]}
        />
    );
}
