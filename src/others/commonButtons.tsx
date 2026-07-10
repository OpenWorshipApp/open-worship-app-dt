import { createContext, use, useCallback, useMemo } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import KeyboardEventListener, {
    PlatformEnum,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { goToPath } from '../router/routeHelpers';
import { openSettingPage } from '../setting/settingHelpers';
import appProvider from '../server/appProvider';

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
    return (
        <button
            className="btn btn-sm btn-outline-warning"
            title={title}
            aria-label={title}
            onClick={handleClick}
        >
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

export function HelpButtonComp() {
    const url = useMemo(() => {
        const helpKey = appProvider.currentHomePage
            .replace(/^\//, '')
            .replace(/\.html$/, '');
        return `${appProvider.appInfo.homepage}/help#${helpKey}`;
    }, []);
    const urlRef = useAppCurrentRef(url);
    const handleClick = useCallback(() => {
        appProvider.browserUtils.openExternalURL(urlRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-outline-info"
            title={url}
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
