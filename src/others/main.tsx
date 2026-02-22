import './appInit.scss';
import './bootstrap-override.scss';
import './theme-override-dark.scss';
import './theme-override-light.scss';
import './scrollbar.scss';

import type { ReactNode } from 'react';
import { StrictMode } from 'react';

import { getCurrentLocale, getLangData, tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { handleError } from '../helper/errorHelpers';
import FileSourceMetaManager from '../helper/FileSourceMetaManager';
import appProvider from '../server/appProvider';
import initCrypto from '../_owa-crypto';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { applyFontFamily } from './LanguageWrapper';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import {
    handleClassNameAction,
    handleFullWidgetView,
    addDomChangeEventListener,
    HoverMotionHandler,
    InputContextMenuHandler,
    handleActiveSelectedElementScrolling,
} from '../helper/domHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { unlocking } from '../server/unlockingHelpers';
import {
    checkDecidedBibleReaderHomePage,
    checkForUpdateSilently,
} from '../server/appHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { openGeneralSetting } from '../setting/settingHelpers';
import { applyDarkModeToApp } from './initHelpers';
import { getReactRoot } from './rootHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';

const ERROR_DATETIME_SETTING_NAME = 'error-datetime-setting';
const ERROR_DURATION = 1000 * 10; // 10 seconds;

function useCheckSetting() {
    useAppEffectAsync(async () => {
        if (
            !appProvider.isPageSetting &&
            !(await appLocalStorage.getSelectedParentDirectory())
        ) {
            const isOk = await showAppConfirm(
                tran('No Parent Directory Selected'),
                tran(
                    'You will be redirected to the General Settings page to ' +
                        'select a parent directory.',
                ),
            );
            if (isOk) {
                openGeneralSetting();
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
            const oldDatetime = Number.parseInt(oldDatetimeString);
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

function isDomException(error: any) {
    if (typeof error === 'string' && error.startsWith('ResizeObserver')) {
        return true;
    }
    return error instanceof DOMException;
}

async function initMain() {
    globalThis.onunhandledrejection = (promiseError) => {
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

    globalThis.onerror = function (error: any) {
        handleError(error);
        if (isDomException(error)) {
            return;
        }
        confirmReloading();
    };

    await initCrypto();
    const promises = [FileSourceMetaManager.checkAllColorNotes()];
    await Promise.all(promises);
}

export function RenderApp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    useCheckSetting();
    return (
        <div id="app" ref={applyDarkModeToApp}>
            <StrictMode>{children}</StrictMode>
        </div>
    );
}

export async function run(children: ReactNode) {
    await initMain();
    KeyboardEventListener.onMacQuitting = () => {
        showAppConfirm(
            tran('Quick Exit'),
            tran('Are you sure you want to quit the app?'),
            {
                confirmButtonLabel: tran('Yes'),
            },
        ).then((isOk) => {
            if (isOk) {
                window.close();
            }
        });
    };
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
            handleActiveSelectedElementScrolling,
        ),
    );
    const currentLocale = getCurrentLocale();
    const langData = getLangData(currentLocale);
    if (langData === null) {
        throw new Error(`Lang data not found for locale ${currentLocale}`);
    }
    const { fontFamily } = langData;
    if (fontFamily != undefined) {
        document.body.style.fontFamily = fontFamily;
    }

    const root = getReactRoot();
    root.render(<RenderApp>{children}</RenderApp>);

    setTimeout(checkForUpdateSilently, 6e4);
}
