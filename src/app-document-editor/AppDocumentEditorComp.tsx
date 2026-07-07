import { lazy, use, useEffect, useRef } from 'react';

import AppDocument from '../app-document-list/AppDocument';
import { SelectedVaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import appProvider from '../server/appProvider';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { goToPath } from '../router/routeHelpers';

const LazyAppDocumentPreviewerComp = lazy(() => {
    return import('../app-document-presenter/items/AppDocumentPreviewerComp');
});
const LazyAppDocumentEditorRightComp = lazy(() => {
    return import('./AppDocumentEditorRightComp');
});

export default function AppDocumentEditorComp() {
    const selectedAppDocumentContext = use(
        SelectedVaryAppDocumentContext,
    );
    const redirectedFilePathRef = useRef<string | null>(null);

    useEffect(() => {
        const selectedVaryAppDocument =
            selectedAppDocumentContext?.selectedVaryAppDocument ?? null;
        if (
            selectedVaryAppDocument === null ||
            AppDocument.checkIsThisType(selectedVaryAppDocument)
        ) {
            return;
        }
        if (
            redirectedFilePathRef.current === selectedVaryAppDocument.filePath
        ) {
            return;
        }
        redirectedFilePathRef.current = selectedVaryAppDocument.filePath;

        let isActive = true;
        void (async () => {
            const isOk = await showAppConfirm(
                'Open Worship slide required',
                'The selected document is not an Open Worship slide. Return to Presenter?',
                {
                    confirmButtonLabel: 'Return to Presenter',
                },
            );
            if (isOk && isActive) {
                goToPath(appProvider.presenterHomePage);
            }
        })();

        return () => {
            isActive = false;
        };
    }, [selectedAppDocumentContext]);

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
                    children: LazyAppDocumentEditorRightComp,
                    key: 'h2',
                    widgetName: 'App Editor Right',
                },
            ]}
        />
    );
}
