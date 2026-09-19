import { lazy, use } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { SelectedVaryAppDocumentContext } from './appDocumentHelpers';
import {
    closeAppDocumentPreviewFloating,
    useOpenedAppDocumentPreviewFilePaths,
} from './appDocumentPreviewFloatingHelpers';

// The widget drags in the whole previewer (slide list, editing menu, note pane),
// which the main panel itself only loads lazily. Nothing of it is loaded until a
// preview is actually opened.
const LazyAppDocumentPreviewFloatingItemComp = lazy(() => {
    return import('./AppDocumentPreviewFloatingItemComp');
});

/**
 * Hosts every open floating document preview.
 *
 * Mounted once, app-wide, rather than from the Documents list: that list sits in
 * a collapsible widget, and unmounting it would take every open preview with it.
 */
export default function AppDocumentPreviewFloatingComp() {
    const openedFilePaths = useOpenedAppDocumentPreviewFilePaths();
    const selectedContext = use(SelectedVaryAppDocumentContext);
    const selectedFilePath =
        selectedContext?.selectedVaryAppDocument?.filePath ?? null;

    // A document is previewed in exactly ONE place. Enforced here rather than at
    // the row click, so it also holds when the selection changes from a drag, a
    // presenting flow, or `previewingEventListener`.
    useAppEffect(() => {
        if (selectedFilePath !== null) {
            closeAppDocumentPreviewFloating(selectedFilePath);
        }
    }, [selectedFilePath]);

    const openedFilePathsRef = useAppCurrentRef(openedFilePaths);
    // On the host and not on the row: the row owning a deleted file is
    // unmounting at exactly the moment the event fires.
    useFileSourceEvents(['delete'], (deletedFilePath: any) => {
        if (
            typeof deletedFilePath === 'string' &&
            openedFilePathsRef.current.includes(deletedFilePath)
        ) {
            closeAppDocumentPreviewFloating(deletedFilePath);
        }
    });

    if (openedFilePaths.length === 0) {
        return null;
    }
    return (
        <AppSuspenseComp>
            {openedFilePaths.map((filePath, index) => {
                return (
                    <LazyAppDocumentPreviewFloatingItemComp
                        key={filePath}
                        filePath={filePath}
                        index={index}
                    />
                );
            })}
        </AppSuspenseComp>
    );
}
