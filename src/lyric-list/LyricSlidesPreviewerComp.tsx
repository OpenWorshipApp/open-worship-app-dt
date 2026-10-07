import '../app-document-presenter/items/SlidePreviewer.scss';

import { useCallback, useMemo } from 'react';

import { VaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';
import VarySlidesPreviewerComp from '../app-document-presenter/items/VarySlidesPreviewerComp';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { useStateSettingString } from '../helper/settingHelpers';
import { useLyricManagerContext } from './LyricManager';
import type LyricManager from './LyricManager';
import { type DataInputType } from '../resize-actor/flexSizeHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import type LyricAppDocument from './LyricAppDocument';
import { getLyricAppDocumentStageByStage } from './lyricHelpers';
import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getLabelIconName } from '../others/labelIconHelpers';
import LyricStageStyleFloatingComp from './LyricStageStyleFloatingComp';
import {
    closeLyricStageStyleFloating,
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { exportLyricStagesToPptx } from './lyricPptxExportHelpers';
import { genDocumentTransitionMenuItems } from '../others/slideTransitionMenuHelpers';
import StagePreviewerHeaderComp, {
    genStageAccentStyle,
    parseStagePaneSetting,
    toStagePaneSetting,
} from '../app-document-presenter/stage/StagePreviewerHeaderComp';

function getLyricAppDocuments(
    stageSetting: string,
    lyricManager: LyricManager,
) {
    const stages = parseStagePaneSetting(stageSetting, MAX_STAGE_PANE_COUNT);
    const entries = stages.map((stage) => {
        return getLyricAppDocumentStageByStage(lyricManager.filePath, stage);
    }) as [number, LyricAppDocument][];
    entries.forEach(([_, lyricAppDocument]) => {
        lyricAppDocument.openLyric = lyricManager.openLyricPreviewer;
    });
    return [stages, entries] as const;
}

/**
 * How many stage panes may be open at once, the base stage included.
 *
 * Stage numbers themselves are unbounded — this is the only ceiling, and it is
 * a memory one: a pane holds a whole song's rendered HTML, and they are laid
 * out side by side, so the eighth is already unreadable before it is
 * expensive. Eight is also where the stage accent colours start repeating.
 */
const MAX_STAGE_PANE_COUNT = 8;

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

    const lyricAppDocumentEntriesRef = useAppCurrentRef(
        lyricAppDocumentEntries,
    );

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
    const handleMoreOptions = useCallback(async (event: any) => {
        // The song's own transition, the same row each stage pane's ⋮ offers:
        // it is one per song, whichever stage it is shown on.
        const transitionMenuItems = await genDocumentTransitionMenuItems(
            lyricManagerRef.current.fileSource.filePath,
        );
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
            ...transitionMenuItems,
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleStagesChange = useCallback((newStages: number[]) => {
        setStageSetting(toStagePaneSetting(newStages));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const renderStageStyleButton = useCallback(
        (stage: number) => {
            return (
                <RenderStageStyleButtonComp ownerId={ownerId} stage={stage} />
            );
        },
        [ownerId],
    );

    return (
        <div className="w-100 h-100 app-overflow-hidden card stage-previewer lyric-slides-previewer">
            {/*
                The gear is on EVERY chip, the base stage included: stage 0
                cannot be removed, but how it renders is just as configurable
                as any other stage's.
            */}
            <StagePreviewerHeaderComp
                stages={stages}
                maxPaneCount={MAX_STAGE_PANE_COUNT}
                isWithIncrement
                onStagesChange={handleStagesChange}
                renderChipExtra={renderStageStyleButton}
            >
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
            </StagePreviewerHeaderComp>
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
