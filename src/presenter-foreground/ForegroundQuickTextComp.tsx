import {
    type ChangeEvent,
    useCallback,
    useMemo,
    type CSSProperties,
} from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
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
import PropRowComp from './ForegroundPropRowComp';
import type { ForegroundQuickTextDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
import { renderMarkdown } from '../lyric-list/markdownHelpers';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';

/** The keys ONE session of this panel owns beyond its Properties. */
function genOwnSettingNames(suffix: string) {
    return [
        `foreground-quick-text-setting${suffix}`,
        `foreground-quick-text-time-delay${suffix}`,
        `foreground-quick-text-time-to-live${suffix}`,
    ];
}

function refreshAllQuickText(
    showingScreenIds: [number, ForegroundQuickTextDataType][],
    extraStyle: CSSProperties,
) {
    for (const [screenId, data] of showingScreenIds) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setQuickTextData(null);
                screenForegroundManager.setQuickTextData({
                    ...data,
                    extraStyle,
                });
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
}: Readonly<{ sessionId: string; suffix: string; prefix: string }>) {
    // No screen subscription of its own: the wrapper below holds one and this
    // is its child, so a second would cost a listener for the same redraw.
    // Per-instance: nothing here may assume this panel stays a single mount.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const [markdownText, setMarkdownText] = useStateSettingString<string>(
        `foreground-quick-text-setting${suffix}`,
        '## This is Title\n\ntext **bold** and *italic*.',
    );
    const [timeSecondDelay, setTimeSecondDelay] = useStateSettingNumber(
        `foreground-quick-text-time-delay${suffix}`,
        0,
    );
    const [timeSecondToLive, setTimeSecondToLive] = useStateSettingNumber(
        `foreground-quick-text-time-to-live${suffix}`,
        3,
    );

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
    const {
        genStyle,
        fontFamily,
        fontWeight,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                // THIS session's quick text only -- see the stopwatch panel.
                refreshAllQuickText(
                    toSessionShowingList(showingRef.current, sessionId),
                    extraStyle,
                );
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
            );
        },
        [
            getRenderedHtml,
            timeSecondDelay,
            timeSecondToLive,
            genStyle,
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
            screenForegroundManager.setQuickTextData({
                // A LIVE drop from this panel is this session acting; a
                // run-sheet row replayed weeks later carries none.
                id: sessionId || undefined,
                htmlText: await getRenderedHtml(),
                timeSecondDelay,
                timeSecondToLive,
                extraStyle: genStyle(),
            });
        },
        [
            getRenderedHtml,
            timeSecondDelay,
            timeSecondToLive,
            genStyle,
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
    const handleQuickTextDragStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        // The markdown source travels, not the rendered html: rendering is
        // async and a drag payload has to be built synchronously.
        handleDragStart(
            event,
            genForegroundDragInf('quick-text', () => {
                return {
                    markdownText: markdownTextRef.current,
                    timeSecondDelay: timeSecondDelayRef.current,
                    timeSecondToLive: timeSecondToLiveRef.current,
                    extraStyle: genStyleRef.current(),
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
                <div className="d-flex">
                    <div className="ms-auto d-flex gap-2">
                        <SavedTextSessionButtonsComp
                            settingName="foreground-quick-text-saved-sessions"
                            label="Quick Text"
                            text={markdownText}
                            onPickText={setMarkdownText}
                        />
                    </div>
                </div>
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
    // One session is one notice ready to go -- this week's announcement in
    // one, the standing 'phones off' in another, each with its own delay,
    // its own seconds on screen and its own look.
    const {
        activeId,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'quick-text',
        toPrefix: (sessionSuffix) => {
            return `quick-text${sessionSuffix}`;
        },
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId);
            });
        },
        hideSession: (sessionId) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId)) {
                    handleHiding(screenId);
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
            />
        </ForegroundLayoutComp>
    );
}
