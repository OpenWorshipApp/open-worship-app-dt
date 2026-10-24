import { useCallback, useMemo } from 'react';

import VarySlidesPreviewerComp from '../items/VarySlidesPreviewerComp';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import type { DataInputType } from '../../resize-actor/flexSizeHelpers';
import { useStateSettingString } from '../../helper/settingHelpers';
import { tran } from '../../lang/langHelpers';
import { getLabelIconName } from '../../others/labelIconHelpers';
import { SlideStageContext } from './documentStageContexts';
import StagePreviewerHeaderComp, {
    genStageAccentStyle,
    parseStagePaneSetting,
    toStagePaneSetting,
} from './StagePreviewerHeaderComp';

/**
 * Stages 0 to 5 -- every stage that draws differently from another. Past 5 a
 * document's stage looks like stage 1 (there is no style to set it apart, as a
 * song has), so a sixth pane would only repeat one already open.
 */
const MAX_STAGE_PANE_COUNT = 6;

function StagePaneComp({ stage }: Readonly<{ stage: number }>) {
    return (
        <div
            className="w-100 h-100 app-overflow-hidden stage-previewer-pane"
            style={genStageAccentStyle(stage)}
        >
            <SlideStageContext value={stage}>
                <VarySlidesPreviewerComp />
            </SlideStageContext>
        </div>
    );
}

/**
 * The Stage Previewer of a slide document, a PDF, a PowerPoint or a Word file
 * -- a song's has its own (`LyricSlidesPreviewerComp`). One pane per stage,
 * each the ordinary slide list drawn the way a screen on that `St:` number
 * draws it (`documentStageHelpers`), so the operator sees what the singer on
 * the stage monitor sees. Nothing to configure: no gear, no style panel.
 *
 * With only stage 0 -- how it ships -- the one pane is the slide list exactly
 * as it was; a stage costs nothing until it is added.
 */
export default function DocumentStagePreviewerComp({
    flexSizeNamePrefix = '',
}: Readonly<{
    // A floating preview's panes keep their own widths, apart from the main
    // panel's.
    flexSizeNamePrefix?: string;
}>) {
    const [stageSetting, setStageSetting] = useStateSettingString(
        'document-slides-previewer-stages',
        '0',
    );
    const stages = useMemo(() => {
        return parseStagePaneSetting(stageSetting, MAX_STAGE_PANE_COUNT);
    }, [stageSetting]);
    const handleStagesChange = useCallback((newStages: number[]) => {
        setStageSetting(toStagePaneSetting(newStages));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100 h-100 app-overflow-hidden card stage-previewer">
            <StagePreviewerHeaderComp
                stages={stages}
                maxPaneCount={MAX_STAGE_PANE_COUNT}
                isWithIncrement={false}
                onStagesChange={handleStagesChange}
            />
            <div className="w-100 card-body app-overflow-hidden">
                <ResizeActorComp
                    flexSizeName={`${flexSizeNamePrefix}flex-size-document-slides-previewer`}
                    isHorizontal
                    isDisableQuickResize
                    flexSizeDefault={Object.fromEntries(
                        stages.map((stage) => [`h${stage}`, ['1']]),
                    )}
                    dataInput={stages.map((stage) => {
                        const inputData: DataInputType = {
                            key: `h${stage}`,
                            widgetName: `${tran('Stage')} ${stage}`,
                            widgetIconName:
                                getLabelIconName('Stage') ?? undefined,
                            children: {
                                render: () => {
                                    return <StagePaneComp stage={stage} />;
                                },
                            },
                        };
                        return inputData;
                    })}
                />
            </div>
        </div>
    );
}
