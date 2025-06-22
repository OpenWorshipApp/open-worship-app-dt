import '../app-document-presenter/items/SlidePreviewer.scss';

import { useSelectedLyricContext } from './lyricHelpers';
import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import VaryAppDocumentItemsPreviewerComp from '../app-document-presenter/items/VaryAppDocumentItemsPreviewerComp';
import AppDocumentPreviewerFooterComp from '../app-document-presenter/items/AppDocumentPreviewerFooterComp';
import LyricAppDocument from './LyricAppDocument';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import FileSource from '../helper/FileSource';
import { useMemo } from 'react';

export default function LyricSlidesPreviewerComp() {
    const selectedLyric = useSelectedLyricContext();
    const lyricAppDocument = useMemo(() => {
        const instance = LyricAppDocument.getInstanceFromLyricFilePath(
            selectedLyric.filePath,
            true,
        );
        if (instance !== null) {
            instance.isPreRender = true;
        }
        return instance;
    }, [selectedLyric]);
    useFileSourceEvents(
        ['update'],
        () => {
            if (lyricAppDocument) {
                const fileSource = FileSource.getInstance(
                    lyricAppDocument.filePath,
                );
                fileSource.fireUpdateEvent();
            }
        },
        [lyricAppDocument],
        selectedLyric.filePath,
    );
    return (
        <div className="slide-previewer card w-100 h-100">
            <VaryAppDocumentContext value={lyricAppDocument}>
                <div className="card-body w-100 h-100 overflow-hidden">
                    <VaryAppDocumentItemsPreviewerComp />
                </div>
                <AppDocumentPreviewerFooterComp isDisableChanging />
            </VaryAppDocumentContext>
        </div>
    );
}
