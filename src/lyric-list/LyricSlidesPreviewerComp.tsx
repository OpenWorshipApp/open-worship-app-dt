import '../app-document-presenter/items/SlidePreviewer.scss';

import { useMemo } from 'react';

import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import VarySlidesPreviewerComp from '../app-document-presenter/items/VarySlidesPreviewerComp';
import LyricAppDocument from './LyricAppDocument';
import type LyricManager from './LyricManager';
import { useLyricManagerContext } from './LyricManager';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

function initNewLyricAppDocument(lyricManager: LyricManager) {
    const newLyricAppDocument = new LyricAppDocument(lyricManager.filePath);
    newLyricAppDocument.lyricManager = lyricManager;
    newLyricAppDocument.slideFontSize = 60;
    newLyricAppDocument.isSlideImage = true;
    return newLyricAppDocument;
}

export default function LyricSlidesPreviewerComp() {
    const lyricManager = useLyricManagerContext();

    const { lyricAppDocumentStage0, lyricAppDocumentStage1 } = useMemo(() => {
        const lyricAppDocumentStage0 = initNewLyricAppDocument(lyricManager);
        const lyricAppDocumentStage1 = initNewLyricAppDocument(lyricManager);
        lyricAppDocumentStage1.stage = 1;
        return { lyricAppDocumentStage0, lyricAppDocumentStage1 };
    }, [lyricManager]);

    return (
        <ResizeActorComp
            flexSizeName={'flex-size-lyric-slides-previewer'}
            isHorizontal
            isDisableQuickResize
            flexSizeDefault={{
                h1: ['1'],
                h2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return (
                                <VaryAppDocumentContext
                                    value={lyricAppDocumentStage0}
                                >
                                    <VarySlidesPreviewerComp />
                                </VaryAppDocumentContext>
                            );
                        },
                    },
                    key: 'h1',
                    widgetName: 'left-ol-slide-previewer',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <VaryAppDocumentContext
                                    value={lyricAppDocumentStage1}
                                >
                                    <VarySlidesPreviewerComp />
                                </VaryAppDocumentContext>
                            );
                        },
                    },
                    key: 'h2',
                    widgetName: 'right-ol-slide-previewer',
                },
            ]}
        />
    );
}
