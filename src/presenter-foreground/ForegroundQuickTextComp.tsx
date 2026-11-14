import {
    type ChangeEvent,
    type MouseEvent,
    useCallback,
    useMemo,
    useState,
    type CSSProperties,
} from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundSessionShowingList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import PropRowComp from './ForegroundPropRowComp';
import {
    type ForegroundQuickTextDataType,
    toQuickTextInfinitePart,
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
    QUICK_TEXT_WIDGET_KEY,
    toQuickTextPrefix,
    toQuickTextSettingName,
    toQuickTextTimeDelaySettingName,
    toQuickTextTimeToLiveSettingName,
    toQuickTextIsInfiniteSettingName,
} from './quickTextPresetHelpers';
import {
    QUICK_TEXT_DEFAULT_DELAY_SECOND,
    QUICK_TEXT_DEFAULT_LIVE_SECOND,
} from './foregroundComponentRules';
import {
    QUICK_TEXT_DEFAULT_MARKDOWN,
    type QuickTextReadingPaceType,
    genQuickTextReadingSeconds,
    toNextQuickTextReadingPace,
} from './quickTextFormatHelpers';
import QuickTextMarkdownLessonComp from './QuickTextMarkdownLessonComp';

/** The keys ONE session of this panel owns beyond its Properties. */
function genOwnSettingNames(suffix: string) {
    return [
        toQuickTextSettingName(suffix),
        toQuickTextTimeDelaySettingName(suffix),
        toQuickTextTimeToLiveSettingName(suffix),
        toQuickTextIsInfiniteSettingName(suffix),
    ];
}

/**
 * The box's height, Edit and Preview alike so switching does not jump: 120px
 * held about four lines of a verse (2026-11-10, the user: _make textarea
 * height higher_). It can still be dragged taller.
 */
const QUICK_TEXT_BOX_HEIGHT = '220px';

/** A pace's name, as written on the Live box's reading button. */
function toReadingPaceLabel(pace: QuickTextReadingPaceType) {
    if (pace === 'slow') {
        return tran('Slow');
    }
    return pace === 'medium' ? tran('Medium') : tran('Fast');
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
                height: QUICK_TEXT_BOX_HEIGHT,
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
                // Only THIS session's overlay is drawn afresh.
                screenForegroundManager.removeSessionData(
                    'quickTextDataList',
                    data,
                );
                screenForegroundManager.setQuickTextData(
                    withForegroundLayer({ ...data, extraStyle }, isBehind),
                );
            },
        );
    }
}

/** Takes THIS overlay's session off the screen; other sessions' stay up. */
function handleHiding(screenId: number, data: ForegroundQuickTextDataType) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeSessionData('quickTextDataList', data);
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
    isLessonOpen,
    setIsLessonOpen,
}: Readonly<{
    sessionId: string;
    suffix: string;
    prefix: string;
    /** THIS session's quick texts only -- see `toSessionShowingList`. */
    showingScreenIdDataList: [number, ForegroundQuickTextDataType][];
    /** Held by the wrapper, so switching session keeps the choice. */
    isPreviewing: boolean;
    setIsPreviewing: (isPreviewing: boolean) => void;
    /** Held by the wrapper too, for the same reason. */
    isLessonOpen: boolean;
    setIsLessonOpen: (isLessonOpen: boolean) => void;
}>) {
    // No screen subscription of its own: the wrapper below holds one and this
    // is its child, so a second would cost a listener for the same redraw.
    // Per-instance: nothing here may assume this panel stays a single mount.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const [markdownText, setMarkdownText] = useStateSettingString<string>(
        toQuickTextSettingName(suffix),
        QUICK_TEXT_DEFAULT_MARKDOWN,
    );
    // The timing is the SESSION's, like its words: the verse in one stays
    // up until it is hidden, the speaker's name in another for 5 seconds.
    const [timeSecondDelay, setTimeSecondDelay] = useStateSettingNumber(
        toQuickTextTimeDelaySettingName(suffix),
        QUICK_TEXT_DEFAULT_DELAY_SECOND,
    );
    const [timeSecondToLive, setTimeSecondToLive] = useStateSettingNumber(
        toQuickTextTimeToLiveSettingName(suffix),
        QUICK_TEXT_DEFAULT_LIVE_SECOND,
    );
    const [isInfinite, setIsInfinite] = useStateSettingBoolean(
        toQuickTextIsInfiniteSettingName(suffix),
        false,
    );
    // The pace the Live box's reading button last worked the seconds out at:
    // none until it is pressed, so the first press is always Slow.
    const [readingPace, setReadingPace] =
        useState<QuickTextReadingPaceType | null>(null);

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
        // Margins in place of Width, as the Lyric stage style has them.
        isMargin: true,
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
                isInfinite,
            );
        },
        [
            getRenderedHtml,
            timeSecondDelay,
            timeSecondToLive,
            isInfinite,
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
                        ...toQuickTextInfinitePart(isInfinite),
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
            isInfinite,
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
    const setIsInfiniteRef = useAppCurrentRef(setIsInfinite);
    const handleIsInfiniteChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsInfiniteRef.current(event.target.checked);
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
    const readingPaceRef = useAppCurrentRef(readingPace);
    // Live worked out from the words in the box, read slow, then medium,
    // then fast, then slow again, a press each (2026-11-10, the user: _click
    // to get slow click again to get medium again to fast again to slow_).
    const handleReadingPaceClick = useCallback(() => {
        const pace = toNextQuickTextReadingPace(readingPaceRef.current);
        setReadingPace(pace);
        setTimeSecondToLiveRef.current(
            genQuickTextReadingSeconds(markdownTextRef.current, pace),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const timeSecondDelayRef = useAppCurrentRef(timeSecondDelay);
    const timeSecondToLiveRef = useAppCurrentRef(timeSecondToLive);
    const isInfiniteRef = useAppCurrentRef(isInfinite);
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
                        ...toQuickTextInfinitePart(isInfiniteRef.current),
                        extraStyle: genStyleRef.current(),
                    },
                    getIsBehindRef.current(),
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Words the dictionaries already hold, so the title needs no sentence of
    // its own in every language: `Live: Slow / Medium / Fast`.
    const readingPaceTitle =
        `${tran('Live')}: ${tran('Slow')} / ${tran('Medium')} / ` +
        tran('Fast');
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
                 * strip the Properties panel above them is built from, side by
                 * side on one line.
                 */}
                <div className="fg-props-tail fg-props-tail-plain fg-props-tail-inline">
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
                            // Kept, greyed, while Infinite is on: switched
                            // back off, the session's own length is there.
                            disabled={isInfinite}
                            onChange={handleTimeSecondToLiveChange}
                        />
                        <span className="fg-unit-static">s</span>
                        <button
                            type="button"
                            className="fg-reading-pace"
                            title={readingPaceTitle}
                            aria-label={readingPaceTitle}
                            disabled={isInfinite}
                            onClick={handleReadingPaceClick}
                        >
                            <i
                                className="bi bi-speedometer2"
                                aria-hidden="true"
                            />
                            {readingPace === null ? null : (
                                <span>{toReadingPaceLabel(readingPace)}</span>
                            )}
                        </button>
                    </PropRowComp>
                    <PropRowComp
                        iconClassName="bi bi-infinity"
                        label={tran('Infinite')}
                        title={tran(
                            'Keep the text on screen until it is hidden',
                        )}
                        isEngaged={isInfinite}
                    >
                        <input
                            className="form-check-input app-caught-hover-pointer mt-0"
                            type="checkbox"
                            role="switch"
                            aria-label={tran(
                                'Keep the text on screen until it is hidden',
                            )}
                            checked={isInfinite}
                            onChange={handleIsInfiniteChange}
                        />
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
                    {/*
                     * Beside Edit and Preview, not among them: the lesson
                     * opens WITH the box, above it, so the marks can be
                     * copied while typing.
                     */}
                    <button
                        type="button"
                        className="fg-quiet-btn fg-md-lesson-toggle"
                        aria-pressed={isLessonOpen}
                        title={tran('Markdown Lesson')}
                        onClick={() => {
                            setIsLessonOpen(!isLessonOpen);
                        }}
                    >
                        <i className="bi bi-mortarboard" aria-hidden="true" />
                        <span>{tran('Markdown Lesson')}</span>
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
                {isLessonOpen ? (
                    <QuickTextMarkdownLessonComp
                        fontFamily={fontFamily}
                        fontWeight={fontWeight}
                    />
                ) : null}
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
                            height: QUICK_TEXT_BOX_HEIGHT,
                        }}
                    />
                )}
            </div>
            <div className="fg-actions-dock">
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
    // One row per SESSION's overlay: every session owns its own on a screen.
    const showingScreenIdDataList =
        getForegroundSessionShowingList('quickTextDataList');
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // Up here, not in the body: the body is keyed by the session, and an
    // operator previewing one notice is previewing the next one too.
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isLessonOpen, setIsLessonOpen] = useState(false);
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
                    handleHiding(screenId, data);
                }
            }
        },
    });
    return (
        <ForegroundLayoutComp target="quick-text">
            {sessionsElement}
            <QuickTextBodyComp
                key={activeId}
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
                isLessonOpen={isLessonOpen}
                setIsLessonOpen={setIsLessonOpen}
            />
        </ForegroundLayoutComp>
    );
}
