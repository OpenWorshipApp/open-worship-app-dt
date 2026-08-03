import '../app-document-presenter/items/SlidePreviewer.scss';

import { useCallback, useMemo } from 'react';

import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import VarySlidesPreviewerComp from '../app-document-presenter/items/VarySlidesPreviewerComp';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { useStateSettingString } from '../helper/settingHelpers';
import { useLyricManagerContext } from './LyricManager';
import type LyricManager from './LyricManager';
import { type DataInputType } from '../resize-actor/flexSizeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import type LyricAppDocument from './LyricAppDocument';
import { getLyricAppDocumentStageByStage } from './lyricHelpers';

function getLyricAppDocuments(
    stageSetting: string,
    lyricManager: LyricManager,
) {
    const stages = stageSetting
        .split(',')
        .map((stage) => stage.trim())
        .map((stage) => parseInt(stage, 10))
        .filter((stage) => !isNaN(stage))
        .filter((stage) => stage !== 0);
    stages.unshift(0);

    const entries = stages.map((stage) => {
        return getLyricAppDocumentStageByStage(lyricManager.filePath, stage);
    }) as [number, LyricAppDocument][];
    entries.forEach(([_, lyricAppDocument]) => {
        lyricAppDocument.openLyric = lyricManager.openLyricPreviewer;
    });
    return [stages, entries] as const;
}

export default function LyricSlidesPreviewerComp() {
    const lyricManager = useLyricManagerContext();
    const [stageSetting, setStageSetting] = useStateSettingString(
        'lyric-slides-previewer-stages',
        '0',
    );
    const [stages, lyricAppDocumentEntries] = useMemo(() => {
        return getLyricAppDocuments(stageSetting, lyricManager);
    }, [stageSetting, lyricManager]);
    const stagesRef = useAppCurrentRef(stages);

    const handleStageAdding = useCallback(() => {
        const newStages = [...stagesRef.current]
            .map((stage) => stage)
            .filter((stage) => stage !== 0);
        const maxStage = Math.max(...newStages, 0);
        newStages.push(maxStage + 1);
        setStageSetting(newStages.join(','));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleStageRemoving = useCallback((targeStage: number) => {
        const newStages = [...stagesRef.current]
            .map((stage) => stage)
            .filter((stage) => stage !== 0);
        setStageSetting(
            newStages.filter((stage) => stage !== targeStage).join(','),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-100 h-100 app-overflow-hidden card">
            <div className="w-100 p-1 card-header">
                Stage Previewer (stages:{' '}
                {stages.map((stage) => {
                    if (stage === 0) {
                        return <span key={stage}>0</span>;
                    }
                    return (
                        <span
                            key={stage}
                            className="mx-1 app-caught-hover-pointer"
                            title={`Remove stage ${stage}`}
                            onClick={handleStageRemoving.bind(null, stage)}
                        >
                            {stage}
                        </span>
                    );
                })}
                ){/* a plus icon to add new stage */}
                <i
                    className="bi bi-plus-circle ms-2 app-caught-hover-pointer"
                    style={{ color: 'var(--bs-info)' }}
                    onClick={handleStageAdding}
                />
            </div>
            <div className="w-100 card-body app-overflow-hidden">
                <ResizeActorComp
                    flexSizeName={'flex-size-lyric-slides-previewer'}
                    isHorizontal
                    isDisableQuickResize
                    flexSizeDefault={Object.fromEntries(
                        lyricAppDocumentEntries.map(([stage]) => [
                            `h${stage}`,
                            ['1'],
                        ]),
                    )}
                    dataInput={lyricAppDocumentEntries.map(
                        ([stage, lyricAppDocument]) => {
                            const inputData: DataInputType = {
                                key: `h${stage}`,
                                widgetName: `Stage ${stage}`,
                                children: {
                                    render: () => {
                                        return (
                                            <VaryAppDocumentContext
                                                value={lyricAppDocument}
                                            >
                                                <VarySlidesPreviewerComp />
                                            </VaryAppDocumentContext>
                                        );
                                    },
                                },
                            };
                            return inputData;
                        },
                    )}
                />
            </div>
        </div>
    );
}
