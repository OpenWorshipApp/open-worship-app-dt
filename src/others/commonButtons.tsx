import { createContext, use, useMemo } from 'react';

import {
    EventMapper,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { goToPath } from '../router/routeHelpers';
import { gotoSettingPage } from '../setting/settingHelpers';
import appProvider from '../server/appProvider';

export function QuitCurrentPageComp({
    title,
    pathname,
}: Readonly<{
    title: string;
    pathname?: string;
}>) {
    return (
        <button
            className="btn btn-sm btn-outline-warning"
            title={title}
            onClick={() => {
                goToPath(pathname);
            }}
        >
            <i className="bi bi-escape" />
        </button>
    );
}

export function SettingButtonComp() {
    return (
        <button
            className="btn btn-outline-success rotating-hover"
            title="`Setting"
            onClick={() => {
                gotoSettingPage();
            }}
        >
            <i className="bi bi-gear-wide-connected" />
        </button>
    );
}

export function HelpButtonComp() {
    const url = useMemo(() => {
        const helpKey = appProvider.currentHomePage
            .replace(/^\//, '')
            .replace(/\.html$/, '');
        return `${appProvider.appInfo.homepage}/help#${helpKey}`;
    }, []);
    return (
        <button
            className="btn btn-outline-info"
            title={url}
            onClick={() => {
                console.log('Help button clicked');
                appProvider.browserUtils.openExternalURL(url);
            }}
        >
            <i className="bi bi-question-circle" />
        </button>
    );
}

export const BibleLookupTogglePopupContext = createContext<{
    isShowing: boolean;
    setIsShowing: (isShowing: boolean) => void;
} | null>(null);
const openBibleEventMap: EventMapper = {
    allControlKey: ['Ctrl'],
    key: 'b',
};

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

export function BibleLookupButtonComp() {
    const { setIsShowing: setIsBibleLookupShowing } =
        useIsBibleLookupShowingContext();
    useKeyboardRegistering(
        [openBibleEventMap],
        () => {
            setIsBibleLookupShowing(true);
        },
        [],
    );
    return (
        <button
            className="btn btn-labeled btn-primary"
            style={{ width: '220px' }}
            title={`Bible lookup [${toShortcutKey(openBibleEventMap)}]`}
            type="button"
            onClick={async () => {
                setIsBibleLookupShowing(true);
            }}
        >
            <span className="btn-label">
                <i className="bi bi-book px-1" />
                {tran('bible-lookup')}
            </span>
        </button>
    );
}
