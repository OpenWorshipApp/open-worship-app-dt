import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

const LazyBibleReadingLeftComp = lazy(() => {
    return import('../bible-list/BibleReadingLeftComp');
});
const LazyMiniScreenComp = lazy(() => {
    return import('../_screen/preview/MiniScreenComp');
});

export default function AppPresenterRightComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appPresenterRight}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['4'],
                v2: ['5'],
            }}
            dataInput={[
                {
                    children: LazyBibleReadingLeftComp,
                    key: 'v1',
                    widgetName: 'Bible and Notes',
                    className: 'flex-item',
                },
                {
                    children: LazyMiniScreenComp,
                    key: 'v2',
                    widgetName: 'Mini Screen',
                    className: 'flex-item',
                },
            ]}
        />
    );
}
