import { useCallback, useMemo, useState } from 'react';

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
    DAILY_TIP_SESSION_KEY,
    disableDailyTips,
    getAreDailyTipsDisabled,
    getDailyTipPage,
    getDailyTips,
    pickDailyTipIndex,
    rememberDailyTip,
} from './dailyTipHelpers';

const MENU_KEY = 'daily-tips';

type DailyTipMenuClickType = {
    isOpenDailyTip?: boolean;
    isBrowseDailyTips?: boolean;
};

export default function DailyTipComp() {
    const page = getDailyTipPage(appProvider.currentHomePage);
    const tips = useMemo(
        () => (page === null ? [] : getDailyTips(page)),
        [page],
    );
    const [tipIndex, setTipIndex] = useState<number | null>(() => {
        if (
            page === null ||
            !checkIsMainWindow() ||
            getAreDailyTipsDisabled() ||
            globalThis.sessionStorage.getItem(DAILY_TIP_SESSION_KEY) === 'true'
        ) {
            return null;
        }
        globalThis.sessionStorage.setItem(DAILY_TIP_SESSION_KEY, 'true');
        return pickDailyTipIndex(page, tips);
    });
    const [isStarting, setIsStarting] = useState(false);
    const [isBrowsing, setIsBrowsing] = useState(false);
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
        setErrorMessage('');
        setIsBrowsing(false);
        setTipIndex(pickDailyTipIndex(page, tips));
    }, [page, tips]);

    const openAllTips = useCallback(() => {
        if (page === null || tips.length === 0) {
            return;
        }
        setErrorMessage('');
        setSearchText('');
        setTipIndex((oldIndex) => {
            return oldIndex ?? pickDailyTipIndex(page, tips);
        });
        setIsBrowsing(true);
    }, [page, tips]);

    useAppEffect(() => {
        if (!checkIsMainWindow()) {
            return;
        }
        if (page === null) {
            setAppMenuItems(MENU_KEY, null);
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
            setAppMenuItems(MENU_KEY, null);
        };
    }, [openAllTips, openTip, page]);

    useAppEffect(() => {
        if (page !== null && tip !== null) {
            rememberDailyTip(page, tip);
        }
    }, [page, tip]);

    const handleNext = useCallback(() => {
        setErrorMessage('');
        setIsBrowsing(false);
        setTipIndex((oldIndex) => {
            return oldIndex === null ? 0 : (oldIndex + 1) % tips.length;
        });
    }, [tips.length]);
    const handleDisable = useCallback(() => {
        disableDailyTips();
        setIsBrowsing(false);
        setTipIndex(null);
    }, []);
    const handleShow = useCallback(async () => {
        if (tip === null || isStarting) {
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
            await callTool('owa_guide_start', { demoId: tip.demoId });
            setTipIndex(null);
        } catch (_error) {
            setErrorMessage(tran('Could not start this walkthrough.'));
        } finally {
            setIsStarting(false);
        }
    }, [isStarting, tip]);

    if (page === null || tip === null) {
        return null;
    }
    return (
        <div
            className="toast show fade app-daily-tip"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="toast-header">
                <strong className="me-auto">
                    {isBrowsing
                        ? page === 'presenter'
                            ? tran('All Presenter tips')
                            : tran('All Reader tips')
                        : `${tran('Tip of the Day')} · ${
                              page === 'presenter'
                                  ? tran('Presenter tip')
                                  : tran('Reader tip')
                          }`}
                </strong>
                <button
                    type="button"
                    className="btn-close"
                    aria-label={tran('Close')}
                    onClick={() => {
                        setIsBrowsing(false);
                        setTipIndex(null);
                    }}
                />
            </div>
            <div className="toast-body app-selectable-text">
                {isBrowsing ? (
                    <>
                        <p className="small mb-2">
                            {tran('Choose a tip to practise at your own pace.')}
                        </p>
                        <div className="input-group input-group-sm mb-2">
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
                                        <span className="d-flex gap-2 align-items-start">
                                            <span className="badge text-bg-secondary mt-1">
                                                {index + 1}
                                            </span>
                                            <span>
                                                <span className="d-block fw-semibold">
                                                    {listedTip.title}
                                                </span>
                                                {listedTip.category ? (
                                                    <span className="badge text-bg-light border mb-1">
                                                        {listedTip.category}
                                                    </span>
                                                ) : null}
                                                <span className="d-block small">
                                                    {listedTip.detail}
                                                </span>
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                            {filteredTips.length === 0 ? (
                                <div className="list-group-item text-muted small">
                                    {tran('No tips found')}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mt-2"
                            onClick={() => setIsBrowsing(false)}
                        >
                            {tran('Back to tip')}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="fw-semibold">{tip.title}</div>
                        <div className="app-daily-tip-detail">{tip.detail}</div>
                        {errorMessage ? (
                            <div className="text-danger mb-2" role="alert">
                                {errorMessage}
                            </div>
                        ) : null}
                        <div className="app-daily-tip-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={isStarting}
                                onClick={() => void handleShow()}
                            >
                                {isStarting
                                    ? tran('Starting walkthrough…')
                                    : tran('Show it')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={isStarting}
                                onClick={handleNext}
                            >
                                {tran('Next tip')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-info"
                                disabled={isStarting}
                                onClick={openAllTips}
                            >
                                {tran('All tips')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-link"
                                disabled={isStarting}
                                onClick={handleDisable}
                            >
                                {tran("Don't show again")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
