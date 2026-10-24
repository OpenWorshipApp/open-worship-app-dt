import './StagePreviewerComp.scss';

import { type CSSProperties, type ReactNode, useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    showAppContextMenu,
    type ContextMenuItemType,
} from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { toIconedLabel } from '../../others/labelIconHelpers';
import {
    getStageAccentColor,
    STAGE_NUMBER_CHOICE_COUNT,
} from '../../_screen/screenHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

/**
 * The header every Stage Previewer wears -- a song's and any other
 * document's: a chip per stage shown, `+ Add Stage`, and whatever the caller
 * ends the row with. A song adds a gear to each chip and a `⋮`; a document
 * adds neither, since its stages have nothing to set.
 */

export const BASE_STAGE = 0;

const STAGE_ACCENT_VAR_NAME = '--stage-accent';

export function genStageAccentStyle(stage: number) {
    return {
        [STAGE_ACCENT_VAR_NAME]: getStageAccentColor(stage),
    } as CSSProperties;
}

/**
 * The stages a previewer shows, from its setting: any non-negative integer,
 * each at most once, SORTED so the panes read left to right in stage order
 * whatever order the setting names them in, and never more than
 * `maxPaneCount` -- the memory guard, since every pane draws the whole
 * document again. The base stage always leads and is never stored.
 */
export function parseStagePaneSetting(
    stageSetting: string,
    maxPaneCount: number,
) {
    const stages = [
        ...new Set(
            stageSetting
                .split(',')
                .map((stage) => Number.parseInt(stage.trim(), 10))
                .filter((stage) => Number.isInteger(stage) && stage >= 0)
                .filter((stage) => stage !== BASE_STAGE),
        ),
    ]
        .sort((stageA, stageB) => stageA - stageB)
        .slice(0, maxPaneCount - 1);
    stages.unshift(BASE_STAGE);
    return stages;
}

// The setting for `stages`: sorted, the base stage left out.
export function toStagePaneSetting(stages: number[]) {
    return [...new Set(stages)]
        .filter((stage) => stage !== BASE_STAGE)
        .sort((stageA, stageB) => stageA - stageB)
        .join(',');
}

/**
 * One stage, shown as a chip. The point is that the control tells you what it
 * does without being tried: a stage that can be hidden carries its own visible
 * `×`, and the base stage says why it has none. Before, the stage numbers were
 * bare text whose only clue was a `title` on hover.
 *
 * The `×` HIDES the pane -- it only takes the stage out of this previewer's
 * setting, and **Add Stage** puts it straight back with its style untouched
 * (a song's style is kept per stage number, not per pane). It was labelled
 * "Remove Stage", which the agent firewall rightly reads as a press that
 * cannot be undone, so an assistant could add a pane and not take it away.
 */
function RenderStageChipComp({
    stage,
    onRemove,
    extra,
}: Readonly<{
    stage: number;
    onRemove: (stage: number) => void;
    extra?: ReactNode;
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
                {extra}
            </span>
        );
    }
    const hideLabel = `${tran('Hide Stage')} ${stage}`;
    return (
        <span className="stage-previewer-chip" style={accentStyle}>
            {label}
            {extra}
            <button
                type="button"
                className="stage-previewer-chip-remove"
                title={hideLabel}
                aria-label={hideLabel}
                onClick={() => {
                    onRemove(stage);
                }}
            >
                <i
                    className="bi bi-x-lg"
                    style={{
                        color: 'var(--bs-danger)',
                    }}
                />
            </button>
        </span>
    );
}

export default function StagePreviewerHeaderComp({
    stages,
    maxPaneCount,
    isWithIncrement,
    onStagesChange,
    renderChipExtra,
    children,
}: Readonly<{
    // Always led by the base stage (`parseStagePaneSetting`).
    stages: number[];
    maxPaneCount: number;
    // Offer "Increment · Stage N" past the shortlist: a song's stages past 5
    // differ by their own style, a document's would all look like stage 1.
    isWithIncrement: boolean;
    // The stages to show from now on, base stage included.
    onStagesChange: (stages: number[]) => void;
    renderChipExtra?: (stage: number) => ReactNode;
    // Ends the row, e.g. a song's `⋮`.
    children?: ReactNode;
}>) {
    const isFull = stages.length >= maxPaneCount;
    const stagesRef = useAppCurrentRef(stages);
    const maxPaneCountRef = useAppCurrentRef(maxPaneCount);
    const isWithIncrementRef = useAppCurrentRef(isWithIncrement);
    const onStagesChangeRef = useAppCurrentRef(onStagesChange);

    // The same menu the mini screen's `St:` badge opens, and deliberately so:
    // that one is where a stage number is CHOSEN for a projector, this one is
    // where the pane that previews it is added, and a volunteer who learns one
    // has learned the other. So it offers the same shortlist of numbers (plus,
    // for a song, the same Increment past the end of it -- the shortlist alone
    // could never reach the stage a screen was already set to). A number
    // already on screen stays LISTED and disabled rather than disappearing: the
    // menu is then the whole picture, positions do not move under the mouse,
    // and the chips beside the button already say which those are. Each item
    // carries the stage's own accent, the colour its chip and pane wear.
    const handleStageAdding = useCallback((event: any) => {
        const currentStages = stagesRef.current;
        if (currentStages.length >= maxPaneCountRef.current) {
            return;
        }
        const addStage = (stage: number) => {
            onStagesChangeRef.current([...currentStages, stage]);
        };
        const items: ContextMenuItemType[] = Array.from(
            { length: STAGE_NUMBER_CHOICE_COUNT },
            (_, stage) => stage,
        ).map((stage) => {
            return {
                childBefore: genContextMenuItemIcon('easel2', {
                    color: getStageAccentColor(stage),
                }),
                menuElement: `${tran('Stage')} ${stage}`,
                disabled: currentStages.includes(stage),
                onSelect: () => {
                    addStage(stage);
                },
            };
        });
        if (isWithIncrementRef.current) {
            // One past the highest shown, exactly like the mini screen's
            // Increment. `stages` always holds the base stage, so there is
            // nothing for `Math.max` to be empty about.
            const stageToIncrementTo = Math.max(...currentStages) + 1;
            items.push({
                childBefore: genContextMenuItemIcon('plus-circle'),
                menuElement:
                    `${tran('Increment')} · ` +
                    `${tran('Stage')} ${stageToIncrementTo}`,
                onSelect: () => {
                    addStage(stageToIncrementTo);
                },
            });
        }
        showAppContextMenu(event, items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleStageRemoving = useCallback((targetStage: number) => {
        onStagesChangeRef.current(
            stagesRef.current.filter((stage) => stage !== targetStage),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        // This header is a flex item of the card column and was being shrunk
        // below its own content box, so a label that wrapped to a second line
        // got clipped mid-glyph - which is what the Khmer translation does,
        // being about twice the width of the English one. The scss keeps it
        // on a single unshrinkable line: the label truncates with an
        // ellipsis FIRST, then Add Stage folds to its `+`, so the chips --
        // the only sign of which panes are up -- stay visible.
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
                            extra={renderChipExtra?.(stage)}
                        />
                    );
                })}
            </div>
            {/*
                Spelled out rather than a bare `+` glyph: this is the only way
                to get a second stage, so it has to read as an action even to
                someone who has never seen the panel before. It only goes dead
                at the pane ceiling.
            */}
            <button
                type="button"
                className="btn btn-sm btn-outline-info stage-previewer-add"
                disabled={isFull}
                aria-haspopup="menu"
                // The words fold away in a narrow pane (the scss), and the
                // name must not go with them.
                aria-label={tran('Add Stage')}
                title={
                    isFull
                        ? tran('Maximum stages are shown')
                        : tran('Choose a stage to add')
                }
                onClick={handleStageAdding}
            >
                <i className="bi bi-plus-lg" />
                <span className="stage-previewer-add-label">
                    {tran('Add Stage')}
                </span>
            </button>
            {children}
        </div>
    );
}
