import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import {
    appLocalStorage,
    DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
} from './directory-setting/appLocalStorage';
import { useAppEffect } from '../helper/appHooks';
import { applyStore } from './SettingApplyComp';
import SettingCardHeaderComp from './SettingCardHeaderComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import {
    readAiCautionHiddenTime,
    readAiProviderWarnHiddenTime,
    showAiCautionAgain,
    showAiProviderWarnAgain,
} from '../helper/ai/aiCautionHelpers';
import { readChatTipsHiddenAt, showChatTips } from '../chatbot/tipHelpers';
import {
    readDataDirMoveHiddenAt,
    showDataDirMoveAgain,
} from './directory-setting/dataDirMoveHelpers';
import {
    getAreDailyTipsDisabled,
    readDailyTipsHiddenAt,
    setAreDailyTipsEnabled,
    showDailyTipsAgain,
} from '../toast/dailyTipSettingHelpers';

/**
 * One row of the things a "Hide for 30 days" button put away (2026-10-20, the
 * user's asks: _everything that can be hidden for 30 days should be seen in
 * setting general … to be able to restore_). Only what is hidden right now is
 * listed; each `restore` brings it back before the day it would have come
 * back itself.
 */
function genHiddenItemRows(now = Date.now()) {
    return [
        {
            id: 'daily-tips',
            labelKey: 'Tips of the Day',
            until: readDailyTipsHiddenAt(now),
            restore: showDailyTipsAgain,
        },
        {
            id: 'chat-tips',
            labelKey: 'Tips in the help window',
            until: readChatTipsHiddenAt(now),
            restore: showChatTips,
        },
        {
            id: 'ai-caution',
            labelKey: 'The caution before an AI window opens',
            until: readAiCautionHiddenTime(now),
            restore: showAiCautionAgain,
        },
        {
            id: 'ai-warn',
            labelKey: 'The notice about the free AI service',
            until: readAiProviderWarnHiddenTime(now),
            restore: showAiProviderWarnAgain,
        },
        {
            id: 'data-dir-move',
            labelKey: 'The suggestion to move the data folder',
            until: readDataDirMoveHiddenAt(now),
            restore: showDataDirMoveAgain,
        },
    ].filter((row) => {
        return row.until !== null;
    });
}

// The day, plain and unambiguous: Electron's ICU answers a Khmer date in
// English anyway (memory `electron-icu-has-no-khmer`).
function toHiddenDateText(until: number) {
    return new Date(until).toISOString().slice(0, 10);
}

// `Reset Widgets Size` used to live here. It moved to the native View menu,
// where it applies live instead of waiting for an Apply Settings reload:
// `resize-actor/widgetAppMenuHelpers`.
export default function SettingGeneralOtherOptionsComp() {
    const [areDailyTipsEnabled, setDailyTipsEnabledState] = useState(
        () => !getAreDailyTipsDisabled(),
    );
    const [hiddenRows, setHiddenRows] = useState(() => genHiddenItemRows());
    // Read once, the list missed what was put away while it was open -- the
    // Desktop card's Hide for 30 days in this very window, or a tip hidden in
    // another -- and its Show again was not there to press.
    useAppEffect(() => {
        const readHiddenRows = () => {
            setHiddenRows(genHiddenItemRows());
        };
        globalThis.addEventListener(
            DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
            readHiddenRows,
        );
        globalThis.addEventListener('focus', readHiddenRows);
        return () => {
            globalThis.removeEventListener(
                DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME,
                readHiddenRows,
            );
            globalThis.removeEventListener('focus', readHiddenRows);
        };
    }, []);
    const handleShowingAgain = useCallback(
        (id: string) => {
            hiddenRows.find((row) => row.id === id)?.restore();
            setHiddenRows(genHiddenItemRows());
        },
        [hiddenRows],
    );
    const handleClearSettings = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Clear All Settings'),
            tran('Are you sure you want to clear all settings?'),
        );
        if (!isOk) {
            return;
        }
        await appLocalStorage.clear();
        applyStore.pendingApply();
    }, []);
    return (
        <div className="card m-1">
            <SettingCardHeaderComp
                iconClassName="bi-sliders"
                title="Other General Options"
            />
            <div className="card-body d-grid gap-2">
                <div className="form-check form-switch">
                    <input
                        id="setting-daily-tips-enabled"
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={areDailyTipsEnabled}
                        onChange={(event) => {
                            const isEnabled = event.currentTarget.checked;
                            setAreDailyTipsEnabled(isEnabled);
                            setDailyTipsEnabledState(isEnabled);
                        }}
                    />
                    <label
                        className="form-check-label"
                        htmlFor="setting-daily-tips-enabled"
                    >
                        {tran('Show Tips of the Day automatically')}
                    </label>
                    <div className="form-text">
                        {tran('Applies to each app page on the next launch.')}
                    </div>
                </div>
                {hiddenRows.length > 0 ? (
                    <div className="d-grid gap-1 border-top pt-2">
                        <div className="form-text">
                            {tran('Put away for 30 days')}
                        </div>
                        {hiddenRows.map((row) => {
                            return (
                                <div
                                    key={row.id}
                                    className="d-flex align-items-center gap-2"
                                >
                                    <span className="flex-grow-1">
                                        {tran(row.labelKey)}{' '}
                                        <small className="text-muted">
                                            {tran('Hidden until')}{' '}
                                            {toHiddenDateText(row.until!)}
                                        </small>
                                    </span>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        title={tran('Show again')}
                                        onClick={() => {
                                            handleShowingAgain(row.id);
                                        }}
                                    >
                                        {tran('Show again')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                <button
                    className="btn btn-outline-danger d-flex align-items-center justify-content-center"
                    title={tran('Clear All Settings')}
                    onClick={handleClearSettings}
                >
                    <i className="bi bi-trash3 me-2" />
                    {tran('Clear All Settings')}
                </button>
            </div>
        </div>
    );
}
