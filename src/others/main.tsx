import './appInit.scss';
import './bootstrap-override.scss';
import './theme-override-dark.scss';
import './theme-override-light.scss';
import './scrollbar.scss';
// Must stay last: it carries the focus ring, which has to out-cascade
// Bootstrap's per-component `outline: 0`. See the note at the top of the file.
import './interaction.scss';

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
import { useAppEffectAsync } from '../helper/appHooks';
import { openGeneralSetting } from '../setting/settingHelpers';
import { useThemeSource } from './themeHelpers';
import { getReactRoot } from './rootHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';
import { checkForAppUpdate } from '../server/updatingAppHelpers';
import { initTitleSoundMeter } from '../helper/titleSoundMeterHelpers';
import { initTouchDragAndDrop } from '../helper/touchDragHelpers';
import { checkAreChildrenOnscreen } from '../app-modal/floatingWidgetHelpers';

const ERROR_DATETIME_SETTING_NAME = 'error-datetime-setting';
const ERROR_DURATION = 1000 * 10; // 10 seconds;

function useCheckSetting() {
    useAppEffectAsync(async () => {
        if (
            appProvider.isMainPage &&
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
    }, []);
}

async function confirmLocalStorageErasing() {
    const isOk = await showAppConfirm(
        tran('Unfixable Error'),
        'We were sorry, local settings are broken, we need to erase local' +
            ' storage and reload the app',
    );
    if (isOk) {
        await appLocalStorage.clear();
    }
    appProvider.reload();
}

// One dialog at a time. `onerror`/`onunhandledrejection` fire once per failure,
// and the failures that reach here arrive in bursts — a render loop raises one
// per attempt. Without this every one of them opened its own confirm on top of
// the last.
let isReloadingConfirmShowing = false;

async function confirmReloading() {
    if (isReloadingConfirmShowing) {
        return;
    }
    isReloadingConfirmShowing = true;
    try {
        // The lock covers the read-compare-write of the timestamp and NOTHING
        // more. It used to be held across the confirm below as well — that is,
        // for as long as it took a human to answer — so the next error in the
        // burst spun on it for 60s and then took the escape hatch in
        // `unlocking`, running CONCURRENTLY with the holder on the very setting
        // the lock exists to serialize.
        const isRepeatedError = await unlocking(
            ERROR_DATETIME_SETTING_NAME,
            () => {
                const oldDatetimeString = getSetting(
                    ERROR_DATETIME_SETTING_NAME,
                );
                if (oldDatetimeString) {
                    const oldDatetime = Number.parseInt(oldDatetimeString);
                    if (Date.now() - oldDatetime < ERROR_DURATION) {
                        return true;
                    }
                }
                setSetting(ERROR_DATETIME_SETTING_NAME, Date.now().toString());
                return false;
            },
        );
        if (isRepeatedError) {
            await confirmLocalStorageErasing();
            return;
        }
        const isOk = await showAppConfirm(
            tran('Reload is needed'),
            tran(
                'We were sorry, Internal process error, you to refresh the app',
            ),
        );
        if (isOk) {
            appProvider.reload();
        }
    } finally {
        isReloadingConfirmShowing = false;
    }
}

function isDomException(error: any) {
    if (typeof error === 'string' && error.startsWith('ResizeObserver')) {
        return true;
    }
    return error instanceof DOMException;
}

async function initMain() {
    globalThis.onunhandledrejection = (promiseError) => {
        // A promise can reject with anything (or nothing); never assume an
        // Error-like reason.
        const reason = promiseError.reason;
        if (reason?.name === 'Canceled') {
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
    await appProvider.init();
}

export function RenderApp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    useCheckSetting();
    const { theme } = useThemeSource();
    return (
        <div id="app" className="app" data-bs-theme={theme}>
            <StrictMode>{children}</StrictMode>
        </div>
    );
}

export async function run(children?: ReactNode) {
    await initMain();
    KeyboardEventListener.onMacQuitting = () => {
        showAppConfirm(
            tran('Quick Exit'),
            tran('Are you sure you want to quit the app?'),
            {
                cancelButtonLabel: 'No',
                confirmButtonLabel: 'Yes',
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
    addDomChangeEventListener(checkAreChildrenOnscreen);
    addDomChangeEventListener(handleFullWidgetView);
    initTitleSoundMeter();
    initTouchDragAndDrop();
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

    if (appProvider.isPagePresenter || appProvider.isPageReader) {
        setTimeout(checkForAppUpdate, 6e4);
    }
    if (children !== undefined) {
        const root = getReactRoot();
        root.render(<RenderApp>{children}</RenderApp>);
    }
}
