import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { toWidgetLabel } from '../others/labelIconHelpers';

const LazyAppDocumentListComp = lazy(() => {
    return import('../app-document-list/VaryAppDocumentListComp');
});
const LazyPresentingFlowListComp = lazy(() => {
    return import('../presenting-flow/PresentingFlowListComp');
});

export default function AppPresenterLeftComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appPresenterLeft}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['3'],
                v2: ['2'],
            }}
            dataInput={[
                {
                    children: LazyAppDocumentListComp,
                    key: 'v1',
                    ...toWidgetLabel('Document List'),
                    className: 'app-flex-item',
                },
                {
                    children: LazyPresentingFlowListComp,
                    key: 'v2',
                    ...toWidgetLabel('Presenting Flow List'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
