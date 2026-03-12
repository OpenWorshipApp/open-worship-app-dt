import { init } from './boot';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import { run } from './others/main';
import HandleAlertComp from './popup-widget/HandleAlertComp';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import { forceReloadAppWindows } from './setting/settingHelpers';
import ToastComp from './toast/ToastComp';

globalThis.addEventListener('beforeunload', () => {
    forceReloadAppWindows();
});

init(async () => {
    // Problem with language object initialization order
    const SettingComp = (await import('./setting/SettingComp')).default;
    run(
        <>
            <SettingComp />
            <TopProgressBarComp />
            <ToastComp />
            <HandleAlertComp />
            <AppContextMenuComp />
        </>,
    );
});
