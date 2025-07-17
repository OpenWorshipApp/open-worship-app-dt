import { createContext, use } from 'react';

import {
    EventMapper,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { goToPath } from '../router/routeHelpers';
import appProvider from '../server/appProvider';
import { getAllLocalBibleInfoList } from '../helper/bible-helpers/bibleDownloadHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

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
                goToPath(appProvider.settingHomePage);
            }}
        >
            <i className="bi bi-gear-wide-connected" />
        </button>
    );
}

export function HelpButtonComp() {
    return (
        <button
            className="btn btn-outline-info"
            title="`Help"
            onClick={() => {
                console.log('Help button clicked');
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
                const localBibleInfoList = await getAllLocalBibleInfoList();
                if (!localBibleInfoList?.length) {
                    const isConfirmed = await showAppConfirm(
                        'No Bible',
                        'You need to download a Bible to use this feature',
                    );
                    if (isConfirmed) {
                        goToPath(appProvider.settingHomePage);
                    }
                    return;
                }
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
