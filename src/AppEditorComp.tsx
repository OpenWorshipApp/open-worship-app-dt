import { lazy } from 'react';

import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import ResizeActorComp from './resize-actor/ResizeActorComp';

const LazyAppDocumentPreviewerComp = lazy(() => {
    return import('./app-document-presenter/items/AppDocumentPreviewerComp');
});
const LazyAppEditorRightComp = lazy(() => {
    return import('./AppEditorRightComp');
});

export default function AppEditorComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appEditor}
            isHorizontal
            flexSizeDefault={{
                h1: ['1'],
                h2: ['3'],
            }}
            dataInput={[
                {
                    children: LazyAppDocumentPreviewerComp,
                    key: 'h1',
                    widgetName: 'App Editor Left',
                },
                {
                    children: LazyAppEditorRightComp,
                    key: 'h2',
                    widgetName: 'App Editor Right',
                },
            ]}
        />
    );
}
