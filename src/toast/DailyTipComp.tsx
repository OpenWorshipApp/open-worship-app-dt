import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { askToEnableAI } from '../helper/ai/aiEnableHelpers';
import { useAppEffect } from '../helper/appHooks';
import {
    registerAppMenuClicked,
    setAppMenuItems,
    tran,
} from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { checkIsMainWindow } from '../server/appHelpers';
import {
    DAILY_TIP_AUTO_CLOSE_MS,
    getDailyTipSessionKey,
    getDailyTipPageLabel,
    disableDailyTips,
    getAreDailyTipsDisabled,
    getDailyTipAutoShowDelay,
    getDailyTipPage,
    getDailyTips,
    pickDailyTipIndex,
    rememberDailyTip,
    startDailyTipGuide,
} from './dailyTipHelpers';
import type { DailyTipPageType } from './dailyTipHelpers';

const MENU_KEY = 'daily-tips';

type DailyTipMenuClickType = {
    isOpenDailyTip?: boolean;
    isBrowseDailyTips?: boolean;
};

// Read again when the delay ends: "Don't show again" may have been pressed in
// Settings meanwhile, or a tip already opened from Help.
function checkIsAutoTipBlocked(page: DailyTipPageType) {
    return (
        getAreDailyTipsDisabled() ||
        globalThis.sessionStorage.getItem(getDailyTipSessionKey(page)) ===
            'true'
    );
}

function markAutoTipShown(page: DailyTipPageType) {
    globalThis.sessionStorage.setItem(getDailyTipSessionKey(page), 'true');
}

export default function DailyTipComp() {
    const page = getDailyTipPage(appProvider.currentHomePage);
    const tips = useMemo(
        () => (page === null ? [] : getDailyTips(page)),
        [page],
    );
    const [tipIndex, setTipIndex] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isBrowsing, setIsBrowsing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const tip = tipIndex === null ? null : (tips[tipIndex] ?? null);
    const filteredTips = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        return tips
            .map((listedTip, index) => ({ listedTip, index }))
            .filter(({ listedTip }) => {
                return (
                    query.length === 0 ||
                    [
                        listedTip.title,
                        listedTip.detail,
                        listedTip.category ?? '',
                    ].some((text) => {
                        return text.toLocaleLowerCase().includes(query);
                    })
                );
            });
    }, [searchText, tips]);

    const openTip = useCallback(() => {
        if (page === null || tips.length === 0) {
            return;
        }
        // A tip asked for from Help stands in for this page's automatic one.
        markAutoTipShown(page);
        setErrorMessage('');
        setIsBrowsing(false);
        setTipIndex(pickDailyTipIndex(page, tips));
    }, [page, tips]);

    const openAllTips = useCallback(() => {
        if (page === null || tips.length === 0) {
            return;
        }
        markAutoTipShown(page);
        setErrorMessage('');
        setSearchText('');
        setTipIndex((oldIndex) => {
            return oldIndex ?? pickDailyTipIndex(page, tips);
        });
        setIsBrowsing(true);
    }, [page, tips]);

    const showAutoTip = useCallback(() => {
        if (
            page === null ||
            tips.length === 0 ||
            checkIsAutoTipBlocked(page) ||
            !appProvider.getIsWindowFocused()
        ) {
            return;
        }
        markAutoTipShown(page);
        setTipIndex((oldIndex) => {
            return oldIndex ?? pickDailyTipIndex(page, tips);
        });
    }, [page, tips]);

    useAppEffect(() => {
        if (page === null || checkIsAutoTipBlocked(page)) {
            return;
        }
        const timeoutId = setTimeout(showAutoTip, getDailyTipAutoShowDelay());
        const handleFocus = () => {
            if (getDailyTipAutoShowDelay() === 0) showAutoTip();
        };
        globalThis.addEventListener('focus', handleFocus);
        return () => {
            clearTimeout(timeoutId);
            globalThis.removeEventListener('focus', handleFocus);
        };
    }, [page, showAutoTip]);

    useAppEffect(() => {
        if (page === null) {
            return;
        }
        const unregister = registerAppMenuClicked<DailyTipMenuClickType>(
            (_event, data) => {
                if (data?.isOpenDailyTip && appProvider.getIsWindowFocused()) {
                    openTip();
                }
                if (
                    data?.isBrowseDailyTips &&
                    appProvider.getIsWindowFocused()
                ) {
                    openAllTips();
                }
            },
        );
        // The main window owns the shared menu; every supported window listens.
        // Closing a popup must not withdraw the menu for the remaining windows.
        if (checkIsMainWindow())
            setAppMenuItems(
                MENU_KEY,
                {
                    help: [
                        {
                            label: tran('Tips of the Day'),
                            clickData: { isOpenDailyTip: true },
                        },
                        {
                            label: tran('All tips'),
                            clickData: { isBrowseDailyTips: true },
                        },
                    ],
                },
                { isRoutedToFocusedWindow: true },
            );
        return () => {
            unregister();
            if (checkIsMainWindow()) setAppMenuItems(MENU_KEY, null);
        };
    }, [openAllTips, openTip, page]);

    useAppEffect(() => {
        if (page !== null && tip !== null) {
            rememberDailyTip(page, tip);
        }
    }, [page, tip]);

    const handleHovering = useCallback(() => setIsHovered(true), []);
    const handleUnhovering = useCallback(() => setIsHovered(false), []);
    const closeTip = useCallback(() => {
        setIsBrowsing(false);
        // A card closed from under the pointer -- Show it, or the timer
        // itself -- never gets its `mouseleave`, so the next one would open
        // already held.
        setIsHovered(false);
        setTipIndex(null);
    }, []);

    // A minute is the card's whole life. The pointer resting on it holds that
    // minute where it is, and so does browsing the list or starting a
    // walkthrough -- the bar and this timer are held by the SAME flag, so what
    // the bar shows is always what is left. The remaining time is carried
    // across a pause rather than restarted: a hover must not buy a new minute.
    // Focus is deliberately not a second hold: a click leaves its own button
    // focused, and the card would then sit there for good.
    const isCountdownPaused = isHovered || isStarting;
    const remainingRef = useRef(DAILY_TIP_AUTO_CLOSE_MS);
    useAppEffect(() => {
        remainingRef.current = DAILY_TIP_AUTO_CLOSE_MS;
    }, [isBrowsing, tip]);
    useAppEffect(() => {
        if (tip === null || isBrowsing || isCountdownPaused) {
            return;
        }
        const startedAt = Date.now();
        const timeoutId = setTimeout(closeTip, remainingRef.current);
        return () => {
            clearTimeout(timeoutId);
            remainingRef.current = Math.max(
                0,
                remainingRef.current - (Date.now() - startedAt),
            );
        };
    }, [closeTip, isBrowsing, isCountdownPaused, tip]);

    const handleNext = useCallback(() => {
        setErrorMessage('');
        setIsBrowsing(false);
        setTipIndex((oldIndex) => {
            return oldIndex === null ? 0 : (oldIndex + 1) % tips.length;
        });
    }, [tips.length]);
    const handleDisable = useCallback(() => {
        disableDailyTips();
        closeTip();
    }, [closeTip]);
    const handleShow = useCallback(async () => {
        if (page === null || tip === null || isStarting) {
            return;
        }
        if (!getIsAIEnabled()) {
            void askToEnableAI();
            return;
        }
        setErrorMessage('');
        setIsStarting(true);
        try {
            const { callTool } = await import('../chatbot/mcpClient');
            await startDailyTipGuide(
                page,
                tip,
                callTool,
                globalThis.location.href,
            );
            closeTip();
        } catch (_error) {
            setErrorMessage(tran('Could not start this walkthrough.'));
        } finally {
            setIsStarting(false);
        }
    }, [closeTip, isStarting, page, tip]);

    if (page === null || tip === null) {
        return null;
    }
    return (
        <div
            className="toast show fade app-daily-tip"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            onMouseEnter={handleHovering}
            onMouseLeave={handleUnhovering}
        >
            <div className="toast-header">
                <i
                    className="bi bi-lightbulb app-daily-tip-mark"
                    aria-hidden="true"
                />
                {/*
                 * The page name is dropped from the card deliberately: the
                 * volunteer is standing in that page, and the header row it
                 * cost is the reason the card covered the controls behind it.
                 * "Don't show again" sits here rather than beside the actions
                 * -- it is the least-wanted press and had equal weight with
                 * the one the card exists for.
                 */}
                <span className="me-auto app-daily-tip-kind">
                    {isBrowsing
                        ? page === 'presenter'
                            ? tran('All Presenter tips')
                            : page === 'reader'
                              ? tran('All Reader tips')
                              : `${tran('All tips')} · ${getDailyTipPageLabel(page)}`
                        : page === 'presenter' || page === 'reader'
                          ? tran('Tip of the Day')
                          : `${tran('Tip of the Day')} · ${getDailyTipPageLabel(page)}`}
                </span>
                {isBrowsing ? null : (
                    <button
                        type="button"
                        className="btn btn-link app-daily-tip-quiet"
                        disabled={isStarting}
                        onClick={handleDisable}
                    >
                        {tran("Don't show again")}
                    </button>
                )}
                <button
                    type="button"
                    className="btn-close"
                    aria-label={tran('Close')}
                    onClick={closeTip}
                />
            </div>
            <div className="toast-body app-selectable-text">
                {isBrowsing ? (
                    <>
                        <div className="input-group input-group-sm mb-1">
                            <span className="input-group-text">
                                <i className="bi bi-search" />
                            </span>
                            <input
                                type="search"
                                className="form-control"
                                value={searchText}
                                placeholder={tran('Search tips')}
                                aria-label={tran('Search tips')}
                                onChange={(event) => {
                                    setSearchText(event.target.value);
                                }}
                            />
                            <span className="input-group-text">
                                {filteredTips.length}/{tips.length}
                            </span>
                        </div>
                        <div
                            className="app-daily-tip-list list-group"
                            aria-label={tran('All tips')}
                        >
                            {filteredTips.map(({ listedTip, index }) => {
                                return (
                                    <button
                                        key={listedTip.id}
                                        type="button"
                                        // The row reads as its number, title,
                                        // category and detail run together --
                                        // a name no screen reader announces
                                        // usefully and nothing can press by.
                                        // The title is what the row IS.
                                        aria-label={listedTip.title}
                                        className={
                                            'list-group-item list-group-item-action' +
                                            (index === tipIndex
                                                ? ' active'
                                                : '')
                                        }
                                        onClick={() => {
                                            setTipIndex(index);
                                            setIsBrowsing(false);
                                        }}
                                    >
                                        <span className="d-flex gap-2 align-items-baseline">
                                            <span className="app-daily-tip-index app-data">
                                                {index + 1}
                                            </span>
                                            <span>
                                                <span className="app-daily-tip-title d-block">
                                                    {listedTip.title}
                                                </span>
                                                {/*
                                                 * The category used to be a
                                                 * bordered badge on a line of
                                                 * its own -- 150 rows paying
                                                 * a row each. It leads the
                                                 * detail line now, told apart
                                                 * by weight rather than by a
                                                 * separator glyph.
                                                 */}
                                                <span className="app-daily-tip-detail d-block">
                                                    {listedTip.category ? (
                                                        <span className="app-daily-tip-category">
                                                            {listedTip.category}
                                                        </span>
                                                    ) : null}
                                                    {listedTip.detail}
                                                </span>
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                            {filteredTips.length === 0 ? (
                                <div className="list-group-item app-daily-tip-detail">
                                    {tran('No tips found')}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline-secondary mt-1"
                            onClick={() => setIsBrowsing(false)}
                        >
                            {tran('Back to tip')}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="app-daily-tip-title">{tip.title}</div>
                        <div className="app-daily-tip-detail">{tip.detail}</div>
                        {errorMessage ? (
                            <div
                                className="text-danger app-daily-tip-error"
                                role="alert"
                            >
                                {errorMessage}
                            </div>
                        ) : null}
                        {/*
                         * One segmented group rather than four loose buttons:
                         * they are the same kind of thing, and a group cannot
                         * wrap into a second row in a longer language.
                         */}
                        <div className="btn-group app-daily-tip-actions">
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isStarting}
                                onClick={() => void handleShow()}
                            >
                                {isStarting
                                    ? tran('Starting walkthrough…')
                                    : tran('Show it')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                disabled={isStarting}
                                onClick={handleNext}
                            >
                                {tran('Next tip')}
                            </button>
                            {/*
                             * Both were coloured (secondary + info) beside the
                             * filled primary. One filled button is the only
                             * thing here that needs a hue.
                             */}
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                disabled={isStarting}
                                onClick={openAllTips}
                            >
                                {tran('All tips')}
                            </button>
                        </div>
                    </>
                )}
            </div>
            {/*
             * The only clock on the card. It is a `transform` on one 3px rule
             * rather than a width or a number counting down: a repainting
             * toast costs frames on the machines this app is built for, and a
             * per-second tick would re-render the card sixty times over.
             * Keyed by the tip so Next tip starts the minute again.
             */}
            {isBrowsing ? null : (
                <div
                    className="app-daily-tip-countdown"
                    title={tran('This tip closes by itself')}
                    style={
                        {
                            // One source for the minute: the stylesheet reads
                            // the same constant the timer counts.
                            '--app-daily-tip-countdown-time': `${DAILY_TIP_AUTO_CLOSE_MS}ms`,
                        } as CSSProperties
                    }
                >
                    <div
                        key={tip.id}
                        className={
                            'app-daily-tip-countdown-bar' +
                            (isCountdownPaused ? ' app-paused' : '')
                        }
                    />
                </div>
            )}
        </div>
    );
}
