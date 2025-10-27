import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});
const LazyBibleCustomStyleComp = lazy(() => {
    return import('../screen-setting/BibleCustomStyleComp');
});

export default function PresenterBiblePreviewerRenderComp() {
    return (
        <div className="w-100 h-100">
            <ResizeActorComp
                flexSizeName={resizeSettingNames.presenterBiblePreviewer}
                isHorizontal={false}
                flexSizeDefault={{
                    v1: ['4'],
                    v2: ['1'],
                }}
                dataInput={[
                    {
                        children: LazyBiblePreviewerRenderComp,
                        key: 'v1',
                        widgetName: 'Bible Previewer',
                    },
                    {
                        children: LazyBibleCustomStyleComp,
                        key: 'v2',
                        widgetName: 'Bible Custom Style',
                    },
                ]}
            />
        </div>
    );
}
