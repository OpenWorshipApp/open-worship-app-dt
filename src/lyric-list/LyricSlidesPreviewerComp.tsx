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
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import type LyricAppDocument from './LyricAppDocument';
import {
    checkIsValidLyricStage,
    getLyricAppDocumentStageByStage,
} from './lyricHelpers';
import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getLabelIconName, toIconedLabel } from '../others/labelIconHelpers';
import {
    getStageAccentColor,
    STAGE_NUMBER_CHOICE_COUNT,
} from '../_screen/screenHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import LyricStageStyleFloatingComp from './LyricStageStyleFloatingComp';
import {
    closeLyricStageStyleFloating,
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { exportLyricStagesToPptx } from './lyricPptxExportHelpers';

function getLyricAppDocuments(
    stageSetting: string,
    lyricManager: LyricManager,
) {
    // Any non-negative integer is a stage, each at most once, SORTED so the
    // panes read left to right in stage order whatever order the setting names
    // them in. The cap is the memory guard: every pane renders the whole song
    // again, so a hand-edited setting naming forty stages must not open forty
    // panes — and past a handful they are slivers nobody can read anyway.
    const stages = [
        ...new Set(
            stageSetting
                .split(',')
                .map((stage) => parseInt(stage.trim(), 10))
                .filter(checkIsValidLyricStage)
                .filter((stage) => stage !== BASE_STAGE),
        ),
    ]
        .sort((stageA, stageB) => stageA - stageB)
        .slice(0, MAX_STAGE_PANE_COUNT - 1);
    stages.unshift(BASE_STAGE);

    const entries = stages.map((stage) => {
        return getLyricAppDocumentStageByStage(lyricManager.filePath, stage);
    }) as [number, LyricAppDocument][];
    entries.forEach(([_, lyricAppDocument]) => {
        lyricAppDocument.openLyric = lyricManager.openLyricPreviewer;
    });
    return [stages, entries] as const;
}

const BASE_STAGE = 0;

/**
 * How many stage panes may be open at once, the base stage included.
 *
 * Stage numbers themselves are unbounded — this is the only ceiling, and it is
 * a memory one: a pane holds a whole song's rendered HTML, and they are laid
 * out side by side, so the eighth is already unreadable before it is
 * expensive. Eight is also where the stage accent colours start repeating.
 */
const MAX_STAGE_PANE_COUNT = 8;

const STAGE_ACCENT_VAR_NAME = '--stage-accent';

function genStageAccentStyle(stage: number) {
    return {
        [STAGE_ACCENT_VAR_NAME]: getStageAccentColor(stage),
    } as CSSProperties;
}

/**
 * The gear that opens this stage's slide style panel.
 *
 * On EVERY chip, the base stage included: stage 0 cannot be removed, but how it
 * renders is just as configurable as any other stage's.
 */
function RenderStageStyleButtonComp({
    ownerId,
    stage,
}: Readonly<{
    ownerId: string;
    stage: number;
}>) {
    const openedStage = useLyricStageStyleFloatingStage(ownerId);
    const isOpened = openedStage === stage;
    const label = `${tran('Stage Style')} ${stage}`;
    return (
        <button
            type="button"
            className={
                'stage-previewer-chip-config' + (isOpened ? ' is-active' : '')
            }
            title={label}
            aria-label={label}
            aria-pressed={isOpened}
            onClick={() => {
                toggleLyricStageStyleFloatingStage(ownerId, stage);
            }}
            style={{
                padding: 2,
            }}
        >
            <i
                className="bi bi-gear-fill"
                style={{
                    color: 'var(--bs-secondary)',
                }}
            />
        </button>
    );
}

/**
 * One stage, shown as a chip. The point is that the control tells you what it
 * does without being tried: a removable stage carries its own visible `×`, and
 * the base stage says why it has none. Before, the stage numbers were bare text
 * whose only clue was a `title` on hover.
 */
function RenderStageChipComp({
    ownerId,
    stage,
    onRemove,
}: Readonly<{
    ownerId: string;
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
                <RenderStageStyleButtonComp ownerId={ownerId} stage={stage} />
            </span>
        );
    }
    const removeLabel = `${tran('Remove Stage')} ${stage}`;
    return (
        <span className="stage-previewer-chip" style={accentStyle}>
            {label}
            <RenderStageStyleButtonComp ownerId={ownerId} stage={stage} />
            <button
                type="button"
                className="stage-previewer-chip-remove"
                title={removeLabel}
                aria-label={removeLabel}
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

function PreviewBlockComp({
    stage,
    lyricAppDocument,
}: Readonly<{
    stage: number;
    lyricAppDocument: LyricAppDocument;
}>) {
    return (
        <div
            className="w-100 h-100 app-overflow-hidden stage-previewer-pane"
            style={genStageAccentStyle(stage)}
        >
            <VaryAppDocumentContext value={lyricAppDocument}>
                <VarySlidesPreviewerComp />
            </VaryAppDocumentContext>
        </div>
    );
}

export default function LyricSlidesPreviewerComp() {
    const lyricManager = useLyricManagerContext();
    // This previewer's identity in the shared style-panel store. More than one
    // previewer can be mounted (a floating document preview of a `.owl` renders
    // a second one), and they all host the same single-slot widget — so the
    // store has to be able to tell whose gear was clicked.
    const ownerId = useMemo(() => {
        return genLyricStageStyleFloatingOwnerId();
    }, []);
    // A panel left behind by a previewer that is gone would be styling a stage
    // nothing on screen is showing, and its `onChanged` would refresh a lyric
    // that is no longer previewed.
    useAppEffect(() => {
        return () => {
            closeLyricStageStyleFloating(ownerId);
        };
    }, [ownerId]);
    const [stageSetting, setStageSetting] = useStateSettingString(
        'lyric-slides-previewer-stages',
        '0',
    );
    const [stages, lyricAppDocumentEntries] = useMemo(() => {
        return getLyricAppDocuments(stageSetting, lyricManager);
    }, [stageSetting, lyricManager]);

    // The file moved on disk, so the slides every pane derived from it are
    // stale. ORDER IS LOAD-BEARING: the previewer is re-fed first and the
    // caches dropped second — a pane that re-derives in between would re-fill
    // its cache from the text the previewer still holds, and stay stale for the
    // cache's full 3 minutes.
    useFileSourceEvents(
        ['update'],
        async () => {
            await lyricManager.refreshOpenLyricContent();
            lyricAppDocumentEntries.forEach(([_, lyricAppDocument]) => {
                lyricAppDocument.clearCache();
            });
        },
        [lyricAppDocumentEntries],
        lyricManager.filePath,
    );

    const stagesRef = useAppCurrentRef(stages);
    // The stage a new one gets: one past the highest shown, exactly like the
    // mini screen's Increment. `stages` always holds the base stage, so there
    // is nothing for `Math.max` to be empty about.
    const nextStage = useMemo(() => {
        return Math.max(...stages) + 1;
    }, [stages]);
    const nextStageRef = useAppCurrentRef(nextStage);
    const isFull = stages.length >= MAX_STAGE_PANE_COUNT;
    const lyricAppDocumentEntriesRef = useAppCurrentRef(
        lyricAppDocumentEntries,
    );

    // The same menu the mini screen's `St:` badge opens, and deliberately so:
    // that one is where a stage number is CHOSEN for a projector, this one is
    // where the pane that previews it is added, and a volunteer who learns one
    // has learned the other. So it offers the same shortlist of numbers plus
    // the same Increment past the end of it — stage numbers have no ceiling,
    // and the shortlist alone could never reach the stage a screen was already
    // set to. A number already on screen stays LISTED and disabled rather than
    // disappearing: the menu is then the whole picture, positions do not move
    // under the mouse, and the chips beside the button already say which those
    // are. Each item carries the stage's own accent, the colour its chip and
    // pane wear.
    const handleStageAdding = useCallback((event: any) => {
        const currentStages = stagesRef.current;
        if (currentStages.length >= MAX_STAGE_PANE_COUNT) {
            return;
        }
        const addStage = (stage: number) => {
            // Sorted, so the panes read left to right in stage order whatever
            // order they were picked in.
            const newStages = [...currentStages, stage]
                .filter((eachStage) => eachStage !== BASE_STAGE)
                .sort((stageA, stageB) => stageA - stageB);
            setStageSetting(newStages.join(','));
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
        const stageToIncrementTo = nextStageRef.current;
        items.push({
            childBefore: genContextMenuItemIcon('plus-circle'),
            menuElement:
                `${tran('Increment')} · ` +
                `${tran('Stage')} ${stageToIncrementTo}`,
            onSelect: () => {
                addStage(stageToIncrementTo);
            },
        });
        showAppContextMenu(event, items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Every pane listens on the lyric's own file source, so ONE update event
    // refreshes them all — the same channel `initOpenLyric`'s `saveSetting`
    // override already uses for the font-size control. No debounce here: the
    // panel collapses a drag into one call, and `useVarySlidesData` adds its own
    // trailing 500ms per pane. Panes for OTHER stages re-derive from an
    // unchanged cache key, so they cost a cache hit rather than a re-render.
    const lyricManagerRef = useAppCurrentRef(lyricManager);
    const handleStyleChanged = useCallback(() => {
        lyricManagerRef.current.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The same `Reload` a stage pane already offers on right-click, but reachable
    // from the header: nothing on a pane says the menu is there, and one
    // `fireUpdateEvent` on the lyric's own file source refreshes EVERY pane at
    // once - so it belongs to the previewer rather than to any one stage.
    const handleMoreOptions = useCallback((event: any) => {
        showAppContextMenu(event, [
            genLyricReloadContextMenuItem(() => {
                lyricManagerRef.current.fileSource.fireUpdateEvent();
            }),
            {
                childBefore: genContextMenuItemIcon('filetype-pptx'),
                menuElement: tran('Export to PPTX'),
                onSelect: () => {
                    void exportLyricStagesToPptx(
                        lyricAppDocumentEntriesRef.current,
                    );
                },
            },
        ]);
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
                                ownerId={ownerId}
                                stage={stage}
                                onRemove={handleStageRemoving}
                            />
                        );
                    })}
                </div>
                {/*
                    Spelled out rather than a bare `+` glyph: this is the only
                    way to get a second stage, so it has to read as an action
                    even to someone who has never seen the panel before. It only
                    ever goes dead at the pane ceiling — there is no highest
                    stage to run out of.
                */}
                <button
                    type="button"
                    className="btn btn-sm btn-outline-info stage-previewer-add"
                    disabled={isFull}
                    aria-haspopup="menu"
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
                <button
                    type="button"
                    className={
                        'btn btn-sm btn-outline-secondary stage-previewer-more' +
                        ' app-context-menu-dots'
                    }
                    title={tran('More Options')}
                    aria-label={tran('More Options')}
                    onClick={handleMoreOptions}
                >
                    <i className="bi bi-three-dots-vertical" />
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
                                            <PreviewBlockComp
                                                stage={stage}
                                                lyricAppDocument={
                                                    lyricAppDocument
                                                }
                                            />
                                        );
                                    },
                                },
                            };
                            return inputData;
                        },
                    )}
                />
            </div>
            <LyricStageStyleFloatingComp
                ownerId={ownerId}
                onChanged={handleStyleChanged}
            />
        </div>
    );
}
