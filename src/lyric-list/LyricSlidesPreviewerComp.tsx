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
    getAvailableLyricStages,
    getLyricAppDocumentStageByStage,
} from './lyricHelpers';
import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { getLabelIconName, toIconedLabel } from '../others/labelIconHelpers';
import { getStageAccentColor } from '../_screen/screenHelpers';
import LyricStageStyleFloatingComp from './LyricStageStyleFloatingComp';
import {
    closeLyricStageStyleFloating,
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';

function getLyricAppDocuments(
    stageSetting: string,
    lyricManager: LyricManager,
) {
    // Only stages that HAVE a layout may be shown, and each at most once. A
    // stage with no class of its own resolves to another stage's cached
    // instance, so letting one through renders a duplicate pane rather than a
    // new one. A setting persisted before this was enforced can still name
    // those, hence the filter rather than a plain parse.
    const availableStages = getAvailableLyricStages();
    const stages = [
        ...new Set(
            stageSetting
                .split(',')
                .map((stage) => parseInt(stage.trim(), 10))
                .filter((stage) => availableStages.includes(stage))
                .filter((stage) => stage !== BASE_STAGE),
        ),
    ];
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
    // The lowest stage that has a layout and is not on screen yet. `null` once
    // every one of them is shown, which is what disables the add button —
    // previously it just kept incrementing past the last real stage.
    const nextStage = useMemo(() => {
        const unusedStages = getAvailableLyricStages().filter((stage) => {
            return !stages.includes(stage);
        });
        return unusedStages.length === 0 ? null : unusedStages[0];
    }, [stages]);
    const nextStageRef = useAppCurrentRef(nextStage);

    const handleStageAdding = useCallback(() => {
        if (nextStageRef.current === null) {
            return;
        }
        const newStages = [...stagesRef.current, nextStageRef.current].filter(
            (stage) => stage !== BASE_STAGE,
        );
        setStageSetting(newStages.join(','));
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
                    even to someone who has never seen the panel before.
                    Disabled once every stage that HAS a layout is on screen —
                    it used to keep counting upwards and each extra chip added a
                    pane rendering a duplicate of the last real stage.
                */}
                <button
                    type="button"
                    className="btn btn-sm btn-outline-info stage-previewer-add"
                    disabled={nextStage === null}
                    title={tran(
                        nextStage === null
                            ? 'All stage layouts are shown'
                            : 'Add another stage layout',
                    )}
                    onClick={handleStageAdding}
                >
                    <i className="bi bi-plus-lg" />
                    <span className="stage-previewer-add-label">
                        {tran('Add Stage')}
                    </span>
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary stage-previewer-more"
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
