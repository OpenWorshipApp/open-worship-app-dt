import './appInit.scss';
import './others/bootstrap-override.scss';
import './others/theme-override.scss';
import './others/theme-override-dark.scss';
import './others/scrollbar.scss';

import { showAppConfirm } from './popup-widget/popupWidgetHelpers';
import {
    PlatformEnum,
    useKeyboardRegistering,
} from './event/KeyboardEventListener';
import { handleError } from './helper/errorHelpers';
import FileSourceMetaManager from './helper/FileSourceMetaManager';
import {
    getCurrentLangAsync,
    getCurrentLocale,
    getFontFamily,
} from './lang/langHelpers';
import appProvider from './server/appProvider';
import initCrypto from './_owa-crypto';
import { StrictMode } from 'react';
import { getSetting, setSetting } from './helper/settingHelpers';
import { applyFontFamily } from './others/LanguageWrapper';
import {
    bringDomToNearestView,
    HIGHLIGHT_SELECTED_CLASSNAME,
} from './helper/helpers';
import {
    handleClassNameAction,
    handleFullWidgetView,
    addDomChangeEventListener,
    HoverMotionHandler,
    InputContextMenuHandler,
} from './helper/domHelpers';
import { appLocalStorage } from './setting/directory-setting/appLocalStorage';
import { unlocking } from './server/unlockingHelpers';
import {
    checkDecidedBibleReaderHomePage,
    checkForUpdateSilently,
} from './server/appHelpers';
import { useAppEffectAsync } from './helper/debuggerHelpers';
import { goToGeneralSetting } from './setting/settingHelpers';
import { applyDarkModeToApp, getReactRoot } from './initHelpers';

const ERROR_DATETIME_SETTING_NAME = 'error-datetime-setting';
const ERROR_DURATION = 1000 * 10; // 10 seconds;

function useCheckSetting() {
    useAppEffectAsync(async () => {
        if (
            !appProvider.isPageSetting &&
            !(await appLocalStorage.getSelectedParentDirectory())
        ) {
            const isOk = await showAppConfirm(
                '`No Parent Directory Selected',
                '`You will be redirected to the General Settings page to ' +
                    'select a parent directory.',
            );
            if (isOk) {
                goToGeneralSetting();
            }
            return;
        }
        checkDecidedBibleReaderHomePage();
    }, []);
}

async function confirmLocalStorageErasing() {
    const isOk = await showAppConfirm(
        'Unfixable Error',
        'We were sorry, local settings are broken, we need to erase local' +
            ' storage and reload the app',
    );
    if (isOk) {
        await appLocalStorage.clear();
    }
    appProvider.reload();
}

async function confirmReloading() {
    await unlocking(ERROR_DATETIME_SETTING_NAME, async () => {
        const oldDatetimeString = getSetting(ERROR_DATETIME_SETTING_NAME);
        if (oldDatetimeString) {
            const oldDatetime = parseInt(oldDatetimeString);
            if (Date.now() - oldDatetime < ERROR_DURATION) {
                confirmLocalStorageErasing();
                return;
            }
        }
        setSetting(ERROR_DATETIME_SETTING_NAME, Date.now().toString());
        const isOk = await showAppConfirm(
            'Reload is needed',
            'We were sorry, Internal process error, you to refresh the app',
        );
        if (isOk) {
            appProvider.reload();
        }
    });
}

export async function initApp() {
    function isDomException(error: any) {
        if (typeof error === 'string' && error.startsWith('ResizeObserver')) {
            return true;
        }
        return error instanceof DOMException;
    }

    window.onunhandledrejection = (promiseError) => {
        const reason = promiseError.reason;
        if (reason.name === 'Canceled') {
            return;
        }
        handleError(reason);
        if (isDomException(reason)) {
            return;
        }
        confirmReloading();
    };

    window.onerror = function (error: any) {
        handleError(error);
        if (isDomException(error)) {
            return;
        }
        confirmReloading();
    };

    await initCrypto();
    const promises = [
        FileSourceMetaManager.checkAllColorNotes(),
        getCurrentLangAsync(),
    ];
    await Promise.all(promises);
}

export function useQuickExitBlock() {
    useKeyboardRegistering(
        [
            {
                key: 'q',
                mControlKey: ['Meta'],
                platforms: [PlatformEnum.Mac],
            },
        ],
        async (event) => {
            event.preventDefault();
            await showAppConfirm(
                'Quick Exit',
                'Are you sure you want to quit the app?',
            ).then((isOk) => {
                if (isOk) {
                    window.close();
                }
            });
        },
        [],
    );
}

export function RenderApp({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    useQuickExitBlock();
    useCheckSetting();
    return (
        <div id="app" ref={applyDarkModeToApp}>
            <StrictMode>{children}</StrictMode>
        </div>
    );
}

export async function main(children: React.ReactNode) {
    await initApp();
    const hoverMotionHandler = new HoverMotionHandler();
    addDomChangeEventListener(
        hoverMotionHandler.listenForHoverMotion.bind(hoverMotionHandler),
    );
    const inputContextMenuHandler = new InputContextMenuHandler();
    addDomChangeEventListener(
        inputContextMenuHandler.listenForInputContextMenu.bind(
            inputContextMenuHandler,
        ),
    );
    addDomChangeEventListener(applyFontFamily);
    addDomChangeEventListener(handleFullWidgetView);
    addDomChangeEventListener(
        handleClassNameAction.bind(
            null,
            HIGHLIGHT_SELECTED_CLASSNAME,
            (target) => {
                bringDomToNearestView(target as HTMLDivElement);
            },
        ),
    );
    const locale = getCurrentLocale();
    const fontFamily = await getFontFamily(locale);
    if (fontFamily) {
        document.body.style.fontFamily = fontFamily;
    }
    const root = getReactRoot();

    root.render(<RenderApp>{children}</RenderApp>);

    setTimeout(checkForUpdateSilently, 6e4);
}
