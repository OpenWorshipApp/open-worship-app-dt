import './SettingComp.scss';

import { lazy, useCallback } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    getAIKeyFocusRequest,
    takeAIKeyFocusRequest,
} from '../helper/ai/aiKeyFocusHelpers';
import { setSetting, useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import {
    listenForSettingTabRequest,
    SETTING_SETTING_NAME,
    takeSettingTabRequest,
} from './settingHelpers';
import SettingApplyComp from './SettingApplyComp';
import SettingArchiveButtonsComp from './setting-archive/SettingArchiveButtonsComp';
import { toIconedLabel } from '../others/labelIconHelpers';
import { warnIfAnyBibleEditorDirty } from './bible-setting/bibleEditorDirtyHelpers';
import { appLocalStorage } from './directory-setting/appLocalStorage';
import { tran } from '../lang/langHelpers';

const LazySettingGeneralComp = lazy(() => {
    return import('./SettingGeneralComp');
});
const LazySettingPathComp = lazy(() => {
    return import('./SettingPathComp');
});
const LazySettingBibleComp = lazy(() => {
    return import('./bible-setting/SettingBibleComp');
});
const LazySettingOthersComp = lazy(() => {
    return import('./SettingOthersComp');
});
const LazySettingAIComp = lazy(() => {
    return import('./SettingAIComp');
});

// Label KEYS, translated in render: `toIconedLabel` calls `tran()`, and
// called here at import it froze the tabs in whatever language was in force
// when this module first loaded (and throws in dev before language data is in).
const tabTypeList = [
    ['g', 'General', LazySettingGeneralComp],
    ['p', 'Path Settings', LazySettingPathComp],
    ['b', 'Bible', LazySettingBibleComp],
    ['a', 'AI Providers', LazySettingAIComp],
    ['o', 'Others', LazySettingOthersComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
// With no data folder only these: the language, the theme and the AI
// assistants belong to the computer, and the other tabs are settings of a
// data folder there is not.
const NO_DATA_DIR_TAB_KEY_LIST: TabKeyType[] = ['g', 'p', 'a'];
// The tab holding the AI keys -- not Others, which is where the panel used to
// be mounted; a request for the key box must land beside the box.
const AI_TAB_KEY: TabKeyType = 'a';

/**
 * The assistant, a press away from every setting: Settings has no top bar for
 * the 🤖, and the way in was Ctrl+Shift+A or the Tools menu. The 🤖's own
 * press, so the AI switch and the caution are asked the same.
 */
function SettingAssistantButtonComp() {
    const handleClick = useCallback(async () => {
        const { openChatbotOnPress } = await import('../others/commonButtons');
        await openChatbotOnPress();
    }, []);
    return (
        <button
            className="btn btn-sm btn-outline-info w-100 d-flex align-items-center justify-content-center mb-1"
            type="button"
            title={tran('App Assistant')}
            onClick={handleClick}
        >
            <i className="bi bi-robot me-1" />
            {tran('App Assistant')}
        </button>
    );
}

export default function SettingComp() {
    // Path Settings first: the data folder is what every other setting is
    // kept in.
    const [storedTabKey, setTabKey] = useStateSettingString<TabKeyType>(
        SETTING_SETTING_NAME,
        'p',
    );
    const isOnOwnFolder = appLocalStorage.isOnOwnFolder;
    const shownTabTypeList = isOnOwnFolder
        ? tabTypeList.filter(([key]) => {
              return NO_DATA_DIR_TAB_KEY_LIST.includes(key);
          })
        : tabTypeList;
    const tabKey =
        isOnOwnFolder && !NO_DATA_DIR_TAB_KEY_LIST.includes(storedTabKey)
            ? 'p'
            : storedTabKey;
    // Says whether the tab changed, for the focus handler below.
    const handleSettingTab = (key: TabKeyType) => {
        // Leaving the Bible tab unmounts its editors, which would silently
        // discard any unsaved changes.
        if (
            warnIfAnyBibleEditorDirty(
                'Save or discard unsaved Bible changes before switching tabs.',
            )
        ) {
            return false;
        }
        setTabKey(key);
        return true;
    };
    const handleSettingTabRef = useAppCurrentRef(handleSettingTab);
    const tabKeyRef = useAppCurrentRef(tabKey);
    // Another window can ask this one to show a particular tab. A newly opened
    // Settings window reads `setting-tabs` while mounting; one that was open
    // all along is only RAISED, and the raise is the focus this listens for.
    // AI-key requests use the same focus event, then remain stored for the AI
    // panel itself to take once the AI tab is showing.
    useAppEffect(() => {
        // The asker is often this very window (the assistant's "Enable AI
        // features" prompt, answered inside Settings). It is already in front,
        // so the raise fires no focus event and the tab request below would
        // never be taken -- Yes would read as doing nothing.
        const cleanUpTabRequestListener = listenForSettingTabRequest(
            (tabKey) => {
                // Taken here rather than on the next focus: it was just written
                // for a window already in front, which may not see another focus
                // for a long time. Left stored, it would be applied again later.
                takeSettingTabRequest();
                if (tabKey === tabKeyRef.current) {
                    return;
                }
                if (!handleSettingTabRef.current(tabKey)) {
                    // Refused over unsaved Bible changes, and the warning says so.
                    setSetting(SETTING_SETTING_NAME, tabKeyRef.current);
                    if (getAIKeyFocusRequest() !== null) {
                        takeAIKeyFocusRequest();
                    }
                }
            },
        );
        const handleFocusing = () => {
            let currentTab = tabKeyRef.current;
            const requestedTab = takeSettingTabRequest();
            if (requestedTab !== null && requestedTab !== currentTab) {
                if (!handleSettingTabRef.current(requestedTab)) {
                    // The request was written before this already-open window
                    // could apply its dirty-editor guard. Keep the persisted
                    // tab aligned with the tab that safely remained visible.
                    setSetting(SETTING_SETTING_NAME, currentTab);
                    if (getAIKeyFocusRequest() !== null) {
                        takeAIKeyFocusRequest();
                    }
                    return;
                }
                currentTab = requestedTab;
            }
            if (currentTab === AI_TAB_KEY || getAIKeyFocusRequest() === null) {
                return;
            }
            if (!handleSettingTabRef.current(AI_TAB_KEY)) {
                // Refused over unsaved Bible changes, and the warning says so.
                // Dropped, or every click back into this window would ask
                // again for the next half minute.
                takeAIKeyFocusRequest();
            }
        };
        window.addEventListener('focus', handleFocusing);
        return () => {
            cleanUpTabRequestListener();
            window.removeEventListener('focus', handleFocusing);
        };
    }, []);
    return (
        <div
            id="app-setting"
            className="card flex-row w-100 h-100 app-overflow-hidden app-zero-border-radius"
        >
            <div className="app-setting-sidebar d-flex flex-column p-1">
                <TabRenderComp<TabKeyType>
                    isVertical
                    className="app-setting-nav flex-grow-1"
                    tabs={shownTabTypeList.map(([key, labelKey]) => {
                        return {
                            key,
                            title: toIconedLabel(labelKey),
                        };
                    })}
                    activeTabs={[tabKey]}
                    setActiveTab={handleSettingTab}
                />
                <div className="app-setting-apply mt-1 pt-1">
                    <SettingAssistantButtonComp />
                    <SettingApplyComp />
                    {isOnOwnFolder ? null : <SettingArchiveButtonsComp />}
                </div>
            </div>
            <div className="card-body app-overflow-hidden p-0">
                {shownTabTypeList.map(([type, _, target]) => {
                    return genTabBody<TabKeyType>(tabKey, [type, target]);
                })}
            </div>
        </div>
    );
}
