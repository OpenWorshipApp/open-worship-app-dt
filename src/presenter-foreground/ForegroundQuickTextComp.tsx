import {
    type ChangeEvent,
    type MouseEvent,
    useCallback,
    useMemo,
    useState,
    type CSSProperties,
} from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import PropRowComp from './ForegroundPropRowComp';
import {
    type ForegroundQuickTextDataType,
    withForegroundLayer,
} from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
import { renderMarkdown } from '../lyric-list/markdownHelpers';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';
import {
    QUICK_TEXT_PRESET_LIST,
    QUICK_TEXT_WIDGET_KEY,
    type QuickTextPresetIdType,
    applyQuickTextPreset,
    toQuickTextPrefix,
    toQuickTextPresetLabel,
    toQuickTextSettingName,
    toQuickTextTimeDelaySettingName,
    toQuickTextTimeToLiveSettingName,
} from './quickTextPresetHelpers';

/** The keys ONE session of this panel owns beyond its Properties. */
function genOwnSettingNames(suffix: string) {
    return [
        toQuickTextSettingName(suffix),
        toQuickTextTimeDelaySettingName(suffix),
        toQuickTextTimeToLiveSettingName(suffix),
    ];
}

// A link in the preview is something to read, not to follow: a press would
// take the whole Presenter window to it.
function handlePreviewLinkClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a') !== null) {
        event.preventDefault();
    }
}

/**
 * The markdown as it will read on the screen -- headings, bold, lists --
 * drawn through the same renderer and the same sanitizer as the screen. It is
 * mounted only while Preview is chosen, so the rendered copy is dropped the
 * moment the operator goes back to Edit.
 */
function QuickTextMarkdownPreviewComp({
    markdownText,
    fontFamily,
    fontWeight,
}: Readonly<{
    markdownText: string;
    fontFamily: string;
    fontWeight: string;
}>) {
    const [html, setHtml] = useState('');
    useAppEffect(() => {
        let isStale = false;
        renderMarkdown(markdownText)
            .then((data) => {
                if (!isStale) {
                    setHtml(sanitizeHtml(data.html));
                }
            })
            .catch((error) => {
                handleError(error);
            });
        return () => {
            isStale = true;
        };
    }, [markdownText]);
    return (
        <div
            className="fg-text-editor fg-markdown-preview"
            data-placeholder={tran('Leave a markdown text here')}
            style={{
                fontFamily: fontFamily || undefined,
                fontWeight: fontWeight || undefined,
                height: '120px',
            }}
            onClick={handlePreviewLinkClick}
            onAuxClick={handlePreviewLinkClick}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function refreshAllQuickText(
    showingScreenIds: [number, ForegroundQuickTextDataType][],
    extraStyle: CSSProperties,
    isBehind: boolean,
) {
    for (const [screenId, data] of showingScreenIds) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setQuickTextData(null);
                screenForegroundManager.setQuickTextData(
                    withForegroundLayer({ ...data, extraStyle }, isBehind),
                );
            },
        );
    }
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setQuickTextData(null);
    });
}

/**
 * The panel, ON ONE SESSION. Everything below reads its setting when it
 * mounts, so the body is keyed by the session in the wrapper underneath --
 * otherwise switching would leave the previous session's words in the box
 * while writing them to the new session's keys.
 */
function QuickTextBodyComp({
    sessionId,
    suffix,
    prefix,
    showingScreenIdDataList,
    isPreviewing,
    setIsPreviewing,
    onPresetApplied,
}: Readonly<{
    sessionId: string;
    suffix: string;
    prefix: string;
    /** THIS session's quick texts only -- see `toSessionShowingList`. */
    showingScreenIdDataList: [number, ForegroundQuickTextDataType][];
    /** Held by the wrapper, so applying a preset does not drop it. */
    isPreviewing: boolean;
    setIsPreviewing: (isPreviewing: boolean) => void;
    /** A preset rewrote this session's keys: remount to read them. */
    onPresetApplied: () => void;
}>) {
    // No screen subscription of its own: the wrapper below holds one and this
    // is its child, so a second would cost a listener for the same redraw.
    // Per-instance: nothing here may assume this panel stays a single mount.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const [markdownText, setMarkdownText] = useStateSettingString<string>(
        toQuickTextSettingName(suffix),
        '## This is Title\n\ntext **bold** and *italic*.',
    );
    const [timeSecondDelay, setTimeSecondDelay] = useStateSettingNumber(
        toQuickTextTimeDelaySettingName(suffix),
        0,
    );
    const [timeSecondToLive, setTimeSecondToLive] = useStateSettingNumber(
        toQuickTextTimeToLiveSettingName(suffix),
        3,
    );

    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    const {
        genStyle,
        getIsBehind,
        getTransition,
        fontFamily,
        fontWeight,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix,
        widgetKey: QUICK_TEXT_WIDGET_KEY,
        onChange: (extraStyle, isBehind) => {
            attemptTimeout(() => {
                refreshAllQuickText(showingRef.current, extraStyle, isBehind);
            });
        },
        isFontSize: true,
    });
    const getRenderedHtml = useCallback(async () => {
        const { html } = await renderMarkdown(markdownText);
        return html;
    }, [markdownText]);
    const handleShowing = useCallback(
        async (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.setQuickText(
                event,
                await getRenderedHtml(),
                timeSecondDelay,
                timeSecondToLive,
                genStyle(),
                isForceChoosing,
                sessionId,
                getIsBehind(),
                getTransition(),
            );
        },
        [
            getRenderedHtml,
            timeSecondDelay,
            timeSecondToLive,
            genStyle,
            getIsBehind,
            getTransition,
            sessionId,
        ],
    );
    const handleShowingRef = useAppCurrentRef(handleShowing);
    const handleContextMenuOpening = useCallback((event: any) => {
        handleShowingRef.current(event, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleByDropped = useCallback(
        async (event: any) => {
            const screenForegroundManager =
                getScreenForegroundManagerByDropped(event);
            if (screenForegroundManager === null) {
                return;
            }
            screenForegroundManager.setQuickTextData(
                withForegroundLayer(
                    {
                        // A LIVE drop from this panel is this session acting;
                        // a run-sheet row replayed weeks later carries none.
                        id: sessionId || undefined,
                        ...toTransitionPart(getTransition()),
                        htmlText: await getRenderedHtml(),
                        timeSecondDelay,
                        timeSecondToLive,
                        extraStyle: genStyle(),
                    },
                    getIsBehind(),
                ),
            );
        },
        [
            getRenderedHtml,
            timeSecondDelay,
            timeSecondToLive,
            genStyle,
            getIsBehind,
            getTransition,
            sessionId,
        ],
    );
    const setTimeSecondDelayRef = useAppCurrentRef(setTimeSecondDelay);
    const handleTimeSecondDelayChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setTimeSecondDelayRef.current(Number.parseInt(e.target.value, 10));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setTimeSecondToLiveRef = useAppCurrentRef(setTimeSecondToLive);
    const handleTimeSecondToLiveChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setTimeSecondToLiveRef.current(Number.parseInt(e.target.value, 10));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setMarkdownTextRef = useAppCurrentRef(setMarkdownText);
    const handleMarkdownTextChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            setMarkdownTextRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const markdownTextRef = useAppCurrentRef(markdownText);
    const timeSecondDelayRef = useAppCurrentRef(timeSecondDelay);
    const timeSecondToLiveRef = useAppCurrentRef(timeSecondToLive);
    const genStyleRef = useAppCurrentRef(genStyle);
    const getIsBehindRef = useAppCurrentRef(getIsBehind);
    const getTransitionRef = useAppCurrentRef(getTransition);
    const handleQuickTextDragStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        // The markdown source travels, not the rendered html: rendering is
        // async and a drag payload has to be built synchronously.
        handleDragStart(
            event,
            genForegroundDragInf('quick-text', () => {
                return withForegroundLayer(
                    {
                        ...toTransitionPart(getTransitionRef.current()),
                        markdownText: markdownTextRef.current,
                        timeSecondDelay: timeSecondDelayRef.current,
                        timeSecondToLive: timeSecondToLiveRef.current,
                        extraStyle: genStyleRef.current(),
                    },
                    getIsBehindRef.current(),
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePresetApplying = (presetId: QuickTextPresetIdType) => {
        if (!applyQuickTextPreset(suffix, presetId)) {
            return;
        }
        // What is up on a screen takes the new look at once, as it does
        // after any Properties change; `genStyle` reads the keys just written.
        refreshAllQuickText(showingRef.current, genStyle(), getIsBehind());
        onPresetApplied();
    };
    const handlePresetApplyingRef = useAppCurrentRef(handlePresetApplying);
    const handlePresetsOpening = useCallback((event: any) => {
        showAppContextMenu(
            event,
            QUICK_TEXT_PRESET_LIST.map((preset) => {
                return {
                    childBefore: genContextMenuItemIcon(preset.iconName),
                    menuElement: toQuickTextPresetLabel(preset.id),
                    onSelect: () => {
                        handlePresetApplyingRef.current(preset.id);
                    },
                };
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
            buttonText={tran('Hide Quick Text')}
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    return (
        <>
            {propsSetting}
            <div className="fg-body">
                {/*
                 * Two numbers that used to be two 220px input-groups of four
                 * segments each -- an icon box, a word box, the field and a
                 * unit box -- for one value apiece. They are rows of the same
                 * strip the Properties panel above them is built from.
                 */}
                <div className="fg-props-tail fg-props-tail-plain">
                    <PropRowComp
                        iconClassName="bi bi-hourglass-top"
                        label={tran('Delay')}
                        title={tran('Seconds to wait before showing the text')}
                        isEngaged={timeSecondDelay !== 0}
                    >
                        <input
                            className="fg-num"
                            type="number"
                            min="0"
                            aria-label={tran(
                                'Seconds to wait before showing the text',
                            )}
                            value={timeSecondDelay}
                            onChange={handleTimeSecondDelayChange}
                        />
                        <span className="fg-unit-static">s</span>
                    </PropRowComp>
                    <PropRowComp
                        iconClassName="bi bi-clock"
                        label={tran('Live')}
                        title={tran('Seconds the text stays on screen')}
                    >
                        <input
                            className="fg-num"
                            type="number"
                            min="1"
                            aria-label={tran(
                                'Seconds the text stays on screen',
                            )}
                            value={timeSecondToLive}
                            onChange={handleTimeSecondToLiveChange}
                        />
                        <span className="fg-unit-static">s</span>
                    </PropRowComp>
                </div>
                <div className="d-flex align-items-center flex-wrap gap-2">
                    {/*
                     * Edit or Preview: one box at a time, the way a comment
                     * box on the web does it -- the panel is too narrow for
                     * the two side by side.
                     */}
                    <span className="fg-chips fg-md-mode" role="group">
                        <button
                            type="button"
                            className={isPreviewing ? undefined : 'fg-chip-on'}
                            aria-pressed={!isPreviewing}
                            onClick={() => {
                                setIsPreviewing(false);
                            }}
                        >
                            <i className="bi bi-pencil" aria-hidden="true" />{' '}
                            {tran('Edit')}
                        </button>
                        <button
                            type="button"
                            className={isPreviewing ? 'fg-chip-on' : undefined}
                            aria-pressed={isPreviewing}
                            onClick={() => {
                                setIsPreviewing(true);
                            }}
                        >
                            <i className="bi bi-eye" aria-hidden="true" />{' '}
                            {tran('Preview')}
                        </button>
                    </span>
                    <button
                        type="button"
                        className="fg-props-toggle fg-presets-toggle"
                        title={tran('Presets')}
                        onClick={handlePresetsOpening}
                    >
                        <i className="bi bi-palette" aria-hidden="true" />
                        <span>{tran('Presets')}</span>
                        <i className="bi bi-chevron-down" aria-hidden="true" />
                    </button>
                    <div className="ms-auto d-flex gap-2">
                        <SavedTextSessionButtonsComp
                            settingName="foreground-quick-text-saved-sessions"
                            label="Quick Text"
                            text={markdownText}
                            onPickText={setMarkdownText}
                        />
                    </div>
                </div>
                {isPreviewing ? (
                    <QuickTextMarkdownPreviewComp
                        markdownText={markdownText}
                        fontFamily={fontFamily}
                        fontWeight={fontWeight}
                    />
                ) : (
                    <textarea
                        id="quick-text-textarea"
                        className="fg-text-editor"
                        aria-label={tran('Markdown')}
                        value={markdownText}
                        onChange={handleMarkdownTextChange}
                        placeholder={tran('Leave a markdown text here')}
                        style={{
                            fontFamily: fontFamily || undefined,
                            fontWeight: fontWeight || undefined,
                            height: '120px',
                        }}
                    />
                )}
                <div className="fg-actions">
                    <button
                        className="btn btn-primary"
                        title={tran('Show Quick Text')}
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={handleQuickTextDragStart}
                    >
                        <i className="bi bi-display" />{' '}
                        {tran('Show Quick Text')}
                    </button>
                    <ContextMenuDotsButtonComp
                        label={tran('Show on Screens')}
                        onOpening={handleContextMenuOpening}
                    />
                    {genHidingElement(false)}
                </div>
            </div>
        </>
    );
}

export default function ForegroundQuickTextComp() {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.quickTextData !== null;
        },
    )
        .map(
            ([screenId, data]):
                [number, ForegroundQuickTextDataType] | null => {
                if (data.quickTextData === null) {
                    return null;
                }
                return [screenId, data.quickTextData];
            },
        )
        .filter((item) => {
            return item !== null;
        });
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // Up here, not in the body: a preset remounts the body (below), and the
    // operator who was previewing should still be.
    const [isPreviewing, setIsPreviewing] = useState(false);
    // Bumped by a preset. The body and its Properties read their settings
    // when they mount, so this is what makes them show the preset's values.
    const [lookVersion, setLookVersion] = useState(0);
    // One session is one notice ready to go -- this week's announcement in
    // one, the standing 'phones off' in another, each with its own delay,
    // its own seconds on screen and its own look.
    const {
        activeId,
        sessionIds,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: QUICK_TEXT_WIDGET_KEY,
        toPrefix: toQuickTextPrefix,
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId, _sessionSuffix, idList) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId, idList);
            });
        },
        hideSession: (sessionId, _sessionSuffix, idList) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId, idList)) {
                    handleHiding(screenId);
                }
            }
        },
    });
    return (
        <ForegroundLayoutComp target="quick-text">
            {sessionsElement}
            <QuickTextBodyComp
                key={`${activeId}:${lookVersion}`}
                sessionId={activeId}
                suffix={suffix}
                prefix={prefix}
                showingScreenIdDataList={toSessionShowingList(
                    showingScreenIdDataList,
                    activeId,
                    sessionIds,
                )}
                isPreviewing={isPreviewing}
                setIsPreviewing={setIsPreviewing}
                onPresetApplied={() => {
                    setLookVersion((version) => {
                        return version + 1;
                    });
                }}
            />
        </ForegroundLayoutComp>
    );
}
