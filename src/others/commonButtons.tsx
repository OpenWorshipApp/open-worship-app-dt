import { createContext, use, useCallback, useMemo } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import KeyboardEventListener, {
    PlatformEnum,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { askAiCaution } from '../helper/ai/aiCautionHelpers';
import { askToEnableAI } from '../helper/ai/aiEnableHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { openAiChatPage, openChatbotPage } from '../helper/domHelpers';
import { tran } from '../lang/langHelpers';
import { goToPath } from '../router/routeHelpers';
import { openSettingPage } from '../setting/settingHelpers';
import appProvider from '../server/appProvider';
import { checkIsMainWindow, getHelpPageUrl } from '../server/appHelpers';

export function QuitCurrentPageComp({
    title,
    pathname,
}: Readonly<{
    title: string;
    pathname?: string;
}>) {
    const pathnameRef = useAppCurrentRef(pathname);
    const handleClick = useCallback(() => {
        goToPath(pathnameRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isMainWindow = checkIsMainWindow();
    if (!isMainWindow) {
        return null;
    }
    return (
        <button
            className="btn btn-sm btn-outline-warning"
            title={title}
            aria-label={title}
            onClick={handleClick}
        >
            🖥️
            <i className="bi bi-escape" />
        </button>
    );
}

export function SettingButtonComp() {
    const handleClick = useCallback(() => {
        openSettingPage();
    }, []);
    return (
        <button
            className="btn btn-outline-success rotating-hover"
            title={tran('Setting')}
            aria-label={tran('Setting')}
            onClick={handleClick}
        >
            <i className="bi bi-gear-wide-connected" />
        </button>
    );
}

/**
 * Opens the in-app assistant, beside the Help button that goes to the website:
 * the two answer the same question, one from the manual bundled in this build
 * and from what the app is doing right now, the other from a browser and an
 * internet connection this machine may not have.
 */
export function ChatbotButtonComp() {
    const handleClick = useCallback(async () => {
        // The switch is read at the PRESS, not at render. The button used to
        // disappear with it, which left a volunteer who never turned AI on --
        // the packaged default -- with nothing to press and nothing saying
        // why the assistant everyone talks about is not there. It says what is
        // off and offers the one place that turns it back on instead; that
        // only takes effect on the next launch, so the dialog says so too.
        if (!getIsAIEnabled()) {
            void askToEnableAI();
            return;
        }
        // The switch is asked FIRST and the caution second: there is nothing
        // to be careful about in a window that is not going to open, and
        // warning about an assistant before saying it is turned off is two
        // dialogs to reach one piece of news.
        if (!(await askAiCaution('assistant'))) {
            return;
        }
        openChatbotPage();
    }, []);
    return (
        <button
            className="btn btn-outline-info"
            title={tran('App Assistant')}
            aria-label={tran('App Assistant')}
            onClick={handleClick}
        >
            <i className="bi bi-robot" />
        </button>
    );
}

/**
 * Opens the AI Chat window -- ChatGPT, Claude, Gemini and the rest, each on
 * its own site, in a box beside the app -- right of the 🤖 that opens the
 * app's own assistant. Not gated on the AI switch: it holds no key, asks no
 * assistant and opens no door of the app's, so there is nothing for the
 * switch to turn off.
 */
export function AiChatButtonComp() {
    const handleClick = useCallback(async () => {
        if (!(await askAiCaution('aichat'))) {
            return;
        }
        openAiChatPage();
    }, []);
    return (
        <button
            className="btn btn-outline-info"
            title={tran('AI Chat')}
            aria-label={tran('AI Chat')}
            onClick={handleClick}
        >
            <i className="bi bi-stars" />
        </button>
    );
}

export function HelpButtonComp() {
    const url = useMemo(() => {
        const helpPageUrl = getHelpPageUrl();
        const helpKey = appProvider.currentHomePage
            .replace(/^\//, '')
            .replace(/\.html$/, '');
        return `${helpPageUrl}#${helpKey}`;
    }, []);
    const urlRef = useAppCurrentRef(url);
    const handleClick = useCallback(() => {
        appProvider.browserUtils.openExternalURL(urlRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-outline-info"
            title={tran('Help')}
            aria-label={tran('Help')}
            onClick={handleClick}
        >
            <i className="bi bi-question-circle" />
        </button>
    );
}

export const BibleLookupTogglePopupContext = createContext<{
    isShowing: boolean;
    setIsShowing: (isShowing: boolean) => void;
} | null>(null);
const openBibleEventMaps: EventMapperType[] =
    KeyboardEventListener.filterEventMappersByPlatform([
        {
            allControlKey: ['Ctrl'],
            key: 'b',
        },
        {
            platform: PlatformEnum.MacOS,
            mControlKey: ['Meta'],
            key: 'b',
        },
    ]);

export function useIsBibleLookupShowingContext() {
    const context = use(BibleLookupTogglePopupContext);
    if (context === null) {
        throw new Error(
            'useBibleLookupShowingContext must be used within a ' +
                'BibleLookupShowingProvider',
        );
    }
    return context;
}

export function useToggleBibleLookupPopupContext(isShowing = true) {
    const context = use(BibleLookupTogglePopupContext);
    if (context === null) {
        return null;
    }
    return context.setIsShowing.bind(null, isShowing);
}

const shortcutKey = openBibleEventMaps
    .map((eventMapper) => {
        return toShortcutKey(eventMapper);
    })
    .join(' | ');
export function BibleLookupButtonComp() {
    const { setIsShowing: setIsBibleLookupShowing } =
        useIsBibleLookupShowingContext();
    const setIsBibleLookupShowingRef = useAppCurrentRef(
        setIsBibleLookupShowing,
    );
    useKeyboardRegistering(openBibleEventMaps, () => {
        setIsBibleLookupShowingRef.current(true);
    }, []);
    const handleClick = useCallback(() => {
        setIsBibleLookupShowingRef.current(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-sm btn-labeled btn-primary app-zero-border-radius"
            style={{ width: '220px' }}
            title={tran('Open bible lookup popup') + ` [${shortcutKey}]`}
            type="button"
            onClick={handleClick}
        >
            <span className="btn-label">
                <i className="bi bi-book px-1" />
                {tran('Bible Lookup')}
            </span>
        </button>
    );
}
