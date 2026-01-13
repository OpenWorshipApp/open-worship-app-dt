import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

const LazySlideEditorGroundComp = lazy(() => {
    return import('../slide-editor/SlideEditorGroundComp');
});
const LazyBackgroundComp = lazy(() => {
    return import('../background/BackgroundComp');
});

export default function AppDocumentEditorRightComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appEditorRight}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['4'],
                v2: ['1'],
            }}
            dataInput={[
                {
                    children: LazySlideEditorGroundComp,
                    key: 'v1',
                    widgetName: 'Slide Editor Ground',
                },
                {
                    children: LazyBackgroundComp,
                    key: 'v2',
                    widgetName: 'Background',
                },
            ]}
        />
    );
}
