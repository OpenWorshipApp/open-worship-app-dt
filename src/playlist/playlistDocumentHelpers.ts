import { useCallback } from 'react';

import {
    checkIsLyric,
    useSelectedAppDocumentSetterContext,
    varyAppDocumentFromFilePath,
} from '../app-document-list/appDocumentHelpers';
import type {
    VaryAppDocumentType,
    VarySlideType,
} from '../app-document-list/appDocumentTypeHelpers';
import { getIsShowingLyricPreviewer } from '../app-document-presenter/presenterRendererHelpers';
import { getIsShowingVaryAppDocumentPreviewer } from '../app-document-presenter/presenterRendererHelpers';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { handleError } from '../helper/errorHelpers';
import { useSelectedLyricSetterContext } from '../lyric-list/lyricHelpers';
import { getFileDotExtension } from '../server/fileHelpers';

export function checkIsLyricFilePath(filePath: string) {
    return checkIsLyric(getFileDotExtension(filePath));
}

/**
 * Clicking a document in a playlist does what clicking it in the Documents list
 * does — select it and make sure its previewer is showing. The selection has to
 * go through the layout context setters (not the plain setting writer), or the
 * lists and previewer keep showing the previous document.
 */
export function useVaryAppDocumentOpener() {
    const setSelectedVaryAppDocument = useSelectedAppDocumentSetterContext();
    const setSelectedLyric = useSelectedLyricSetterContext();
    return useCallback(
        async (filePath: string) => {
            try {
                if (checkIsLyricFilePath(filePath)) {
                    const { default: Lyric } =
                        await import('../lyric-list/Lyric');
                    const lyric = Lyric.getInstance(filePath);
                    setSelectedLyric(lyric);
                    if (!getIsShowingLyricPreviewer()) {
                        previewingEventListener.showLyric(lyric);
                    }
                    return;
                }
                const varyAppDocument = varyAppDocumentFromFilePath(filePath);
                setSelectedVaryAppDocument(varyAppDocument);
                if (!getIsShowingVaryAppDocumentPreviewer()) {
                    previewingEventListener.showVaryAppDocument(
                        varyAppDocument,
                    );
                }
            } catch (error) {
                handleError(error);
            }
        },
        [setSelectedVaryAppDocument, setSelectedLyric],
    );
}

/**
 * The document behind a referenced file. Lyrics resolve to their rendering
 * stage document — the plain `LyricAppDocument` only yields empty placeholder
 * slides.
 */
export async function loadVaryAppDocument(
    filePath: string,
    stage = 0,
): Promise<VaryAppDocumentType | null> {
    try {
        if (checkIsLyricFilePath(filePath)) {
            const { getLyricAppDocumentStageByStage } =
                await import('../lyric-list/lyricHelpers');
            const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
                filePath,
                stage,
            );
            return lyricAppDocument as VaryAppDocumentType;
        }
        return varyAppDocumentFromFilePath(filePath);
    } catch (error) {
        handleError(error);
    }
    return null;
}

/** Split out so a caller that already holds the document does not resolve it twice. */
export async function loadVarySlides(
    varyAppDocument: VaryAppDocumentType,
): Promise<VarySlideType[] | null> {
    try {
        return (await varyAppDocument.getSlides()) as VarySlideType[];
    } catch (error) {
        handleError(error);
    }
    return null;
}

/**
 * Read a referenced document's slides. Only called when a document row is
 * actually expanded — a collapsed playlist never touches the file.
 */
export async function loadVaryAppDocumentSlides(
    filePath: string,
): Promise<VarySlideType[] | null> {
    const varyAppDocument = await loadVaryAppDocument(filePath);
    if (varyAppDocument === null) {
        return null;
    }
    return await loadVarySlides(varyAppDocument);
}
