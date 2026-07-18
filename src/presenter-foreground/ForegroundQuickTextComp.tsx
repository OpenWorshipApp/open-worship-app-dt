import { type ChangeEvent, useCallback, type CSSProperties } from 'react';

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
import type { ForegroundQuickTextDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
import { renderMarkdown } from '../lyric-list/markdownHelpers';
import { dragStore } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllQuickText(
    showingScreenIds: [number, ForegroundQuickTextDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
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
    });
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setQuickTextData(null);
    });
}

export default function ForegroundQuickTextComp() {
    useScreenForegroundManagerEvents(['update']);
    const [markdownText, setMarkdownText] = useStateSettingString<string>(
        'foreground-quick-text-setting',
        '## This is Title\n\ntext **bold** and *italic*.',
    );
    const [timeSecondDelay, setTimeSecondDelay] = useStateSettingNumber(
        'foreground-quick-text-time-delay',
        0,
    );
    const [timeSecondToLive, setTimeSecondToLive] = useStateSettingNumber(
        'foreground-quick-text-time-to-live',
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
    const {
        genStyle,
        fontFamily,
        fontWeight,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix: 'quick-text',
        onChange: (extraStyle) => {
            refreshAllQuickText(showingScreenIdDataList, extraStyle);
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
            );
        },
        [getRenderedHtml, timeSecondDelay, timeSecondToLive, genStyle],
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
                htmlText: await getRenderedHtml(),
                timeSecondDelay,
                timeSecondToLive,
                extraStyle: genStyle(),
            });
        },
        [getRenderedHtml, timeSecondDelay, timeSecondToLive, genStyle],
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
    const handleQuickTextDragStart = useCallback(() => {
        dragStore.onDropped = handleByDroppedRef.current;
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
        <ForegroundLayoutComp
            target="quick-text"
            fullChildHeaders={<h4>{tran('Quick Text')}</h4>}
            childHeadersOnHidden={genHidingElement(true)}
            isOnScreen={showingScreenIdDataList.length > 0}
        >
            {propsSetting}
            <hr />
            <div className="d-flex flex-column gap-2">
                <div className="d-flex flex-wrap gap-2">
                    <div
                        className="input-group"
                        title={tran('Seconds to wait before showing the text')}
                        style={{
                            width: '220px',
                        }}
                    >
                        <span className="input-group-text">
                            <i className="bi bi-hourglass-top" />
                        </span>
                        <span className="input-group-text">
                            {tran('Delay')}
                        </span>
                        <input
                            className="form-control"
                            type="number"
                            min="0"
                            value={timeSecondDelay}
                            onChange={handleTimeSecondDelayChange}
                        />
                        <span className="input-group-text">s</span>
                    </div>
                    <div
                        className="input-group"
                        title={tran('Seconds the text stays on screen')}
                        style={{
                            width: '220px',
                        }}
                    >
                        <span className="input-group-text">
                            <i className="bi bi-clock" />
                        </span>
                        <span className="input-group-text">{tran('Live')}</span>
                        <input
                            className="form-control"
                            type="number"
                            min="1"
                            value={timeSecondToLive}
                            onChange={handleTimeSecondToLiveChange}
                        />
                        <span className="input-group-text">s</span>
                    </div>
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
                <div className="form-floating">
                    <textarea
                        id="quick-text-textarea"
                        className="form-control"
                        cols={150}
                        rows={20}
                        value={markdownText}
                        onChange={handleMarkdownTextChange}
                        placeholder="Leave a markdown text here"
                        style={{
                            fontFamily: fontFamily || undefined,
                            fontWeight: fontWeight || undefined,
                            height: '150px',
                        }}
                    />
                    <label htmlFor="quick-text-textarea">
                        {tran('Markdown')}
                    </label>
                </div>
                <div className="d-flex">
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
                </div>
            </div>
            <div>{genHidingElement(false)}</div>
        </ForegroundLayoutComp>
    );
}
