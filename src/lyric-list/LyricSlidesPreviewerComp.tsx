import '../app-document-presenter/items/SlidePreviewer.scss';
import './LyricSlidesPreviewerComp.scss';

import { type CSSProperties, useCallback, useMemo } from 'react';

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
import { tran } from '../lang/langHelpers';
import { getLabelIconName, toIconedLabel } from '../others/labelIconHelpers';

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

const BASE_STAGE = 0;

// Each stage gets its own accent, worn by BOTH its chip and the border around
// its preview pane — with several stages side by side that is the only quick
// way to tell which pane belongs to which chip. Fixed hexes rather than theme
// variables: these have to stay distinguishable from each other in light and
// dark alike, which the semantic bootstrap colours do not guarantee.
const STAGE_ACCENT_COLOR_LIST = [
    '#4dabf7',
    '#51cf66',
    '#ffa94d',
    '#cc5de8',
    '#ff6b6b',
    '#22b8cf',
    '#fcc419',
    '#f783ac',
];

function getStageAccentColor(stage: number) {
    const index = Math.abs(stage) % STAGE_ACCENT_COLOR_LIST.length;
    return STAGE_ACCENT_COLOR_LIST[index];
}

const STAGE_ACCENT_VAR_NAME = '--stage-accent';

function genStageAccentStyle(stage: number) {
    return {
        [STAGE_ACCENT_VAR_NAME]: getStageAccentColor(stage),
    } as CSSProperties;
}

/**
 * One stage, shown as a chip. The point is that the control tells you what it
 * does without being tried: a removable stage carries its own visible `×`, and
 * the base stage says why it has none. Before, the stage numbers were bare text
 * whose only clue was a `title` on hover.
 */
function RenderStageChipComp({
    stage,
    onRemove,
}: Readonly<{
    stage: number;
    onRemove: (stage: number) => void;
}>) {
    const label = `${tran('Stage')} ${stage}`;
    const accentStyle = genStageAccentStyle(stage);
    if (stage === BASE_STAGE) {
        return (
            <span
                className="stage-previewer-chip is-base"
                style={accentStyle}
                title={`${tran('Base Stage')} · ${tran(
                    'Base stage is always shown',
                )}`}
            >
                <i className="bi bi-lock-fill" />
                {label}
            </span>
        );
    }
    const removeLabel = `${tran('Remove Stage')} ${stage}`;
    return (
        <span className="stage-previewer-chip" style={accentStyle}>
            {label}
            <button
                type="button"
                className="stage-previewer-chip-remove"
                title={removeLabel}
                aria-label={removeLabel}
                onClick={() => {
                    onRemove(stage);
                }}
            >
                <i className="bi bi-x-lg" />
            </button>
        </span>
    );
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
        <div className="w-100 h-100 app-overflow-hidden card lyric-slides-previewer">
            {/*
                This header is a flex item of the card column and was being
                shrunk below its own content box, so a label that wrapped to a
                second line got clipped mid-glyph - which is what the Khmer
                translation does, being about twice the width of the English one.
                The scss keeps it on a single unshrinkable line: the label
                truncates with an ellipsis, the stage controls always stay
                visible.
            */}
            <div className="w-100 p-1 card-header px-1 py-0">
                <span className="stage-previewer-label">
                    {toIconedLabel('Stage Previewer')}
                </span>
                <div className="stage-previewer-stages">
                    {stages.map((stage) => {
                        return (
                            <RenderStageChipComp
                                key={stage}
                                stage={stage}
                                onRemove={handleStageRemoving}
                            />
                        );
                    })}
                </div>
                {/*
                    Spelled out rather than a bare `+` glyph: this is the only
                    way to get a second stage, so it has to read as an action
                    even to someone who has never seen the panel before.
                */}
                <button
                    type="button"
                    className="btn btn-sm btn-outline-info stage-previewer-add"
                    title={tran('Add another stage layout')}
                    onClick={handleStageAdding}
                >
                    <i className="bi bi-plus-lg" />
                    <span className="stage-previewer-add-label">
                        {tran('Add Stage')}
                    </span>
                </button>
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
                                widgetName: `${tran('Stage')} ${stage}`,
                                widgetIconName:
                                    getLabelIconName('Stage') ?? undefined,
                                children: {
                                    render: () => {
                                        return (
                                            <div
                                                className="stage-previewer-pane"
                                                style={genStageAccentStyle(
                                                    stage,
                                                )}
                                            >
                                                <VaryAppDocumentContext
                                                    value={lyricAppDocument}
                                                >
                                                    <VarySlidesPreviewerComp />
                                                </VaryAppDocumentContext>
                                            </div>
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
