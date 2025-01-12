import { lazy } from 'react';

import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import ResizeActor from './resize-actor/ResizeActor';

const LazySlidePreviewerComp = lazy(() => {
    return import('./app-document-presenter/items/AppDocumentPreviewerComp');
});
const LazySlideEditorGroundComp = lazy(() => {
    return import('./slide-editor/SlideEditorGroundComp');
});

export default function AppEditor() {
    return (
        <ResizeActor
            flexSizeName={resizeSettingNames.appEditor}
            isHorizontal
            flexSizeDefault={{
                h1: ['1'],
                h2: ['3'],
            }}
            dataInput={[
                {
                    children: LazySlidePreviewerComp,
                    key: 'h1',
                    widgetName: 'App Editor Left',
                },
                {
                    children: LazySlideEditorGroundComp,
                    key: 'h2',
                    widgetName: 'Slide Editor Ground',
                },
            ]}
        />
    );
}
